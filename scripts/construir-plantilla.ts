// Construye src/lib/server/plantillas/FOR-ICSI-RMT-01.v1.docx a partir de un reporte real.
//
// Uso (solo en local; el reporte fuente vive en insumos/, que no se versiona):
//   node scripts/construir-plantilla.ts "<reporte FOR-ICSI-RMT-01 con tabla de verificación>.docx"
//
// Conserva de la fuente: portada, tabla de encabezado, tabla de firmas, estilos, numeración, tema,
// encabezados y pies (con el membrete) y las tablas de herramientas y verificación. Sustituye los
// datos por marcadores de docx-templates y genera el cuerpo con los bloques repetidos. El paquete
// se sanea (sin propiedades de autor, customXml, miniaturas, rsid ni fuentes propietarias) y se
// audita contra los nombres de la fuente antes de escribirse; esos nombres no salen de memoria.
import JSZip from 'jszip';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditarPaquete, normalizarParaComparar } from '../src/lib/server/documentos/auditoria.ts';
import {
	bloquesCuerpo,
	elementos,
	escaparXml,
	reemplazarTextoParrafo,
	texto,
	type Fragmento
} from '../src/lib/server/documentos/ooxml.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'src/lib/server/plantillas/FOR-ICSI-RMT-01.v1.docx');

/** Fuentes con licencia libre (OFL/Apache) que se conservan incrustadas para la fidelidad. */
const FUENTES_INCRUSTADAS = new Set(['Open Sans', 'Open Sans Bold', 'Arimo Bold']);

/** Ancho útil de la página de contenido (carta, márgenes de 2.5 cm), en twips. */
const ANCHO_CONTENIDO = 9404;

const TIPOS = {
	documento: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
	estilos: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
	numeracion: 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
	ajustes: 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
	fuentes: 'application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml',
	tema: 'application/vnd.openxmlformats-officedocument.theme+xml',
	notasPie: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml',
	notasFinal: 'application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml',
	encabezado: 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
	pie: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
	core: 'application/vnd.openxmlformats-package.core-properties+xml',
	app: 'application/vnd.openxmlformats-officedocument.extended-properties+xml'
};

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_PAQUETE = 'http://schemas.openxmlformats.org/package/2006/relationships';

const cmd = (comando: string) => `+++${comando}+++`;
const run = (textoRun: string, rPr = '') =>
	`<w:r>${rPr}<w:t xml:space="preserve">${escaparXml(textoRun)}</w:t></w:r>`;
const parrafo = (estilo: string | null, contenido: string, pPr = '') =>
	`<w:p><w:pPr>${estilo ? `<w:pStyle w:val="${estilo}"/>` : ''}${pPr}</w:pPr>${contenido}</w:p>`;
const parrafoComando = (comando: string) => parrafo(null, run(cmd(comando)));

const P_CUERPO =
	'<w:spacing w:before="120" w:after="120" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/>';
const P_CENTRO = '<w:spacing w:before="120" w:after="0"/><w:jc w:val="center"/>';
const P_PIE = '<w:spacing w:before="40" w:after="160"/><w:jc w:val="center"/>';

function limpiarAtributos(xml: string): string {
	return xml
		.replace(/ w:rsid\w*="[^"]*"/g, '')
		.replace(/ w14:(paraId|textId)="[^"]*"/g, '')
		.replace(/ o:gfxdata="[^"]*"/g, '');
}

function reemplazarFragmentos(
	xml: string,
	fragmentos: Fragmento[],
	sustituto: (fragmento: Fragmento, indice: number) => string
): string {
	let resultado = xml;
	for (let i = fragmentos.length - 1; i >= 0; i--) {
		const f = fragmentos[i];
		resultado = resultado.slice(0, f.inicio) + sustituto(f, i) + resultado.slice(f.fin);
	}
	return resultado;
}

function normalizar(xml: string): string {
	return normalizarParaComparar(texto(xml));
}

/** Celda con un único párrafo: el primero conserva su formato y recibe el nuevo texto. */
function celdaConTexto(celda: string, nuevoTexto: string): string {
	const parrafos = elementos(celda, 'w:p');
	if (parrafos.length === 0) throw new Error('Celda sin párrafos');
	const primero = reemplazarTextoParrafo(parrafos[0].xml, nuevoTexto);
	return (
		celda.slice(0, parrafos[0].inicio) + primero + celda.slice(parrafos[parrafos.length - 1].fin)
	);
}

