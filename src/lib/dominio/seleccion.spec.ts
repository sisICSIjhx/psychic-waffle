import { describe, expect, it } from 'vitest';
import type { AvancePrograma } from './esquemas';
import type { BorradorResumen } from './planeacion';
import { buscarPartidas, mesSugerido, normalizarBusqueda, trabajoDePartidas } from './seleccion';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOY = '2026-10-21';

const PARTIDAS = [
	{ id: ID(1), numero: '1', actividad: 'ORDEN, LIMPIEZA Y CONSERVACIÓN' },
	{ id: ID(3), numero: '3', actividad: 'Rótulos de identificación' },
	{ id: ID(7), numero: '7', actividad: 'TOMA DE POTENCIALES TUBO-SUELO' },
	{ id: ID(12), numero: '12', actividad: 'Verificación de 7 válvulas' },
	{ id: ID(17), numero: '17', actividad: 'Calibración de manómetros' }
];

function avance(celdas: Record<number, [string, number | null, number][]>): AvancePrograma {
	return {
		programa: {
			id: ID(100),
			contratoId: ID(101),
			sitioId: ID(102),
			nombre: null,
			periodoInicio: '2026-05-01',
			periodoFin: '2027-04-30',
			meses: []
		},
		partidas: Object.entries(celdas).map(([n, lista]) => ({
			id: ID(Number(n)),
			numero: n,
			actividad: `Partida ${n}`,
			periodicidad: 'mensual',
			distribucion: null,
			cantidadAnual: 12,
			celdas: lista.map(([mes, programado, realizado]) => ({
				mes,
				programado,
				realizado,
				reportes: [],
				ejecucionesReportes: realizado,
				realizadoSinReporte: 0
			})),
			totalProgramado: 0,
			totalRealizado: 0,
			diferencia: 0
		}))
	};
}

const borrador = (n: number, partidaId: string, periodoMes: string): BorradorResumen => ({
	id: ID(500 + n),
	partidaId,
	sitioId: ID(102),
	periodoMes,
	ocurrencia: null,
	titulo: `Borrador ${n}`,
	actualizadoEn: `2026-10-0${n}T00:00:00Z`
});

describe('búsqueda de partidas', () => {
	it('ignora acentos y mayúsculas y exige todas las palabras', () => {
		expect(normalizarBusqueda('  Conservación  DEL  ')).toBe('conservacion del');
		expect(buscarPartidas(PARTIDAS, 'potenciales').map((p) => p.numero)).toEqual(['7']);
		expect(buscarPartidas(PARTIDAS, 'rotulos identificacion').map((p) => p.numero)).toEqual(['3']);
		expect(buscarPartidas(PARTIDAS, 'limpieza CONSERVACION').map((p) => p.numero)).toEqual(['1']);
		expect(buscarPartidas(PARTIDAS, 'inexistente')).toEqual([]);
		expect(buscarPartidas(PARTIDAS, '  ')).toHaveLength(PARTIDAS.length);
	});

	it('con un número, la partida con ese número va primero', () => {
		expect(buscarPartidas(PARTIDAS, '7').map((p) => p.numero)).toEqual(['7', '12', '17']);
		expect(buscarPartidas([{ numero: '07', actividad: 'X' }], '7')).toHaveLength(1);
	});
});

describe('trabajo pendiente de cada partida', () => {
	const programa = avance({
		1: [['2026-10-01', 1, 1]],
		3: [
			['2026-06-01', 1, 0],
			['2026-10-01', 1, 0]
		],
		7: [['2026-10-01', 1, 0]],
		12: [['2026-10-01', 1, 0]]
	});

	it('agrupa por precedencia: con borrador, pendientes y otras', () => {
		const trabajo = trabajoDePartidas(
			PARTIDAS,
			programa,
			[borrador(1, ID(12), '2026-10-01'), borrador(2, ID(1), '2026-10-01')],
			'2026-10-01',
			HOY
		);
		expect(trabajo.get(ID(3))).toMatchObject({
			grupo: 'pendientes',
			vencidos: ['2026-06-01'],
			estadoMes: 'pendiente'
		});
		expect(trabajo.get(ID(7))).toMatchObject({
			grupo: 'pendientes',
			vencidos: [],
			estadoMes: 'pendiente'
		});
		// Pendiente con borrador: solo en «Con borrador», sin perder su estado.
		expect(trabajo.get(ID(12))).toMatchObject({ grupo: 'con_borrador', estadoMes: 'pendiente' });
		expect(trabajo.get(ID(12))?.borradores.map((b) => b.id)).toEqual([ID(501)]);
		// Cumplida: un borrador de ese mes no la vuelve pendiente.
		expect(trabajo.get(ID(1))).toMatchObject({
			grupo: 'otras',
			estadoMes: 'cumplido',
			borradores: []
		});
		expect(trabajo.get(ID(17))).toMatchObject({ grupo: 'otras', estadoMes: null });
	});

	it('cuenta los vencidos de meses anteriores aunque el mes de referencia no tenga programa', () => {
		const trabajo = trabajoDePartidas(
			[{ id: ID(3) }],
			avance({ 3: [['2026-06-01', 1, 0]] }),
			[borrador(3, ID(3), '2026-06-01')],
			'2026-10-01',
			HOY
		);
		expect(trabajo.get(ID(3))).toMatchObject({
			grupo: 'con_borrador',
			vencidos: ['2026-06-01'],
			estadoMes: null
		});
	});

	it('sin programa todas las partidas van en «Otras partidas»', () => {
		const trabajo = trabajoDePartidas(PARTIDAS, null, [], '2026-10-01', HOY);
		expect([...trabajo.values()].every((t) => t.grupo === 'otras')).toBe(true);
	});
});

describe('mes sugerido', () => {
	const meses = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-10-01'];

	it('propone el vencido más antiguo o, si no hay, el mes en curso', () => {
		const conVencidos = {
			grupo: 'pendientes' as const,
			vencidos: ['2026-06-01', '2026-07-01'],
			estadoMes: null,
			borradores: []
		};
		expect(mesSugerido(conVencidos, meses, HOY)).toBe('2026-06-01');
		expect(mesSugerido(undefined, meses, HOY)).toBe('2026-10-01');
		expect(mesSugerido(undefined, ['2027-01-01'], HOY)).toBe('2027-01-01');
		expect(mesSugerido(undefined, [], HOY)).toBeNull();
	});
});
