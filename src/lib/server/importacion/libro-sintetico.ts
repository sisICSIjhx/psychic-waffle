// Libro sintético con la estructura de «CATALOGO DE ALCANCES.xlsx» para las pruebas del
// importador. Solo contiene datos ficticios.
import JSZip from 'jszip';
import { escaparXml } from '../documentos/ooxml.ts';

export interface PartidaSintetica {
	numero: number;
	actividad: string;
	periodicidad: string;
	/** Periodicidad distinta (o vacía) en el programa anual; por omisión, la misma del catálogo. */
	periodicidadPrograma?: string;
	cantidad: number | null;
	distribucion: 'Producción' | 'Mantenimiento';
	/** Meses marcados en la fila P (0 = primer mes del periodo). */
	meses: number[];
	realizados?: number[];
	/** Líneas de la columna DESCRIPCIÓN: viñetas «·», «Nota: …» o normas. */
	alcances: string[];
	odm?: boolean;
	pt?: boolean;
	ast?: boolean;
	material?: 'ICSI' | 'CLIENTE';
	entrega?: string;
}

export interface OpcionesLibro {
	partidas: PartidaSintetica[];
	/** Cabecera que se omite para probar el rechazo por estructura. */
	omitirColumna?: 'FRECUENCIA' | 'P/R' | 'DESCRIPCIÓN';
}

const MESES = [
	'MAYO 2026',
	'JUNIO 2026',
	'JULIO 2026',
	'AGOSTO 2026',
	'SEPTIEMBRE 2026',
	'OCTUBRE 2026',
	'NOVIEMBRE 2026',
	'DICIEMBRE 2026',
	'ENERO 2027',
	'FEBRERO 2027',
	'MARZO 2027',
	'ABRIL 2027'
];

function letra(columna: number): string {
	let resultado = '';
	let n = columna + 1;
	while (n > 0) {
		const resto = (n - 1) % 26;
		resultado = String.fromCharCode(65 + resto) + resultado;
		n = Math.floor((n - 1) / 26);
	}
	return resultado;
}

type Celda = { valor?: string | number; marcada?: boolean };

