import { describe, expect, it } from 'vitest';
import { BLOQUES_SEGUIMIENTO, NIVELES_CONCEPTO, TIPOS_CONCEPTO } from './constantes';
import {
	bloquesAplicados,
	conceptoValido,
	estadoContratoCentro,
	indicadoresDeConcepto,
	nivelesDeBloque,
	tiposDeBloque
} from './seguimiento';

describe('combinaciones de los conceptos', () => {
	it('el bloque fija el nivel, salvo el programa y los documentos', () => {
		expect(nivelesDeBloque('contrato')).toEqual(['contrato']);
		expect(nivelesDeBloque('ordenes_compra')).toEqual(['orden_compra']);
		expect(nivelesDeBloque('documentos')).toEqual(['actividad', 'partida']);
		expect(nivelesDeBloque('carpetas')).toEqual(['periodo']);
		expect(nivelesDeBloque('programa')).toEqual(['periodo', 'actividad', 'partida']);
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
		// contrato y órdenes: 7 tipos × 1 nivel; documentos: 7 × 2; programa: 7 × 3; carpetas: 1 × 1.
		expect(validas).toBe(7 * 2 + 7 * 2 + 7 * 3 + 1);
		expect(conceptoValido('documentos', 'casilla', 'periodo')).toBe(false);
		expect(conceptoValido('documentos', 'casilla', 'partida')).toBe(true);
		expect(conceptoValido('contrato', 'monto', 'partida')).toBe(false);
	});

	it('un indicador solo se ofrece donde tiene sentido', () => {
		expect(indicadoresDeConcepto('contrato', 'monto', 'contrato')).toEqual([
			'monto_contrato',
			'monto_cobrado',
			'monto_facturado'
		]);
		expect(indicadoresDeConcepto('contrato', 'texto', 'contrato')).toEqual(['periodicidad']);
		expect(indicadoresDeConcepto('programa', 'cantidad', 'periodo')).toEqual([
			'em_programadas',
			'em_realizadas',
			'em_cobradas'
		]);
		expect(indicadoresDeConcepto('programa', 'casilla', 'actividad')).toEqual([
			'actividad_cobrada'
		]);
		expect(indicadoresDeConcepto('ordenes_compra', 'monto', 'orden_compra')).toEqual([]);
		expect(indicadoresDeConcepto('documentos', 'casilla', 'partida')).toEqual([]);
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
