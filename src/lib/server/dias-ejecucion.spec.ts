import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aGuardado } from '../dominio/captura';
import type { Reporte } from '../dominio/esquemas';
import { AlmacenamientoLocal } from './almacenamiento';
import { ErrorDatos } from './bd/cliente';
import { aplicarMigraciones, leerMigraciones } from './bd/migraciones';
import { crearClientePglite, type ClientePglite } from './bd/pglite';
import { ServicioCaptura } from './captura';
import { crearRepositorios, type Repositorios } from './repositorios/index';

const dias = (...segmentos: [number, number?][]) =>
	segmentos.map(([desde, hasta = desde]) => ({
		desde: `2026-05-${String(desde).padStart(2, '0')}`,
		hasta: `2026-05-${String(hasta).padStart(2, '0')}`
	}));
const FIRMAS = {
	elaboro: { nombre: 'Uno', cargo: '', empresa: '' },
	aprobo: { nombre: 'Dos', cargo: '', empresa: '' },
	recibio: { nombre: 'Tres', cargo: '', empresa: '' }
};

async function base(repos: Repositorios, periodicidad: 'mensual' | 'diaria', clave: string) {
	const cliente = await repos.catalogo.guardarCliente({
		clave,
		nombre: clave,
		razonSocial: 'CLIENTE FICTICIO'
	});
	// Directo a la base: la prueba del relleno de 0016 crea estos datos antes de 0018, cuyo JSON trae
	// el actualizadoEn que el repositorio exige.
	const sql = (repos.catalogo as unknown as { sql: ClientePglite }).sql;
	const contrato = (await sql.llamar('api_guardar_contrato', {
		clienteId: cliente.id,
		numero: `OC-${clave}`,
		descripcion: null,
		vigenciaInicio: '2026-05-01',
		vigenciaFin: '2027-04-30'
	})) as { id: string };
	const sitio = (await sql.llamar('api_guardar_sitio', {
		clave: `EM-${clave}`,
		nombre: 'SITIO'
	})) as { id: string };
	await repos.catalogo.asociarSitio(contrato.id, sitio.id);
	const partida = await repos.catalogo.guardarPartida({
		contratoId: contrato.id,
		sitioId: sitio.id,
		numero: '33',
		actividad: 'Recorrido ficticio',
		periodicidad,
		objetivo: 'Objetivo',
		conclusionesBase: 'Conclusiones',
		alcances: [{ tipo: 'alcance', texto: 'Alcance' }]
	});
	return { contrato, sitio, partida };
}

