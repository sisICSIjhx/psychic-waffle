import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { auditarPaquete } from './auditoria';
import { generarDocx, limpiarTexto, type ReporteDocumento } from './generar';
import { bloquesCuerpo, elementos, texto } from './ooxml';
import { convertirPdf } from './pdf';

const PLANTILLA = new URL('../plantillas/FOR-ICSI-RMT-01.v1.docx', import.meta.url);
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
			fecha: '2026-06-01',
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
		expect(indice).toContain('2.1 Inspección visual');
		expect(indice).toContain('5. CONCLUSIONES Y/O RECOMENDACIONES');
		expect(textoCompleto).toContain(
			'13.- MANTENIMIENTO Y VERIFICACIÓN DE INDICADORES DE PRESIÓN (MANÓMETROS).'
		);
		expect(textoCompleto).toContain('01 / JUNIO / 2026');
		expect(textoCompleto).toContain('PI-0001');
		expect(textoCompleto).toContain('Persona Ficticia Tres');
		expect(resultado.nombreArchivo).toBe('P13_MANOMETROS_PI-0001_2026-06.docx');
		expect(resultado.versionPlantilla).toBe('FOR-ICSI-RMT-01.v1');
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
			expect(medida.ancho).toBeLessThanOrEqual(5.21);
			expect(medida.alto).toBeLessThanOrEqual(6.51);
		}
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

	it('rechaza una fecha incompleta', async () => {
		const reporte = await reporteBase();
		reporte.encabezado.fecha = '2026-06';
		await expect(generarDocx(reporte)).rejects.toThrow(/Fecha incompleta/);
	});

	it('produce un paquete sin metadatos personales ni marcas de revisión', async () => {
		const resultado = await generarDocx(await reporteBase());
		expect(await auditarPaquete(resultado.docx)).toEqual([]);
	});

	it('elimina caracteres de control de los textos', () => {
		expect(limpiarTexto('a\u0000b\u001ec\r\nd ')).toBe('abc\nd');
		expect(limpiarTexto(null)).toBe('');
	});
});

describe('plantilla FOR-ICSI-RMT-01.v1', () => {
	it('está saneada: sin autor, comentarios, revisiones, customXml ni plantilla adjunta', async () => {
		const plantilla = await readFile(PLANTILLA);
		expect(await auditarPaquete(plantilla)).toEqual([]);
		const zip = await JSZip.loadAsync(plantilla);
		const ajustes = await zip.file('word/settings.xml')!.async('string');
		expect(ajustes).toContain('<w:removePersonalInformation/>');
		expect(ajustes).toContain('<w:updateFields w:val="true"/>');
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
