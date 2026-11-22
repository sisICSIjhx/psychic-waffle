// Escritura mínima de libros .xlsx sobre JSZip: celdas con texto en línea, combinadas, geometría de
// la hoja (anchos y altos) y las partes fijas del paquete. Complementa al lector de
// importacion/xlsx.ts; la usan el generador del reporte fotográfico y el script que construye su
// plantilla. No es una biblioteca general de hojas de cálculo: solo lo que ese formato necesita.
import { escaparXml } from './ooxml.ts';

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const NS_HOJA = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PAQUETE = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CABECERA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

export const EMU_POR_CM = 360000;
const EMU_POR_PT = 12700;
const EMU_POR_PX = 9525;
/** Ancho en píxeles del dígito más ancho de la fuente predeterminada del libro (Arial 10 a 96 ppp). */
const PX_POR_CARACTER = 7;

/** «C» → 2 (base 0). */
export function indiceColumna(letras: string): number {
	let numero = 0;
	for (const letra of letras.toUpperCase()) numero = numero * 26 + (letra.charCodeAt(0) - 64);
	return numero - 1;
}

/** 2 → «C». */
export function letraColumna(indice: number): string {
	let letras = '';
	for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
		letras = String.fromCharCode(65 + ((n - 1) % 26)) + letras;
	}
	return letras;
}

/** AAAA-MM-DD → número de serie de fecha de Excel (sistema 1900). */
export function serieExcel(fechaIso: string): number {
	const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso);
	if (!coincidencia) throw new RangeError(`Fecha incompleta o inválida: «${fechaIso}»`);
	const [, anio, mes, dia] = coincidencia.map(Number);
	return Math.round(Date.UTC(anio, mes - 1, dia) / 86400000) + 25569;
}

export type ContenidoCelda =
	| { tipo: 'texto'; valor: string }
	| { tipo: 'numero'; valor: number }
	/** Fórmula con su resultado guardado, para que el libro se lea igual sin recalcular. */
	| { tipo: 'formula'; formula: string; resultado: string | number };

const textoEnLinea = (valor: string) => `<is><t xml:space="preserve">${escaparXml(valor)}</t></is>`;

/** XML de una celda con su estilo; sin contenido queda vacía (solo formato). */
export function xmlCelda(
	referencia: string,
	estilo: string | null,
	contenido?: ContenidoCelda | null
): string {
	const inicio = `<c r="${referencia}"${estilo === null ? '' : ` s="${estilo}"`}`;
	if (!contenido || (contenido.tipo === 'texto' && !contenido.valor)) return `${inicio}/>`;
	if (contenido.tipo === 'texto') {
		return `${inicio} t="inlineStr">${textoEnLinea(contenido.valor)}</c>`;
	}
	if (contenido.tipo === 'numero') return `${inicio}><v>${contenido.valor}</v></c>`;
	const formula = `<f>${escaparXml(contenido.formula)}</f>`;
	return typeof contenido.resultado === 'number'
		? `${inicio}>${formula}<v>${contenido.resultado}</v></c>`
		: `${inicio} t="str">${formula}<v>${escaparXml(contenido.resultado)}</v></c>`;
}

const patronCelda = (referencia: string) =>
	new RegExp(`<c r="${referencia}"(?: s="(\\d+)")?(?: t="\\w+")?(?:/>|>[\\s\\S]*?</c>)`);

/** Estilo (índice de cellXfs) de una celda de la hoja, o null si la celda no existe o no lo tiene. */
export function estiloDeCelda(xmlHoja: string, referencia: string): string | null {
	return patronCelda(referencia).exec(xmlHoja)?.[1] ?? null;
}

/**
 * Sustituye el contenido de una celda conservando su estilo. La celda debe existir en la hoja: así
 * una plantilla que no corresponde al generador falla con un mensaje claro en vez de salir incompleta.
 */
