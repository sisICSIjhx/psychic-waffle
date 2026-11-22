// Reglas del tablero de estatus: orden de las tarjetas, filtros, textos y ejecución según el origen.
import { describe, expect, it } from 'vitest';
import type { CentroConcentrado } from '$lib/dominio/concentrado';
import type { ProgramaCumplimiento } from '$lib/dominio/cumplimiento';
import type { EstatusCentro, ResumenCentro } from '$lib/dominio/estatus';
import {
	consultaTablero,
	cuentasPorEstatus,
	esEstatus,
	filtrarTarjetas,
	mesVecino,
	ordenarTarjetas,
	tarjetasDelTablero,
	textoFiltroVacio,
	textoResumenTablero,
	type TarjetaTablero
} from './tablero';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOY = '2026-11-20';
const CORTE = '2026-11-01';

const tarjeta = (
	clave: string,
	estatus: EstatusCentro,
	cambios: { pendientes?: number; ejecucion?: number | null; nombre?: string } = {}
): TarjetaTablero => ({
	centro: { id: clave, clave, nombre: cambios.nombre ?? '', sinPlantilla: false },
	estatus,
	kpis:
		cambios.ejecucion === undefined || cambios.ejecucion === null
			? []
			: [
					{
						clave: 'ejecucion',
						etiqueta: 'Ejecución',
						valor: cambios.ejecucion,
						total: 100,
						porcentaje: cambios.ejecucion,
						semaforo: null,
						detalle: ''
					}
				],
	falta: [],
	pendientes: cambios.pendientes ?? 0,
	emergencias: 0,
	contratoId: null
});

const centro = (
	n: number,
	clave: string,
	origen: 'mensual' | 'programa_anual' | null
): CentroConcentrado => ({
	id: ID(n),
	clave,
	nombre: `Centro ${n}`,
	plantilla: origen && { origenActividades: origen },
	contratos: []
});

const resumen = (n: number, cambios: Partial<ResumenCentro> = {}): ResumenCentro => ({
	sitioId: ID(n),
	plantillaId: ID(100 + n),
	origen: 'mensual',
	mesTerminado: false,
	actividades: { programadas: 0, ejecutadas: 0, cobradas: null },
	em: null,
	documentos: { esperados: 0, hechos: 0, faltantes: [] },
	carpetas: [],
	emergencias: 0,
	...cambios
});

describe('orden del tablero', () => {
	it('va del más atrasado al más al corriente, con «Sin datos» antes de «Al corriente»', () => {
		const orden = ordenarTarjetas([
			tarjeta('D', 'al_corriente'),
			tarjeta('C', 'sin_datos'),
			tarjeta('B', 'con_pendientes'),
			tarjeta('A', 'atrasado')
		]).map((t) => t.centro.clave);
		expect(orden).toEqual(['A', 'B', 'C', 'D']);
	});

	it('a igual estatus: más pendientes, luego menor ejecución y al final la clave', () => {
		const orden = ordenarTarjetas([
			tarjeta('EM-10', 'atrasado', { pendientes: 1, ejecucion: 50 }),
			tarjeta('EM-2', 'atrasado', { pendientes: 1, ejecucion: 50 }),
			tarjeta('EM-3', 'atrasado', { pendientes: 1, ejecucion: 20 }),
			tarjeta('EM-4', 'atrasado', { pendientes: 4, ejecucion: 90 }),
			tarjeta('EM-5', 'atrasado', { pendientes: 1 })
		]).map((t) => t.centro.clave);
		expect(orden).toEqual(['EM-4', 'EM-3', 'EM-2', 'EM-10', 'EM-5']);
	});
});

