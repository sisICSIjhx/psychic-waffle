import { describe, expect, it } from 'vitest';
import { textoDia, textoPeriodo, totalesDeAdicionales } from './adicionales';

describe('adicionales', () => {
	it('escribe el periodo de ejecución sin repetir mes ni año', () => {
		expect(textoDia('2026-11-05')).toBe('5 nov 2026');
		expect(textoPeriodo('2026-11-01', '2026-11-15')).toBe('1 al 15 nov 2026');
		expect(textoPeriodo('2026-10-28', '2026-11-03')).toBe('28 oct al 3 nov 2026');
		expect(textoPeriodo('2026-12-20', '2027-01-10')).toBe('20 dic 2026 al 10 ene 2027');
		expect(textoPeriodo('2026-11-05', '2026-11-05')).toBe('5 nov 2026');
	});

	it('dice desde o hasta cuando falta una de las fechas', () => {
		expect(textoPeriodo('2026-11-01', null)).toBe('Desde el 1 nov 2026');
		expect(textoPeriodo(null, '2026-11-15')).toBe('Hasta el 15 nov 2026');
		expect(textoPeriodo(null, null)).toBe('');
	});

	it('suma lo pactado y lo cobrado sin errores de decimales', () => {
		expect(
			totalesDeAdicionales([
				{ montoPactado: 0.1, montoCobrado: null },
				{ montoPactado: 0.2, montoCobrado: 0.3 },
				{ montoPactado: null, montoCobrado: 100 }
			])
		).toEqual({ cantidad: 3, pactado: 0.3, cobrado: 100.3 });
		expect(totalesDeAdicionales([])).toEqual({ cantidad: 0, pactado: 0, cobrado: 0 });
	});
});