/** Copia de una fila de datos con un comando en la primera celda y las demás vacías. */
function filaMarcador(fila: string, comando: string): string {
	return reemplazarFragmentos(fila, elementos(fila, 'w:tc'), (tc, i) =>
		celdaConTexto(tc.xml, i === 0 ? cmd(comando) : '')
	);
}

function filaConComandos(fila: string, comandos: string[]): string {
	const celdas = elementos(fila, 'w:tc');
	if (celdas.length !== comandos.length) {
		throw new Error(`Se esperaban ${comandos.length} celdas y la fila tiene ${celdas.length}`);
	}
	return reemplazarFragmentos(fila, celdas, (tc, i) => celdaConTexto(tc.xml, cmd(comandos[i])));
}

/** Tabla de datos de la fuente convertida en tabla repetida por filas. */
function tablaRepetida(
	tabla: string,
	variable: string,
	origen: string,
	comandos: string[]
): string {
	const filas = elementos(tabla, 'w:tr');
	if (filas.length < 2)
		throw new Error('La tabla de datos necesita encabezado y al menos una fila');
	const modelo = (filas[2] ?? filas[1]).xml;
	const cuerpo = [
		filaMarcador(modelo, `FOR ${variable} IN ${origen}`),
		filaConComandos(modelo, comandos),
		filaMarcador(modelo, `END-FOR ${variable}`)
	].join('');
	// La fila de encabezado se repite si la tabla cruza de página.
	const encabezado = filas[0].xml.includes('<w:trPr>')
		? filas[0].xml.replace('<w:trPr>', '<w:trPr><w:tblHeader/>')
		: filas[0].xml.replace(
				/^<w:tr[^>]*>/,
				(apertura) => `${apertura}<w:trPr><w:tblHeader/></w:trPr>`
			);
	return (
		tabla.slice(0, filas[0].inicio) + encabezado + cuerpo + tabla.slice(filas[filas.length - 1].fin)
	);
}

const CAMPOS_ENCABEZADO: Record<string, string> = {
	'usuario:': 'encabezado.usuario',
	'no contrato / oc:': 'encabezado.contrato',
	'sitio:': 'encabezado.sitio',
	'tag:': 'encabezado.tag',
	'periodicidad:': 'encabezado.periodicidad',
	'fecha:': 'encabezado.fecha',
	'tipo de mantenimiento:': 'encabezado.tipoMantenimiento'
};

function transformarEncabezado(tabla: string, valoresFuente: string[]): string {
	const encontrados = new Set<string>();
	const resultado = reemplazarFragmentos(tabla, elementos(tabla, 'w:tr'), (tr) => {
		const celdas = elementos(tr.xml, 'w:tc');
		const campo = CAMPOS_ENCABEZADO[normalizar(celdas[0]?.xml ?? '')];
		if (!campo || celdas.length < 2) return tr.xml;
		encontrados.add(campo);
		return reemplazarFragmentos(tr.xml, celdas, (tc, i) => {
			if (i === 0) return tc.xml;
			valoresFuente.push(texto(tc.xml));
			return celdaConTexto(tc.xml, i === 1 ? cmd(`INS ${campo}`) : '');
		});
	});
	const faltantes = Object.values(CAMPOS_ENCABEZADO).filter((c) => !encontrados.has(c));
	if (faltantes.length) throw new Error(`Encabezado sin los campos: ${faltantes.join(', ')}`);
	return resultado;
}

const ROLES = ['elaboro', 'aprobo', 'recibio'] as const;