export function ponerCelda(
	xmlHoja: string,
	referencia: string,
	contenido: ContenidoCelda | null
): string {
	const coincidencia = patronCelda(referencia).exec(xmlHoja);
	if (!coincidencia) throw new Error(`La plantilla no tiene la celda ${referencia}`);
	return (
		xmlHoja.slice(0, coincidencia.index) +
		xmlCelda(referencia, coincidencia[1] ?? null, contenido) +
		xmlHoja.slice(coincidencia.index + coincidencia[0].length)
	);
}

/** Cambia el alto (pt) de una fila existente. */
export function ponerAltoFila(xmlHoja: string, fila: number, alto: number): string {
	const patron = new RegExp(`<row r="${fila}"([^>]*)>`);
	const coincidencia = patron.exec(xmlHoja);
	if (!coincidencia) throw new Error(`La plantilla no tiene la fila ${fila}`);
	const atributos = coincidencia[1]
		.replace(/\sht="[^"]*"/, '')
		.replace(/\scustomHeight="[^"]*"/, '');
	const redondeado = Math.round(alto * 100) / 100;
	return xmlHoja.replace(
		patron,
		`<row r="${fila}"${atributos} ht="${redondeado}" customHeight="1">`
	);
}

export function combinadasDe(xmlHoja: string): string[] {
	return [...xmlHoja.matchAll(/<mergeCell ref="([^"]+)"\/>/g)].map((m) => m[1]);
}

/** Reemplaza la lista de celdas combinadas de la hoja (el elemento debe existir). */
export function ponerCombinadas(xmlHoja: string, rangos: readonly string[]): string {
	const patron = /<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/;
	if (!patron.test(xmlHoja)) throw new Error('La plantilla no tiene celdas combinadas');
	const xml = `<mergeCells count="${rangos.length}">${rangos
		.map((r) => `<mergeCell ref="${r}"/>`)
		.join('')}</mergeCells>`;
	return xmlHoja.replace(patron, xml);
}

/** Tamaño de cada columna y fila de la hoja, en EMU (base 0). */
export interface Rejilla {
	columnas: number[];
	filas: number[];
}

/**
 * Lee anchos y altos de la hoja. El ancho en pantalla depende de la fuente predeterminada y de la
 * escala del equipo; aquí se calcula a 96 ppp, y por eso las imágenes se anclan a una sola celda con
 * su tamaño exacto: un error de pocos píxeles mueve la foto, pero no la deforma.
 */
export function rejillaDe(xmlHoja: string, columnas: number, filas: number): Rejilla {
	const formato = /<sheetFormatPr[^>]*>/.exec(xmlHoja)?.[0] ?? '';
	const numero = (xml: string, atributo: string) => {
		const valor = new RegExp(`\\s${atributo}="([^"]+)"`).exec(xml)?.[1];
		return valor === undefined ? null : Number(valor);
	};
	const anchoPredeterminado = numero(formato, 'defaultColWidth') ?? 8.43;
	const altoPredeterminado = numero(formato, 'defaultRowHeight') ?? 15;
	const anchos = new Array<number>(columnas).fill(anchoPredeterminado);
	for (const col of xmlHoja.matchAll(/<col\s[^>]*>/g)) {
		const ancho = numero(col[0], 'width');
		const min = numero(col[0], 'min');
		const max = numero(col[0], 'max') ?? min;
		if (ancho === null || min === null || max === null) continue;
		for (let c = min; c <= Math.min(max, columnas); c++) anchos[c - 1] = ancho;
	}
	const altos = new Array<number>(filas).fill(altoPredeterminado);
	for (const fila of xmlHoja.matchAll(/<row\s[^>]*>/g)) {
		const r = numero(fila[0], 'r');
		const alto = numero(fila[0], 'ht');
		if (r !== null && alto !== null && r <= filas) altos[r - 1] = alto;
	}
	return {
		columnas: anchos.map((a) => Math.trunc(a * PX_POR_CARACTER + 0.5) * EMU_POR_PX),
		filas: altos.map((a) => Math.round(a * EMU_POR_PT))
	};
}

export interface Ancla {
	columna: number;
	desplazamientoColumna: number;
	fila: number;
	desplazamientoFila: number;
}

