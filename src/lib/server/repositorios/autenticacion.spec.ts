// Cuentas, sesiones y carga del personal sobre PGlite (0022). Solo nombres y correos ficticios.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CentroCosto, Personal, RolPersonal } from '../../dominio/esquemas';
import { resumenDeToken } from '../autenticacion/sesiones';
import { ErrorDatos } from '../bd/cliente';
import { crearClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from './index';

let repos: Repositorios;
let centro: CentroCosto;
let numero = 0;

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	centro = await repos.centrosCosto.guardar({
		clave: 'EM-90001',
		nombre: 'Centro ficticio',
		plantillaId: null
	});
}, 60_000);

afterAll(() => repos.cerrar());

/** Da de alta a una persona ficticia; el correo es único salvo que se indique. */
function alta(rol: RolPersonal, datos: Partial<Parameters<typeof guardar>[0]> = {}) {
	numero++;
	return guardar({
		nombre: `Persona${numero}`,
		apellidoPaterno: 'Ficticia',
		apellidoMaterno: null,
		fechaNacimiento: null,
		correo: `persona${numero}@ficticio.test`,
		rol,
		activo: true,
		centroCostoIds: [],
		...datos
	});
}

function guardar(persona: Parameters<Repositorios['personal']['guardar']>[0]) {
	return repos.personal.guardar(persona);
}

const edicion = (persona: Personal, cambios: Record<string, unknown> = {}) => ({
	id: persona.id,
	nombre: persona.nombre,
	apellidoPaterno: persona.apellidoPaterno,
	apellidoMaterno: persona.apellidoMaterno,
	fechaNacimiento: persona.fechaNacimiento,
	correo: persona.correo,
	sede: persona.sede,
	rol: persona.rol,
	activo: persona.activo,
	centroCostoIds: persona.centrosCosto.map((c) => c.id),
	...cambios
});

async function mensajeDe(promesa: Promise<unknown>): Promise<string> {
	try {
		await promesa;
	} catch (error) {
		expect(error).toBeInstanceOf(ErrorDatos);
		return (error as ErrorDatos).message;
	}
	throw new Error('Se esperaba un error');
}

const cuenta = (personalId: string, extra: Record<string, unknown> = {}) =>
	repos.autenticacion.establecerContrasena({
		personalId,
		hash: 'scrypt$ficticio',
		debeCambiar: true,
		...extra
	});

const abrir = (personalId: string, token: string, duracionMinutos = 60) =>
	repos.autenticacion.abrirSesion({
		personalId,
		tokenHash: resumenDeToken(token),
		duracionMinutos
	});

const usuarioDe = async (token: string, inactividad = 720) =>
	(await repos.autenticacion.contexto(resumenDeToken(token), inactividad)).usuario;

describe('personal con la 0022', () => {
	it('guarda la sede, admite no tener fecha de nacimiento ni centros de costo y valida la fecha', async () => {
		const persona = await alta('reporteador', { sede: 'Sede ficticia' });
		expect(persona).toMatchObject({
			sede: 'Sede ficticia',
			fechaNacimiento: null,
			centrosCosto: [],
			acceso: null
		});
		expect(await mensajeDe(guardar(edicion(persona, { fechaNacimiento: '2999-01-01' })))).toBe(
			'Fecha de nacimiento fuera de rango'
		);
		// Quien no envía la sede la conserva.
		const sinSede = edicion(persona, { centroCostoIds: [centro.id] }) as Record<string, unknown>;
		delete sinSede.sede;
		expect(await guardar(sinSede as never)).toMatchObject({
			sede: 'Sede ficticia',
			centrosCosto: [{ id: centro.id }]
		});
	});

	it('mesa directiva y contabilidad no guardan centros de costo', async () => {
		for (const rol of ['mesa_directiva', 'contabilidad'] as const) {
			expect((await alta(rol, { centroCostoIds: [centro.id] })).centrosCosto).toEqual([]);
		}
		expect(await mensajeDe(alta('direccion' as RolPersonal))).toBe('Rol no válido');
	});
});

