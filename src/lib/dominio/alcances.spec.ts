import { describe, expect, it } from 'vitest';
import { agregarPredeterminados } from './alcances';
import type { AlcancePredeterminado } from './esquemas';

const predeterminado = (
	n: number,
	texto: string,
	tipo: AlcancePredeterminado['tipo'] = 'alcance'
): AlcancePredeterminado => ({
	id: `00000000-0000-4000-8000-00000000000${n}`,
	clienteId: '00000000-0000-4000-8000-000000000099',
	tipo,
	grupo: null,
	texto,
	orden: n,
	activo: true
});

const copiar = (a: AlcancePredeterminado) => ({ tipo: a.tipo, texto: a.texto });

describe('agregarPredeterminados', () => {
	it('agrega al final y omite los que ya tiene la partida aunque cambien acentos o espacios', () => {
		const actuales = [{ tipo: 'alcance' as const, texto: 'Limpieza del área' }];
		const resultado = agregarPredeterminados(
			actuales,
			[
				predeterminado(1, ' limpieza  del AREA '),
				predeterminado(2, 'Medición de presión'),
				predeterminado(3, 'Limpieza del área', 'nota')
			],
			copiar
		);
		expect(resultado.map((r) => `${r.tipo}:${r.texto}`)).toEqual([
			'alcance:Limpieza del área',
			'alcance:Medición de presión',
			'nota:Limpieza del área'
		]);
	});

	it('no repite un predeterminado elegido dos veces', () => {
		const p = predeterminado(1, 'Medición');
		expect(agregarPredeterminados([], [p, p], copiar)).toHaveLength(1);
	});
});
