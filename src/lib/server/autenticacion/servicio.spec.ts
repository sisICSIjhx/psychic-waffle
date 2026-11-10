// Casos de uso del acceso sobre PGlite, con contraseñas reales resumidas con scrypt. Solo nombres y
// correos ficticios.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Personal, RolPersonal } from '../../dominio/esquemas';
import { crearClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from '../repositorios/index';
import { contextoDeAcceso, olvidarContextos } from './contexto';
import {
	activarInicioSesion,
	cambiarContrasena,
	cerrarSesion,
	generarContrasenaDe,
	iniciarSesion,
	LimiteIntentos,
	MENSAJE_BLOQUEO,
	MENSAJE_CREDENCIALES,
	MENSAJE_LIMITE,
	quitarAcceso
} from './servicio';

let repos: Repositorios;
let administrador: Personal;
let numero = 0;

const CONTRASENA = 'contraseña del administrador';

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	administrador = await alta('administrador');
}, 60_000);

afterAll(() => repos.cerrar());

function alta(rol: RolPersonal, extra: Record<string, unknown> = {}) {
	numero++;
	return repos.personal.guardar({
		nombre: `Persona${numero}`,
		apellidoPaterno: 'Ficticia',
		apellidoMaterno: null,
		fechaNacimiento: null,
		correo: `persona${numero}@ficticio.test`,
		rol,
		activo: true,
		clienteIds: [],
		...extra
	});
}

const entrar = (correo: string, contrasena: string, limite = new LimiteIntentos()) =>
	iniciarSesion(repos, { correo, contrasena, direccion: '10.0.0.1' }, limite);

const usuarioDe = async (token: string) => {
	olvidarContextos();
	return (await contextoDeAcceso(repos.autenticacion, token)).usuario;
};

describe('activación', () => {
	it('rechaza contraseñas no válidas y a quien no es administrador', async () => {
		const reporteador = await alta('reporteador');
		expect(
			await activarInicioSesion(repos, {
				personalId: reporteador.id,
				contrasena: CONTRASENA,
				confirmacion: CONTRASENA
			})
		).toEqual({ ok: false, mensaje: 'La primera cuenta debe ser de un administrador' });
		expect(
			await activarInicioSesion(repos, {
				personalId: administrador.id,
				contrasena: CONTRASENA,
				confirmacion: 'otra distinta 123'
			})
		).toEqual({ ok: false, mensaje: 'La contraseña y su confirmación no coinciden.' });
		expect(
			await activarInicioSesion(repos, {
				personalId: administrador.id,
				contrasena: 'corta',
				confirmacion: 'corta'
			})
		).toMatchObject({ ok: false, mensaje: expect.stringMatching(/al menos 10/) });
		expect((await repos.autenticacion.contexto(null, 720)).activada).toBe(false);
	});

	it('crea la cuenta del administrador con la sesión iniciada y ya no se repite', async () => {
		const resultado = await activarInicioSesion(repos, {
			personalId: administrador.id,
			contrasena: CONTRASENA,
			confirmacion: CONTRASENA
		});
		if (!resultado.ok) throw new Error(resultado.mensaje);
		expect(resultado.usuario).toMatchObject({ id: administrador.id, debeCambiar: false });
		expect(await usuarioDe(resultado.token)).toMatchObject({ id: administrador.id });
		expect((await repos.autenticacion.contexto(null, 720)).activada).toBe(true);

		expect(
			await activarInicioSesion(repos, {
				personalId: administrador.id,
				contrasena: CONTRASENA,
				confirmacion: CONTRASENA
			})
		).toEqual({ ok: false, mensaje: 'El inicio de sesión ya está activado.' });
	});
});

describe('entrada', () => {
	it('entra con el correo en cualquier forma y la contraseña correcta', async () => {
		const resultado = await entrar(`  ${administrador.correo!.toUpperCase()}  `, CONTRASENA);
		if (!resultado.ok) throw new Error(resultado.mensaje);
		expect(resultado.usuario.rol).toBe('administrador');
		expect(await usuarioDe(resultado.token)).not.toBeNull();
		await cerrarSesion(repos, resultado.token);
		expect(await usuarioDe(resultado.token)).toBeNull();
	});

	it('da el mismo mensaje para correo desconocido, contraseña incorrecta, baja y sin cuenta', async () => {
		const sinCuenta = await alta('reporteador');
		const deBaja = await alta('reporteador');
		const { temporal } = await generarContrasenaDe(repos, deBaja.id);
		await repos.personal.guardar({ ...entrada(deBaja), activo: false });

		const rechazo = { ok: false, motivo: 'credenciales', mensaje: MENSAJE_CREDENCIALES };
		expect(await entrar('nadie@ficticio.test', CONTRASENA)).toEqual(rechazo);
		expect(await entrar(administrador.correo!, 'contraseña equivocada')).toEqual(rechazo);
		expect(await entrar(sinCuenta.correo!, CONTRASENA)).toEqual(rechazo);
		expect(await entrar(deBaja.correo!, temporal)).toEqual(rechazo);
		expect(await entrar('', '')).toEqual(rechazo);
		expect(await entrar(administrador.correo!, 'x'.repeat(5000))).toEqual(rechazo);
	});

	it('bloquea al quinto fallo y ni la contraseña correcta entra durante el bloqueo', async () => {
		const persona = await alta('lider_operativo');
		const { temporal } = await generarContrasenaDe(repos, persona.id);
		for (let intento = 1; intento <= 4; intento++) {
			expect(await entrar(persona.correo!, 'equivocada')).toMatchObject({ motivo: 'credenciales' });
		}
		const bloqueo = { ok: false, motivo: 'bloqueada', mensaje: MENSAJE_BLOQUEO };
		expect(await entrar(persona.correo!, 'equivocada')).toEqual(bloqueo);
		expect(await entrar(persona.correo!, temporal)).toEqual(bloqueo);
		// Otra contraseña temporal levanta el bloqueo.
		const nueva = await generarContrasenaDe(repos, persona.id);
		expect(await entrar(persona.correo!, nueva.temporal)).toMatchObject({ ok: true });
	});

	it('limita los intentos por dirección de red sea cual sea el correo', async () => {
		const limite = new LimiteIntentos(3, 60_000);
		for (let intento = 1; intento <= 3; intento++) {
			expect(await entrar(`nadie${intento}@ficticio.test`, 'x', limite)).toMatchObject({
				motivo: 'credenciales'
			});
		}
		expect(await entrar(administrador.correo!, CONTRASENA, limite)).toEqual({
			ok: false,
			motivo: 'limite',
			mensaje: MENSAJE_LIMITE
		});
		// Otra dirección no se ve afectada, y la ventana se renueva con el tiempo.
		expect(limite.permitir('10.0.0.2')).toBe(true);
		expect(limite.permitir('10.0.0.1', Date.now() + 61_000)).toBe(true);
	});
});

