// «Capturar actividad» sobre PGlite (cambio capturar-actividad): opciones, registro de realizada y no
// realizada, fecha de hoy por omisión, nada pendiente, alcance y permisos. Solo datos ficticios.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { estadoEjecucion } from '$lib/dominio/cumplimiento';
import type { RolPersonal } from '$lib/dominio/esquemas';
import { decidirAcceso } from '$lib/server/autenticacion/acceso';
import { crearClientePglite, type ClientePglite } from '$lib/server/bd/pglite';
import { crearRepositorios, type Repositorios } from '$lib/server/repositorios/index';

const HOY = '2026-11-21';
let cliente: ClientePglite;
let repos: Repositorios;
vi.mock('$lib/server/datos', () => ({ datos: async () => repos }));
vi.mock('$lib/dominio/fechas', async (original) => ({
	...(await original<typeof import('$lib/dominio/fechas')>()),
	fechaEnZona: () => HOY
}));

const { GET, POST } = await import('./+server');

let sitio: string;
let sinPrograma: string;
let programa: string;
let partida: string;
let personas: string[];

beforeAll(async () => {
	cliente = await crearClientePglite();
	repos = crearRepositorios(cliente);
	const c = await repos.catalogo.guardarCliente({
		clave: 'act',
		nombre: 'act',
		razonSocial: 'CLIENTE ACT'
	});
	const contrato = await repos.catalogo.guardarContrato({
		clienteId: c.id,
		numero: 'OC-ACT',
		descripcion: null,
		vigenciaInicio: '2026-05-01',
		vigenciaFin: '2027-04-30'
	});
	sitio = (await repos.catalogo.guardarSitio({ clave: 'EM-ACT-1', nombre: 'SITIO' })).id;
	sinPrograma = (await repos.catalogo.guardarSitio({ clave: 'EM-ACT-2', nombre: 'OTRO' })).id;
	await repos.catalogo.asociarSitio(contrato.id, sitio);
	partida = (
		await repos.catalogo.guardarPartida({
			contratoId: contrato.id,
			sitioId: sitio,
			numero: '7',
			actividad: 'Toma de potenciales',
			periodicidad: 'mensual',
			objetivo: 'Objetivo',
			conclusionesBase: 'Conclusiones',
			alcances: [{ tipo: 'alcance', texto: 'Alcance' }]
		})
	).id;
	programa = (
		await repos.programa.guardarPrograma({
			contratoId: contrato.id,
			sitioId: sitio,
			periodoInicio: '2026-05-01',
			periodoFin: '2027-04-30'
		})
	).id;
	await repos.programa.guardarMeses(programa, [
		{ partidaId: partida, mes: '2026-10-01', cantidad: 1 },
		{ partidaId: partida, mes: '2026-11-01', cantidad: 1 }
	]);
	const alta = (nombre: string, activo = true) =>
		repos.personal.guardar({
			nombre,
			apellidoPaterno: 'Prueba',
			apellidoMaterno: null,
			fechaNacimiento: null,
			correo: null,
			rol: 'reporteador',
			activo,
			centroCostoIds: [sitio]
		});
	personas = [(await alta('Ana')).id, (await alta('Beto')).id, (await alta('Inactiva', false)).id];
}, 60_000);
afterAll(() => repos.cerrar());

function locales(rol: RolPersonal | null, centrosCosto: string[] | null = null) {
	return rol
		? { autenticacion: true, usuario: { id: 'x', nombre: 'Ficticio', rol, centrosCosto } }
		: { autenticacion: false, usuario: null };
}

async function consultar(consulta = '', locals = locales(null)) {
	const url = new URL(`http://localhost/actividades${consulta}`);
	return (await GET({ locals, url } as never)).json();
}

async function registrar(cuerpo: object, locals = locales(null)) {
	const url = new URL('http://localhost/actividades');
	const request = new Request(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(cuerpo)
	});
	const respuesta = await POST({ locals, url, request } as never);
	return { estado: respuesta.status, datos: await respuesta.json() };
}

async function celda(mes: string) {
	const avance = await repos.programa.obtenerAvance(programa);
	return avance.partidas.find((p) => p.id === partida)!.celdas.find((c) => c.mes === mes)!;
}

