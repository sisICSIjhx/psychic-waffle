import { describe, expect, it } from 'vitest';
import {
	cuadriculaFotos,
	descripcionPartida,
	fechasEjecucion,
	nombreArchivoFotografico,
	nombresDeHoja,
	periodoContrato,
	periodoEstimado,
	repartirHojas,
	textoActividad,
	textoPagina
} from './reporte-fotografico';
import { formatoDeDocumento, TIPOS_DOCUMENTO } from './tipos-documento';

const dia = (fecha: string) => ({ desde: fecha, hasta: fecha });

describe('textos de fechas y periodos', () => {
	it('une los días sueltos y escribe los tramos con «DEL … AL …»', () => {
		expect(fechasEjecucion([dia('2026-09-03')])).toBe('03/09/2026');
		expect(fechasEjecucion([dia('2026-09-01'), dia('2026-09-07')])).toBe('01/09/2026 Y 07/09/2026');
		expect(
			fechasEjecucion([
				dia('2026-09-01'),
				dia('2026-09-07'),
				{ desde: '2026-09-15', hasta: '2026-09-30' }
			])
		).toBe('01/09/2026, 07/09/2026 Y DEL 15/09/2026 AL 30/09/2026');
	});

	it('rechaza fechas inexistentes, tramos invertidos y la falta de días', () => {
		expect(() => fechasEjecucion([])).toThrow(RangeError);
		expect(() => fechasEjecucion([dia('2026-02-30')])).toThrow(RangeError);
		expect(() => fechasEjecucion([{ desde: '2026-09-10', hasta: '2026-09-01' }])).toThrow(
			RangeError
		);
	});

	it('escribe el periodo estimado y el de contrato como en el formato', () => {
		expect(periodoEstimado({ desde: '2026-09-01', hasta: '2026-09-30' })).toBe(
			'01 SEPTIEMBRE 2026 AL 30 SEPTIEMBRE 2026'
		);
		expect(periodoContrato({ desde: '2026-03-01', hasta: '2027-02-28' })).toBe(
			'DEL 01 DE MARZO 2026 AL 28 DE FEBRERO 2027'
		);
	});

	it('arma la descripción con la actividad, el sitio y las fechas en otro renglón', () => {
		expect(
			descripcionPartida({
				actividad: '  Toma de potenciales   tubo-suelo. ',
				sitio: 'em-00000',
				dias: [dia('2026-07-07')]
			})
		).toBe('TOMA DE POTENCIALES TUBO-SUELO (EM-00000)\nFECHA DE EJECUCIÓN: 07/07/2026');
		// El sitio no se repite si la actividad ya lo menciona, y puede faltar.
		expect(
			descripcionPartida({
				actividad: 'Celaje terrestre (EM-00000)',
				sitio: 'EM-00000',
				dias: [dia('2026-07-07')]
			})
		).toBe('CELAJE TERRESTRE (EM-00000)\nFECHA DE EJECUCIÓN: 07/07/2026');
		expect(
			descripcionPartida({ actividad: 'Celaje', sitio: null, dias: [dia('2026-07-07')] })
		).toBe('CELAJE\nFECHA DE EJECUCIÓN: 07/07/2026');
	});

	it('numera las actividades y la página', () => {
		expect(textoActividad(2, '  Limpieza   física. ')).toBe('2._ Limpieza física.');
		expect(textoPagina(3, 33)).toBe('3 DE 33');
	});
});

describe('cuadrícula de fotos', () => {
	it('crece hasta 4 × 2 según el número de fotos', () => {
		expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => cuadriculaFotos(n))).toEqual([
			{ columnas: 1, filas: 1 },
			{ columnas: 1, filas: 1 },
			{ columnas: 2, filas: 1 },
			{ columnas: 2, filas: 2 },
			{ columnas: 2, filas: 2 },
			{ columnas: 3, filas: 2 },
			{ columnas: 3, filas: 2 },
			{ columnas: 4, filas: 2 },
			{ columnas: 4, filas: 2 }
		]);
		expect(() => cuadriculaFotos(9)).toThrow(RangeError);
	});
});