function hojaXml(filas: Map<number, Map<number, Celda>>, combinadas: string[]): string {
	const cuerpo = [...filas.entries()]
		.sort(([a], [b]) => a - b)
		.map(([fila, celdas]) => {
			const contenido = [...celdas.entries()]
				.sort(([a], [b]) => a - b)
				.map(([columna, celda]) => {
					const ref = `${letra(columna)}${fila + 1}`;
					const estilo = celda.marcada ? ' s="1"' : '';
					if (celda.valor === undefined) return `<c r="${ref}"${estilo}/>`;
					if (typeof celda.valor === 'number')
						return `<c r="${ref}"${estilo}><v>${celda.valor}</v></c>`;
					return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${escaparXml(celda.valor)}</t></is></c>`;
				})
				.join('');
			return `<row r="${fila + 1}">${contenido}</row>`;
		})
		.join('');
	const merges = combinadas.length
		? `<mergeCells count="${combinadas.length}">${combinadas.map((r) => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>`
		: '';
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cuerpo}</sheetData>${merges}</worksheet>`;
}

function poner(
	filas: Map<number, Map<number, Celda>>,
	fila: number,
	columna: number,
	celda: Celda
) {
	if (!filas.has(fila)) filas.set(fila, new Map());
	filas.get(fila)!.set(columna, { ...filas.get(fila)!.get(columna), ...celda });
}

export async function crearLibroSintetico({
	partidas,
	omitirColumna
}: OpcionesLibro): Promise<Uint8Array> {
	// Hoja 1: programa anual. Columnas B a G y dos columnas por mes desde H.
	const programa = new Map<number, Map<number, Celda>>();
	const combinadasPrograma: string[] = [];
	poner(programa, 0, 1, { valor: 'EMPRESA FICTICIA PROGRAMA DE OPERACIÓN Y MANTENIMIENTO' });
	poner(programa, 4, 1, { valor: 'USUARIO: CLIENTE FICTICIO' });
	poner(programa, 4, 4, { valor: 'ESTACIÓN DE MEDICIÓN: 99999 " SITIO FICTICIO "' });
	const cabeceras = ['PARTIDA', 'ACTIVIDAD', 'PERIODICIDAD ', 'CANTIDAD', 'DISTRIBUCIÓN', 'P/R'];
	cabeceras.forEach((t, i) => {
		if (t === omitirColumna) return;
		poner(programa, 5, i + 1, { valor: t });
	});
	poner(programa, 5, 7, { valor: 'PERIODO: 01 DE MAYO DE 2026 AL 30 DE ABRIL DE 2027' });
	MESES.forEach((mes, i) => {
		poner(programa, 6, 7 + i * 2, { valor: mes });
		combinadasPrograma.push(`${letra(7 + i * 2)}7:${letra(8 + i * 2)}7`);
	});
	let fila = 7;
	for (const p of partidas) {
		poner(programa, fila, 1, { valor: p.numero });
		poner(programa, fila, 2, { valor: p.actividad });
		poner(programa, fila, 3, { valor: p.periodicidadPrograma ?? p.periodicidad });
		if (p.cantidad !== null) poner(programa, fila, 4, { valor: p.cantidad });
		poner(programa, fila, 5, { valor: p.distribucion });
		poner(programa, fila, 6, { valor: 'P' });
		poner(programa, fila + 1, 6, { valor: 'R' });
		for (const columna of [1, 2, 3, 4, 5]) {
			combinadasPrograma.push(`${letra(columna)}${fila + 1}:${letra(columna)}${fila + 2}`);
		}
		MESES.forEach((_, i) => {
			const columna = 7 + i * 2;
			poner(programa, fila, columna, { marcada: p.meses.includes(i) });
			poner(programa, fila + 1, columna, { marcada: p.realizados?.includes(i) ?? false });
			combinadasPrograma.push(`${letra(columna)}${fila + 1}:${letra(columna + 1)}${fila + 1}`);
		});
		fila += 2;
	}
	// Bloque de firmas con nombres ficticios: el importador solo debe proponerlos.
	poner(programa, fila + 4, 1, { valor: 'OPERADOR' });
	poner(programa, fila + 4, 4, { valor: 'AUTORIZA' });
	poner(programa, fila + 7, 1, { valor: 'Ing. Nombre Ficticio Uno' });
	poner(programa, fila + 8, 1, { valor: 'Dirección Ficticia' });
	poner(programa, fila + 9, 1, { valor: 'EMPRESA FICTICIA' });
	poner(programa, fila + 7, 4, { valor: 'Ing. Nombre Ficticio Dos' });

	// Hoja 2: catálogo de conceptos.
	const catalogo = new Map<number, Map<number, Celda>>();
	const columnasCatalogo = [
		'ITEM',
		'ACTIVIDAD',
		'DESCRIPCIÓN',
		'DISTRIBUCIÓN',
		'FRECUENCIA',
		'ENTREGA',
		'ENTREGA DE ACUERDO CON OMA',
		'ENTREGA PROPUESTA',
		'REQUIERE ODM',
		null,
		'REQUIERE PT',
		null,
		'REQUIERE AST',
		null,
		'MATERIAL / CONSUMIBLES (POR ICSI O CLIENTE)',
		null,
		'Reportes Homologados'
	];
	columnasCatalogo.forEach((t, i) => {
		if (t && t !== omitirColumna) poner(catalogo, 3, i + 1, { valor: t });
	});
	[9, 11, 13].forEach((c) => {
		poner(catalogo, 4, c, { valor: 'SI' });
		poner(catalogo, 4, c + 1, { valor: 'NO' });
	});
	fila = 5;
	for (const p of partidas) {
		poner(catalogo, fila, 1, { valor: p.numero });
		poner(catalogo, fila, 2, { valor: p.actividad });
		poner(catalogo, fila, 4, { valor: p.distribucion });
		poner(catalogo, fila, 5, { valor: p.periodicidad });
		poner(catalogo, fila, 6, { valor: p.entrega ?? 'Reporte' });
		poner(catalogo, fila, p.odm === false ? 10 : 9, { valor: 'X' });
		poner(catalogo, fila, p.pt ? 11 : 12, { valor: 'X' });
		poner(catalogo, fila, p.ast ? 13 : 14, { valor: 'X' });
		poner(catalogo, fila, 15, { valor: p.material ?? 'ICSI' });
		p.alcances.forEach((linea, i) => poner(catalogo, fila + i, 3, { valor: linea }));
		fila += Math.max(1, p.alcances.length);
	}

	const zip = new JSZip();
	zip.file(
		'[Content_Types].xml',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'
	);
	zip.file(
		'_rels/.rels',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
	);
	zip.file(
		'xl/workbook.xml',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="PROGRAMA ANUAL 2026" sheetId="1" r:id="rId1"/><sheet name="Catálogo de Conceptos-ALCANCES" sheetId="2" r:id="rId2"/></sheets></workbook>'
	);
	zip.file(
		'xl/_rels/workbook.xml.rels',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
	);
	zip.file(
		'xl/styles.xml',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor theme="0" tint="-0.34998626667073579"/><bgColor indexed="64"/></patternFill></fill></fills><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" applyFill="1"/></cellXfs></styleSheet>'
	);
	zip.file('xl/worksheets/sheet1.xml', hojaXml(programa, combinadasPrograma));
	zip.file('xl/worksheets/sheet2.xml', hojaXml(catalogo, []));
	return zip.generateAsync({ type: 'uint8array' });
}

/** Tres partidas ficticias que cubren mensual, diaria (por días del mes) y «cuando aplique». */
export const PARTIDAS_EJEMPLO: PartidaSintetica[] = [
	{
		numero: 1,
		actividad: 'Orden y limpieza ficticia',
		periodicidad: 'Mensual',
		cantidad: 12,
		distribucion: 'Producción',
		meses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
		alcances: ['·    Inspección visual', '·    Limpieza general', 'Nota: No incluye materiales.'],
		material: 'ICSI'
	},
	{
		numero: 2,
		actividad: 'Recorrido diario ficticio',
		periodicidad: 'Diario',
		cantidad: 365,
		distribucion: 'Producción',
		meses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
		realizados: [0],
		alcances: ['· Recorrido de inspección', 'Para asegurar el cumplimiento de la NOM-000-FICTICIA'],
		pt: true,
		material: 'CLIENTE'
	},
	{
		numero: 3,
		actividad: 'Atención de emergencias ficticia',
		periodicidad: 'Cuando aplique',
		cantidad: null,
		distribucion: 'Mantenimiento',
		meses: [],
		alcances: ['· Atención de la emergencia']
	}
];