describe('filtros del tablero', () => {
	const tarjetas = [
		tarjeta('EM-00001', 'atrasado', { nombre: 'Estación Río' }),
		tarjeta('EM-00002', 'con_pendientes', { nombre: 'Área de ejemplo' }),
		tarjeta('OMA EJEMPLO', 'con_pendientes', { nombre: 'Medición' })
	];

	it('filtra por estatus y por texto sin acentos ni mayúsculas, con todas las palabras', () => {
		const claves = (estatus: EstatusCentro | null, q = '') =>
			filtrarTarjetas(tarjetas, estatus, q).map((t) => t.centro.clave);
		expect(claves('con_pendientes')).toEqual(['EM-00002', 'OMA EJEMPLO']);
		expect(claves(null, 'area')).toEqual(['EM-00002']);
		expect(claves(null, '  RIO  estacion ')).toEqual(['EM-00001']);
		expect(claves('atrasado', 'medicion')).toEqual([]);
		expect(claves(null, '   ')).toHaveLength(3);
	});

	it('cuenta por estatus y valida el parámetro de la dirección', () => {
		expect(cuentasPorEstatus(tarjetas)).toEqual({
			atrasado: 1,
			con_pendientes: 2,
			al_corriente: 0,
			sin_datos: 0
		});
		expect([esEstatus('sin_datos'), esEstatus('otro'), esEstatus(null)]).toEqual([
			true,
			false,
			false
		]);
	});

	it('escribe el resumen y el mensaje del filtro vacío', () => {
		expect(textoResumenTablero(tarjetas, '2026-11')).toBe(
			'3 centros de costo en noviembre 2026: 1 atrasado, 2 con pendientes, 0 al corriente y 0 sin datos.'
		);
		expect(textoResumenTablero(tarjetas.slice(0, 1), '2026-11')).toMatch(/^1 centro de costo en /);
		expect(textoFiltroVacio('al_corriente', '2026-11')).toBe(
			'Ningún centro de costo está «Al corriente» en noviembre 2026.'
		);
	});

	it('arma la consulta de la dirección sin lo vacío y con la búsqueda codificada', () => {
		const filtros = { corte: '2026-11', estatus: null, q: '  ', periodicidad: null };
		expect(consultaTablero(filtros)).toBe('corte=2026-11');
		expect(
			consultaTablero({ ...filtros, estatus: 'atrasado', q: ' área 1 ', periodicidad: 'mensual' })
		).toBe('corte=2026-11&estatus=atrasado&q=%C3%A1rea+1&periodicidad=mensual');
	});

	it('calcula el mes anterior y el siguiente al cruzar el año', () => {
		expect([mesVecino('2026-01', -1), mesVecino('2026-12', 1), mesVecino('2026-11', -1)]).toEqual([
			'2025-12',
			'2027-01',
			'2026-10'
		]);
	});
});

describe('tarjetas del tablero', () => {
	const programa: ProgramaCumplimiento = {
		contrato: { id: ID(50), numero: 'OC-EJEMPLO' },
		sitio: { id: ID(1), clave: 'EM-00001', nombre: '' },
		avance: {
			programa: { id: ID(60), periodoInicio: '2026-03-01', periodoFin: '2027-02-28' },
			partidas: [
				{
					id: ID(70),
					numero: '1',
					actividad: 'Partida de ejemplo',
					periodicidad: 'mensual',
					celdas: ['2026-08-01', '2026-09-01', '2026-10-01'].map((mes, i) => ({
						mes,
						programado: 1,
						ejecucionesReportes: i === 0 ? 1 : 0,
						realizadoSinReporte: 0
					}))
				}
			]
		}
	};

	it('usa el programa anual acumulado, el mes en los mensuales y «Sin datos» sin resumen', () => {
		const tarjetas = tarjetasDelTablero(
			[
				centro(1, 'EM-00001', 'programa_anual'),
				centro(2, 'EM-00002', 'mensual'),
				centro(3, 'EM-00003', null)
			],
			[
				resumen(1, { origen: 'programa_anual' }),
				resumen(2, { actividades: { programadas: 4, ejecutadas: 4, cobradas: null } })
			],
			[programa],
			CORTE,
			HOY
		);
		const porClave = Object.fromEntries(tarjetas.map((t) => [t.centro.clave, t]));

		// Un mes ejecutado de tres vencidos: bajo la meta, atrasado y primero en la lista.
		expect(tarjetas[0].centro.clave).toBe('EM-00001');
		expect(porClave['EM-00001'].estatus).toBe('atrasado');
		expect(porClave['EM-00001'].contratoId).toBe(ID(50));
		expect(porClave['EM-00001'].kpis[0]).toMatchObject({
			clave: 'ejecucion',
			alcance: 'ciclo',
			valor: 1,
			total: 3,
			semaforo: 'rojo'
		});

		expect(porClave['EM-00002'].estatus).toBe('al_corriente');
		expect(porClave['EM-00002'].kpis[0]).toMatchObject({ alcance: 'mes', valor: 4, total: 4 });

		// Un centro sin fila en el resumen (sin plantilla) no rompe el tablero.
		expect(porClave['EM-00003']).toMatchObject({
			estatus: 'sin_datos',
			kpis: [],
			falta: [],
			pendientes: 0
		});
		expect(porClave['EM-00003'].centro.sinPlantilla).toBe(true);
		expect(tarjetas.map((t) => t.estatus)).toEqual(['atrasado', 'sin_datos', 'al_corriente']);
	});
});
