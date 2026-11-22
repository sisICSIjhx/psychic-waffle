import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { leerLibro, referenciaACoordenadas, valorEn, type Hoja } from '../importacion/xlsx';
import { plantillaFotograficoVigente } from '../plantillas/vigente';
import { auditarPaquete } from './auditoria';
import {
	generarReporteFotografico,
	reporteFotograficoDe,
	VERSION_PLANTILLA_FOTOGRAFICO,
	type FotoFotografico,
	type LibroFotografico,
	type ReporteFotografico
} from './fotografico';
import type { ReporteDocumento } from './generar';
import { anclasDe, combinadasDe, EMU_POR_CM, ponerCelda, serieExcel } from './libro-xlsx';

const PLANTILLA = new URL('../plantillas/REPORTE-FOTOGRAFICO.v1.xlsx', import.meta.url);
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function foto(ancho: number, alto: number, color = '#7a8b99') {
	return sharp({ create: { width: ancho, height: alto, channels: 3, background: color } })
		.jpeg()
		.toBuffer();
}

async function fotos(cantidad: number, actividades: number): Promise<FotoFotografico[]> {
	const horizontal = await foto(160, 120);
	const vertical = await foto(90, 160, '#445566');
	return Array.from({ length: cantidad }, (_, i) => ({
		datos: i % 4 === 3 ? vertical : horizontal,
		descripcion: `Foto ficticia ${i + 1}`,
		actividad: (i % actividades) + 1
	}));
}

async function libroBase(reportes?: ReporteFotografico[]): Promise<LibroFotografico> {
	return {
		estimacion: {
			numero: '07 (PARCIAL)',
			fechaEntrega: '2026-10-02',
			periodo: { desde: '2026-09-01', hasta: '2026-09-30' }
		},
		contrato: {
			cliente: 'CLIENTE DE PRUEBA, S.A. DE C.V.',
			numero: 'CONTRATO-PRUEBA-001',
			ordenCompra: 'OC00000',
			descripcion: 'SERVICIO DE PRUEBA <A & B> DE LA ESTACIÓN (EM-00000).',
			vigencia: { desde: '2026-03-01', hasta: '2027-02-28' },
			importe: 123456.78,
			contratista: 'CONTRATISTA DE PRUEBA, S.A. DE C.V.'
		},
		firmas: {
			contratista: {
				nombre: 'Persona Ficticia Uno',
				cargo: 'Administrador de prueba',
				empresa: 'Empresa A'
			},
			autoriza: {
				nombre: 'Persona Ficticia Dos',
				cargo: 'Supervisor de prueba',
				empresa: 'Empresa B'
			}
		},
		reportes: reportes ?? [
			{
				numeroPartida: 13,
				actividad: 'Mantenimiento y verificación de indicadores de presión (manómetros)',
				sitio: 'EM-00000',
				dias: [
					{ desde: '2026-09-03', hasta: '2026-09-03' },
					{ desde: '2026-09-07', hasta: '2026-09-07' }
				],
				actividades: ['Inspección visual.', 'Desmontaje de indicadores.', 'Limpieza física.'],
				fotos: await fotos(9, 3)
			},
			{
				numeroPartida: 4,
				actividad: 'Mantenimiento preventivo a postes',
				sitio: 'EM-00000',
				dias: [{ desde: '2026-09-15', hasta: '2026-09-20' }],
				actividades: ['Inspección visual.', 'Aplicación de pintura.'],
				fotos: await fotos(3, 2)
			}
		]
	};
}

interface Forma {
	columna: number;
	fila: number;
	ancho: number;
	alto: number;
	nombre: string;
	texto: string | null;
	imagen: string | null;
}

