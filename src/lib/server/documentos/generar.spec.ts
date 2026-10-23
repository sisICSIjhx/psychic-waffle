import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { auditarPaquete } from './auditoria';
import {
	generarDocx,
	limpiarTexto,
	PERFILES_IMAGEN,
	prepararFotos,
	type ReporteDocumento
} from './generar';
import { prepararImagen } from './imagenes';
import { bloquesCuerpo, elementos, texto } from './ooxml';
import { convertirPdf } from './pdf';

const PLANTILLA = new URL('../plantillas/FOR-ICSI-RMT-01.v2.docx', import.meta.url);
const EMU_POR_CM = 360000;

async function foto(ancho: number, alto: number, color = '#7a8b99') {
	return sharp({ create: { width: ancho, height: alto, channels: 3, background: color } })
		.jpeg()
		.toBuffer();
}

async function reporteBase(cambios: Partial<ReporteDocumento> = {}): Promise<ReporteDocumento> {
	const horizontal = await foto(160, 120);
	const vertical = await foto(90, 160, '#445566');
	return {
		numeroPartida: 13,
		actividad: 'Mantenimiento y verificación de indicadores de presión (manómetros)',
		actividadCorta: 'Manómetros',
		periodo: { anio: 2026, mes: 6 },
		tags: ['PI-0001'],
		encabezado: {
			usuario: 'CLIENTE DE PRUEBA S.A. DE C.V.',
			contrato: 'CONTRATO-PRUEBA-001',
			sitio: 'EM-00000 SITIO DE PRUEBA',
			periodicidad: 'Trimestral',
			dias: [{ desde: '2026-06-01', hasta: '2026-06-01' }],
			tipoMantenimiento: 'Preventivo'
		},
		firmantes: {
			elaboro: {
				nombre: 'Persona Ficticia Uno',
				cargo: 'Encargado de prueba',
				empresa: 'Empresa A'
			},
			aprobo: { nombre: 'Persona Ficticia Dos', cargo: 'Director de prueba', empresa: 'Empresa A' },
			recibio: {
				nombre: 'Persona Ficticia Tres',
				cargo: 'Supervisor de prueba',
				empresa: 'Empresa B'
			}
		},
		objetivo: 'Verificar el funcionamiento de los indicadores.',
		introduccion: 'Actividades realizadas en la estación.',
		disposicionFotos: 'cuadricula',
		alcances: [
			{
				titulo: 'Inspección visual',
				descripcion: 'Revisión general.\nSegunda línea.',
				fotos: [
					{ datos: horizontal, descripcion: 'Vista general' },
					{ datos: vertical, descripcion: 'Detalle' },
					{ datos: horizontal }
				],
				estado: 'ok'
			},
			{
				titulo: 'Limpieza física',
				descripcion: 'Sin evidencia.',
				fotos: [],
				estado: 'con_observacion',
				observaciones: 'Falta pintura'
			}
		],
		herramientas: [
			{ cantidad: '1 unidad', descripcion: 'Manómetro patrón' },
			{ cantidad: null, descripcion: 'Atomizador' }
		],
		incluyeVerificacion: true,
		conclusiones: 'Equipo operando. Se recomienda revisar A & B <c>.',
		...cambios
	};
}

async function abrir(docx: Buffer) {
	const zip = await JSZip.loadAsync(docx);
	const documento = await zip.file('word/document.xml')!.async('string');
	const bloques = bloquesCuerpo(documento);
	const titulosNivel1 = bloques
		.filter((b) => b.xml.includes('<w:pStyle w:val="Level1"/>'))
		.map((b) => texto(b.xml).trim());
	const indice = texto(bloques.find((b) => b.etiqueta === 'w:sdt')!.xml);
	return { zip, documento, titulosNivel1, indice, textoCompleto: texto(documento) };
}