function transformarFirmas(tabla: string, nombresFuente: string[]): string {
	const filas = elementos(tabla, 'w:tr');
	const linea = filas.findIndex((f) => texto(f.xml).includes('____'));
	if (linea === -1 || !filas[linea + 2])
		throw new Error('Tabla de firmas sin la estructura esperada');
	const nombres = linea + 1;
	const empresas = linea + 2;
	return reemplazarFragmentos(tabla, filas, (tr, i) => {
		if (i !== nombres && i !== empresas) return tr.xml;
		const celdas = elementos(tr.xml, 'w:tc');
		if (celdas.length !== ROLES.length)
			throw new Error('La tabla de firmas debe tener tres columnas');
		return reemplazarFragmentos(tr.xml, celdas, (tc, c) => {
			const rol = ROLES[c];
			const parrafos = elementos(tc.xml, 'w:p');
			if (i === nombres) {
				// El nombre puede ocupar varios párrafos; el último es el cargo.
				nombresFuente.push(
					parrafos
						.slice(0, -1)
						.map((p) => texto(p.xml))
						.join(' ')
				);
				nombresFuente.push(...parrafos.slice(0, -1).map((p) => texto(p.xml)));
				const nombre = reemplazarTextoParrafo(parrafos[0].xml, cmd(`INS firmas.${rol}.nombre`));
				const cargo = reemplazarTextoParrafo(
					parrafos[parrafos.length - 1].xml,
					cmd(`INS firmas.${rol}.cargo`)
				);
				return (
					tc.xml.slice(0, parrafos[0].inicio) +
					nombre +
					cargo +
					tc.xml.slice(parrafos[parrafos.length - 1].fin)
				);
			}
			return celdaConTexto(tc.xml, cmd(`INS firmas.${rol}.empresa`));
		});
	});
}

function transformarPortada(portada: string): string {
	return reemplazarFragmentos(portada, elementos(portada, 'w:txbxContent'), (caja) => {
		const parrafos = elementos(caja.xml, 'w:p');
		if (parrafos.length < 2) throw new Error('El cuadro de la portada debe tener título y periodo');
		const apertura = caja.xml.slice(0, caja.xml.indexOf('>') + 1);
		return (
			apertura +
			reemplazarTextoParrafo(parrafos[0].xml, cmd('INS portada.linea1')) +
			reemplazarTextoParrafo(parrafos[1].xml, cmd('INS portada.linea2')) +
			'</w:txbxContent>'
		);
	});
}

function indice(): string {
	const tabulador = `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${ANCHO_CONTENIDO - 10}"/></w:tabs>`;
	const entrada1 = (contenido: string) => parrafo('TDC1', contenido, tabulador);
	const inicioCampo =
		'<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
		'<w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r>' +
		'<w:r><w:fldChar w:fldCharType="separate"/></w:r>';
	return [
		'<w:sdt><w:sdtPr><w:docPartObj><w:docPartGallery w:val="Table of Contents"/><w:docPartUnique/></w:docPartObj></w:sdtPr><w:sdtContent>',
		parrafo('TtuloTDC', run('Contenido')),
		entrada1(inicioCampo + run('1. OBJETIVO')),
		entrada1(run('2. ALCANCE')),
		parrafoComando('FOR t IN indice.alcances'),
		parrafo('TDC2', run(cmd('INS $t')), tabulador),
		parrafoComando('END-FOR t'),
		entrada1(run('3. HERRAMIENTAS Y EQUIPO')),
		parrafoComando('IF verificacion.incluida'),
		entrada1(run('4. DOCUMENTOS DE VERIFICACIÓN')),
		parrafoComando('END-IF'),
		entrada1(
			run(cmd('INS secciones.conclusiones')) +
				run('. CONCLUSIONES Y/O RECOMENDACIONES') +
				'<w:r><w:fldChar w:fldCharType="end"/></w:r>'
		),
		'</w:sdtContent></w:sdt>',
		'<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
	].join('');
}