describe('nombres de hoja', () => {
	it('repite la partida con «(2)», «(3)» y evita los nombres reservados', () => {
		expect(nombresDeHoja([1, 13, 13, 13, '7A'])).toEqual(['1', '13', '13 (2)', '13 (3)', '7A']);
		expect(nombresDeHoja(['hoja maestra', 'Hoja Maestra'], ['HOJA MAESTRA'])).toEqual([
			'hoja maestra (2)',
			'Hoja Maestra (3)'
		]);
	});

	it('quita los caracteres que Excel no admite y limita el largo', () => {
		const [nombre, vacio] = nombresDeHoja(["'26/02: [a]*?\\", ' ']);
		expect(nombre).toBe('26 02 a');
		expect(vacio).toBe('Reporte');
		const [largo, repetido] = nombresDeHoja(['x'.repeat(60), 'x'.repeat(60)]);
		expect(largo).toHaveLength(25);
		expect(repetido).toBe(`${'x'.repeat(25)} (2)`);
		expect(repetido.length).toBeLessThanOrEqual(31);
	});
});

describe('reparto en hojas', () => {
	const actividades = ['Inspección', 'Limpieza', 'Pintura'];

	it('da una hoja por reporte y hojas de continuación cuando sobran fotos', () => {
		const hojas = repartirHojas([
			{ numeroPartida: 1, actividades, fotos: [1, 1, 2] },
			{ numeroPartida: 13, actividades, fotos: Array.from({ length: 17 }, (_, i) => (i % 3) + 1) },
			{ numeroPartida: 29, actividades, fotos: [] }
		]);
		expect(hojas.map((h) => [h.nombre, h.reporte, h.fotos.length, h.pagina, h.total])).toEqual([
			['1', 0, 3, 1, 5],
			['13', 1, 8, 2, 5],
			['13 (2)', 1, 8, 3, 5],
			['13 (3)', 1, 1, 4, 5],
			['29', 2, 0, 5, 5]
		]);
		// Las hojas de continuación repiten la lista completa y siguen el orden de las fotos.
		expect(hojas[2].actividades).toEqual(hojas[1].actividades);
		expect(hojas[1].actividades.map((a) => a.numero)).toEqual([1, 2, 3]);
		expect(hojas[2].fotos).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
		expect(hojas[3].fotos).toEqual([16]);
	});

	it('parte la lista de actividades que no cabe y lleva cada foto con su tramo', () => {
		const muchas = Array.from({ length: 14 }, (_, i) => `Actividad ${i + 1}`);
		const hojas = repartirHojas([
			// Fotos de las actividades 1, 13 y 14, una sin actividad y otra con un número que no existe.
			{ numeroPartida: 16, actividades: muchas, fotos: [1, 13, 14, null, 99] }
		]);
		expect(hojas).toHaveLength(2);
		expect(hojas[0].actividades.map((a) => a.numero)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
		]);
		expect(hojas[0].fotos).toEqual([0, 3, 4]);
		expect(hojas[1].actividades.map((a) => a.numero)).toEqual([13, 14]);
		expect(hojas[1].fotos).toEqual([1, 2]);
		expect(hojas.map((h) => h.nombre)).toEqual(['16', '16 (2)']);
	});

	it('omite las actividades en blanco sin renumerar y respeta las fotos por hoja pedidas', () => {
		const hojas = repartirHojas(
			[{ numeroPartida: 4, actividades: ['Uno', '  ', 'Tres'], fotos: [1, 3, 3, 1, 1] }],
			{ fotosPorHoja: 2 }
		);
		expect(hojas[0].actividades).toEqual([
			{ numero: 1, texto: 'Uno' },
			{ numero: 3, texto: 'Tres' }
		]);
		expect(hojas.map((h) => h.fotos)).toEqual([[0, 1], [2, 3], [4]]);
		expect(() => repartirHojas([], { fotosPorHoja: 9 })).toThrow(RangeError);
	});
});

describe('nombre del archivo y formato de descarga', () => {
	it('usa solo caracteres válidos y la extensión del formato declarado', () => {
		expect(
			nombreArchivoFotografico({ contrato: 'CONTRATO-PRUEBA/001', estimacion: '07 (parcial)' })
		).toBe('REPORTE-FOTOGRAFICO_CONTRATO-PRUEBA-001_EST-07-PARCIAL.xlsx');
		expect(nombreArchivoFotografico({ contrato: '', estimacion: '' })).toBe(
			'REPORTE-FOTOGRAFICO_EST-0.xlsx'
		);
	});

	it('cada tipo de documento declara su formato: Word el reporte y Excel el fotográfico', () => {
		expect(TIPOS_DOCUMENTO['reporte-mantenimiento'].formato).toBe('docx');
		expect(formatoDeDocumento('reporte-mantenimiento')).toMatchObject({
			extension: '.docx',
			mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		});
		expect(formatoDeDocumento('reporte-fotografico')).toMatchObject({
			extension: '.xlsx',
			mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		});
	});
});