function extensionesCm(documento: string) {
	return [...documento.matchAll(/<wp:inline[\s\S]*?<wp:extent cx="(\d+)" cy="(\d+)"/g)].map(
		(m) => ({
			ancho: Number(m[1]) / EMU_POR_CM,
			alto: Number(m[2]) / EMU_POR_CM
		})
	);
}

describe('generación del DOCX FOR-ICSI-RMT-01', () => {
	it('resuelve todos los marcadores y respeta el orden con verificación', async () => {
		const resultado = await generarDocx(await reporteBase());
		const { documento, titulosNivel1, indice, textoCompleto } = await abrir(resultado.docx);

		expect(documento).not.toContain('+++');
		expect(titulosNivel1).toEqual([
			'1. OBJETIVO',
			'2. ALCANCE',
			'3. HERRAMIENTAS Y EQUIPO',
			'4. DOCUMENTOS DE VERIFICACIÓN',
			'5. CONCLUSIONES Y/O RECOMENDACIONES'
		]);
		expect(indice).toMatch(/2\.1\s*Inspección visual/);
		expect(indice).toContain('5. CONCLUSIONES Y/O RECOMENDACIONES');
		expect(textoCompleto).toContain(
			'13.- MANTENIMIENTO Y VERIFICACIÓN DE INDICADORES DE PRESIÓN (MANÓMETROS).'
		);
		expect(textoCompleto).toContain('01 / JUNIO / 2026');
		expect(textoCompleto).toContain('PI-0001');
		expect(textoCompleto).toContain('Persona Ficticia Tres');
		expect(resultado.nombreArchivo).toBe('P13_MANOMETROS_PI-0001_2026-06.docx');
		expect(resultado.versionPlantilla).toBe('FOR-ICSI-RMT-01.v2');
	});

	it('numera las ilustraciones y no deja tabla vacía en un alcance sin fotos', async () => {
		const { documento, textoCompleto } = await abrir((await generarDocx(await reporteBase())).docx);

		expect(textoCompleto).toContain('Ilustración 2.1.1 Vista general');
		expect(textoCompleto).toContain('Ilustración 2.1.2 Detalle');
		expect(textoCompleto).toMatch(/Ilustración 2\.1\.3\s*$/m);
		expect(textoCompleto).not.toContain('Ilustración 2.2.');
		expect((documento.match(/<pic:pic/g) ?? []).length).toBe(3);

		// Solo el primer alcance lleva tabla de fotos: tras «Limpieza física» viene su texto y la sección 3.
		const bloques = bloquesCuerpo(documento);
		const limpieza = bloques.findIndex((b) => texto(b.xml).trim() === 'Limpieza física');
		expect(bloques[limpieza + 2].xml).toContain('<w:pStyle w:val="Level1"/>');
	});

	it('ajusta fotos verticales y horizontales a la caja sin deformarlas', async () => {
		const { documento } = await abrir((await generarDocx(await reporteBase())).docx);
		const [horizontal, vertical] = extensionesCm(documento);
		expect(horizontal.ancho).toBeCloseTo(8, 1);
		expect(horizontal.alto).toBeCloseTo(6, 1);
		expect(vertical.alto).toBeLessThanOrEqual(6.01);
		expect(vertical.ancho / vertical.alto).toBeCloseTo(90 / 160, 1);
	});

	it('omite la verificación y numera conclusiones como 4', async () => {
		const { titulosNivel1, indice } = await abrir(
			(await generarDocx(await reporteBase({ incluyeVerificacion: false }))).docx
		);
		expect(titulosNivel1).toEqual([
			'1. OBJETIVO',
			'2. ALCANCE',
			'3. HERRAMIENTAS Y EQUIPO',
			'4. CONCLUSIONES Y/O RECOMENDACIONES'
		]);
		expect(indice).not.toContain('DOCUMENTOS DE VERIFICACIÓN');
	});

	it('incluye la tabla de verificación con estados y observaciones', async () => {
		const { textoCompleto } = await abrir((await generarDocx(await reporteBase())).docx);
		expect(textoCompleto).toContain('Con observación');
		expect(textoCompleto).toContain('Falta pintura');
	});

	it('acomoda antes, durante y después en ese orden de numeración', async () => {
		const [a, d, p] = await Promise.all([foto(120, 160), foto(160, 120), foto(160, 160)]);
		const reporte = await reporteBase({
			disposicionFotos: 'antes_durante_despues',
			alcances: [
				{
					titulo: 'Retiro de PSV',
					descripcion: 'Desmontaje.',
					fotos: [
						{ datos: p, momento: 'despues', descripcion: 'final' },
						{ datos: a, momento: 'antes', descripcion: 'inicial' },
						{ datos: d, momento: 'durante', descripcion: 'proceso' }
					]
				}
			]
		});
		const { documento, textoCompleto } = await abrir((await generarDocx(reporte)).docx);
		const orden = [
			'ANTES',
			'DURANTE',
			'DESPUÉS',
			'Ilustración 2.1.1 inicial',
			'Ilustración 2.1.2 proceso',
			'Ilustración 2.1.3 final'
		];
		for (const etiqueta of orden) expect(textoCompleto).toContain(etiqueta);
		expect(textoCompleto.indexOf('Ilustración 2.1.1 inicial')).toBeLessThan(
			textoCompleto.indexOf('Ilustración 2.1.3 final')
		);
		for (const medida of extensionesCm(documento)) {
			expect(medida.ancho).toBeLessThanOrEqual(8.01);
			expect(medida.alto).toBeLessThanOrEqual(6.01);
		}
		// Disposición 2 + 1: antes y durante en una fila; después sola, centrada en ambas columnas.
		const tabla = bloquesCuerpo(documento).find(
			(b) => b.etiqueta === 'w:tbl' && texto(b.xml).includes('Ilustración 2.1.3 final')
		)!;
		const filas = elementos(tabla.xml, 'w:tr');
		expect(filas).toHaveLength(2);
		expect(elementos(filas[0].xml, 'w:tc')).toHaveLength(2);
		expect(filas[0].xml).toContain('<w:keepNext/>');
		expect(filas[1].xml).toContain('<w:gridSpan w:val="2"/>');
		expect(texto(filas[1].xml)).toContain('DESPUÉS');
	});

	it('centra la foto sola de la última fila de la cuadrícula', async () => {
		const { documento } = await abrir((await generarDocx(await reporteBase())).docx);
		const tabla = bloquesCuerpo(documento).find(
			(b) => b.etiqueta === 'w:tbl' && texto(b.xml).includes('Ilustración 2.1.1')
		)!;
		const filas = elementos(tabla.xml, 'w:tr');
		expect(filas).toHaveLength(2);
		expect(elementos(filas[0].xml, 'w:tc')).toHaveLength(2);
		expect(elementos(filas[1].xml, 'w:tc')).toHaveLength(1);
		expect(filas[1].xml).toContain('<w:gridSpan w:val="2"/>');
		expect(texto(filas[1].xml)).toContain('Ilustración 2.1.3');
	});

	it('escapa caracteres especiales, separa renglones en párrafos y muestra herramientas sin cantidad', async () => {
		const { documento, zip } = await abrir((await generarDocx(await reporteBase())).docx);
		expect(documento).toContain('A &amp; B &lt;c&gt;');
		const parrafos = bloquesCuerpo(documento).map((b) => texto(b.xml).trim());
		expect(parrafos).toContain('Revisión general.');
		expect(parrafos).toContain('Segunda línea.');
		expect(documento).not.toContain('<w:br/>');
		const herramientas = bloquesCuerpo(documento).find(
			(b) => b.etiqueta === 'w:tbl' && texto(b.xml).includes('Atomizador')
		)!;
		const [encabezado, ...filas] = elementos(herramientas.xml, 'w:tr');
		expect(encabezado.xml).toContain('<w:tblHeader/>');
		const fila = filas.find((tr) => texto(tr.xml).includes('Atomizador'))!;
		expect(elementos(fila.xml, 'w:tc').map((tc) => texto(tc.xml).trim())).toEqual([
			'2.',
			'',
			'Atomizador'
		]);
		const tipos = await zip.file('[Content_Types].xml')!.async('string');
		expect(tipos).toMatch(/Extension="jpg"/);
	});

	it('genera un reporte con 130 fotografías dentro del límite y rechaza el exceso', async () => {
		const imagen = await foto(64, 48);
		const fotos = Array.from({ length: 130 }, (_, i) => ({
			datos: imagen,
			descripcion: `Foto ${i + 1}`
		}));
		const reporte = await reporteBase({
			alcances: [
				{ titulo: 'Volumen alto', descripcion: 'Muchas fotos.', fotos: fotos.slice(0, 70) },
				{ titulo: 'Segundo alcance', descripcion: 'Más fotos.', fotos: fotos.slice(70) }
			]
		});
		const resultado = await generarDocx(reporte);
		const { documento, textoCompleto } = await abrir(resultado.docx);
		expect(resultado.fotos).toBe(130);
		expect((documento.match(/<pic:pic/g) ?? []).length).toBe(130);
		expect(textoCompleto).toContain('Ilustración 2.2.60 Foto 130');
		await expect(generarDocx(reporte, { limiteBytes: 10_000 })).rejects.toThrow(/excede el límite/);
	}, 60_000);

	it('rechaza una fecha incompleta o sin días', async () => {
		const reporte = await reporteBase();
		reporte.encabezado.dias = [{ desde: '2026-06', hasta: '2026-06' }];
		await expect(generarDocx(reporte)).rejects.toThrow(/Fecha incompleta/);
		reporte.encabezado.dias = [];
		await expect(generarDocx(reporte)).rejects.toThrow(/No hay días/);
	});

	it('produce un paquete sin metadatos personales ni marcas de revisión', async () => {
		const resultado = await generarDocx(await reporteBase());
		expect(await auditarPaquete(resultado.docx)).toEqual([]);
	});

	it('sanea también los textos derivados, como el TAG', async () => {
		const reporte = await reporteBase({ tags: ['PI-0001\u001e\u001e<w:br/>\u001e\u001e'] });
		const { documento } = await abrir((await generarDocx(reporte)).docx);
		expect(documento).toContain('PI-0001&lt;w:br/&gt;');
		expect(documento).not.toContain('\u001e');
	});

	it('reduce las fotos de alta resolución hasta que el documento cabe en el límite', async () => {
		const ruido = await sharp({
			create: {
				width: 2000,
				height: 1500,
				channels: 3,
				background: '#808080',
				noise: { type: 'gaussian', mean: 128, sigma: 60 }
			}
		})
			.jpeg({ quality: 90 })
			.toBuffer();
		const fotos = Array.from({ length: 12 }, () => ({ datos: ruido }));
		const reporte = await reporteBase({
			alcances: [{ titulo: 'Alta resolución', descripcion: 'Fotos pesadas.', fotos }]
		});
		const plantilla = await readFile(PLANTILLA);
		const limiteBytes = plantilla.length + 1024 * 1024 + 4 * 1024 * 1024;
		const resultado = await generarDocx(reporte, { limiteBytes });
		expect(resultado.fotos).toBe(12);
		expect(resultado.bytes).toBeLessThanOrEqual(limiteBytes);
		const zip = await JSZip.loadAsync(resultado.docx);
		const medio = Object.keys(zip.files).find(
			(n) => n.startsWith('word/media/') && n.endsWith('.jpg')
		)!;
		const { width } = await sharp(await zip.file(medio)!.async('nodebuffer')).metadata();
		expect(width).toBeLessThan(1600);
	}, 120_000);

	it('elimina caracteres de control de los textos', () => {
		expect(limpiarTexto('a\u0000b\u001ec\r\nd ')).toBe('abc\nd');
		expect(limpiarTexto(null)).toBe('');
	});
});

