// Alcances predeterminados por proyecto, personal y fotos en SharePoint (0020). Solo nombres
// ficticios.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Cliente, Reporte } from '../../dominio/esquemas';
import { aGuardado } from '../../dominio/captura';
import { ErrorDatos } from '../bd/cliente';
import { crearClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from './index';

let repos: Repositorios;
let cerritos: Cliente;
let proagro: Cliente;

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	cerritos = await repos.catalogo.guardarCliente({
		clave: 'cerritos-ficticio',
		nombre: 'Cerritos ficticio',
		razonSocial: 'CLIENTE FICTICIO A'
	});
	proagro = await repos.catalogo.guardarCliente({
		clave: 'proagro-ficticio',
		nombre: 'Proagro ficticio',
		razonSocial: 'CLIENTE FICTICIO B'
	});
});

afterAll(async () => {
	await repos.cerrar();
});

async function errorDe(promesa: Promise<unknown>): Promise<ErrorDatos> {
	try {
		await promesa;
	} catch (error) {
		expect(error).toBeInstanceOf(ErrorDatos);
		return error as ErrorDatos;
	}
	throw new Error('Se esperaba un error');
}

const mensajeError = async (promesa: Promise<unknown>) => (await errorDe(promesa)).message;

describe('alcances predeterminados', () => {
	it('da de alta por proyecto, en orden, y lista solo los del proyecto', async () => {
		const catalogo = repos.catalogo;
		const a = await catalogo.guardarAlcancePredeterminado({
			clienteId: cerritos.id,
			tipo: 'alcance',
			grupo: 'Instrumentación',
			texto: 'Verificar la calibración del manómetro'
		});
		const b = await catalogo.guardarAlcancePredeterminado({
			clienteId: cerritos.id,
			tipo: 'norma',
			texto: 'NOM-020-STPS-2011'
		});
		await catalogo.guardarAlcancePredeterminado({
			clienteId: proagro.id,
			tipo: 'alcance',
			texto: 'Limpieza general del área'
		});
		expect(a).toMatchObject({ orden: 1, activo: true, grupo: 'Instrumentación' });
		expect(b.orden).toBe(2);
		const lista = await catalogo.listarAlcancesPredeterminados({ clienteId: cerritos.id });
		// Sin grupo primero; después por grupo y orden de alta.
		expect(lista.map((x) => x.texto)).toEqual([
			'NOM-020-STPS-2011',
			'Verificar la calibración del manómetro'
		]);
	});

	it('rechaza duplicados del mismo tipo en el proyecto aunque cambien acentos y espacios', async () => {
		const catalogo = repos.catalogo;
		expect(
			await mensajeError(
				catalogo.guardarAlcancePredeterminado({
					clienteId: cerritos.id,
					tipo: 'alcance',
					texto: '  verificar la calibracion   del manometro '
				})
			)
		).toBe('Ya existe ese alcance en el proyecto');
		// Otro proyecto u otro tipo sí lo admiten.
		await catalogo.guardarAlcancePredeterminado({
			clienteId: proagro.id,
			tipo: 'alcance',
			texto: 'Verificar la calibración del manómetro'
		});
		await catalogo.guardarAlcancePredeterminado({
			clienteId: cerritos.id,
			tipo: 'nota',
			texto: 'Verificar la calibración del manómetro'
		});
		expect(
			await mensajeError(
				catalogo.guardarAlcancePredeterminado({
					clienteId: cerritos.id,
					tipo: 'alcance',
					texto: ' '
				})
			)
		).toBe('Escriba el texto del alcance');
	});

	it('edita, desactiva y elimina', async () => {
		const catalogo = repos.catalogo;
		const alcance = await catalogo.guardarAlcancePredeterminado({
			clienteId: proagro.id,
			tipo: 'alcance',
			texto: 'Revisión de válvulas'
		});
		const editado = await catalogo.guardarAlcancePredeterminado({
			id: alcance.id,
			tipo: 'alcance',
			texto: 'Revisión de válvulas de seguridad',
			activo: false
		});
		expect(editado).toMatchObject({ clienteId: proagro.id, activo: false, orden: alcance.orden });
		const activos = await catalogo.listarAlcancesPredeterminados({
			clienteId: proagro.id,
			soloActivos: true
		});
		expect(activos.some((a) => a.id === alcance.id)).toBe(false);
		await catalogo.eliminarAlcancePredeterminado(alcance.id);
		expect(await mensajeError(catalogo.eliminarAlcancePredeterminado(alcance.id))).toBe(
			'Alcance predeterminado no encontrado'
		);
	});
});

