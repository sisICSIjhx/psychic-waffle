import { describe, expect, it } from 'vitest';
import { partidasDelMes } from '$lib/dominio/seguimiento-operativo';
import type {
	ActividadSeguimiento,
	ConceptoSeguimientoOperativo
} from '$lib/server/repositorios/seguimiento';
import {
	ANCLA_VALIDA,
	alGuardar,
	anclaDePartida,
	avanceDeDocumentos,
	avanceDePartida,
	claveValor,
	mesVecino,
	ordenarPartidas,
	partidasAbiertas,
	resultadoDe,
	textoDiaMes,
	ultimoDiaDelMes,
	type MapaValores
} from './captura';

const HOY = '2026-11-12';

function actividad(
	grupo: string,
	ordinal: number | null,
	extra: Partial<ActividadSeguimiento> = {}
): ActividadSeguimiento {
	return {
		clave: ordinal ? `${grupo}:${ordinal}` : grupo,
		nombre: grupo,
		ordinal,
		fecha: null,
		ejecutada: false,
		programada: true,
		grupo,
		partida: grupo,
		manual: false,
		...extra
	};
}

function concepto(
	id: string,
	nivel: ConceptoSeguimientoOperativo['nivel'],
	extra: Partial<ConceptoSeguimientoOperativo> = {}
): ConceptoSeguimientoOperativo {
	return {
		id,
		etiqueta: id,
		bloque: 'documentos',
		tipo: 'casilla',
		nivel,
		indicador: null,
		porDefinir: false,
		carpetaId: null,
		...extra
	};
}

const valoresDe = (pares: [string | null, string, boolean | string][]): MapaValores =>
	new Map(pares.map(([a, c, v]) => [claveValor(a, c), v]));

describe('anclas y textos de la captura', () => {
	it('el ancla de una partida sirve de id y de fragmento', () => {
		const ancla = anclaDePartida('a:11111111-aaaa:22222222-bbbb');
		expect(ancla).toBe('p-a-11111111-aaaa-22222222-bbbb');
		expect(ANCLA_VALIDA.test(ancla)).toBe(true);
		expect(ANCLA_VALIDA.test(`${ancla}-e12`)).toBe(true);
		expect(ANCLA_VALIDA.test('con espacio')).toBe(false);
		expect(ANCLA_VALIDA.test('"><script>')).toBe(false);
	});

	it('escribe fechas cortas y recorre los meses', () => {
		expect(textoDiaMes('2026-11-05')).toBe('5 nov');
		expect(textoDiaMes(null)).toBe('');
		expect(mesVecino('2026-12', 1)).toBe('2027-01');
		expect(mesVecino('2026-01', -1)).toBe('2025-12');
		expect(ultimoDiaDelMes('2026-11')).toBe('2026-11-30');
		expect(ultimoDiaDelMes('2028-02')).toBe('2028-02-29');
	});

	it('solo la tarjeta que originó el envío recibe el mensaje', () => {
		const captura = { enviando: ['b'], ancla: 'a', mensaje: 'Guardado.' };
		expect(resultadoDe(captura, 'a')).toEqual({
			fase: 'guardado',
			mensaje: 'Guardado.',
			error: null
		});
		expect(resultadoDe(captura, 'b')).toEqual({ fase: 'enviando', mensaje: null, error: null });
		expect(resultadoDe(captura, 'c')).toEqual({ fase: 'reposo', mensaje: null, error: null });
		// Mientras se reenvía, la respuesta anterior deja de mostrarse.
		expect(resultadoDe({ enviando: ['a'], ancla: 'a', error: 'No' }, 'a')).toMatchObject({
			fase: 'enviando',
			error: null
		});
	});

	it('alGuardar solo avisa cuando el envío terminó bien', async () => {
		let avisos = 0;
		const enviar = alGuardar(
			() => async () => {},
			() => avisos++
		);
		const fin = await enviar({} as never);
		await fin?.({ result: { type: 'failure', status: 400 } } as never);
		expect(avisos).toBe(0);
		await fin?.({ result: { type: 'success', status: 200 } } as never);
		expect(avisos).toBe(1);
	});
});

