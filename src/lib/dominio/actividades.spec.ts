import { describe, expect, it } from 'vitest';
import { errorFechaActividad, faltanEnFecha, fechaEfectiva, mesDeFecha } from './actividades';

const PROGRAMA = { periodoInicio: '2026-05-01', periodoFin: '2027-04-30' };
const HOY = '2026-11-21';

describe('captura de actividades', () => {
	it('usa la fecha de hoy si se deja vacía', () => {
		expect(fechaEfectiva('', HOY)).toBe(HOY);
		expect(fechaEfectiva(null, HOY)).toBe(HOY);
		expect(fechaEfectiva(' 2026-11-02 ', HOY)).toBe('2026-11-02');
		expect(mesDeFecha('2026-11-02')).toBe('2026-11-01');
	});

	it('rechaza fechas inválidas, futuras o fuera del programa', () => {
		expect(errorFechaActividad('2026-11-21', HOY, PROGRAMA)).toBeNull();
		expect(errorFechaActividad('2026-13-40', HOY, PROGRAMA)).toBe('La fecha no es válida.');
		expect(errorFechaActividad('2026-11-22', HOY, PROGRAMA)).toBe(
			'La fecha no puede ser posterior a hoy.'
		);
		expect(errorFechaActividad('2026-04-30', HOY, PROGRAMA)).toBe(
			'La fecha está fuera del periodo del programa anual.'
		);
	});

	it('lee lo que falta en el mes de la fecha', () => {
		const partida = { faltan: { '2026-11-01': 2 } };
		expect(faltanEnFecha(partida, '2026-11-15')).toBe(2);
		expect(faltanEnFecha(partida, '2026-10-15')).toBe(0);
	});
});
