import { describe, expect, it } from 'vitest';
import {
	escalaGirada,
	girar,
	moverDeColumna,
	moverPaso,
	reordenarFoto,
	type Momento
} from './fotos';

const foto = (id: string, momento: Momento | null = null) => ({ id, momento });
const ids = (fotos: { id: string }[]) => fotos.map((f) => f.id).join(' ');

describe('reordenarFoto', () => {
	const fotos = ['a', 'b', 'c', 'd'].map((id) => foto(id));

	it('coloca la foto antes o después de otra y al final del grupo sin destino', () => {
		expect(ids(reordenarFoto(fotos, { fotoId: 'c', destinoId: 'a', lado: 'antes' }))).toBe(
			'c a b d'
		);
		expect(ids(reordenarFoto(fotos, { fotoId: 'a', destinoId: 'c', lado: 'despues' }))).toBe(
			'b c a d'
		);
		expect(ids(reordenarFoto(fotos, { fotoId: 'b', destinoId: null, lado: 'antes' }))).toBe(
			'a c d b'
		);
	});

	it('cambia el espacio al soltar en otra columna y conserva las ocultas en su lugar relativo', () => {
		const mezcla = [
			foto('a', 'antes'),
			foto('b', 'durante'),
			foto('x', 'durante'),
			foto('c', 'despues')
		];
		const r = reordenarFoto(mezcla, {
			fotoId: 'a',
			destinoId: 'c',
			lado: 'antes',
			momento: 'despues'
		});
		expect(ids(r)).toBe('b x a c');
		expect(r.find((f) => f.id === 'a')?.momento).toBe('despues');
		// Al final del grupo DURANTE (la foto sin momento cuenta como DURANTE).
		const r2 = reordenarFoto([...mezcla, foto('n')], {
			fotoId: 'c',
			destinoId: null,
			lado: 'antes',
			momento: 'durante'
		});
		expect(ids(r2)).toBe('a b x n c');
	});

	it('no cambia nada con un destino ajeno o con la misma foto', () => {
		expect(ids(reordenarFoto(fotos, { fotoId: 'a', destinoId: 'z', lado: 'antes' }))).toBe(
			'a b c d'
		);
		expect(ids(reordenarFoto(fotos, { fotoId: 'a', destinoId: 'a', lado: 'antes' }))).toBe(
			'a b c d'
		);
	});
});

describe('moverPaso y moverDeColumna', () => {
	it('intercambia con la vecina visible y salta las ocultas', () => {
		const fotos = ['a', 'b', 'c'].map((id) => foto(id));
		expect(ids(moverPaso(fotos, 'c', -1, 'cuadricula', { b: true }))).toBe('c a b');
		expect(ids(moverPaso(fotos, 'a', -1, 'cuadricula'))).toBe('a b c');
	});

	it('se mueve dentro de su columna en antes/durante/después', () => {
		const fotos = [foto('a', 'antes'), foto('b', 'durante'), foto('c', 'antes')];
		expect(ids(moverPaso(fotos, 'c', -1, 'antes_durante_despues'))).toBe('c a b');
	});

	it('pasa a la columna vecina en la misma posición o al final', () => {
		const fotos = [foto('a', 'antes'), foto('b', 'antes'), foto('c', 'durante')];
		const r = moverDeColumna(fotos, 'b', 1);
		expect(r.find((f) => f.id === 'b')?.momento).toBe('durante');
		expect(ids(r)).toBe('a c b');
		const r2 = moverDeColumna(fotos, 'a', 1);
		expect(ids(r2)).toBe('b a c');
		expect(ids(moverDeColumna(fotos, 'a', -1))).toBe('a b c');
	});
});

describe('giro', () => {
	it('avanza en múltiplos de 90° en ambos sentidos', () => {
		expect(girar(0, 1)).toBe(90);
		expect(girar(270, 1)).toBe(0);
		expect(girar(0, -1)).toBe(270);
	});

	it('escala una foto girada para que quepa completa en su marco', () => {
		const marco = { ancho: 400, alto: 300 };
		expect(escalaGirada({ ancho: 1600, alto: 1200 }, 0, marco)).toBe(1);
		// 4:3 en un marco 4:3 ocupa 400 × 300; girada mide 300 × 400 y debe bajar a 300 de alto.
		expect(escalaGirada({ ancho: 1600, alto: 1200 }, 90, marco)).toBeCloseTo(0.75);
		expect(escalaGirada({ ancho: 1200, alto: 1600 }, 270, marco)).toBeCloseTo(1.333, 2);
	});
});