async function abrir(xlsx: Uint8Array) {
	const zip = await JSZip.loadAsync(xlsx);
	const leer = (parte: string) => zip.file(parte)!.async('string');
	const hojas = await leerLibro(xlsx);
	const xmlHoja = (numero: number) => leer(`xl/worksheets/sheet${numero}.xml`);
	/** Formas del dibujo de una hoja de reporte (la hoja 2 del libro usa el dibujo 1). */
	async function formas(numero: number): Promise<Forma[]> {
		const dibujo = await leer(`xl/drawings/drawing${numero - 1}.xml`);
		const relaciones = await leer(`xl/drawings/_rels/drawing${numero - 1}.xml.rels`);
		const destinos = new Map(
			[...relaciones.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]])
		);
		return anclasDe(dibujo).map((ancla) => {
			const numeroDe = (etiqueta: string) =>
				Number(new RegExp(`<xdr:${etiqueta}>(\\d+)</xdr:${etiqueta}>`).exec(ancla)![1]);
			const tamano = /<xdr:ext cx="(\d+)" cy="(\d+)"\/>/.exec(ancla)!;
			const relacion = /r:embed="([^"]+)"/.exec(ancla)?.[1];
			return {
				columna: numeroDe('col'),
				fila: numeroDe('row'),
				ancho: Number(tamano[1]),
				alto: Number(tamano[2]),
				nombre: /<xdr:cNvPr id="\d+" name="([^"]*)"/.exec(ancla)![1],
				texto: /<a:t>([^<]*)<\/a:t>/.exec(ancla)?.[1] ?? null,
				imagen: relacion ? (destinos.get(relacion)?.replace('../', 'xl/') ?? 'sin destino') : null
			};
		});
	}
	return { zip, leer, hojas, xmlHoja, formas };
}

const celda = (hoja: Hoja, referencia: string) => {
	const { fila, columna } = referenciaACoordenadas(referencia);
	return valorEn(hoja, fila, columna);
};

/** Comprueba que cada parte XML tenga las etiquetas balanceadas (Excel rechaza lo contrario). */
function etiquetasBalanceadas(xml: string): boolean {
	const pila: string[] = [];
	for (const m of xml.matchAll(/<(\/)?([\w:.-]+)(?:\s[^<>]*?)?(\/)?>/g)) {
		if (m[3]) continue;
		if (!m[1]) pila.push(m[2]);
		else if (pila.pop() !== m[2]) return false;
	}
	return pila.length === 0;
}

describe('plantilla del reporte fotográfico', () => {
	it('solo contiene los rótulos del formato, el logotipo de ICSI y ningún dato', async () => {
		const plantilla = await readFile(PLANTILLA);
		const { zip, hojas, leer } = await abrir(plantilla);
		expect(hojas.map((h) => h.nombre)).toEqual(['HOJA MAESTRA', 'REPORTE']);
		expect(Object.keys(zip.files).filter((n) => n.startsWith('xl/media/'))).toEqual([
			'xl/media/logo_icsi.png'
		]);
		for (const parte of ['xl/sharedStrings.xml', 'xl/calcChain.xml', 'xl/printerSettings']) {
			expect(Object.keys(zip.files).some((n) => n.startsWith(parte))).toBe(false);
		}
		const textos = hojas
			.flatMap((h) => h.filas.flat())
			.filter((v) => v !== null && v !== undefined);
		expect(textos.every((t) => typeof t === 'string')).toBe(true);
		expect(new Set(textos.map((t) => String(t).replace(/_+/g, '_').trim()))).toEqual(
			new Set([
				'FECHA DE ENTREGA DE ESTIMACIÓN:',
				'PERIODO ESTIMADO:',
				'ESTIMACION No.',
				'CONTRATO No.',
				'ORDEN DE COMPRA:',
				'DESCRIPCION DE LA OBRA O SERVICIO:',
				'PERIODO DE CONTRATO:',
				'IMPORTE CONTRATADO:',
				'CONTRATISTA:',
				'PAGINA',
				'REPORTE FOTOGRAFICO',
				'PARTIDA',
				'DESCRIPCION',
				'CONTRATISTA',
				'AUTORIZA',
				'_'
			])
		);
		expect(await auditarPaquete(plantilla)).toEqual([]);
		const modelo = await leer('xl/worksheets/sheet2.xml');
		expect(modelo).toMatch(/<pageSetup[^>]*orientation="landscape"/);
		expect(modelo).toContain('<pageSetUpPr fitToPage="1"/>');
		expect(combinadasDe(modelo)).toEqual(
			expect.arrayContaining(['G1:K4', 'M1:P4', 'F7:J10', 'C13:P14', 'D16:P18', 'D48:H48'])
		);
	});

	it('la plantilla empaquetada por Vite es la del repositorio', async () => {
		expect(Buffer.from(await plantillaFotograficoVigente()).equals(await readFile(PLANTILLA))).toBe(
			true
		);
	});
});

