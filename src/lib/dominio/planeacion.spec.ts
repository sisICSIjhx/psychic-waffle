import { describe, expect, it } from 'vitest';
import type { AvancePrograma } from './esquemas';
import {
	estadoCelda,
	filtrarPartidas,
	pendientesVencidos,
	programaVigente,
	resumenDelMes
} from './planeacion';

const HOY = '2026-07-15';
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function partida(
	n: number,
	celdas: [string, number | null, number][],
	cambios: Partial<AvancePrograma['partidas'][number]> = {}
): AvancePrograma['partidas'][number] {
	return {
		id: ID(n),
		numero: String(n),
		actividad: `Partida ${n}`,
		periodicidad: 'mensual',
		distribucion: 'produccion',
		cantidadAnual: 12,
		celdas: celdas.map(([mes, programado, realizado]) => ({
			mes,
			programado,
			realizado,
			reportes: []
		})),
		totalProgramado: 0,
		totalRealizado: 0,
		diferencia: 0,
		...cambios
	};
}

describe('estado de cada celda del programa', () => {
	it('distingue cumplido, pendiente del mes en curso, vencido y extra', () => {
		const celda = (mes: string, programado: number | null, realizado: number) => ({
			mes,
			programado,
			realizado,
			reportes: []
		});
		expect(estadoCelda(celda('2026-06-01', 1, 1), HOY)).toBe('cumplido');
		expect(estadoCelda(celda('2026-06-01', 1, 0), HOY)).toBe('vencido');
		expect(estadoCelda(celda('2026-07-01', 1, 0), HOY)).toBe('pendiente');
		expect(estadoCelda(celda('2026-08-01', 1, 0), HOY)).toBe('pendiente');
		expect(estadoCelda(celda('2026-06-01', null, 1), HOY)).toBe('extra');
		expect(estadoCelda(celda('2026-06-01', null, 0), HOY)).toBe('sin_programa');
		// Una partida diaria con 30 programados y 29 realizados en junio sigue vencida.
		expect(estadoCelda(celda('2026-06-01', 30, 29), HOY)).toBe('vencido');
	});
});

describe('pendientes vencidos y filtros', () => {
	const partidas = [
		partida(7, [
			['2026-05-01', 1, 1],
			['2026-06-01', 1, 0],
			['2026-07-01', 1, 0]
		]),
		partida(2, [['2026-05-01', 31, 30]], { periodicidad: 'diaria', distribucion: 'mantenimiento' })
	];

	it('señala como vencida la partida programada en junio sin reporte emitido', () => {
		expect(pendientesVencidos(partidas, HOY)).toEqual([
			{ partidaId: ID(2), numero: '2', actividad: 'Partida 2', mes: '2026-05-01', faltan: 1 },
			{ partidaId: ID(7), numero: '7', actividad: 'Partida 7', mes: '2026-06-01', faltan: 1 }
		]);
	});

	it('filtra por distribución y periodicidad', () => {
		expect(
			filtrarPartidas(partidas, { distribucion: 'mantenimiento' }).map((p) => p.numero)
		).toEqual(['2']);
		expect(filtrarPartidas(partidas, { periodicidad: 'mensual' }).map((p) => p.numero)).toEqual([
			'7'
		]);
		expect(filtrarPartidas(partidas, {})).toHaveLength(2);
	});
});

describe('resumen del mes para el panel', () => {
	it('cuenta partidas programadas, cumplidas, pendientes y vencidas', () => {
		const avance = {
			programa: {
				id: ID(1),
				contratoId: ID(2),
				sitioId: ID(3),
				nombre: null,
				periodoInicio: '2026-05-01',
				periodoFin: '2027-04-30',
				meses: []
			},
			partidas: [
				partida(1, [
					['2026-06-01', 1, 0],
					['2026-07-01', 1, 1]
				]),
				partida(2, [['2026-07-01', 31, 3]], { periodicidad: 'diaria' }),
				partida(3, [['2026-07-01', null, 0]])
			]
		};
		expect(resumenDelMes([avance], HOY)).toEqual({
			programadas: 2,
			cumplidas: 1,
			pendientes: 1,
			vencidas: 1
		});
	});

	it('elige el programa vigente o, si no hay, el más reciente', () => {
		const programas = [
			{ periodoInicio: '2025-05-01', periodoFin: '2026-04-30' },
			{ periodoInicio: '2026-05-01', periodoFin: '2027-04-30' }
		];
		expect(programaVigente(programas, HOY)).toBe(programas[1]);
		expect(programaVigente(programas, '2030-01-01')).toBe(programas[1]);
		expect(programaVigente([], HOY)).toBeNull();
	});
});