describe('plantilla FOR-ICSI-RMT-01.v2', () => {
	it('está saneada: sin autor, comentarios, revisiones, customXml ni plantilla adjunta', async () => {
		const plantilla = await readFile(PLANTILLA);
		expect(await auditarPaquete(plantilla)).toEqual([]);
		const zip = await JSZip.loadAsync(plantilla);
		const ajustes = await zip.file('word/settings.xml')!.async('string');
		expect(ajustes).toContain('<w:removePersonalInformation/>');
		expect(ajustes).not.toContain('updateFields');
		const documento = await zip.file('word/document.xml')!.async('string');
		expect(documento).not.toMatch(/w:dirty=/);
		// El índice de la plantilla es un campo TOC vacío que el generador sustituye.
		expect(documento).toContain(' TOC \\o "1-3" \\h \\z \\u ');
	});
});

describe('índice ya resuelto', () => {
	it('abre sin pedir actualizar: marcadores, hipervínculos y páginas del modelo', async () => {
		const resultado = await generarDocx(await reporteBase());
		const zip = await JSZip.loadAsync(resultado.docx);
		const documento = await zip.file('word/document.xml')!.async('string');
		const ajustes = await zip.file('word/settings.xml')!.async('string');
		expect(ajustes).not.toContain('updateFields');
		expect(documento).not.toMatch(/w:dirty=/);
		const marcadores = [
			...documento.matchAll(/<w:bookmarkStart w:id="\d+" w:name="(_Toc\d+)"\/>/g)
		].map((m) => m[1]);
		const anclas = [...documento.matchAll(/<w:hyperlink w:anchor="(_Toc\d+)"/g)].map((m) => m[1]);
		const referencias = [...documento.matchAll(/PAGEREF (_Toc\d+) \\h/g)].map((m) => m[1]);
		expect(marcadores).toHaveLength(resultado.indice.titulos.length);
		expect(anclas).toEqual(marcadores);
		expect(referencias).toEqual(marcadores);
		const inicios = documento.match(/w:fldCharType="begin"/g)!.length;
		expect(documento.match(/w:fldCharType="separate"/g)!.length).toBe(inicios);
		expect(documento.match(/w:fldCharType="end"/g)!.length).toBe(inicios);
		// Cada PAGEREF muestra la página calculada.
		const paginas = [
			...documento.matchAll(/PAGEREF _Toc\d+ \\h <\/w:instrText>[\s\S]*?<w:t>(\d+)<\/w:t>/g)
		].map((m) => Number(m[1]));
		expect(paginas).toEqual(resultado.indice.titulos.map((t) => t.pagina));
		expect(resultado.indice.paginaInicialCuerpo).toBe(3);
		expect(await auditarPaquete(resultado.docx)).toEqual([]);
	});
});