describe('personal', () => {
	const base = {
		nombre: 'Persona',
		apellidoPaterno: 'Ficticia',
		apellidoMaterno: 'Prueba',
		fechaNacimiento: '1990-05-17',
		correo: null as string | null,
		activo: true
	};

	it('da de alta a un reporteador con proyecto y lo lista', async () => {
		const persona = await repos.personal.guardar({
			...base,
			rol: 'reporteador',
			clienteIds: [proagro.id]
		});
		expect(persona).toMatchObject({ rol: 'reporteador', activo: true });
		expect(persona.proyectos.map((p) => p.nombre)).toEqual(['Proagro ficticio']);
		expect((await repos.personal.listar()).some((p) => p.id === persona.id)).toBe(true);
	});

	it('los roles con proyectos pueden quedar sin ninguno y al administrador no se le guardan', async () => {
		// Desde la 0022 ya no se exige un proyecto: la lista del personal llega sin ellos.
		const sinProyectos = await repos.personal.guardar({
			...base,
			rol: 'lider_operativo',
			clienteIds: []
		});
		expect(sinProyectos.proyectos).toEqual([]);
		const admin = await repos.personal.guardar({
			...base,
			nombre: 'Admin',
			rol: 'administrador',
			clienteIds: [cerritos.id]
		});
		expect(admin.proyectos).toEqual([]);
	});

	it('valida fecha, rol y correo', async () => {
		const persona = { ...base, rol: 'lider_administrativo', clienteIds: [cerritos.id] };
		const guardar = (cambios: Partial<typeof persona>) =>
			mensajeError(repos.personal.guardar({ ...persona, ...cambios }));
		expect(await guardar({ fechaNacimiento: '2999-01-01' })).toBe(
			'Fecha de nacimiento fuera de rango'
		);
		expect(await guardar({ rol: 'capturista' })).toBe('Rol no válido');
		expect(await guardar({ correo: 'sin-arroba' })).toBe('Correo no válido');
		await repos.personal.guardar({ ...persona, correo: 'persona.ficticia@ejemplo.test' });
		expect(await guardar({ correo: 'PERSONA.FICTICIA@ejemplo.test' })).toBe(
			'Ya existe otra persona con ese correo'
		);
	});

	it('edita proyectos y da de baja sin eliminar', async () => {
		const persona = await repos.personal.guardar({
			...base,
			apellidoMaterno: null,
			rol: 'lider_operativo',
			clienteIds: [cerritos.id, proagro.id]
		});
		const baja = await repos.personal.guardar({
			...base,
			id: persona.id,
			apellidoMaterno: null,
			rol: 'lider_operativo',
			activo: false,
			clienteIds: [cerritos.id]
		});
		expect(baja).toMatchObject({ activo: false, apellidoMaterno: null });
		expect(baja.proyectos.map((p) => p.id)).toEqual([cerritos.id]);
		expect((await repos.personal.obtener(persona.id)).activo).toBe(false);
	});
});