describe('generación del reporte fotográfico en Excel', () => {
	it('crea la hoja maestra y una hoja por reporte, con continuación si sobran fotos', async () => {
		const resultado = await generarReporteFotografico(await libroBase());
		expect(resultado).toMatchObject({
			nombreArchivo: 'REPORTE-FOTOGRAFICO_CONTRATO-PRUEBA-001_EST-07-PARCIAL.xlsx',
			tipo: 'reporte-fotografico',
			mime: MIME,
			versionPlantilla: VERSION_PLANTILLA_FOTOGRAFICO,
			fotos: 12,
			bytes: resultado.xlsx.length
		});
		expect(resultado.hojas).toEqual([
			{ nombre: '13', pagina: 1, reporte: 0, fotos: 8 },
			{ nombre: '13 (2)', pagina: 2, reporte: 0, fotos: 1 },
			{ nombre: '4', pagina: 3, reporte: 1, fotos: 3 }
		]);
		const { hojas, leer, zip } = await abrir(resultado.xlsx);
		expect(hojas.map((h) => h.nombre)).toEqual(['HOJA MAESTRA', '13', '13 (2)', '4']);

		const [maestra, primera, segunda, tercera] = hojas;
		expect(celda(maestra, 'E3')).toBe(serieExcel('2026-10-02'));
		expect(celda(maestra, 'E6')).toBe('01 SEPTIEMBRE 2026 AL 30 SEPTIEMBRE 2026');
		expect(celda(maestra, 'E9')).toBe('07 (PARCIAL)');

		for (const [hoja, pagina] of [
			[primera, '1 DE 3'],
			[segunda, '2 DE 3'],
			[tercera, '3 DE 3']
		] as const) {
			expect(celda(hoja, 'G1')).toBe('CLIENTE DE PRUEBA, S.A. DE C.V.');
			expect(celda(hoja, 'F5')).toBe('CONTRATO-PRUEBA-001');
			expect(celda(hoja, 'F6')).toBe('OC00000');
			expect(celda(hoja, 'F7')).toBe('SERVICIO DE PRUEBA <A & B> DE LA ESTACIÓN (EM-00000).');
			expect(celda(hoja, 'M7')).toBe('DEL 01 DE MARZO 2026 AL 28 DE FEBRERO 2027');
			expect(celda(hoja, 'F11')).toBe(123456.78);
			expect(celda(hoja, 'F12')).toBe('CONTRATISTA DE PRUEBA, S.A. DE C.V.');
			expect(celda(hoja, 'M12')).toBe(pagina);
			// Resultados guardados de las fórmulas que leen la hoja maestra.
			expect(celda(hoja, 'M5')).toBe(serieExcel('2026-10-02'));
			expect(celda(hoja, 'M9')).toBe('01 SEPTIEMBRE 2026 AL 30 SEPTIEMBRE 2026');
			expect(celda(hoja, 'M11')).toBe('07 (PARCIAL)');
			expect(celda(hoja, 'C13')).toBe('REPORTE FOTOGRAFICO');
			expect(celda(hoja, 'D48')).toBe('Persona Ficticia Uno');
			expect(celda(hoja, 'D49')).toBe('Administrador de prueba');
			expect(celda(hoja, 'D50')).toBe('Empresa A');
			expect(celda(hoja, 'L48')).toBe('Persona Ficticia Dos');
			expect(celda(hoja, 'L49')).toBe('Supervisor de prueba');
			expect(celda(hoja, 'L50')).toBe('Empresa B');
		}
		expect(celda(primera, 'C16')).toBe(13);
		expect(celda(primera, 'D16')).toBe(
			'MANTENIMIENTO Y VERIFICACIÓN DE INDICADORES DE PRESIÓN (MANÓMETROS) (EM-00000)\n' +
				'FECHA DE EJECUCIÓN: 03/09/2026 Y 07/09/2026'
		);
		expect(celda(segunda, 'D16')).toBe(celda(primera, 'D16'));
		expect(celda(tercera, 'C16')).toBe(4);
		expect(celda(tercera, 'D16')).toBe(
			'MANTENIMIENTO PREVENTIVO A POSTES (EM-00000)\nFECHA DE EJECUCIÓN: DEL 15/09/2026 AL 20/09/2026'
		);
		// La lista de actividades se repite en la hoja de continuación.
		for (const hoja of [primera, segunda]) {
			expect([38, 39, 40, 41].map((f) => celda(hoja, `D${f}`))).toEqual([
				'1._ Inspección visual.',
				'2._ Desmontaje de indicadores.',
				'3._ Limpieza física.',
				null
			]);
		}
		expect(celda(tercera, 'D39')).toBe('2._ Aplicación de pintura.');

		const libro = await leer('xl/workbook.xml');
		expect(libro).toContain("'13 (2)'!$B$1:$Q$53");
		expect(libro.match(/_xlnm\.Print_Area/g)).toHaveLength(3);
		expect(await leer('xl/worksheets/sheet2.xml')).toContain("<f>'HOJA MAESTRA'!E3</f>");
		expect(zip.file('xl/sharedStrings.xml')).toBeNull();
		expect(await auditarPaquete(resultado.xlsx)).toEqual([]);
	});

	it('conserva la disposición de la plantilla: combinadas, anchos y página horizontal', async () => {
		const plantilla = await abrir(await readFile(PLANTILLA));
		const modelo = await plantilla.xmlHoja(2);
		const { xmlHoja, leer } = await abrir(
			(await generarReporteFotografico(await libroBase())).xlsx
		);
		for (const numero of [2, 3, 4]) {
			const xml = await xmlHoja(numero);
			expect(/<cols>[\s\S]*<\/cols>/.exec(xml)?.[0]).toBe(
				/<cols>[\s\S]*<\/cols>/.exec(modelo)?.[0]
			);
			expect(/<pageSetup[^>]*>/.exec(xml)?.[0]).toBe(/<pageSetup[^>]*>/.exec(modelo)?.[0]);
			expect(/<pageMargins[^>]*>/.exec(xml)?.[0]).toBe(/<pageMargins[^>]*>/.exec(modelo)?.[0]);
			expect(xml).toContain('<pageSetUpPr fitToPage="1"/>');
			expect(combinadasDe(xml)).toEqual(expect.arrayContaining(combinadasDe(modelo)));
			expect(etiquetasBalanceadas(xml)).toBe(true);
		}
		// Cada actividad ocupa su renglón combinado a lo ancho de la zona.
		const combinadas = combinadasDe(await xmlHoja(2));
		expect(combinadas).toEqual(expect.arrayContaining(['D38:O38', 'D39:O39', 'D40:O40']));
		expect(combinadas).toHaveLength(combinadasDe(modelo).length + 3);
		expect((await xmlHoja(2)).match(/tabSelected="1"/g)).toHaveLength(1);
		expect(await xmlHoja(3)).not.toContain('tabSelected');
		expect(await leer('xl/styles.xml')).toBe(await plantilla.leer('xl/styles.xml'));
		for (const parte of ['xl/workbook.xml', '[Content_Types].xml', 'xl/drawings/drawing1.xml']) {
			expect(etiquetasBalanceadas(await leer(parte))).toBe(true);
		}
	});

	it('coloca las fotos en la zona de fotos con el círculo de su actividad', async () => {
		const { formas, zip, leer } = await abrir(
			(await generarReporteFotografico(await libroBase())).xlsx
		);
		const primera = await formas(2);
		const fotosPrimera = primera.filter((f) => f.nombre.startsWith('Foto '));
		expect(primera[0]).toMatchObject({ nombre: 'Logotipo ICSI', imagen: 'xl/media/logo_icsi.png' });
		expect(fotosPrimera).toHaveLength(8);
		for (const forma of fotosPrimera) {
			// Zona de fotos: columnas C a P y filas 19 a 37 (en base 0).
			expect(forma.columna).toBeGreaterThanOrEqual(2);
			expect(forma.columna).toBeLessThanOrEqual(15);
			expect(forma.fila).toBeGreaterThanOrEqual(18);
			expect(forma.fila).toBeLessThanOrEqual(36);
			expect(forma.ancho).toBeLessThanOrEqual(11 * EMU_POR_CM);
			expect(forma.alto).toBeLessThanOrEqual(8.25 * EMU_POR_CM);
			expect(zip.file(forma.imagen!)).not.toBeNull();
		}
		// Las horizontales (4:3) llenan la caja de 11 × 8.25 cm; la vertical se ajusta al alto.
		expect(fotosPrimera[0].ancho / EMU_POR_CM).toBeCloseTo(11, 1);
		expect(fotosPrimera[0].alto / EMU_POR_CM).toBeCloseTo(8.25, 1);
		expect(fotosPrimera[3].alto / EMU_POR_CM).toBeCloseTo(8.25, 1);
		expect(fotosPrimera[3].ancho / fotosPrimera[3].alto).toBeCloseTo(90 / 160, 2);
		// Cuatro por fila: la quinta empieza la segunda fila, más abajo.
		expect(new Set(fotosPrimera.slice(0, 4).map((f) => f.fila)).size).toBe(1);
		expect(fotosPrimera[4].fila).toBeGreaterThan(fotosPrimera[0].fila);
		expect(primera.filter((f) => f.texto !== null).map((f) => f.texto)).toEqual([
			'1',
			'2',
			'3',
			'1',
			'2',
			'3',
			'1',
			'2'
		]);

		const segunda = await formas(3);
		expect(segunda.filter((f) => f.nombre.startsWith('Foto '))).toHaveLength(1);
		expect(segunda.filter((f) => f.texto !== null).map((f) => f.texto)).toEqual(['3']);
		expect((await formas(4)).filter((f) => f.nombre.startsWith('Foto '))).toHaveLength(3);

		const medios = Object.keys(zip.files).filter((n) => n.startsWith('xl/media/'));
		expect(medios.filter((n) => /foto\d+\.jpg$/.test(n))).toHaveLength(12);
		for (const medio of medios.filter((n) => n.endsWith('.jpg'))) {
			expect((await sharp(await zip.file(medio)!.async('nodebuffer')).metadata()).format).toBe(
				'jpeg'
			);
		}
		const tipos = await leer('[Content_Types].xml');
		expect(tipos).toContain('Extension="jpg"');
		expect(tipos.match(/drawing\+xml/g)).toHaveLength(3);
		expect(tipos.match(/worksheet\+xml/g)).toHaveLength(4);
	});

	it('gira y reduce las fotos con el mismo tratamiento del DOCX', async () => {
		const grande = await foto(2400, 1800);
		const libro = await libroBase([
			{
				numeroPartida: 7,
				actividad: 'Toma de potenciales',
				dias: [{ desde: '2026-07-07', hasta: '2026-07-07' }],
				actividades: ['Inspección visual.'],
				fotos: [
					{ datos: grande, actividad: 1 },
					{ datos: grande, actividad: 1, rotacion: 90 }
				]
			}
		]);
		const { formas, zip } = await abrir((await generarReporteFotografico(libro)).xlsx);
		const [normal, girada] = (await formas(2)).filter((f) => f.nombre.startsWith('Foto '));
		const medidas = await sharp(await zip.file(normal.imagen!)!.async('nodebuffer')).metadata();
		expect([medidas.width, medidas.height]).toEqual([1024, 768]);
		expect(normal.ancho / normal.alto).toBeCloseTo(4 / 3, 2);
		expect(girada.ancho / girada.alto).toBeCloseTo(3 / 4, 2);
	});

	it('reparte más de seis actividades en dos columnas y crece la fila del texto largo', async () => {
		const larga =
			'Verificación con equipo patrón y registro de lecturas en el formato de campo de cada instrumento, comparando contra el patrón en cinco puntos de la escala y anotando la desviación.';
		const actividades = ['Uno.', 'Dos.', larga, 'Cuatro.', 'Cinco.', 'Seis.', 'Siete.'];
		const libro = await libroBase([
			{
				numeroPartida: '16-A',
				actividad: 'Revisión de instrumentación',
				dias: [{ desde: '2026-09-01', hasta: '2026-09-01' }],
				actividades,
				fotos: []
			}
		]);
		const { hojas, xmlHoja, formas } = await abrir((await generarReporteFotografico(libro)).xlsx);
		const hoja = hojas[1];
		expect(hoja.nombre).toBe('16-A');
		expect(celda(hoja, 'C16')).toBe('16-A');
		expect(celda(hoja, 'D16')).toBe('REVISIÓN DE INSTRUMENTACIÓN\nFECHA DE EJECUCIÓN: 01/09/2026');
		const { fila: f38, columna: colD } = referenciaACoordenadas('D38');
		const colK = referenciaACoordenadas('K38').columna;
		expect([0, 1, 2, 3].map((i) => hoja.filas[f38 + i]?.[colD])).toEqual([
			'1._ Uno.',
			'2._ Dos.',
			`3._ ${larga}`,
			'4._ Cuatro.'
		]);
		expect([0, 1, 2, 3].map((i) => hoja.filas[f38 + i]?.[colK] ?? null)).toEqual([
			'5._ Cinco.',
			'6._ Seis.',
			'7._ Siete.',
			null
		]);
		const xml = await xmlHoja(2);
		expect(combinadasDe(xml)).toEqual(
			expect.arrayContaining(['D38:J38', 'K38:O38', 'D41:J41', 'K40:O40'])
		);
		const alto = (fila: number) =>
			Number(new RegExp(`<row r="${fila}"[^>]*\\sht="([\\d.]+)"`).exec(xml)![1]);
		expect(alto(38)).toBe(24.9);
		expect(alto(40)).toBeGreaterThan(40);
		// Sin fotos solo queda el logotipo de la plantilla.
		expect((await formas(2)).map((f) => f.nombre)).toEqual(['Logotipo ICSI']);
	});

	it('agrega el logotipo del cliente cuando se entrega y deja el importe en blanco si falta', async () => {
		const libro = await libroBase();
		libro.contrato.importe = null;
		libro.logoCliente = await sharp({
			create: { width: 400, height: 100, channels: 4, background: '#2f6f9f' }
		})
			.png()
			.toBuffer();
		const { hojas, formas, zip } = await abrir((await generarReporteFotografico(libro)).xlsx);
		expect(celda(hojas[1], 'F11')).toBeNull();
		for (const numero of [2, 3, 4]) {
			const logo = (await formas(numero)).find((f) => f.nombre === 'Logotipo del cliente')!;
			expect(logo).toMatchObject({ columna: 2, fila: 0, imagen: 'xl/media/logo_cliente.png' });
			expect(logo.ancho / logo.alto).toBeCloseTo(4, 1);
		}
		expect(Object.keys(zip.files).filter((n) => n.includes('logo_cliente'))).toHaveLength(1);
	});

	it('quita los caracteres de control y escapa el XML de los textos', async () => {
		const libro = await libroBase();
		libro.contrato.cliente = 'CLIENTE\u0001 "A" & <B>';
		libro.reportes[0].actividades[0] = 'Inspección\u0007 <visual> & registro';
		libro.reportes[0].fotos[0].descripcion = 'Vista "general" <1>';
		const { hojas, xmlHoja, leer } = await abrir((await generarReporteFotografico(libro)).xlsx);
		expect(celda(hojas[1], 'G1')).toBe('CLIENTE "A" & <B>');
		expect(celda(hojas[1], 'D38')).toBe('1._ Inspección <visual> & registro');
		expect(etiquetasBalanceadas(await xmlHoja(2))).toBe(true);
		const dibujo = await leer('xl/drawings/drawing1.xml');
		expect(dibujo).toContain('descr="Vista &quot;general&quot; &lt;1&gt;"');
		expect(etiquetasBalanceadas(dibujo)).toBe(true);
	});

	it('rechaza un libro sin reportes, fechas inválidas, el exceso de tamaño y una plantilla ajena', async () => {
		await expect(generarReporteFotografico(await libroBase([]))).rejects.toThrow(RangeError);
		const sinDias = await libroBase();
		sinDias.reportes[0].dias = [];
		await expect(generarReporteFotografico(sinDias)).rejects.toThrow('No hay días de ejecución');
		const fechaMala = await libroBase();
		fechaMala.estimacion.fechaEntrega = '02/10/2026';
		await expect(generarReporteFotografico(fechaMala)).rejects.toThrow(RangeError);
		await expect(
			generarReporteFotografico(await libroBase(), { limiteBytes: 40 * 1024 })
		).rejects.toThrow(/excede el límite/);

		const ajena = await JSZip.loadAsync(await readFile(PLANTILLA));
		const modelo = await ajena.file('xl/worksheets/sheet2.xml')!.async('string');
		ajena.file('xl/worksheets/sheet2.xml', modelo.replace('<c r="M12"', '<c r="Z12"'));
		await expect(
			generarReporteFotografico(await libroBase(), {
				plantilla: await ajena.generateAsync({ type: 'uint8array' })
			})
		).rejects.toThrow('La plantilla no tiene la celda M12');
	});

	it('ponerCelda conserva el estilo y exige que la celda exista', () => {
		const fila =
			'<row r="5"><c r="F5" s="180"/><c r="G5" s="181" t="inlineStr"><is><t>x</t></is></c></row>';
		expect(ponerCelda(fila, 'F5', { tipo: 'texto', valor: 'A & B' })).toContain(
			'<c r="F5" s="180" t="inlineStr"><is><t xml:space="preserve">A &amp; B</t></is></c>'
		);
		expect(ponerCelda(fila, 'G5', null)).toContain('<c r="G5" s="181"/></row>');
		expect(() => ponerCelda(fila, 'H5', null)).toThrow('La plantilla no tiene la celda H5');
	});
});