function situar(tamanos: readonly number[], posicion: number): [number, number] {
	let resto = Math.max(0, Math.round(posicion));
	for (let i = 0; i < tamanos.length; i++) {
		if (resto < tamanos[i] || i === tamanos.length - 1) return [i, Math.min(resto, tamanos[i])];
		resto -= tamanos[i];
	}
	return [0, 0];
}

/** Celda y desplazamiento que corresponden a un punto (EMU desde la esquina de la hoja). */
export function anclaEn(rejilla: Rejilla, x: number, y: number): Ancla {
	const [columna, desplazamientoColumna] = situar(rejilla.columnas, x);
	const [fila, desplazamientoFila] = situar(rejilla.filas, y);
	return { columna, desplazamientoColumna, fila, desplazamientoFila };
}

export const suma = (valores: readonly number[], desde: number, hasta: number) =>
	valores.slice(desde, hasta).reduce((total, v) => total + v, 0);

// --- Dibujos -----------------------------------------------------------------------------------

const xmlDesde = (a: Ancla) =>
	`<xdr:from><xdr:col>${a.columna}</xdr:col><xdr:colOff>${a.desplazamientoColumna}</xdr:colOff>` +
	`<xdr:row>${a.fila}</xdr:row><xdr:rowOff>${a.desplazamientoFila}</xdr:rowOff></xdr:from>`;

export interface Tamano {
	/** EMU */
	ancho: number;
	/** EMU */
	alto: number;
}

/** Imagen anclada a una celda con su tamaño exacto (no se deforma al cambiar anchos o altos). */
export function xmlImagen(
	id: number,
	nombre: string,
	descripcion: string,
	relacion: string,
	ancla: Ancla,
	{ ancho, alto }: Tamano
): string {
	return (
		`<xdr:oneCellAnchor>${xmlDesde(ancla)}<xdr:ext cx="${ancho}" cy="${alto}"/><xdr:pic>` +
		`<xdr:nvPicPr><xdr:cNvPr id="${id}" name="${escaparXml(nombre)}" descr="${escaparXml(descripcion)}"/>` +
		'<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
		`<xdr:blipFill><a:blip xmlns:r="${NS_REL}" r:embed="${relacion}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
		`<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${ancho}" cy="${alto}"/></a:xfrm>` +
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>'
	);
}

/** Círculo blanco con un texto centrado (el número de la actividad que ilustra la foto). */
export function xmlCirculo(
	id: number,
	nombre: string,
	texto: string,
	ancla: Ancla,
	diametro: number
): string {
	return (
		`<xdr:oneCellAnchor>${xmlDesde(ancla)}<xdr:ext cx="${diametro}" cy="${diametro}"/>` +
		`<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="${escaparXml(nombre)}"/><xdr:cNvSpPr/></xdr:nvSpPr>` +
		`<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${diametro}" cy="${diametro}"/></a:xfrm>` +
		'<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></xdr:spPr>' +
		'<xdr:style><a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="15000"/></a:schemeClr></a:lnRef>' +
		'<a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef>' +
		'<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></xdr:style>' +
		'<xdr:txBody><a:bodyPr vertOverflow="clip" horzOverflow="clip" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="ctr"/><a:lstStyle/>' +
		'<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="es-MX" sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:rPr>' +
		`<a:t>${escaparXml(texto)}</a:t></a:r></a:p></xdr:txBody></xdr:sp><xdr:clientData/></xdr:oneCellAnchor>`
	);
}

export function xmlDibujo(anclas: readonly string[]): string {
	return (
		CABECERA +
		'<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
		`xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anclas.join('')}</xdr:wsDr>`
	);
}

/** Anclas (imágenes o formas) de un dibujo, tal como están escritas. */
export function anclasDe(xmlDibujoHoja: string): string[] {
	return (
		xmlDibujoHoja.match(
			/<xdr:(oneCellAnchor|twoCellAnchor)[\s>][\s\S]*?<\/xdr:(?:oneCellAnchor|twoCellAnchor)>/g
		) ?? []
	);
}