describe('días de ejecución en la base', () => {
	let repos: Repositorios;
	let cliente: ClientePglite;
	let carpeta: string;
	let servicio: ServicioCaptura;

	beforeAll(async () => {
		cliente = await crearClientePglite();
		repos = crearRepositorios(cliente);
		carpeta = await mkdtemp(join(tmpdir(), 'dias-'));
		servicio = new ServicioCaptura(repos, new AlmacenamientoLocal(carpeta));
	}, 60_000);

	afterAll(async () => {
		await repos.cerrar();
		await rm(carpeta, { recursive: true, force: true });
	});

	async function emitir(reporte: Reporte, segmentos = reporte.diasEjecucion): Promise<Reporte> {
		const guardado = aGuardado(reporte);
		guardado.diasEjecucion = segmentos;
		guardado.firmantes = FIRMAS;
		guardado.alcances = guardado.alcances.map((a) => ({ ...a, estadoVerificacion: 'ok' }));
		const listo = await servicio.guardar(guardado);
		const enRevision = await servicio.cambiarEstado(listo.id, listo.version, 'en_revision');
		return servicio.cambiarEstado(enRevision.id, enRevision.version, 'emitido');
	}

	it('guarda los segmentos capturados y deriva la primera y la última fecha', async () => {
		const { partida } = await base(repos, 'mensual', '51111');
		const reporte = await servicio.crearReporte({
			partidaId: partida.id,
			periodoMes: '2026-05-01',
			ocurrencia: null,
			equipoIds: []
		});
		expect(reporte).toMatchObject({ diasEjecucion: [], fechaEjecucion: null });
		const guardado = await servicio.guardar({
			...aGuardado(reporte),
			diasEjecucion: dias([15], [16], [20, 25])
		});
		expect(guardado).toMatchObject({
			diasEjecucion: dias([15], [16], [20, 25]),
			fechaEjecucion: '2026-05-15',
			fechaEjecucionFin: '2026-05-25'
		});

		// Segmentos de otro mes: el check lo rechaza y el reporte conserva sus días.
		const error = await servicio
			.guardar({
				...aGuardado(guardado),
				diasEjecucion: [{ desde: '2026-06-02', hasta: '2026-06-02' }]
			})
			.catch((e) => e);
		expect(error).toBeInstanceOf(ErrorDatos);
		expect((error as ErrorDatos).tipo).toBe('invalido');
		expect((await servicio.obtener(reporte.id)).diasEjecucion).toEqual(dias([15], [16], [20, 25]));
	});

	it('acepta la fecha heredada como un día y exige días para enviar', async () => {
		const { partida } = await base(repos, 'mensual', '52222');
		const reporte = await servicio.crearReporte({
			partidaId: partida.id,
			periodoMes: '2026-05-01',
			ocurrencia: null,
			equipoIds: []
		});
		const error = await servicio
			.cambiarEstado(reporte.id, reporte.version, 'en_revision')
			.catch((e) => e);
		expect(error.observaciones.map((o: { campo: string }) => o.campo)).toContain('diasEjecucion');
		const sinDias: Record<string, unknown> = { ...aGuardado(reporte) };
		delete sinDias.diasEjecucion;
		const heredado = await cliente.llamar<{ reporte: Reporte }>('api_guardar_reporte', {
			...sinDias,
			fechaEjecucion: '2026-05-18'
		});
		expect(heredado.reporte.diasEjecucion).toEqual(dias([18]));
		expect(heredado.reporte.fechaEjecucion).toBe('2026-05-18');
	});

	it('la revisión de un emitido conserva sus días', async () => {
		const { partida } = await base(repos, 'mensual', '53333');
		const reporte = await servicio.crearReporte({
			partidaId: partida.id,
			periodoMes: '2026-05-01',
			ocurrencia: null,
			equipoIds: []
		});
		const emitido = await emitir(reporte, dias([15], [16], [20, 25]));
		const revision = await repos.reportes.crearRevision(emitido.id);
		expect(revision.diasEjecucion).toEqual(dias([15], [16], [20, 25]));
	});

	it('en una diaria cuenta cada día distinto de los emitidos', async () => {
		const { contrato, sitio, partida } = await base(repos, 'diaria', '54444');
		const programa = await repos.programa.guardarPrograma({
			contratoId: contrato.id,
			sitioId: sitio.id,
			periodoInicio: '2026-05-01',
			periodoFin: '2027-04-30'
		});
		await repos.programa.guardarMeses(programa.id, [
			{ partidaId: partida.id, mes: '2026-05-01', cantidad: 31 }
		]);
		const semana1 = await servicio.crearReporte({
			partidaId: partida.id,
			periodoMes: '2026-05-01',
			ocurrencia: { tipo: 'semana', numero: 1 },
			equipoIds: []
		});
		await emitir(semana1, dias([1, 3]));
		const mes = await servicio.crearReporte({
			partidaId: partida.id,
			periodoMes: '2026-05-01',
			ocurrencia: null,
			equipoIds: []
		});
		await emitir(mes, dias([2, 10]));
		const avance = await repos.programa.obtenerAvance(programa.id);
		// Del 1 al 3 y del 2 al 10: 10 días distintos.
		expect(avance.partidas[0].celdas[0].realizado).toBe(10);
	});
});

describe('relleno de los reportes existentes al aplicar 0016', () => {
	it('convierte la fecha en un día sin cambiar la versión ni la fecha de actualización', async () => {
		const todas = await leerMigraciones();
		const previas = todas.filter((m) => m.nombre < '0016');
		const cliente = await crearClientePglite(undefined, previas);
		const repos = crearRepositorios(cliente);
		try {
			const { partida } = await base(repos, 'mensual', '55555');
			const { id } = (await cliente.llamar('api_crear_reporte', {
				partidaId: partida.id,
				periodoMes: '2026-05-01',
				fechaEjecucion: '2026-05-18',
				titulo: 'Reporte ficticio',
				disposicionFotos: 'cuadricula',
				incluyeVerificacion: false,
				firmantes: {},
				alcances: [],
				herramientas: [],
				equipoIds: []
			})) as { id: string };
			const antes = await cliente.bd.query<{ version: number; actualizado_en: string }>(
				'select version, actualizado_en from public.reportes where id = $1',
				[id]
			);
			await aplicarMigraciones(cliente.bd, todas);
			const despues = await cliente.bd.query<{
				version: number;
				actualizado_en: string;
				dias_ejecucion: unknown;
				fecha_ejecucion_fin: string;
			}>(
				'select version, actualizado_en, dias_ejecucion, fecha_ejecucion_fin::text from public.reportes where id = $1',
				[id]
			);
			expect(despues.rows[0]).toMatchObject({
				version: antes.rows[0].version,
				actualizado_en: antes.rows[0].actualizado_en,
				dias_ejecucion: dias([18]),
				fecha_ejecucion_fin: '2026-05-18'
			});
		} finally {
			await repos.cerrar();
		}
		// Aplica las migraciones dos veces (antes y después de 0016): más que el límite general.
	}, 90_000);
});
