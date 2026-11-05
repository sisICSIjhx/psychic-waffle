import { describe, expect, it } from 'vitest';
import { plural, textoHaceTiempo, textoMes, textoOracion, textoRango } from './textos';

describe('textos de la interfaz', () => {
	it('concuerda el plural con la cantidad', () => {
		expect(plural(1, 'foto')).toBe('1 foto');
		expect(plural(0, 'foto')).toBe('0 fotos');
		expect(plural(3, 'foto')).toBe('3 fotos');
		expect(plural(1, 'programa anual vigente', 'programas anuales vigentes')).toBe(
			'1 programa anual vigente'
		);
		expect(plural(2, 'programa anual vigente', 'programas anuales vigentes')).toBe(
			'2 programas anuales vigentes'
		);
	});

	it('escribe los meses en formato de oración', () => {
		expect(textoMes('2026-05-01')).toBe('mayo 2026');
		expect(textoMes('2026-09-01', { inicial: true })).toBe('Septiembre 2026');
		expect(textoMes('2026-12', { corto: true })).toBe('dic 2026');
		expect(textoMes('2027-01-01', { inicial: true, corto: true })).toBe('Ene 2027');
	});

	it('describe el rango de días del periodo', () => {
		expect(textoRango({ desde: '2026-05-01', hasta: '2026-05-31' })).toBe(
			'del 1 al 31 de mayo de 2026'
		);
		expect(textoRango({ desde: '2026-05-18', hasta: '2026-05-18' })).toBe('el 18 de mayo de 2026');
	});

	it('expresa el tiempo desde el último guardado', () => {
		const t = new Date(2026, 9, 21, 9, 5, 0).getTime();
		expect(textoHaceTiempo(t, t + 2_000)).toBe('hace un momento');
		expect(textoHaceTiempo(t, t + 5_000)).toBe('hace 5 s');
		expect(textoHaceTiempo(t, t + 3 * 60_000)).toBe('hace 3 min');
		expect(textoHaceTiempo(t, t + 2 * 3_600_000)).toBe('a las 9:05');
	});

	it('pasa a oración un texto en mayúsculas y conserva siglas y cifras', () => {
		expect(textoOracion('MANTENIMIENTO PREVENTIVO A RÓTULOS DE IDENTIFICACIÓN EM, VT')).toBe(
			'Mantenimiento preventivo a rótulos de identificación EM, VT'
		);
		expect(textoOracion('ORDEN Y LIMPIEZA DEL DERECHO DE VÍA EN ERM 2 (DDV)')).toBe(
			'Orden y limpieza del derecho de vía en ERM 2 (DDV)'
		);
		expect(textoOracion('Toma de potenciales')).toBe('Toma de potenciales');
	});
});
