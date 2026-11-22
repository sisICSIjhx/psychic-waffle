// Construye src/lib/server/plantillas/REPORTE-FOTOGRAFICO.v1.xlsx a partir del libro de reportes
// fotográficos que hoy se arma a mano en Excel.
//
// Uso (solo en local; el libro fuente vive en insumos/, que no se versiona):
//   node scripts/construir-plantilla-fotografico.ts "<libro de reportes fotográficos>.xlsx" [hoja modelo] [destino]
//
// Conserva de la fuente: la «HOJA MAESTRA», una hoja de reporte (por omisión la llamada «3») con sus
// estilos, anchos, altos, celdas combinadas del encabezado y de las firmas, página horizontal y área
// de impresión, el tema y el logotipo de ICSI. Quita todo lo demás: las otras hojas, las fotos, los
// círculos, los cuadros de texto vacíos, el logotipo del cliente, los ajustes de impresora, las
// cadenas compartidas y los datos (contrato, importes, actividades y firmantes). Solo quedan como
// texto los rótulos fijos del formato. El paquete se audita contra los textos de la fuente antes de
// escribirse; esos textos no salen de memoria.
import JSZip from 'jszip';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { auditarPaquete, normalizarParaComparar } from '../src/lib/server/documentos/auditoria.ts';
import {
	anclasDe,
	combinadasDe,
	indiceColumna,
	letraColumna,
	ponerCombinadas,
	relacionesLibro,
	xmlCelda,
	xmlDibujo,
	xmlImagen,
	xmlLibro,
	xmlRelaciones,
	xmlTiposContenido
} from '../src/lib/server/documentos/libro-xlsx.ts';
import { decodificarXml } from '../src/lib/server/documentos/ooxml.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [fuente, hojaModelo = '3', destinoArg] = process.argv.slice(2);
const DESTINO = resolve(
	RAIZ,
	destinoArg ?? 'src/lib/server/plantillas/REPORTE-FOTOGRAFICO.v1.xlsx'
);
if (!fuente) {
	console.error(
		'Uso: node scripts/construir-plantilla-fotografico.ts "<libro>.xlsx" [hoja modelo] [destino]'
	);
	process.exit(1);
}

const HOJA_MAESTRA = 'HOJA MAESTRA';
const HOJA_MODELO = 'REPORTE';
const AREA_IMPRESION = '$B$1:$Q$53';
/** Fecha fija de las entradas del paquete, para que reconstruir la plantilla dé los mismos bytes. */
const FECHA_PAQUETE = new Date(Date.UTC(2026, 0, 1));

/** Rótulos fijos de la hoja de reporte: celda → comienzo esperado del texto (sin acentos). */
const ROTULOS_REPORTE: Record<string, string> = {
	C5: 'contrato no',
	C6: 'orden de compra',
	C7: 'descripcion de la obra',
	K5: 'fecha de entrega',
	K7: 'periodo de contrato',
	K9: 'periodo estimado',
	C11: 'importe contratado',
	K11: 'estimacion no',
	C12: 'contratista',
	K12: 'pagina',
	C13: 'reporte fotografico',
	C15: 'partida',
	D15: 'descripcion',
	D45: 'contratista',
	L45: 'autoriza',
	D47: '____',
	L47: '____'
};
const ROTULOS_MAESTRA: Record<string, string> = {
	B3: 'fecha de entrega',
	B6: 'periodo estimado',
	B9: 'estimacion no'
};
/** Filas de la zona de fotos y de la lista de actividades; el constructor las deja uniformes. */
const ZONA = { fotosDesde: 19, fotosHasta: 37, actividadesDesde: 38, actividadesHasta: 43 };
const COLUMNA_INICIAL = indiceColumna('C');
const COLUMNA_FINAL = indiceColumna('P');

const zip = await JSZip.loadAsync(await readFile(fuente));
const leer = async (parte: string) => {
	const archivo = zip.file(parte);
	if (!archivo) throw new Error(`La fuente no tiene la parte ${parte}`);
	return archivo.async('string');
};

