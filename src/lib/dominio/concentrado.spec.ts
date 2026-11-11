import { describe, expect, it } from 'vitest';
import {
	filasConcentrado,
	motivoSinAvance,
	resumenConcentrado,
	type CentroConcentrado
} from './concentrado';
import { tablaCumplimiento, type CeldaEvaluable, type ProgramaCumplimiento } from './cumplimiento';

const HOY = '2026-11-11';
const CORTE = '2026-11-01';

const celda = (mes: string, ejecutadas: number): CeldaEvaluable =>
	({
		mes,
		programado: 1,
		realizado: ejecutadas,
		ejecucionesReportes: ejecutadas,
		realizadoSinReporte: 0,
		salida: 0,
		entrada: 0,
		noEjecutado: 0,
		ajustes: [],
		reportes: [],
		reportesAbiertos: []
	}) as unknown as CeldaEvaluable;

const programa = (sitio: string, celdas: CeldaEvaluable[]): ProgramaCumplimiento => ({
	contrato: { id: `contrato-${sitio}`, numero: `C-${sitio}` },
	sitio: { id: sitio, clave: sitio, nombre: '' },
	avance: {
		programa: { id: `programa-${sitio}`, periodoInicio: '2026-01-01', periodoFin: '2026-12-31' },
		partidas: [{ id: 'p', numero: '1', actividad: 'Ficticia', periodicidad: 'mensual', celdas }]
	}
});

const centro = (
	id: string,
	origen: 'programa_anual' | 'mensual' | 'ninguno' | null
): CentroConcentrado => ({
	id,
	clave: id,
	nombre: '',
	plantilla: origen && { origenActividades: origen },
	contratos: []
});

describe('concentrado de centros de costo', () => {
	const programas = [
		// Cuatro meses terminados, uno sin ejecutar: 3 de 4.
		programa('anual', [
			celda('2026-07-01', 1),
			celda('2026-08-01', 1),
			celda('2026-09-01', 0),
			celda('2026-10-01', 1),
			celda('2026-12-01', 0)
		])
	];
	const centros = [
		centro('anual', 'programa_anual'),
		centro('mensual', 'mensual'),
		centro('mensual-vacio', 'mensual'),
		centro('anual-sin-programa', 'programa_anual'),
		centro('solo-reporte', 'ninguno'),
		centro('sin-plantilla', null)
	];
	const actividades = {
		mensual: { programadas: 4, ejecutadas: 4 },
		'mensual-vacio': { programadas: 0, ejecutadas: 0 }
	};
	const filas = filasConcentrado(centros, programas, actividades, CORTE, HOY);
	const fila = (id: string) => filas.find((f) => f.centro.id === id)!;

	it('mide el programa anual con el mismo cálculo que el tablero', () => {
		const tablero = tablaCumplimiento(programas, CORTE, HOY).total;
		expect(fila('anual')).toMatchObject({
			fuente: 'programa',
			planeado: tablero.PR,
			ejecutado: tablero.E,
			avance: 75,
			semaforo: 'amarillo',
			contratoId: 'contrato-anual'
		});
		expect(tablero).toMatchObject({ PR: 4, E: 3 });
	});

	it('mide los centros de captura mensual con las actividades del mes', () => {
		expect(fila('mensual')).toMatchObject({
			fuente: 'seguimiento',
			planeado: 4,
			ejecutado: 4,
			avance: 100,
			semaforo: 'verde',
			contratoId: null
		});
		// Sin actividades capturadas no hay nada que medir.
		expect(fila('mensual-vacio')).toMatchObject({ fuente: null, avance: null });
		expect(motivoSinAvance(fila('mensual-vacio'))).toBe('Sin actividades capturadas en el mes');
	});

	it('deja sin avance a los centros que no tienen qué medir y dice por qué', () => {
		for (const id of ['anual-sin-programa', 'solo-reporte', 'sin-plantilla']) {
			expect(fila(id)).toMatchObject({ fuente: null, avance: null, semaforo: null });
		}
		expect(motivoSinAvance(fila('anual-sin-programa'))).toBe(
			'Sin programa anual en el mes de corte'
		);
		expect(motivoSinAvance(fila('solo-reporte'))).toBe('Sin actividades programadas');
		expect(motivoSinAvance(fila('sin-plantilla'))).toBe('Sin plantilla de seguimiento');
	});

	it('resume los centros por semáforo y conserva el orden recibido', () => {
		expect(filas.map((f) => f.centro.id)).toEqual(centros.map((c) => c.id));
		expect(resumenConcentrado(filas)).toEqual({ verde: 1, amarillo: 1, rojo: 0, sinDatos: 4 });
	});
});