describe('cuentas', () => {
	let administrador: Personal;

	it('sin cuentas el inicio de sesión no está activado', async () => {
		expect(await repos.autenticacion.contexto(null, 720)).toEqual({
			activada: false,
			usuario: null
		});
		expect(await repos.autenticacion.credencialDeCorreo('nadie@ficticio.test')).toBeNull();
	});

	it('la primera cuenta debe ser de un administrador activo con correo', async () => {
		const reporteador = await alta('reporteador');
		expect(await mensajeDe(cuenta(reporteador.id))).toBe(
			'La primera cuenta debe ser de un administrador'
		);
		const sinCorreo = await alta('administrador', { correo: null });
		expect(await mensajeDe(cuenta(sinCorreo.id))).toBe('Registre primero el correo de la persona');
		const deBaja = await alta('administrador', { activo: false });
		expect(await mensajeDe(cuenta(deBaja.id))).toBe('La persona está dada de baja');
		expect((await repos.autenticacion.contexto(null, 720)).activada).toBe(false);

		administrador = await alta('administrador');
		const conCuenta = await cuenta(administrador.id);
		expect(conCuenta.acceso).toEqual({
			debeCambiar: true,
			bloqueadaHasta: null,
			ultimoAccesoEn: null
		});
		expect((await repos.autenticacion.contexto(null, 720)).activada).toBe(true);
		// Ya activado, cualquier persona activa con correo puede tener cuenta.
		expect((await cuenta(reporteador.id)).acceso).not.toBeNull();
	});

	it('busca la credencial por correo sin distinguir mayúsculas ni espacios', async () => {
		const credencial = await repos.autenticacion.credencialDeCorreo(
			`  ${administrador.correo?.toUpperCase()} `
		);
		expect(credencial).toMatchObject({
			personalId: administrador.id,
			hash: 'scrypt$ficticio',
			activo: true,
			bloqueadaHasta: null
		});
	});

	it('abre, reconoce y cierra una sesión', async () => {
		const usuario = await abrir(administrador.id, 'sesion-a');
		expect(usuario).toMatchObject({
			id: administrador.id,
			nombre: `${administrador.nombre} Ficticia`,
			correo: administrador.correo,
			rol: 'administrador',
			debeCambiar: true
		});
		expect(await usuarioDe('sesion-a')).toEqual(usuario);
		expect(await usuarioDe('otra-cookie')).toBeNull();
		expect((await repos.personal.obtener(administrador.id)).acceso?.ultimoAccesoEn).not.toBeNull();

		expect(await repos.autenticacion.cerrarSesion(resumenDeToken('sesion-a'))).toBe(true);
		expect(await usuarioDe('sesion-a')).toBeNull();
		expect(await repos.autenticacion.cerrarSesion(resumenDeToken('sesion-a'))).toBe(false);
	});

	it('una sesión caducada o sin uso reciente no vale', async () => {
		await abrir(administrador.id, 'sesion-caducada', 0);
		expect(await usuarioDe('sesion-caducada')).toBeNull();
		await abrir(administrador.id, 'sesion-inactiva');
		expect(await usuarioDe('sesion-inactiva', 0)).toBeNull();
		expect(await usuarioDe('sesion-inactiva')).not.toBeNull();
	});

	it('bloquea la cuenta al quinto fallo y la entrada correcta reinicia el contador', async () => {
		const fallar = () => repos.autenticacion.registrarAccesoFallido(administrador.id, 5, 15);
		for (let intento = 1; intento <= 3; intento++) {
			expect(await fallar()).toEqual({ intentosFallidos: intento, bloqueadaHasta: null });
		}
		await abrir(administrador.id, 'sesion-reinicio');
		expect(await fallar()).toEqual({ intentosFallidos: 1, bloqueadaHasta: null });
		for (let intento = 2; intento <= 4; intento++) await fallar();
		const quinto = await fallar();
		expect(quinto.intentosFallidos).toBe(0);
		expect(quinto.bloqueadaHasta).not.toBeNull();
		expect(
			(await repos.autenticacion.credencialDeCorreo(administrador.correo!))?.bloqueadaHasta
		).not.toBeNull();
		expect((await repos.personal.obtener(administrador.id)).acceso?.bloqueadaHasta).not.toBeNull();
		// Una contraseña nueva levanta el bloqueo.
		expect((await cuenta(administrador.id)).acceso?.bloqueadaHasta).toBeNull();
	});

	it('cambiar la contraseña cierra las demás sesiones y conserva la indicada', async () => {
		await abrir(administrador.id, 'sesion-propia');
		await abrir(administrador.id, 'sesion-ajena');
		const persona = await cuenta(administrador.id, {
			hash: 'scrypt$nuevo',
			debeCambiar: false,
			conservarTokenHash: resumenDeToken('sesion-propia')
		});
		expect(persona.acceso?.debeCambiar).toBe(false);
		expect(await usuarioDe('sesion-propia')).toMatchObject({ debeCambiar: false });
		expect(await usuarioDe('sesion-ajena')).toBeNull();
		expect((await repos.autenticacion.credencialDeCorreo(administrador.correo!))?.hash).toBe(
			'scrypt$nuevo'
		);
	});

	it('no deja sin acceso al último administrador', async () => {
		const ultimo = 'Debe quedar al menos un administrador con acceso';
		expect(await mensajeDe(repos.autenticacion.quitarAcceso(administrador.id))).toBe(ultimo);
		expect(await mensajeDe(guardar(edicion(administrador, { activo: false })))).toBe(ultimo);
		expect(await mensajeDe(guardar(edicion(administrador, { rol: 'reporteador' })))).toBe(ultimo);
		expect(await mensajeDe(guardar(edicion(administrador, { correo: null })))).toBe(
			'Quite primero el acceso de la persona para dejarla sin correo'
		);

		// Con otro administrador con cuenta, el primero ya puede cambiar de rol.
		const segundo = await alta('administrador');
		await cuenta(segundo.id);
		expect((await guardar(edicion(administrador, { rol: 'lider_operativo' }))).rol).toBe(
			'lider_operativo'
		);
		expect(await mensajeDe(repos.autenticacion.quitarAcceso(segundo.id))).toBe(ultimo);
		administrador = segundo;
	});

	it('la baja cierra las sesiones y quitar el acceso elimina la cuenta', async () => {
		const persona = await alta('lider_operativo');
		await cuenta(persona.id);
		await abrir(persona.id, 'sesion-baja');
		expect(await usuarioDe('sesion-baja')).not.toBeNull();
		await guardar(edicion(persona, { activo: false }));
		expect(await usuarioDe('sesion-baja')).toBeNull();
		expect(await mensajeDe(abrir(persona.id, 'sesion-de-baja'))).toBe('La persona no tiene acceso');

		const otra = await alta('reporteador');
		await cuenta(otra.id);
		await abrir(otra.id, 'sesion-quitar');
		expect((await repos.autenticacion.quitarAcceso(otra.id)).acceso).toBeNull();
		expect(await usuarioDe('sesion-quitar')).toBeNull();
		expect(await repos.autenticacion.credencialDeCorreo(otra.correo!)).toBeNull();
	});
});