describe('giro de las fotos', () => {
	const conFotos = async (fotos: ReporteDocumento['alcances'][number]['fotos']) =>
		reporteBase({
			alcances: [{ titulo: 'Inspección visual', descripcion: '', fotos, estado: 'ok' }]
		});

	it('aplica el giro antes de ajustar la foto a la caja', async () => {
		const datos = await foto(640, 480);
		const optimizada = { ancho: 640, alto: 480 };
		const { documento } = await abrir(
			(
				await generarDocx(
					await conFotos([
						{ datos, optimizada, rotacion: 90 },
						{ datos, optimizada, rotacion: 180 },
						{ datos, optimizada, rotacion: 270 }
					])
				)
			).docx
		);
		const [noventa, mediaVuelta, doscientos] = extensionesCm(documento);
		expect([noventa.ancho, noventa.alto]).toEqual([expect.closeTo(4.5, 1), expect.closeTo(6, 1)]);
		expect([mediaVuelta.ancho, mediaVuelta.alto]).toEqual([
			expect.closeTo(8, 1),
			expect.closeTo(6, 1)
		]);
		expect(doscientos.ancho).toBeCloseTo(4.5, 1);
	});

	it('sin giro reutiliza los bytes de la optimizada; un perfil ligero conserva las medidas giradas', async () => {
		const datos = await foto(640, 480);
		const optimizada = { ancho: 640, alto: 480 };
		const [sinGiro, girada] = await prepararFotos(
			[
				{ datos, optimizada },
				{ datos, optimizada, rotacion: 90 }
			],
			Number.MAX_SAFE_INTEGER,
			2
		);
		expect(sinGiro.datos.equals(datos)).toBe(true);
		expect([girada.ancho, girada.alto]).toEqual([480, 640]);

		// Con un presupuesto mínimo se degradan todas y la girada sigue en vertical.
		const [, ligera] = await prepararFotos(
			[
				{ datos, optimizada },
				{ datos, optimizada, rotacion: 270 }
			],
			1,
			2
		);
		expect([ligera.ancho, ligera.alto]).toEqual([480, 640]);
	});
});

