import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aGuardado, mesesDeVigencia } from '../dominio/captura';
import type { Reporte } from '../dominio/esquemas';
import { AlmacenamientoLocal } from './almacenamiento';
import { crearClientePglite } from './bd/pglite';
import { ServicioCaptura } from './captura';
import { crearRepositorios, type Repositorios } from './repositorios/index';
import { datosDeSeleccion } from './seleccion-captura';

const HOY = '2026-10-21';
let repos: Repositorios;
let carpeta: string;
let servicio: ServicioCaptura;
let contratoId = '';
let sitioId = '';
const partidas: Record<string, string> = {};
const meses = mesesDeVigencia('2026-05-01', '2027-04-30');

async function emitir(reporte: Reporte, fecha: string): Promise<Reporte> {
	const guardado = aGuardado(reporte);
	guardado.diasEjecucion = [{ desde: fecha, hasta: fecha }];
	guardado.firmantes = {
		elaboro: { nombre: 'Uno', cargo: '', empresa: '' },
		aprobo: { nombre: 'Dos', cargo: '', empresa: '' },
		recibio: { nombre: 'Tres', cargo: '', empresa: '' }
	};
	const listo = await servicio.guardar(guardado);
	const enRevision = await servicio.cambiarEstado(listo.id, listo.version, 'en_revision');
	return servicio.cambiarEstado(enRevision.id, enRevision.version, 'emitido');
}

/**
 * Contrato ficticio con tres partidas mensuales y su programa: la 3 venció en junio y está pendiente
 * en octubre, la 7 está pendiente en octubre y la 12 también, pero ya tiene un borrador de octubre.
 */
beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	carpeta = await mkdtemp(join(tmpdir(), 'seleccion-'));
	servicio = new ServicioCaptura(repos, new AlmacenamientoLocal(carpeta));
	const cliente = await repos.catalogo.guardarCliente({
		clave: 'sel',
		nombre: 'sel',
		razonSocial: 'CLIENTE SEL'
	});
	const contrato = await repos.catalogo.guardarContrato({
		clienteId: cliente.id,
		numero: 'OC-SEL',
		descripcion: null,
		vigenciaInicio: '2026-05-01',
		vigenciaFin: '2027-04-30'
	});
	const sitio = await repos.catalogo.guardarSitio({ clave: 'EM-44444', nombre: 'SITIO' });
	await repos.catalogo.asociarSitio(contrato.id, sitio.id);
	contratoId = contrato.id;
	sitioId = sitio.id;
	for (const numero of ['3', '7', '12']) {
		const partida = await repos.catalogo.guardarPartida({
			contratoId,
			sitioId,
			numero,
			actividad: `Partida ${numero}`,
			periodicidad: 'mensual',
			objetivo: 'Objetivo',
			conclusionesBase: 'Conclusiones',
			alcances: [{ tipo: 'alcance', texto: 'Alcance' }]
		});
		partidas[numero] = partida.id;
	}
	const programa = await repos.programa.guardarPrograma({
		contratoId,
		sitioId,
		periodoInicio: '2026-05-01',
		periodoFin: '2027-04-30'
	});
	await repos.programa.guardarMeses(programa.id, [
		{ partidaId: partidas['3'], mes: '2026-06-01', cantidad: 1 },
		{ partidaId: partidas['3'], mes: '2026-10-01', cantidad: 1 },
		{ partidaId: partidas['7'], mes: '2026-10-01', cantidad: 1 },
		{ partidaId: partidas['12'], mes: '2026-10-01', cantidad: 1 }
	]);
	await servicio.crearReporte({
		partidaId: partidas['12'],
		periodoMes: '2026-10-01',
		ocurrencia: null,
		equipoIds: []
	});
	// La partida 7 tiene un reporte de mayo emitido y sustituido por su revisión, también emitida.
	const mayo = await emitir(
		await servicio.crearReporte({
			partidaId: partidas['7'],
			periodoMes: '2026-05-01',
			ocurrencia: null,
			equipoIds: []
		}),
		'2026-05-15'
	);
	await emitir(await repos.reportes.crearRevision(mayo.id), '2026-05-16');
}, 120_000);

afterAll(async () => {
	await repos.cerrar();
	await rm(carpeta, { recursive: true, force: true });
});

const lista = () =>
	Object.entries(partidas).map(([numero, id]) => ({ id, numero, actividad: `Partida ${numero}` }));