describe('fotos en SharePoint', () => {
	const URL_BASE = 'https://ficticio.sharepoint.com/sites/reportes/fotos';
	let reporte: Reporte;

	beforeAll(async () => {
		const contrato = await repos.catalogo.guardarContrato({
			clienteId: cerritos.id,
			numero: 'OC-SP',
			descripcion: null,
			vigenciaInicio: '2026-05-01',
			vigenciaFin: '2027-04-30'
		});
		const sitio = await repos.catalogo.guardarSitio({ clave: 'EM-SP', nombre: 'SITIO' });
		await repos.catalogo.asociarSitio(contrato.id, sitio.id);
		const partida = await repos.catalogo.guardarPartida({
			contratoId: contrato.id,
			sitioId: sitio.id,
			numero: '01',
			actividad: 'Inspección',
			periodicidad: 'mensual',
			cantidadAnual: 12
		});
		reporte = await repos.reportes.insertar({
			partidaId: partida.id,
			periodoMes: '2026-05-01',
			ocurrencia: null,
			titulo: '01.- INSPECCIÓN. MAYO 2026',
			usuario: 'CLIENTE',
			contratoTexto: 'OC',
			sitioTexto: 'EM SITIO',
			periodicidad: 'Mensual',
			tipoMantenimiento: 'Preventivo',
			actividad: 'Inspección',
			numeroPartida: '01',
			objetivo: 'Objetivo',
			introduccion: '',
			conclusiones: 'Sin anomalías',
			disposicionFotos: 'cuadricula',
			incluyeVerificacion: false,
			firmantes: {},
			alcances: [{ titulo: 'Inspección visual', descripcion: 'Revisión' }],
			herramientas: [],
			equipoIds: []
		});
	});

	const foto = (version: number, n: number) => ({
		reporteId: reporte.id,
		alcanceId: reporte.alcances[0].id,
		version,
		almacenamiento: 'sharepoint' as const,
		urlOriginal: `${URL_BASE}/${n}-original.heic`,
		urlOptimizada: `${URL_BASE}/${n}.jpg`,
		ancho: 1600,
		alto: 1200,
		bytes: 1000,
		tipoMime: 'image/heic'
	});

	it('rechaza la foto de SharePoint sin URL y la local sin rutas', async () => {
		const actual = await repos.reportes.obtener(reporte.id);
		const sinUrl = { ...foto(actual.version, 1), urlOptimizada: null };
		expect((await errorDe(repos.reportes.agregarFoto(sinUrl))).tipo).toBe('invalido');
		const local = { ...foto(actual.version, 1), almacenamiento: 'local' as const };
		expect((await errorDe(repos.reportes.agregarFoto(local))).tipo).toBe('invalido');
	});

	it('guarda solo la URL, la devuelve y no deja rutas que limpiar al quitarla', async () => {
		const actual = await repos.reportes.obtener(reporte.id);
		const { foto: guardada } = await repos.reportes.agregarFoto(foto(actual.version, 2));
		expect(guardada).toMatchObject({
			almacenamiento: 'sharepoint',
			urlOptimizada: `${URL_BASE}/2.jpg`,
			rutaOriginal: null,
			rutaOptimizada: null
		});
		const leido = await repos.reportes.obtener(reporte.id);
		expect(leido.alcances[0].fotos[0].urlOriginal).toBe(`${URL_BASE}/2-original.heic`);
		const guardado = aGuardado(leido);
		guardado.alcances[0].fotos = [];
		expect((await repos.reportes.guardar(guardado)).fotosEliminadas).toEqual([]);
	});

	it('la revisión de un emitido copia las fotos de SharePoint con su giro', async () => {
		const actual = await repos.reportes.obtener(reporte.id);
		await repos.reportes.agregarFoto(foto(actual.version, 3));
		const conFoto = await repos.reportes.obtener(reporte.id);
		const guardado = {
			...aGuardado(conFoto),
			diasEjecucion: [{ desde: '2026-05-15', hasta: '2026-05-15' }]
		};
		guardado.alcances[0].fotos = guardado.alcances[0].fotos.map((f) => ({ ...f, rotacion: 90 }));
		const { reporte: listo } = await repos.reportes.guardar(guardado);
		const enRevision = await repos.reportes.cambiarEstado(listo.id, listo.version, 'en_revision');
		const emitido = await repos.reportes.cambiarEstado(
			enRevision.id,
			enRevision.version,
			'emitido'
		);
		const revision = await repos.reportes.crearRevision(emitido.id);
		expect(revision.alcances[0].fotos[0]).toMatchObject({
			almacenamiento: 'sharepoint',
			urlOptimizada: `${URL_BASE}/3.jpg`,
			rotacion: 90
		});
	});
});
