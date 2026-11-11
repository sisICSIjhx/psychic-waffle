import { describe, expect, it } from 'vitest';
import { BLOQUES_SEGUIMIENTO, NIVELES_CONCEPTO, TIPOS_CONCEPTO } from './constantes';
import {
	bloquesAplicados,
	conceptoValido,
	estadoContratoCentro,
	nivelesDeBloque,
	tiposDeBloque
} from './seguimiento';

describe('combinaciones de los conceptos', () => {
	it('el bloque fija el nivel, salvo el programa', () => {
		expect(nivelesDeBloque('contrato')).toEqual(['contrato']);
		expect(nivelesDeBloque('ordenes_compra')).toEqual(['orden_compra']);
		expect(nivelesDeBloque('documentos')).toEqual(['actividad']);
		expect(nivelesDeBloque('carpetas')).toEqual(['periodo']);
		expect(nivelesDeBloque('programa')).toEqual(['periodo', 'actividad']);
	});

	it('las carpetas solo son entregas, y ningún otro bloque las usa', () => {
		expect(tiposDeBloque('carpetas')).toEqual(['carpeta']);
		for (const bloque of BLOQUES_SEGUIMIENTO.filter((b) => b !== 'carpetas')) {
			expect(tiposDeBloque(bloque)).not.toContain('carpeta');
		}
	});

	it('conceptoValido coincide con las listas de cada bloque', () => {
		let validas = 0;
		for (const bloque of BLOQUES_SEGUIMIENTO)
			for (const tipo of TIPOS_CONCEPTO)
				for (const nivel of NIVELES_CONCEPTO) if (conceptoValido(bloque, tipo, nivel)) validas++;
		// contrato, órdenes y documentos: 7 tipos × 1 nivel; programa: 7 × 2; carpetas: 1 × 1.
		expect(validas).toBe(7 * 3 + 7 * 2 + 1);
		expect(conceptoValido('documentos', 'casilla', 'periodo')).toBe(false);
	});
});

describe('bloquesAplicados', () => {
	it('los que tienen algún concepto, en el orden del plan', () => {
		expect(
			bloquesAplicados([{ bloque: 'carpetas' }, { bloque: 'documentos' }, { bloque: 'documentos' }])
		).toEqual(['documentos', 'carpetas']);
		expect(bloquesAplicados([])).toEqual([]);
	});
});

describe('estadoContratoCentro', () => {
	const plantilla = (modoContrato: 'obligatorio' | 'opcional' | 'sin_contrato') => ({
		modoContrato
	});

	it('pendiente solo si la plantilla exige contrato y no hay ninguno', () => {
		expect(estadoContratoCentro({ plantilla: plantilla('obligatorio'), contratos: [] })).toBe(
			'pendiente'
		);
		expect(estadoContratoCentro({ plantilla: plantilla('opcional'), contratos: [] })).toBe(
			'sin_contrato'
		);
		expect(estadoContratoCentro({ plantilla: null, contratos: [] })).toBe('sin_contrato');
		expect(estadoContratoCentro({ plantilla: plantilla('sin_contrato'), contratos: [{}] })).toBe(
			'con_contrato'
		);
	});
});
