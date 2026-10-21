import { describe, expect, it } from 'vitest';
import { plural, textoMes } from './textos';

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
});