// --- Partes del paquete ------------------------------------------------------------------------

export interface Relacion {
	id: string;
	tipo: 'worksheet' | 'styles' | 'theme' | 'drawing' | 'image';
	destino: string;
}

export function xmlRelaciones(relaciones: readonly Relacion[]): string {
	return (
		CABECERA +
		`<Relationships xmlns="${NS_PAQUETE}">${relaciones
			.map((r) => `<Relationship Id="${r.id}" Type="${NS_REL}/${r.tipo}" Target="${r.destino}"/>`)
			.join('')}</Relationships>`
	);
}

export interface HojaLibro {
	nombre: string;
	/** Área de impresión en notación absoluta («$B$1:$Q$53»), si la hoja tiene. */
	areaImpresion?: string;
}

/** Nombre de hoja entre comillas simples, como lo escribe Excel en fórmulas y nombres definidos. */
export const nombreHojaEnFormula = (nombre: string) => `'${nombre.replace(/'/g, "''")}'`;

/** xl/workbook.xml: las hojas en orden (rId1, rId2…), sus áreas de impresión y recálculo al abrir. */
export function xmlLibro(hojas: readonly HojaLibro[], hojaActiva = 0): string {
	const lista = hojas
		.map((h, i) => `<sheet name="${escaparXml(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
		.join('');
	const areas = hojas
		.map((h, i) =>
			h.areaImpresion
				? `<definedName name="_xlnm.Print_Area" localSheetId="${i}">${escaparXml(
						`${nombreHojaEnFormula(h.nombre)}!${h.areaImpresion}`
					)}</definedName>`
				: ''
		)
		.join('');
	return (
		CABECERA +
		`<workbook xmlns="${NS_HOJA}" xmlns:r="${NS_REL}"><workbookPr defaultThemeVersion="166925"/>` +
		`<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="23256" windowHeight="13896" activeTab="${hojaActiva}"/></bookViews>` +
		`<sheets>${lista}</sheets>${areas ? `<definedNames>${areas}</definedNames>` : ''}` +
		'<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'
	);
}

/** Relaciones del libro: una por hoja (en orden) y después estilos y tema. */
export function relacionesLibro(hojas: number): Relacion[] {
	return [
		...Array.from({ length: hojas }, (_, i) => ({
			id: `rId${i + 1}`,
			tipo: 'worksheet' as const,
			destino: `worksheets/sheet${i + 1}.xml`
		})),
		{ id: `rId${hojas + 1}`, tipo: 'styles', destino: 'styles.xml' },
		{ id: `rId${hojas + 2}`, tipo: 'theme', destino: 'theme/theme1.xml' }
	];
}

/** [Content_Types].xml de un libro con `hojas` hojas y los dibujos indicados (número de cada uno). */
export function xmlTiposContenido(hojas: number, dibujos: readonly number[]): string {
	const hoja = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
	const parte = (nombre: string, tipo: string) =>
		`<Override PartName="${nombre}" ContentType="${tipo}"/>`;
	return (
		CABECERA +
		'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
		'<Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>' +
		'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
		'<Default Extension="xml" ContentType="application/xml"/>' +
		parte('/xl/workbook.xml', `${MIME_XLSX}.main+xml`) +
		Array.from({ length: hojas }, (_, i) => parte(`/xl/worksheets/sheet${i + 1}.xml`, hoja)).join(
			''
		) +
		dibujos
			.map((n) =>
				parte(
					`/xl/drawings/drawing${n}.xml`,
					'application/vnd.openxmlformats-officedocument.drawing+xml'
				)
			)
			.join('') +
		parte(
			'/xl/styles.xml',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml'
		) +
		parte('/xl/theme/theme1.xml', 'application/vnd.openxmlformats-officedocument.theme+xml') +
		parte('/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml') +
		parte(
			'/docProps/app.xml',
			'application/vnd.openxmlformats-officedocument.extended-properties+xml'
		) +
		'</Types>'
	);
}