// --- Hojas de la fuente --------------------------------------------------------------------------

const libro = await leer('xl/workbook.xml');
const relacionesFuente = await leer('xl/_rels/workbook.xml.rels');
const destinoDe = (xmlRelacionesFuente: string, id: string) => {
	const relacion = [...xmlRelacionesFuente.matchAll(/<Relationship\s[^>]*>/g)].find(
		(r) => /\sId="([^"]+)"/.exec(r[0])?.[1] === id
	);
	return /\sTarget="([^"]+)"/.exec(relacion?.[0] ?? '')?.[1];
};
function parteDeHoja(nombre: string): string {
	const hoja = [...libro.matchAll(/<sheet\s[^>]*>/g)].find(
		(h) => decodificarXml(/\sname="([^"]*)"/.exec(h[0])?.[1] ?? '') === nombre
	);
	const destino = hoja && destinoDe(relacionesFuente, /\sr:id="([^"]+)"/.exec(hoja[0])?.[1] ?? '');
	if (!destino) throw new Error(`La fuente no tiene la hoja «${nombre}»`);
	return posix.join('xl', destino);
}

const cadenas = [
	...(await leer('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)
].map((m) =>
	[...(m[1] ?? '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
		.map((t) => decodificarXml(t[1]))
		.join('')
);

interface CeldaFuente {
	referencia: string;
	columna: number;
	estilo: string | null;
	texto: string | null;
	formula: string | null;
}

function celdasDeFila(xmlFila: string): CeldaFuente[] {
	return [...xmlFila.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((c) => {
		const referencia = /(?:^|\s)r="([A-Z]+\d+)"/.exec(c[1])![1];
		const cuerpo = c[2] ?? '';
		const valor = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
		return {
			referencia,
			columna: indiceColumna(referencia.replace(/\d+/, '')),
			estilo: /(?:^|\s)s="(\d+)"/.exec(c[1])?.[1] ?? null,
			texto: /(?:^|\s)t="s"/.test(c[1]) && valor !== undefined ? cadenas[Number(valor)] : null,
			formula: /<f[^>]*>([\s\S]*?)<\/f>/.exec(cuerpo)?.[1] ?? null
		};
	});
}

/**
 * Reescribe las filas de la hoja: conserva estilos, fórmulas y los rótulos de la lista; vacía todo
 * lo demás. `uniformar` devuelve los estilos de una fila que debe quedar igual en toda la plantilla.
 */
function limpiarFilas(
	xmlHoja: string,
	rotulos: Record<string, string>,
	uniformar: (fila: number, celdas: CeldaFuente[]) => (string | null)[] | null = () => null
): string {
	const encontrados = new Set<string>();
	const resultado = xmlHoja.replace(
		/<row\s([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g,
		(_fila, atributos: string, cuerpo: string | undefined) => {
			const numero = Number(/(?:^|\s)r="(\d+)"/.exec(atributos)![1]);
			const celdas = celdasDeFila(cuerpo ?? '');
			const estilos = uniformar(numero, celdas);
			const xml = estilos
				? estilos.map((estilo, i) =>
						xmlCelda(`${letraColumna(COLUMNA_INICIAL + i)}${numero}`, estilo)
					)
				: celdas.map((celda) => {
						if (celda.formula) {
							return `<c r="${celda.referencia}"${celda.estilo ? ` s="${celda.estilo}"` : ''}><f>${celda.formula}</f></c>`;
						}
						const esperado = rotulos[celda.referencia];
						if (esperado === undefined) return xmlCelda(celda.referencia, celda.estilo);
						if (!normalizarParaComparar(celda.texto ?? '').startsWith(esperado)) {
							throw new Error(
								`La celda ${celda.referencia} no tiene el rótulo esperado: la hoja no es del formato`
							);
						}
						encontrados.add(celda.referencia);
						return xmlCelda(celda.referencia, celda.estilo, {
							tipo: 'texto',
							valor: celda.texto!.trim()
						});
					});
			return `<row ${atributos.trim()}>${xml.join('')}</row>`;
		}
	);
	const faltantes = Object.keys(rotulos).filter((r) => !encontrados.has(r));
	if (faltantes.length) throw new Error(`Faltan los rótulos de ${faltantes.join(', ')}`);
	return resultado;
}

/** Quita lo que ata la hoja al libro y al equipo de origen. */
function limpiarHoja(xmlHoja: string): string {
	return xmlHoja
		.replace(/\sxr:uid="[^"]*"/, '')
		.replace(/(<sheetPr[^>]*?)\scodeName="[^"]*"/, '$1')
		.replace(/<sheetView\s([^>]*)>[\s\S]*?<\/sheetView>|<sheetView\s([^>]*)\/>/, (_v, a, b) => {
			const atributos = String(a ?? b).replace(/\s(?:tabSelected|topLeftCell)="[^"]*"/g, '');
			return `<sheetView ${atributos.trim()}><selection activeCell="A1" sqref="A1"/></sheetView>`;
		})
		.replace(/<pageSetup\s[^>]*\/>/, (ajuste) =>
			ajuste
				.replace(/\sr:id="[^"]*"/, '')
				.replace(/\s(?:horizontal|vertical)Dpi="[^"]*"/g, '')
				.replace('<pageSetup', '<pageSetup paperSize="1"')
		)
		.replace(/<drawing\s[^>]*\/>/, '<drawing r:id="rId1"/>')
		.replace(/<legacyDrawing[^>]*\/>/, '');
}

// --- Estilos: se agrega el de las actividades sin borde ------------------------------------------

let estilos = await leer('xl/styles.xml');
const xmlModeloFuente = await leer(parteDeHoja(hojaModelo));
const filaFuente = (numero: number) =>
	celdasDeFila(
		new RegExp(`<row\\s[^>]*?\\br="${numero}"[^>]*>([\\s\\S]*?)</row>`).exec(
			xmlModeloFuente
		)?.[1] ?? ''
	);
const estiloEn = (fila: number, columna: string) => {
	const estilo = filaFuente(fila).find((c) => c.referencia === `${columna}${fila}`)?.estilo;
	if (!estilo) throw new Error(`La hoja modelo no tiene estilo en ${columna}${fila}`);
	return estilo;
};

const seccionXfs = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/.exec(estilos);
if (!seccionXfs) throw new Error('La fuente no tiene estilos de celda');
const xfs = seccionXfs[2].match(/<xf\s[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g) ?? [];
// Última fila de actividades: 14 pt, alineada a la izquierda, con ajuste de texto y borde inferior.
const estiloActividadFinal = estiloEn(ZONA.actividadesHasta, 'D');
const xfFinal = xfs[Number(estiloActividadFinal)];
if (!/wrapText="1"/.test(xfFinal) || !/horizontal="left"/.test(xfFinal)) {
	throw new Error('El estilo de la última fila de actividades no es el esperado');
}
// Las demás filas usan el mismo estilo sin borde.
const xfActividad = xfFinal.replace(/\sborderId="\d+"/, ' borderId="0"');
const estiloActividad = String(xfs.length);
estilos = estilos.replace(
	seccionXfs[0],
	`<cellXfs count="${xfs.length + 1}">${seccionXfs[2]}${xfActividad}</cellXfs>`
);

// --- Hoja de reporte -----------------------------------------------------------------------------

const estiloZona = estiloEn(ZONA.fotosDesde + 2, 'D');
const columnasZona = COLUMNA_FINAL - COLUMNA_INICIAL + 1;
function estilosUniformes(fila: number, celdas: CeldaFuente[]): (string | null)[] | null {
	if (fila < ZONA.fotosDesde || fila > ZONA.actividadesHasta) return null;
	const borde = (columna: number) => celdas.find((c) => c.columna === columna)?.estilo ?? null;
	const interior =
		fila === ZONA.actividadesHasta
			? estiloActividadFinal
			: fila >= ZONA.actividadesDesde
				? estiloActividad
				: estiloZona;
	return [
		borde(COLUMNA_INICIAL),
		...new Array<string>(columnasZona - 2).fill(interior),
		borde(COLUMNA_FINAL)
	];
}

let hojaReporte = limpiarHoja(limpiarFilas(xmlModeloFuente, ROTULOS_REPORTE, estilosUniformes));
// En la zona de fotos y de actividades las combinadas las decide el generador.
hojaReporte = ponerCombinadas(
	hojaReporte,
	combinadasDe(hojaReporte).filter((rango) => {
		const filas = (rango.match(/\d+/g) ?? []).map(Number);
		return filas.every((f) => f < ZONA.fotosDesde || f > ZONA.actividadesHasta);
	})
);
if (!/orientation="landscape"/.test(hojaReporte) || !/fitToPage="1"/.test(hojaReporte)) {
	throw new Error('La hoja modelo no está configurada en horizontal y ajustada a una página');
}

const hojaMaestra = limpiarHoja(
	limpiarFilas(await leer(parteDeHoja(HOJA_MAESTRA)), ROTULOS_MAESTRA)
);

// --- Logotipo de ICSI (el del cliente no se versiona: lo recibe el generador) --------------------

const parteModelo = parteDeHoja(hojaModelo);
const relacionesHoja = await leer(
	posix.join(dirname(parteModelo), '_rels', `${posix.basename(parteModelo)}.rels`)
);
const destinoDibujo = /Target="([^"]*drawings\/[^"]+)"/.exec(relacionesHoja)?.[1];
if (!destinoDibujo) throw new Error('La hoja modelo no tiene dibujo');
const parteDibujo = posix.join(dirname(parteModelo), destinoDibujo);
const relacionesDibujo = await leer(
	posix.join(dirname(parteDibujo), '_rels', `${posix.basename(parteDibujo)}.rels`)
);
const numeroDe = (xml: string, etiqueta: string) =>
	Number(new RegExp(`<xdr:${etiqueta}>(-?\\d+)</xdr:${etiqueta}>`).exec(xml)?.[1] ?? Number.NaN);
// De las dos imágenes del encabezado (fila 1), la de ICSI es la de la derecha.
const logotipos = anclasDe(await leer(parteDibujo))
	.filter((a) => a.includes('<xdr:pic>') && numeroDe(a, 'row') === 0)
	.sort((a, b) => numeroDe(b, 'col') - numeroDe(a, 'col'));
const logo = logotipos[0];
if (logotipos.length !== 2 || !logo) {
	throw new Error('La hoja modelo no tiene los dos logotipos del encabezado');
}
const destinoLogo = destinoDe(relacionesDibujo, /r:embed="([^"]+)"/.exec(logo)?.[1] ?? '');
if (!destinoLogo) throw new Error('No se encontró la imagen del logotipo');
const imagenLogo = await zip
	.file(posix.join(dirname(parteDibujo), destinoLogo))!
	.async('nodebuffer');
const medidas = await sharp(imagenLogo).metadata();
const recorte = /<a:srcRect([^>]*)\/>/.exec(logo)?.[1] ?? '';
const fraccion = (lado: string) =>
	Number(new RegExp(`\\s${lado}="(\\d+)"`).exec(recorte)?.[1] ?? 0) / 100000;
const izquierda = Math.round(medidas.width * fraccion('l'));
const arriba = Math.round(medidas.height * fraccion('t'));
// El recorte que Excel aplica al mostrarlo se deja hecho en la imagen.
const recortado = {
	left: izquierda,
	top: arriba,
	width: Math.round(medidas.width * (1 - fraccion('r'))) - izquierda,
	height: Math.round(medidas.height * (1 - fraccion('b'))) - arriba
};
const logoIcsi = await sharp(imagenLogo).extract(recortado).png({ compressionLevel: 9 }).toBuffer();
const tamanoLogo = /<xdr:ext cx="(\d+)" cy="(\d+)"\/>/.exec(logo);
if (!tamanoLogo) throw new Error('El logotipo no está anclado a una celda con tamaño propio');
// Se conserva el ancho de la fuente y el alto sale de la proporción real de la imagen.
const anchoLogo = Number(tamanoLogo[1]);
const altoLogo = Math.round((anchoLogo * recortado.height) / recortado.width);
const dibujo = xmlDibujo([
	xmlImagen(
		1,
		'Logotipo ICSI',
		'Logotipo de ICSI',
		'rId1',
		{
			columna: numeroDe(logo, 'col'),
			desplazamientoColumna: numeroDe(logo, 'colOff'),
			fila: 0,
			desplazamientoFila: numeroDe(logo, 'rowOff')
		},
		{ ancho: anchoLogo, alto: altoLogo }
	)
]);

// --- Paquete -------------------------------------------------------------------------------------

const propiedades = (cuerpo: string, espacios: string) =>
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<${espacios}>${cuerpo}</${espacios.split(' ')[0]}>`;
const partes: Record<string, string | Buffer> = {
	'[Content_Types].xml': xmlTiposContenido(2, [1]),
	'_rels/.rels':
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
		'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
		'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
		'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
		'<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
		'</Relationships>',
	'docProps/core.xml': propiedades(
		'<dc:creator>ICSI</dc:creator><cp:lastModifiedBy>ICSI</cp:lastModifiedBy>',
		'cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"'
	),
	'docProps/app.xml': propiedades(
		'<Application>Microsoft Excel</Application>',
		'Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"'
	),
	'xl/workbook.xml': xmlLibro(
		[{ nombre: HOJA_MAESTRA }, { nombre: HOJA_MODELO, areaImpresion: AREA_IMPRESION }],
		1
	),
	'xl/_rels/workbook.xml.rels': xmlRelaciones(relacionesLibro(2)),
	'xl/styles.xml': estilos,
	'xl/theme/theme1.xml': await leer('xl/theme/theme1.xml'),
	'xl/worksheets/sheet1.xml': hojaMaestra,
	'xl/worksheets/sheet2.xml': hojaReporte,
	'xl/worksheets/_rels/sheet2.xml.rels': xmlRelaciones([
		{ id: 'rId1', tipo: 'drawing', destino: '../drawings/drawing1.xml' }
	]),
	'xl/drawings/drawing1.xml': dibujo,
	'xl/drawings/_rels/drawing1.xml.rels': xmlRelaciones([
		{ id: 'rId1', tipo: 'image', destino: '../media/logo_icsi.png' }
	]),
	'xl/media/logo_icsi.png': logoIcsi
};

const paquete = new JSZip();
for (const [nombre, contenido] of Object.entries(partes)) {
	paquete.file(nombre, contenido, { date: FECHA_PAQUETE, createFolders: false });
}
const plantilla = await paquete.generateAsync({
	type: 'nodebuffer',
	compression: 'DEFLATE',
	compressionOptions: { level: 9 }
});

// Ningún texto de la fuente puede quedar en la plantilla, salvo los rótulos fijos del formato.
const rotulos = new Set(
	[...Object.values(partes)]
		.filter((p): p is string => typeof p === 'string')
		.flatMap((xml) => [...xml.matchAll(/<t xml:space="preserve">([^<]*)<\/t>/g)])
		.map((m) => normalizarParaComparar(decodificarXml(m[1])))
);
const textosProhibidos = cadenas.filter((c) => {
	const plano = normalizarParaComparar(c);
	return plano.length >= 6 && ![...rotulos].some((r) => r.includes(plano));
});
const autores = [
	...(await leer('docProps/core.xml')).matchAll(/<(?:dc:creator|cp:lastModifiedBy)>([^<]+)</g)
].map((m) => m[1]);
const problemas = await auditarPaquete(plantilla, {
	textosProhibidos: [...textosProhibidos, ...autores]
});
if (problemas.length) {
	console.error(`La plantilla no pasó la auditoría:\n- ${problemas.join('\n- ')}`);
	process.exit(1);
}

await mkdir(dirname(DESTINO), { recursive: true });
await writeFile(DESTINO, plantilla);
console.log(
	`Plantilla escrita en ${DESTINO} (${plantilla.length} bytes; ${rotulos.size} rótulos; ` +
		`${textosProhibidos.length} textos de la fuente comprobados como ausentes).`
);
