import { describe, expect, it } from 'vitest';
import {
	agregarDia,
	analizarDias,
	diasCubiertos,
	diasFueraDe,
	textoDias,
	textoMesAnio
} from './dias-ejecucion';

const MAYO = '2026-05-01';
const seg = (desde: number, hasta = desde, mes = '2026-05') => ({
	desde: `${mes}-${String(desde).padStart(2, '0')}`,
	hasta: `${mes}-${String(hasta).padStart(2, '0')}`
});

describe('analizarDias', () => {
	it('reconoce los ejemplos del usuario y respeta la forma capturada', () => {
		expect(analizarDias('02, 03, 04', MAYO).segmentos).toEqual([seg(2), seg(3), seg(4)]);
		expect(analizarDias('05-08', MAYO).segmentos).toEqual([seg(5, 8)]);
		expect(analizarDias('15, 16, 20-25', MAYO).segmentos).toEqual([seg(15), seg(16), seg(20, 25)]);
	});

	it('ordena sin fusionar y acepta «y», «al», espacios y el sufijo del mes', () => {
		expect(textoDias(analizarDias('20-25, 15, 16', MAYO).segmentos)).toBe('15, 16, 20-25');
		expect(textoDias(analizarDias('15 y 16, 20 al 25', MAYO).segmentos)).toBe('15, 16, 20-25');
		expect(textoDias(analizarDias('1 AL 3', MAYO).segmentos)).toBe('01-03');
		expect(analizarDias('05-08/ MAYO /2026', MAYO).segmentos).toEqual([seg(5, 8)]);
		expect(analizarDias('28,30', '2026-06-01').segmentos).toEqual([
			seg(28, 28, '2026-06'),
			seg(30, 30, '2026-06')
		]);
		expect(analizarDias('   ', MAYO)).toEqual({ segmentos: [], errores: [] });
	});

	it('informa repetidos, días inexistentes, rangos invertidos, texto y otro mes', () => {
		expect(analizarDias('05-08, 07', MAYO).errores).toEqual(['El día 07 se repite.']);
		expect(analizarDias('31', '2026-06-01').errores).toEqual(['Junio de 2026 no tiene día 31.']);
		expect(analizarDias('10-04', MAYO).errores).toEqual([
			'El rango 10-04 está invertido; escriba 04-10.'
		]);
		expect(analizarDias('15, mañana', MAYO).errores).toEqual([
			'No se reconoce «mañana»; escriba días o rangos, por ejemplo 15, 16, 20-25.'
		]);
		expect(analizarDias('05-08 / JUNIO / 2026', MAYO).errores).toEqual([
			'Los días deben ser de mayo de 2026.'
		]);
		expect(analizarDias('18, 2O', MAYO).segmentos).toEqual([]);
	});
});

describe('utilidades de días', () => {
	it('agrega un día en su orden sin duplicar', () => {
		expect(textoDias(agregarDia([seg(15), seg(16)], '2026-05-21'))).toBe('15, 16, 21');
		expect(agregarDia([seg(20, 25)], '2026-05-21')).toEqual([seg(20, 25)]);
	});

	it('lista los días cubiertos y los que quedan fuera del periodo', () => {
		expect(diasCubiertos([seg(4, 6), seg(11)])).toEqual([
			'2026-05-04',
			'2026-05-05',
			'2026-05-06',
			'2026-05-11'
		]);
		expect(
			textoDias(
				diasFueraDe([seg(4, 6), seg(11), seg(12)], { desde: '2026-05-04', hasta: '2026-05-10' })
			)
		).toBe('11, 12');
	});

	it('nombra el mes del periodo', () => {
		expect(textoMesAnio(MAYO)).toBe('mayo de 2026');
	});
});