describe('datos de la selección en la captura', () => {
	it('agrupa las partidas con los vencidos anteriores y la precedencia del borrador', async () => {
		const datos = await datosDeSeleccion(repos, {
			contratoId,
			sitioId,
			partidas: lista(),
			partidaId: null,
			meses,
			mesPedido: '',
			hoy: HOY
		});
		expect(datos.mesReferencia).toBe('2026-10-01');
		expect(datos.trabajo[partidas['3']]).toMatchObject({
			grupo: 'pendientes',
			vencidos: ['2026-06-01'],
			estadoMes: 'pendiente'
		});
		expect(datos.trabajo[partidas['7']]).toMatchObject({ grupo: 'pendientes', vencidos: [] });
		expect(datos.trabajo[partidas['12']]).toMatchObject({
			grupo: 'con_borrador',
			estadoMes: 'pendiente'
		});
		expect(datos.trabajo[partidas['12']].borradores).toHaveLength(1);
	});

	it('sugiere el vencido más antiguo, salvo que la dirección pida un mes', async () => {
		const base = { contratoId, sitioId, partidas: lista(), meses, hoy: HOY };
		const sinMes = await datosDeSeleccion(repos, {
			...base,
			partidaId: partidas['3'],
			mesPedido: ''
		});
		expect(sinMes.mesSugerido).toBe('2026-06-01');
		const conMes = await datosDeSeleccion(repos, {
			...base,
			partidaId: partidas['3'],
			mesPedido: '2026-10-01'
		});
		expect(conMes.mesSugerido).toBe('2026-10-01');
		const otra = await datosDeSeleccion(repos, {
			...base,
			partidaId: partidas['7'],
			mesPedido: ''
		});
		expect(otra.mesSugerido).toBe('2026-10-01');
	});

	it('trae los reportes vigentes de la partida, sin los sustituidos', async () => {
		const datos = await datosDeSeleccion(repos, {
			contratoId,
			sitioId,
			partidas: lista(),
			partidaId: partidas['7'],
			meses,
			mesPedido: '',
			hoy: HOY
		});
		expect(datos.reportesPartida.map((r) => [r.estado, r.periodoMes])).toEqual([
			['emitido', '2026-05-01']
		]);
	});

	it('devuelve las reprogramaciones de la partida y el reporte creado queda ligado', async () => {
		const programa = (await repos.programa.listarProgramas({ contratoId, sitioId }))[0];
		const ajuste = await repos.programa.registrarAjuste({
			programaId: programa.id,
			partidaId: partidas['3'],
			tipo: 'reprogramado',
			mesOrigen: '2026-06-01',
			mesDestino: '2026-10-01',
			cantidad: 1,
			motivo: 'clima'
		});
		const datos = await datosDeSeleccion(repos, {
			contratoId,
			sitioId,
			partidas: lista(),
			partidaId: partidas['3'],
			meses: ['2026-06-01', '2026-10-01'],
			mesPedido: '2026-10-01',
			hoy: '2026-10-21'
		});
		expect(datos.reprogramaciones.map((r) => [r.id, r.mesOrigen, r.mesDestino])).toEqual([
			[ajuste.id, '2026-06-01', '2026-10-01']
		]);
		const sinAjustes = await datosDeSeleccion(repos, {
			contratoId,
			sitioId,
			partidas: lista(),
			partidaId: partidas['7'],
			meses: ['2026-10-01'],
			mesPedido: '2026-10-01',
			hoy: '2026-10-21'
		});
		expect(sinAjustes.reprogramaciones).toEqual([]);
		const ligado = await servicio.crearReporte({
			partidaId: partidas['3'],
			periodoMes: '2026-10-01',
			ocurrencia: null,
			equipoIds: [],
			reprogramacionId: ajuste.id
		});
		expect([ligado.reprogramacionId, ligado.reprogramadoDesde]).toEqual([ajuste.id, '2026-06-01']);
	});

	it('sin contrato ni sitio no consulta el programa', async () => {
		const datos = await datosDeSeleccion(repos, {
			contratoId: null,
			sitioId: null,
			partidas: [],
			partidaId: null,
			meses: [],
			mesPedido: '',
			hoy: HOY
		});
		expect(datos).toEqual({
			mesReferencia: '2026-10-01',
			mesSugerido: null,
			trabajo: {},
			reportesPartida: [],
			reprogramaciones: []
		});
	});
});