describe('contraseña temporal y cambio', () => {
	it('la temporal obliga a cambiar y el cambio conserva la sesión y cierra las demás', async () => {
		const persona = await alta('reporteador');
		const { temporal, persona: conCuenta } = await generarContrasenaDe(repos, persona.id);
		expect(conCuenta.acceso?.debeCambiar).toBe(true);

		const propia = await entrar(persona.correo!, temporal);
		const ajena = await entrar(persona.correo!, temporal);
		if (!propia.ok || !ajena.ok) throw new Error('No entró con la contraseña temporal');
		expect(propia.usuario.debeCambiar).toBe(true);

		const cambiar = (datos: { actual: string; nueva: string; confirmacion: string }) =>
			cambiarContrasena(repos, propia.usuario, datos, propia.token);
		const nueva = 'mi contraseña nueva';
		expect(await cambiar({ actual: temporal, nueva, confirmacion: 'otra cosa distinta' })).toEqual({
			ok: false,
			mensaje: 'La contraseña nueva y su confirmación no coinciden.'
		});
		expect(
			await cambiar({ actual: temporal, nueva: 'corta', confirmacion: 'corta' })
		).toMatchObject({
			ok: false
		});
		expect(
			await cambiar({ actual: temporal, nueva: persona.correo!, confirmacion: persona.correo! })
		).toEqual({ ok: false, mensaje: 'La contraseña no puede ser el correo.' });
		expect(await cambiar({ actual: 'no es la actual', nueva, confirmacion: nueva })).toEqual({
			ok: false,
			mensaje: 'La contraseña actual no es correcta.'
		});
		expect(await cambiar({ actual: temporal, nueva: temporal, confirmacion: temporal })).toEqual({
			ok: false,
			mensaje: 'La contraseña nueva debe ser distinta de la actual.'
		});

		expect(await cambiar({ actual: temporal, nueva, confirmacion: nueva })).toEqual({ ok: true });
		expect(await usuarioDe(propia.token)).toMatchObject({ debeCambiar: false });
		expect(await usuarioDe(ajena.token)).toBeNull();
		expect(await entrar(persona.correo!, temporal)).toMatchObject({ ok: false });
		expect(await entrar(persona.correo!, nueva)).toMatchObject({ ok: true });
	});

	it('quitar el acceso cierra la sesión y la persona ya no entra', async () => {
		const persona = await alta('lider_administrativo');
		const { temporal } = await generarContrasenaDe(repos, persona.id);
		const sesion = await entrar(persona.correo!, temporal);
		if (!sesion.ok) throw new Error(sesion.mensaje);
		expect((await quitarAcceso(repos, persona.id)).acceso).toBeNull();
		expect(await usuarioDe(sesion.token)).toBeNull();
		expect(await entrar(persona.correo!, temporal)).toMatchObject({ motivo: 'credenciales' });
	});
});

describe('caché del contexto', () => {
	it('reutiliza la consulta unos segundos y se vacía al cambiar las cuentas', async () => {
		const sesion = await entrar(administrador.correo!, CONTRASENA);
		if (!sesion.ok) throw new Error(sesion.mensaje);
		const ahora = Date.now();
		const primero = await contextoDeAcceso(repos.autenticacion, sesion.token, ahora);
		// Cerrada directamente en la base (otro proceso): la caché aún la da por válida…
		await repos.autenticacion.cerrarSesion(
			(await import('./sesiones')).resumenDeToken(sesion.token)
		);
		expect(await contextoDeAcceso(repos.autenticacion, sesion.token, ahora + 5_000)).toBe(primero);
		// …hasta que caduca.
		expect(
			(await contextoDeAcceso(repos.autenticacion, sesion.token, ahora + 11_000)).usuario
		).toBeNull();
	});
});

function entrada(persona: Personal) {
	return {
		id: persona.id,
		nombre: persona.nombre,
		apellidoPaterno: persona.apellidoPaterno,
		apellidoMaterno: persona.apellidoMaterno,
		fechaNacimiento: persona.fechaNacimiento,
		correo: persona.correo,
		rol: persona.rol,
		activo: persona.activo,
		clienteIds: []
	};
}