describe('reporte de la plataforma como entrada del libro', () => {
	it('toma los alcances como actividades y numera cada foto con su alcance', async () => {
		const imagen = await foto(160, 120);
		const reporte: ReporteDocumento = {
			numeroPartida: 13,
			actividad: 'Mantenimiento de manómetros',
			periodo: { anio: 2026, mes: 9 },
			encabezado: {
				usuario: 'CLIENTE DE PRUEBA S.A. DE C.V.',
				contrato: 'CONTRATO-PRUEBA-001',
				sitio: 'EM-00000 SITIO DE PRUEBA',
				periodicidad: 'Trimestral',
				dias: [{ desde: '2026-09-03', hasta: '2026-09-03' }],
				tipoMantenimiento: 'Preventivo'
			},
			firmantes: {
				elaboro: { nombre: 'Persona Ficticia Uno', cargo: 'Encargado', empresa: 'Empresa A' },
				aprobo: { nombre: 'Persona Ficticia Dos', cargo: 'Director', empresa: 'Empresa A' },
				recibio: { nombre: 'Persona Ficticia Tres', cargo: 'Supervisor', empresa: 'Empresa B' }
			},
			objetivo: 'Verificar.',
			introduccion: 'Actividades.',
			disposicionFotos: 'antes_durante_despues',
			alcances: [
				{
					titulo: 'Inspección visual',
					descripcion: '',
					fotos: [
						{ datos: imagen, momento: 'despues', descripcion: 'Después' },
						{ datos: imagen, momento: 'antes', descripcion: 'Antes' }
					]
				},
				{ titulo: 'Limpieza física', descripcion: '', fotos: [] },
				{ titulo: 'Montaje', descripcion: '', fotos: [{ datos: imagen, descripcion: 'Montado' }] }
			],
			herramientas: [],
			incluyeVerificacion: false,
			conclusiones: ''
		};
		const entrada = reporteFotograficoDe(reporte);
		expect(entrada).toMatchObject({
			numeroPartida: 13,
			actividad: 'Mantenimiento de manómetros',
			sitio: 'EM-00000 SITIO DE PRUEBA',
			dias: [{ desde: '2026-09-03', hasta: '2026-09-03' }],
			actividades: ['Inspección visual', 'Limpieza física', 'Montaje']
		});
		// Mismo orden de aparición que en el DOCX (antes, durante y después).
		expect(entrada.fotos.map((f) => [f.descripcion, f.actividad])).toEqual([
			['Antes', 1],
			['Después', 1],
			['Montado', 3]
		]);
		const resultado = await generarReporteFotografico(await libroBase([entrada]));
		expect(resultado.hojas).toEqual([{ nombre: '13', pagina: 1, reporte: 0, fotos: 3 }]);
	});
});