describe('avance de documentos y partidas', () => {
	const conceptos = [
		concepto('odt', 'actividad'),
		concepto('reporte', 'partida'),
		concepto('nuevo', 'actividad', { porDefinir: true }),
		concepto('cobrada', 'actividad', { indicador: 'actividad_cobrada' }),
		concepto('bitacora', 'actividad', { tipo: 'estado' })
	];

	it('espera documentos solo de lo ejecutado, sin los por definir ni los que tienen indicador', () => {
		const [partida] = partidasDelMes([
			actividad('p', 1, { ejecutada: true }),
			actividad('p', 2, { ejecutada: true }),
			actividad('p', 3)
		]);
		const valores = valoresDe([
			['p:1', 'odt', true],
			['p:1', 'reporte', true],
			['p:1', 'bitacora', 'hecho'],
			['p:2', 'bitacora', 'en_proceso'],
			['p:3', 'odt', true]
		]);
		// Dos ejecuciones × (ODT + bitácora) + el reporte de la partida.
		expect(avanceDeDocumentos(conceptos, [partida], valores)).toEqual({ esperados: 5, hechos: 3 });
		expect(avanceDePartida(partida, conceptos, valores)).toEqual({
			programadas: 3,
			ejecutadas: 2,
			faltanDocumentos: 2,
			completa: false
		});
	});

	it('una partida está completa con todo ejecutado y todos sus documentos', () => {
		const [partida] = partidasDelMes([actividad('p', null, { ejecutada: true })]);
		const valores = valoresDe([
			['p', 'odt', true],
			['p', 'reporte', true],
			['p', 'bitacora', 'hecho']
		]);
		expect(avanceDePartida(partida, conceptos, valores).completa).toBe(true);
		expect(avanceDePartida(partida, conceptos, new Map()).completa).toBe(false);
	});
});

describe('orden y partidas abiertas al cargar', () => {
	it('ordena las del programa por su número y deja al final las escritas a mano', () => {
		const partidas = partidasDelMes([
			actividad('m:1', null, { partida: 'Antes de todo', manual: true }),
			actividad('a', null, { partida: '12 · Doce' }),
			actividad('b', null, { partida: '2 · Dos' }),
			actividad('c', null, { partida: '1 · Uno' })
		]);
		expect(ordenarPartidas(partidas).map((p) => p.partida)).toEqual([
			'1 · Uno',
			'2 · Dos',
			'12 · Doce',
			'Antes de todo'
		]);
	});

	it('con poco pendiente abre todo lo que falta; con mucho, lo empezado o lo de hoy', () => {
		const pocas = partidasDelMes([
			actividad('a', null, { ejecutada: true }),
			actividad('b', null),
			actividad('c', 1),
			actividad('c', 2)
		]);
		expect([...partidasAbiertas(pocas, [], new Map(), HOY)]).toEqual(['b', 'c']);

		const diarias = (grupo: string, extra: Partial<ActividadSeguimiento>[] = []) =>
			Array.from({ length: 10 }, (_, i) => actividad(grupo, i + 1, extra[i] ?? {}));
		const muchas = partidasDelMes([...diarias('a'), ...diarias('b'), ...diarias('c')]);
		// Nada empezado: solo la primera, para que se vea cómo se marca.
		expect([...partidasAbiertas(muchas, [], new Map(), HOY)]).toEqual(['a']);

		const enCurso = partidasDelMes([
			...diarias('a'),
			...diarias('b', [{ ejecutada: true }]),
			...diarias('c', [{}, { fecha: HOY }])
		]);
		expect([...partidasAbiertas(enCurso, [], new Map(), HOY)]).toEqual(['b', 'c']);
	});
});
