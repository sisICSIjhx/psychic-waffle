import { describe, expect, it } from 'vitest';
import {
	abreviarActividad,
	agruparAntesDuranteDespues,
	agruparCuadricula,
	fechaEncabezado,
	fechasEncabezado,
	nombreArchivo,
	numeracionSecciones,
	ordenDeAparicion,
	pieIlustracion,
	textoPeriodo,
	semanasDelMes,
	textoTags,
	tituloPortada,
	tituloReporte,
	type MomentoFoto
} from './documento';

describe('título del reporte', () => {
	it('compone partida, actividad, mes y año', () => {
		expect(
			tituloReporte({
				numeroPartida: 7,
				actividad: 'Toma de Potenciales Tubo-Suelo.',
				periodo: { anio: 2026, mes: 5 }
			})
		).toBe('07.- TOMA DE POTENCIALES TUBO-SUELO. MAYO 2026');
	});

	it('incluye la semana cuando la periodicidad es menor a mensual', () => {
		const periodo = { anio: 2026, mes: 5, ocurrencia: { tipo: 'semana' as const, numero: 2 } };
		expect(tituloReporte({ numeroPartida: '15', actividad: 'Orden y limpieza', periodo })).toBe(
			'15.- ORDEN Y LIMPIEZA. SEMANA 2 MAYO 2026'
		);
		expect(textoPeriodo(periodo)).toBe('SEMANA 2 MAYO 2026');
	});

	it('separa la portada en actividad y periodo', () => {
		expect(
			tituloPortada({
				numeroPartida: 16,
				actividad: 'Verificación a PSV 1801',
				periodo: { anio: 2026, mes: 5 }
			})
		).toEqual({ linea1: '16.- VERIFICACIÓN A PSV 1801.', linea2: 'MAYO 2026' });
	});

	it('rechaza periodos inválidos', () => {
		expect(() => textoPeriodo({ anio: 2026, mes: 13 })).toThrow(RangeError);
		expect(() =>
			textoPeriodo({ anio: 2026, mes: 5, ocurrencia: { tipo: 'semana', numero: 0 } })
		).toThrow(RangeError);
	});

	it('limita la ocurrencia según su tipo y el calendario del mes', () => {
		expect(semanasDelMes(2026, 2)).toBe(5);
		expect(semanasDelMes(2026, 3)).toBe(6);
		const periodo = (tipo: 'semana' | 'quincena' | 'dia', numero: number, mes = 2) => ({
			anio: 2026,
			mes,
			ocurrencia: { tipo, numero }
		});
		expect(textoPeriodo(periodo('semana', 5))).toBe('SEMANA 5 FEBRERO 2026');
		expect(() => textoPeriodo(periodo('semana', 6))).toThrow(/máximo 5/);
		expect(() => textoPeriodo(periodo('quincena', 3))).toThrow(RangeError);
		expect(textoPeriodo(periodo('dia', 28))).toBe('DÍA 28 FEBRERO 2026');
		expect(() => textoPeriodo(periodo('dia', 29))).toThrow(RangeError);
		expect(() => textoPeriodo(periodo('dia', 32, 1))).toThrow(RangeError);
	});
});

describe('numeración de ilustraciones', () => {
	it('usa la posición del alcance y de la foto', () => {
		expect(pieIlustracion(2, 1)).toBe('Ilustración 2.2.1');
		expect(pieIlustracion(3, 10, ' Verificación al 100% ')).toBe(
			'Ilustración 2.3.10 Verificación al 100%'
		);
		expect(() => pieIlustracion(0, 1)).toThrow(RangeError);
	});

	it('renumera al reordenar: la tercera foto pasa a 2.2.1', () => {
		const fotos = ['a', 'b', 'c'];
		const reordenadas = [fotos[2], fotos[0], fotos[1]];
		expect(reordenadas.map((foto, i) => pieIlustracion(2, i + 1, foto))).toEqual([
			'Ilustración 2.2.1 c',
			'Ilustración 2.2.2 a',
			'Ilustración 2.2.3 b'
		]);
	});
});