describe('/actividades', () => {
	it('da los centros con su programa, el personal activo y las partidas con lo que falta', async () => {
		const opciones = await consultar();
		expect(opciones.hoy).toBe(HOY);
		const centros = opciones.centros as { id: string; programa: { id: string } | null }[];
		expect(centros.find((c) => c.id === sitio)?.programa?.id).toBe(programa);
		expect(centros.find((c) => c.id === sinPrograma)?.programa).toBeNull();
		const nombres = (opciones.personal as { nombre: string }[]).map((p) => p.nombre);
		expect(nombres).toEqual(expect.arrayContaining(['Ana Prueba', 'Beto Prueba']));
		expect(nombres).not.toContain('Inactiva Prueba');

		const { partidas } = await consultar(`?centro=${sitio}`);
		expect(partidas).toEqual([
			expect.objectContaining({
				id: partida,
				numero: '7',
				faltan: { '2026-10-01': 1, '2026-11-01': 1 }
			})
		]);
	});

	it('registra la realizada con la fecha de hoy por omisión y sus personas', async () => {
		const { estado, datos } = await registrar({
			programaId: programa,
			partidaId: partida,
			realizada: true,
			fecha: '',
			personalIds: personas.slice(0, 2)
		});
		expect(estado).toBe(200);
		expect(datos).toMatchObject({ tipo: 'realizada', fecha: HOY, mes: '2026-11-01' });
		expect(estadoEjecucion(await celda('2026-11-01'), HOY)).toBe('ejecutado');
		const filas = await cliente.bd.query<{ personal_id: string }>(
			'select personal_id from public.programa_marca_personal where marca_id = $1',
			[datos.id]
		);
		expect(filas.rows.map((f) => f.personal_id).sort()).toEqual(personas.slice(0, 2).sort());
	});

	it('rechaza un mes sin nada pendiente, una fecha futura y personas inactivas', async () => {
		const base = { programaId: programa, partidaId: partida, realizada: true };
		const completo = await registrar({ ...base, fecha: '2026-11-05' });
		expect(completo).toMatchObject({
			estado: 400,
			datos: { error: expect.stringMatching(/falta/) }
		});
		const futura = await registrar({ ...base, fecha: '2026-11-30' });
		expect(futura).toMatchObject({
			estado: 400,
			datos: { error: 'La fecha no puede ser posterior a hoy.' }
		});
		const inactiva = await registrar({ ...base, fecha: '2026-10-10', personalIds: [personas[2]] });
		expect(inactiva).toMatchObject({
			estado: 400,
			datos: { error: expect.stringMatching(/activa/) }
		});
		expect((await celda('2026-10-01')).realizado).toBe(0);
	});

	it('registra la no realizada como «No ejecutado» en el mes de la fecha', async () => {
		const { estado, datos } = await registrar({
			programaId: programa,
			partidaId: partida,
			realizada: false,
			fecha: '2026-10-15'
		});
		expect(estado).toBe(200);
		expect(datos).toMatchObject({ tipo: 'no_realizada', mes: '2026-10-01' });
		const octubre = await celda('2026-10-01');
		expect(octubre.ajustes).toEqual([
			expect.objectContaining({ tipo: 'no_ejecutado', motivo: 'otro', cantidad: 1 })
		]);
		expect(estadoEjecucion(octubre, HOY)).toBe('no_ejecutado');
	});

	it('limita al alcance del centro de costo y exige la capacidad de capturar', async () => {
		const ajeno = locales('reporteador', [sinPrograma]);
		await expect(consultar(`?centro=${sitio}`, ajeno)).rejects.toMatchObject({ status: 404 });
		const visibles = (await consultar('', ajeno)).centros as { id: string }[];
		expect(visibles.map((c) => c.id)).toEqual([sinPrograma]);
		await expect(
			registrar({ programaId: programa, partidaId: partida, realizada: true }, ajeno)
		).rejects.toMatchObject({ status: 404 });

		const contexto = (rol: RolPersonal) => ({
			activada: true,
			usuario: { id: 'x', nombre: 'Ficticio', rol, centrosCosto: null, debeCambiar: false }
		});
		const peticion = { ruta: '/actividades', busqueda: '', metodo: 'POST', navegacion: false };
		expect(decidirAcceso(contexto('reporteador') as never, peticion)).toEqual({ tipo: 'permitir' });
		expect(decidirAcceso(contexto('mesa_directiva') as never, peticion)).toMatchObject({
			tipo: 'rechazar',
			estado: 403
		});
	});
});