describe('presupuesto de fotografías', () => {
	const ruido = (ancho: number, alto: number) =>
		sharp({
			create: {
				width: ancho,
				height: alto,
				channels: 3,
				background: '#808080',
				noise: { type: 'gaussian', mean: 128, sigma: 60 }
			}
		})
			.jpeg({ quality: 95 })
			.toBuffer();
	const tamano = async (datos: Buffer, perfil: number) =>
		(await prepararImagen(datos, PERFILES_IMAGEN[perfil])).datos.length;

	it('degrada también las fotos bajo la cuota cuando una foto pesada no basta', async () => {
		const pesada = await ruido(2000, 1500);
		const ligera = await ruido(200, 150);
		const ultimo = PERFILES_IMAGEN.length - 1;
		const presupuesto = (await tamano(pesada, ultimo)) + 10 * (await tamano(ligera, ultimo)) + 1024;
		// Precondición del caso: al inicio las ligeras quedan bajo la cuota por foto.
		expect(await tamano(ligera, 0)).toBeLessThan(presupuesto / 11);

		const fotos = [pesada, ...Array.from({ length: 10 }, () => ligera)].map((datos) => ({ datos }));
		const preparadas = await prepararFotos(fotos, presupuesto, 4);
		const total = preparadas.reduce((suma, p) => suma + p.datos.length, 0);
		expect(preparadas).toHaveLength(11);
		expect(total).toBeLessThanOrEqual(presupuesto);
	}, 60_000);
});