describe('agrupación de fotos', () => {
	it('arma filas de dos en cuadrícula', () => {
		expect(agruparCuadricula([1, 2, 3])).toEqual([
			{ izq: 1, der: 2 },
			{ izq: 3, der: null }
		]);
		expect(agruparCuadricula([])).toEqual([]);
	});

	it('alinea antes, durante y después por fila', () => {
		const foto = (id: string, momento?: MomentoFoto) => ({ id, momento });
		const filas = agruparAntesDuranteDespues([
			foto('a1', 'antes'),
			foto('d1', 'despues'),
			foto('u1', 'durante'),
			foto('a2', 'antes'),
			foto('x')
		]);
		expect(filas.map((f) => [f.antes?.id, f.durante?.id, f.despues?.id])).toEqual([
			['a1', 'u1', 'd1'],
			['a2', 'x', undefined]
		]);
	});

	it('numera en el orden en que aparecen en el documento', () => {
		const fotos = [
			{ id: 'despues', momento: 'despues' as const },
			{ id: 'antes', momento: 'antes' as const },
			{ id: 'durante', momento: 'durante' as const }
		];
		expect(ordenDeAparicion(fotos, 'antes_durante_despues').map((f) => f.id)).toEqual([
			'antes',
			'durante',
			'despues'
		]);
		expect(ordenDeAparicion(fotos, 'cuadricula').map((f) => f.id)).toEqual([
			'despues',
			'antes',
			'durante'
		]);
	});
});

describe('secciones', () => {
	it('numera conclusiones según la tabla de verificación', () => {
		expect(numeracionSecciones(false)).toMatchObject({ verificacion: null, conclusiones: 4 });
		expect(numeracionSecciones(true)).toMatchObject({ verificacion: 4, conclusiones: 5 });
	});
});

describe('nombre de archivo', () => {
	const base = {
		numeroPartida: 13,
		actividad: 'Mantenimiento y verificación de indicadores de presión (manómetros)',
		periodo: { anio: 2026, mes: 6 }
	};

	it('usa el nombre corto, el TAG y el periodo', () => {
		expect(nombreArchivo({ ...base, actividadCorta: 'Manómetros', tags: ['PI-0001'] })).toBe(
			'P13_MANOMETROS_PI-0001_2026-06.docx'
		);
	});

	it('resume varios TAG con el primero y «+N»', () => {
		expect(
			nombreArchivo({
				...base,
				numeroPartida: 17,
				actividadCorta: 'Manómetros',
				periodo: { anio: 2026, mes: 5 },
				tags: ['PI-0001', 'PI-1001', 'PI-1002']
			})
		).toBe('P17_MANOMETROS_PI-0001+2_2026-05.docx');
	});

	it('omite el TAG si no hay y abrevia la actividad sin caracteres inválidos', () => {
		const nombre = nombreArchivo({
			numeroPartida: '6',
			actividad: 'Mantenimiento a Postes Tipo "R" (Protección Catódica): <revisión>?',
			periodo: { anio: 2026, mes: 5, ocurrencia: { tipo: 'semana', numero: 3 } }
		});
		expect(nombre).toBe('P06_MANTENIMIENTO-POSTES-TIPO-R_2026-05-S3.docx');
		expect(nombre).not.toMatch(/[<>:"/\\|?*\s]/);
	});

	it('limita el largo de la abreviatura', () => {
		expect(
			abreviarActividad('Inspección y mantenimiento a fuente de poder UPS').length
		).toBeLessThanOrEqual(30);
		expect(abreviarActividad('¡!')).toBe('REPORTE');
	});
});

describe('encabezado', () => {
	it('formatea la fecha completa', () => {
		expect(fechaEncabezado('2026-05-18')).toBe('18 / MAYO / 2026');
	});

	it('formatea varios días respetando la forma capturada', () => {
		const d = (desde: string, hasta = desde) => ({
			desde: `2026-05-${desde}`,
			hasta: `2026-05-${hasta}`
		});
		expect(fechasEncabezado([d('18')])).toBe('18 / MAYO / 2026');
		expect(fechasEncabezado([d('05', '08')])).toBe('05-08 / MAYO / 2026');
		expect(fechasEncabezado([d('02'), d('03'), d('04')])).toBe('02, 03, 04 / MAYO / 2026');
		expect(fechasEncabezado([d('15'), d('16'), d('20', '25')])).toBe('15, 16, 20-25 / MAYO / 2026');
		expect(() => fechasEncabezado([])).toThrow(RangeError);
		expect(() => fechasEncabezado([d('30'), { desde: '2026-06-01', hasta: '2026-06-01' }])).toThrow(
			/un solo mes/
		);
	});

	it('rechaza fechas incompletas o inexistentes', () => {
		expect(() => fechaEncabezado('2026-05')).toThrow(RangeError);
		expect(() => fechaEncabezado('2026-02-30')).toThrow(RangeError);
	});

	it('lista los TAG o indica N/A', () => {
		expect(textoTags([])).toBe('N/A');
		expect(textoTags(['PI-0001', ' PI-1001 '])).toBe('PI-0001, PI-1001');
	});
});
