import { describe, expect, it } from 'vitest';
import { mesesDelAnio, textoMonto, totalCobrado, valorDeCampo } from './cobranza';

describe('contrato y cobranza', () => {
	it('convierte los campos del formulario según el tipo del concepto', () => {
		expect(valorDeCampo('casilla', 'on')).toBe(true);
		expect(valorDeCampo('casilla', null)).toBe(false);
		expect(valorDeCampo('monto', ' 1500.50 ')).toBe(1500.5);
		expect(valorDeCampo('cantidad', '3')).toBe(3);
		expect(valorDeCampo('monto', 'mil')).toBeNaN();
		expect(valorDeCampo('texto', '  C-001 ')).toBe('C-001');
		expect(valorDeCampo('fecha', '')).toBeNull();
		expect(valorDeCampo('enlace', null)).toBeNull();
	});

	it('arma los doce meses con lo registrado y suma lo cobrado sin errores de redondeo', () => {
		const marzo = {
			mes: '2026-03-01',
			estimacion: true,
			prefactura: true,
			factura: false,
			cobrado: false,
			montoCobrado: 0.1
		};
		const meses = mesesDelAnio(2026, [marzo, { ...marzo, mes: '2026-12-01', montoCobrado: 0.2 }]);
		expect(meses).toHaveLength(12);
		expect(meses[0]).toMatchObject({ mes: '2026-01-01', estimacion: false, montoCobrado: null });
		expect(meses[2]).toBe(marzo);
		expect(totalCobrado(meses)).toBe(0.3);
		expect(textoMonto(1234.5)).toBe('$1,234.50');
	});
});