describe('auditoría del paquete', () => {
	it('detecta textos prohibidos en atributos y en nombres de partes', async () => {
		const zip = new JSZip();
		zip.file(
			'word/document.xml',
			'<w:document><w:body><wp:docPr id="1" descr="Persona Prohibida Ejemplo"/></w:body></w:document>'
		);
		zip.file('word/media/Otra Persona Prohibida.png', new Uint8Array([1]));
		const paquete = await zip.generateAsync({ type: 'uint8array' });
		const problemas = await auditarPaquete(paquete, {
			textosProhibidos: ['Persona Prohibida Ejemplo', 'Otra Persona Prohibida']
		});
		expect(problemas).toContain('word/document.xml: contiene un texto prohibido de la fuente');
		expect(problemas).toContain(
			'Nombres de partes del paquete con un texto prohibido de la fuente'
		);
	});
});

describe('conversión de prueba a PDF', () => {
	it('informa que no está disponible sin afectar al DOCX', async () => {
		const resultado = await convertirPdf(new Uint8Array([1, 2, 3]), 'x.docx', { soffice: '' });
		expect(resultado).toEqual({
			disponible: false,
			motivo: expect.stringContaining('no está disponible')
		});
		const ausente = await convertirPdf(new Uint8Array([1]), 'x.docx', {
			soffice: 'C:/no/existe/soffice.exe'
		});
		expect(ausente.disponible).toBe(false);
	});
});