describe('carga del personal', () => {
	const personas = [
		{
			linea: 1,
			nombre: 'ANA DEL CARMEN',
			apellidoPaterno: 'RUIZ',
			apellidoMaterno: 'LÓPEZ',
			sede: 'SEDE UNO',
			correo: 'Ana.Ruiz@ficticio.test'
		},
		{
			linea: 2,
			nombre: 'LUIS',
			apellidoPaterno: 'RAMOS',
			apellidoMaterno: null,
			sede: null,
			correo: 'luis.ramos@ficticio.test'
		},
		{
			linea: 3,
			nombre: 'OTRA',
			apellidoPaterno: 'ANA',
			apellidoMaterno: null,
			sede: null,
			correo: 'ana.ruiz@ficticio.test'
		},
		{
			linea: 4,
			nombre: 'SIN',
			apellidoPaterno: 'DOMINIO',
			apellidoMaterno: null,
			sede: null,
			correo: 'sin-dominio'
		},
		{
			linea: 5,
			nombre: 'SOLA',
			apellidoPaterno: '',
			apellidoMaterno: null,
			sede: null,
			correo: null
		}
	];

	it('el ensayo informa sin guardar y aplicar da de alta solo a quienes faltan', async () => {
		const antes = (await repos.personal.listar()).length;
		const ensayo = await repos.personal.importar(personas);
		expect(ensayo).toMatchObject({
			ensayo: true,
			resumen: { nuevas: 2, existentes: 0, invalidas: 3 }
		});
		expect(ensayo.filas.map((f) => [f.linea, f.estado, f.motivo])).toEqual([
			[1, 'nueva', null],
			[2, 'nueva', null],
			[3, 'invalida', 'Correo repetido en el archivo'],
			[4, 'invalida', 'Correo no válido'],
			[5, 'invalida', 'Falta el nombre o el apellido']
		]);
		expect((await repos.personal.listar()).length).toBe(antes);

		expect((await repos.personal.importar(personas, false)).resumen).toEqual({
			nuevas: 2,
			existentes: 0,
			invalidas: 3
		});
		const lista = await repos.personal.listar();
		expect(lista.length).toBe(antes + 2);
		expect(lista.find((p) => p.correo === 'ana.ruiz@ficticio.test')).toMatchObject({
			nombre: 'ANA DEL CARMEN',
			apellidoPaterno: 'RUIZ',
			apellidoMaterno: 'LÓPEZ',
			sede: 'SEDE UNO',
			rol: 'reporteador',
			activo: true,
			centrosCosto: [],
			acceso: null
		});

		// Aplicar de nuevo no duplica a nadie.
		expect((await repos.personal.importar(personas, false)).resumen).toEqual({
			nuevas: 0,
			existentes: 2,
			invalidas: 3
		});
		expect((await repos.personal.listar()).length).toBe(antes + 2);
	});
});