const SIN_BORDES =
	'<w:tblBorders>' +
	['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
		.map((b) => `<w:${b} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`)
		.join('') +
	'</w:tblBorders>';

function tablaFotos(columnas: number, celdas: string[], origen: string): string {
	const ancho = Math.floor(ANCHO_CONTENIDO / columnas);
	const tcPr = `<w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/><w:vAlign w:val="bottom"/></w:tcPr>`;
	const celdaMarcador = (comando: string) =>
		Array.from(
			{ length: columnas },
			(_, i) => `<w:tc>${tcPr}${i === 0 ? parrafoComando(comando) : '<w:p/>'}</w:tc>`
		).join('');
	return [
		'<w:tbl><w:tblPr><w:tblStyle w:val="Tablaconcuadrcula"/>',
		`<w:tblW w:w="${ancho * columnas}" w:type="dxa"/><w:jc w:val="center"/>${SIN_BORDES}`,
		'<w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>',
		`<w:tblGrid>${`<w:gridCol w:w="${ancho}"/>`.repeat(columnas)}</w:tblGrid>`,
		`<w:tr>${celdaMarcador(`FOR f IN ${origen}`)}</w:tr>`,
		`<w:tr><w:trPr><w:cantSplit/></w:trPr>${celdas.map((c) => `<w:tc>${tcPr}${c}</w:tc>`).join('')}</w:tr>`,
		`<w:tr>${celdaMarcador('END-FOR f')}</w:tr>`,
		'</w:tbl>'
	].join('');
}

/** Celda de foto: etiqueta opcional, imagen y pie. Los IF en línea conservan la celda aunque falte la foto. */
function celdaFoto(variable: string, etiqueta?: string): string {
	const etiquetaXml = etiqueta
		? parrafo(
				'NewNormal',
				run(cmd(`INS ${variable} ? '${etiqueta}' : ''`), '<w:rPr><w:b/></w:rPr>'),
				'<w:spacing w:before="120" w:after="40"/><w:jc w:val="center"/>'
			)
		: '';
	return (
		etiquetaXml +
		parrafo(
			'NewNormal',
			run(cmd(`IF !!${variable}`)) + run(cmd(`IMAGE ${variable}.imagen`)) + run(cmd('END-IF')),
			P_CENTRO
		) +
		parrafo('Descripcin', run(cmd(`INS ${variable} ? ${variable}.pie : ''`)), P_PIE)
	);
}

function cuerpo(tablaHerramientas: string, tablaVerificacion: string): string {
	const nivel1 = (contenido: string) => parrafo('Level1', contenido);
	// Un párrafo por renglón: los saltos manuales en un párrafo justificado estiran los espacios.
	const parrafosDe = (origen: string, variable: string) =>
		parrafoComando(`FOR ${variable} IN ${origen}`) +
		parrafo('NewNormal', run(cmd(`INS $${variable}`)), P_CUERPO) +
		parrafoComando(`END-FOR ${variable}`);
	return [
		nivel1(run('1. OBJETIVO')),
		parrafosDe('objetivo', 'p'),
		nivel1(run('2. ALCANCE')),
		parrafosDe('introduccion', 'p'),
		parrafoComando('FOR a IN alcances'),
		parrafo('Alcances', run(cmd('INS $a.titulo'))),
		parrafosDe('$a.descripcion', 'd'),
		parrafoComando('IF $a.cuadricula.length > 0'),
		tablaFotos(2, [celdaFoto('$f.izq'), celdaFoto('$f.der')], '$a.cuadricula'),
		parrafoComando('END-IF'),
		parrafoComando('IF $a.antesDuranteDespues.length > 0'),
		tablaFotos(
			3,
			[
				celdaFoto('$f.antes', 'ANTES'),
				celdaFoto('$f.durante', 'DURANTE'),
				celdaFoto('$f.despues', 'DESPUÉS')
			],
			'$a.antesDuranteDespues'
		),
		parrafoComando('END-IF'),
		parrafoComando('END-FOR a'),
		nivel1(run('3. HERRAMIENTAS Y EQUIPO')),
		tablaRepetida(tablaHerramientas, 'h', 'herramientas', [
			'INS $h.numero',
			'INS $h.cantidad',
			'INS $h.descripcion'
		]),
		parrafoComando('IF verificacion.incluida'),
		nivel1(run('4. DOCUMENTOS DE VERIFICACIÓN')),
		tablaRepetida(tablaVerificacion, 'v', 'verificacion.filas', [
			'INS $v.numero',
			'INS $v.alcance',
			'INS $v.estado',
			'INS $v.observaciones'
		]),
		parrafoComando('END-IF'),
		nivel1(run(cmd('INS secciones.conclusiones')) + run('. CONCLUSIONES Y/O RECOMENDACIONES')),
		parrafosDe('conclusiones', 'p')
	].join('');
}

function relacion(id: string, tipo: string, destino: string): string {
	return `<Relationship Id="${id}" Type="${REL}/${tipo}" Target="${destino}"/>`;
}

async function main(): Promise<void> {
	const rutaFuente = process.argv[2];
	if (!rutaFuente) {
		console.error('Uso: node scripts/construir-plantilla.ts "<reporte FOR-ICSI-RMT-01>.docx"');
		process.exit(1);
	}
	const fuente = await JSZip.loadAsync(await readFile(rutaFuente));
	const leer = async (parte: string) => {
		const archivo = fuente.file(parte);
		if (!archivo) throw new Error(`La fuente no contiene ${parte}`);
		return archivo.async('string');
	};

	const documento = await leer('word/document.xml');
	const apertura = documento.slice(0, documento.indexOf('<w:body>'));
	const bloques = bloquesCuerpo(documento);
	const indiceDe = (condicion: (b: Fragmento) => boolean, descripcion: string, desde = 0) => {
		const i = bloques.findIndex((b, n) => n >= desde && condicion(b));
		if (i === -1) throw new Error(`No se encontró en la fuente: ${descripcion}`);
		return i;
	};
	const tablaCon =
		(...textos: string[]) =>
		(b: Fragmento) =>
			b.etiqueta === 'w:tbl' &&
			textos.every(
				(t) =>
					normalizar(elementos(b.xml, 'w:tr')[0]?.xml ?? '').includes(t) ||
					normalizar(b.xml).includes(t)
			);

	const iPortada = indiceDe(
		(b) => b.etiqueta === 'w:p' && b.xml.includes('<wps:txbx'),
		'portada con cuadro de texto'
	);
	const iEncabezado = indiceDe(tablaCon('for-icsi-rmt-01', 'usuario:'), 'tabla de encabezado');
	const iFirmas = indiceDe(tablaCon('elaboro', 'recibio'), 'tabla de firmas');
	const iCorte = indiceDe(
		(b) => b.etiqueta === 'w:p' && b.xml.includes('<w:sectPr'),
		'fin de la portada',
		iFirmas
	);
	const iSeccionIndice = indiceDe(
		(b) => b.xml.includes('<w:sectPr') && b.xml.includes('w:headerReference'),
		'sección con encabezado de contenido',
		iCorte + 1
	);
	const iHerramientas = indiceDe(tablaCon('cantidad', 'material'), 'tabla de herramientas');
	const iVerificacion = indiceDe(
		tablaCon('alcance', 'estado', 'observaciones'),
		'tabla de verificación'
	);
	const seccionFinal = bloques.at(-1);
	if (seccionFinal?.etiqueta !== 'w:sectPr') throw new Error('La fuente no termina con w:sectPr');

	// Textos de la fuente que no deben sobrevivir; solo se usan en memoria para la auditoría.
	const prohibidos: string[] = [];
	const portadaXml = bloques
		.slice(iPortada, iCorte + 1)
		.map((b, n) => {
			const i = iPortada + n;
			if (i === iPortada) {
				prohibidos.push(
					...texto(b.xml)
						.split('\n')
						.filter((t) => t.trim().length > 6)
				);
				return transformarPortada(b.xml);
			}
			if (i === iEncabezado) return transformarEncabezado(b.xml, prohibidos);
			if (i === iFirmas) return transformarFirmas(b.xml, prohibidos);
			return b.xml;
		})
		.join('');

	const sectIndice = elementos(bloques[iSeccionIndice].xml, 'w:sectPr')[0].xml;
	const referencias = (sectIndice.match(/<w:(header|footer)Reference [^>]*\/>/g) ?? []).join('');
	const disenoFinal = seccionFinal.xml.replace(
		/<w:(type|headerReference|footerReference)[^>]*\/>/g,
		''
	);
	const sectPrFinal = disenoFinal.replace(/^<w:sectPr[^>]*>/, `<w:sectPr>${referencias}`);

	const cuerpoXml =
		portadaXml +
		indice() +
		cuerpo(bloques[iHerramientas].xml, bloques[iVerificacion].xml) +
		sectPrFinal;
	const documentoNuevo = limpiarAtributos(`${apertura}<w:body>${cuerpoXml}</w:body></w:document>`);

	// Encabezados y pies referenciados por las secciones (portada y contenido).
	const relsFuente = await leer('word/_rels/document.xml.rels');
	const portadaSect = elementos(bloques[iCorte].xml, 'w:sectPr')[0].xml;
	const idsReferenciados = new Set(
		[...`${portadaSect}${referencias}`.matchAll(/r:id="([^"]+)"/g)].map((m) => m[1])
	);
	const relsEncabezados = [...relsFuente.matchAll(/<Relationship [^>]*\/>/g)]
		.map((m) => m[0])
		.filter((r) => idsReferenciados.has(/Id="([^"]+)"/.exec(r)![1]));
	if (relsEncabezados.length !== idsReferenciados.size)
		throw new Error('Faltan encabezados o pies de la fuente');

	const salida = new JSZip();
	const partesEncabezado: { parte: string; tipo: string }[] = [];
	for (const rel of relsEncabezados) {
		const destino = /Target="([^"]+)"/.exec(rel)![1];
		const parte = `word/${destino}`;
		salida.file(parte, limpiarAtributos(await leer(parte)));
		partesEncabezado.push({ parte, tipo: rel.includes('/header"') ? TIPOS.encabezado : TIPOS.pie });
		const relsParte = fuente.file(`word/_rels/${destino}.rels`);
		if (relsParte) {
			const xml = await relsParte.async('string');
			salida.file(`word/_rels/${destino}.rels`, xml);
			for (const m of xml.matchAll(/Target="([^"]+)"/g)) {
				const medio = `word/${m[1]}`;
				const archivo = fuente.file(medio);
				if (!archivo) throw new Error(`Falta el medio ${medio}`);
				salida.file(medio, await archivo.async('uint8array'));
			}
		}
	}

	for (const parte of [
		'word/styles.xml',
		'word/numbering.xml',
		'word/theme/theme1.xml',
		'word/footnotes.xml',
		'word/endnotes.xml'
	]) {
		salida.file(parte, limpiarAtributos(await leer(parte)));
	}

	// Tabla de fuentes: solo se conservan incrustadas las de licencia libre.
	let tablaFuentes = await leer('word/fontTable.xml');
	const relsFuentes = fuente.file('word/_rels/fontTable.xml.rels')
		? await leer('word/_rels/fontTable.xml.rels')
		: '';
	const fuentesConservadas: string[] = [];
	tablaFuentes = reemplazarFragmentos(tablaFuentes, elementos(tablaFuentes, 'w:font'), (f) => {
		const nombre = /w:name="([^"]+)"/.exec(f.xml)?.[1] ?? '';
		if (FUENTES_INCRUSTADAS.has(nombre)) {
			for (const m of f.xml.matchAll(/<w:embed\w+ r:id="([^"]+)"/g)) fuentesConservadas.push(m[1]);
			return f.xml;
		}
		return f.xml.replace(/<w:embed\w+ [^>]*\/>/g, '');
	});
	const relsFuentesNuevas = [...relsFuentes.matchAll(/<Relationship [^>]*\/>/g)]
		.map((m) => m[0])
		.filter((r) => fuentesConservadas.includes(/Id="([^"]+)"/.exec(r)![1]));
	for (const rel of relsFuentesNuevas) {
		const parte = `word/${/Target="([^"]+)"/.exec(rel)![1]}`;
		salida.file(parte, await fuente.file(parte)!.async('uint8array'));
	}
	salida.file('word/fontTable.xml', tablaFuentes);
	if (relsFuentesNuevas.length) {
		salida.file(
			'word/_rels/fontTable.xml.rels',
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_PAQUETE}">${relsFuentesNuevas.join('')}</Relationships>`
		);
	}

	// Ajustes saneados: sin protección, rsid ni plantilla adjunta; Word actualiza el índice al abrir y
	// quita la información personal al guardar.
	const ajustes = (await leer('word/settings.xml'))
		.replace(/<w:rsids>[\s\S]*?<\/w:rsids>/, '')
		.replace(
			/<w:(documentProtection|attachedTemplate|embedSystemFonts|removePersonalInformation|updateFields)[^>]*\/>/g,
			''
		)
		.replace(/<w:docVars>[\s\S]*?<\/w:docVars>/, '')
		.replace(/(<w:zoom [^>]*\/>)/, '$1<w:removePersonalInformation/>')
		.replace('<w:hdrShapeDefaults>', '<w:updateFields w:val="true"/><w:hdrShapeDefaults>');
	if (!ajustes.includes('<w:updateFields'))
		throw new Error('No se pudo activar la actualización del índice');
	salida.file('word/settings.xml', ajustes);

	salida.file('word/document.xml', documentoNuevo);
	salida.file(
		'word/_rels/document.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_PAQUETE}">` +
			relacion('rIdEstilos', 'styles', 'styles.xml') +
			relacion('rIdNumeracion', 'numbering', 'numbering.xml') +
			relacion('rIdAjustes', 'settings', 'settings.xml') +
			relacion('rIdFuentes', 'fontTable', 'fontTable.xml') +
			relacion('rIdTema', 'theme', 'theme/theme1.xml') +
			relacion('rIdNotasPie', 'footnotes', 'footnotes.xml') +
			relacion('rIdNotasFinal', 'endnotes', 'endnotes.xml') +
			relsEncabezados.join('') +
			'</Relationships>'
	);
	salida.file(
		'[Content_Types].xml',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
			'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
			'<Default Extension="xml" ContentType="application/xml"/>' +
			'<Default Extension="png" ContentType="image/png"/>' +
			'<Default Extension="jpeg" ContentType="image/jpeg"/>' +
			'<Default Extension="jpg" ContentType="image/jpeg"/>' +
			'<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>' +
			`<Override PartName="/word/document.xml" ContentType="${TIPOS.documento}"/>` +
			`<Override PartName="/word/styles.xml" ContentType="${TIPOS.estilos}"/>` +
			`<Override PartName="/word/numbering.xml" ContentType="${TIPOS.numeracion}"/>` +
			`<Override PartName="/word/settings.xml" ContentType="${TIPOS.ajustes}"/>` +
			`<Override PartName="/word/fontTable.xml" ContentType="${TIPOS.fuentes}"/>` +
			`<Override PartName="/word/theme/theme1.xml" ContentType="${TIPOS.tema}"/>` +
			`<Override PartName="/word/footnotes.xml" ContentType="${TIPOS.notasPie}"/>` +
			`<Override PartName="/word/endnotes.xml" ContentType="${TIPOS.notasFinal}"/>` +
			partesEncabezado
				.map((p) => `<Override PartName="/${p.parte}" ContentType="${p.tipo}"/>`)
				.join('') +
			`<Override PartName="/docProps/core.xml" ContentType="${TIPOS.core}"/>` +
			`<Override PartName="/docProps/app.xml" ContentType="${TIPOS.app}"/>` +
			'</Types>'
	);
	salida.file(
		'_rels/.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_PAQUETE}">` +
			relacion('rId1', 'officeDocument', 'word/document.xml') +
			'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
			relacion('rId3', 'extended-properties', 'docProps/app.xml') +
			'</Relationships>'
	);
	salida.file(
		'docProps/core.xml',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
			'<dc:title>REPORTE DE ACTIVIDADES CON EVIDENCIA FOTOGRÁFICA</dc:title><dc:subject>FOR-ICSI-RMT-01</dc:subject>' +
			'<dc:creator>ICSI</dc:creator><cp:lastModifiedBy>ICSI</cp:lastModifiedBy><cp:revision>1</cp:revision>' +
			'</cp:coreProperties>'
	);
	salida.file(
		'docProps/app.xml',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>ICSI Reportes</Application><DocSecurity>0</DocSecurity><Company>ICSI</Company></Properties>'
	);

	const plantilla = await salida.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

	const core = await leer('docProps/core.xml').catch(() => '');
	for (const campo of ['dc:creator', 'cp:lastModifiedBy']) {
		const valor = new RegExp(`<${campo}>([^<]*)</${campo}>`).exec(core)?.[1];
		if (valor) prohibidos.push(valor);
	}
	const problemas = await auditarPaquete(plantilla, {
		textosProhibidos: prohibidos.filter((t) => t.trim())
	});
	if (problemas.length) {
		throw new Error(`La plantilla no pasó la auditoría:\n- ${problemas.join('\n- ')}`);
	}

	await mkdir(dirname(DESTINO), { recursive: true });
	await writeFile(DESTINO, plantilla);
	console.log(`Plantilla escrita en ${DESTINO} (${(plantilla.length / 1024).toFixed(0)} KB).`);
	console.log(
		`Auditoría superada: ${prohibidos.filter((t) => t.trim()).length} textos de la fuente verificados como ausentes.`
	);
	console.log(`Fuentes incrustadas conservadas: ${relsFuentesNuevas.length}.`);
}

await main();
