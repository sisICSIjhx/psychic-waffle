// Utilidades mínimas para recorrer y editar WordprocessingML como texto, sin dependencias.
// Se usan para construir la plantilla, auditarla y verificar los documentos generados.

export interface Fragmento {
	etiqueta: string;
	inicio: number;
	fin: number;
	xml: string;
}

function esFinDeNombre(caracter: string | undefined): boolean {
	return (
		caracter === '>' ||
		caracter === ' ' ||
		caracter === '/' ||
		caracter === '\n' ||
		caracter === '\t'
	);
}

/** Posición de la siguiente apertura exacta de `etiqueta` (no confunde `w:p` con `w:pPr`). */
function siguienteApertura(xml: string, etiqueta: string, desde: number): number {
	let i = xml.indexOf(`<${etiqueta}`, desde);
	while (i !== -1 && !esFinDeNombre(xml[i + etiqueta.length + 1])) {
		i = xml.indexOf(`<${etiqueta}`, i + 1);
	}
	return i;
}

/** Fin (exclusivo) del elemento `etiqueta` que abre en `inicio`, respetando anidamiento. */
export function finDeElemento(xml: string, etiqueta: string, inicio: number): number {
	const finApertura = xml.indexOf('>', inicio);
	if (finApertura === -1) throw new Error(`Etiqueta <${etiqueta}> incompleta`);
	if (xml[finApertura - 1] === '/') return finApertura + 1;
	const cierre = `</${etiqueta}>`;
	let profundidad = 1;
	let i = finApertura + 1;
	for (;;) {
		const fin = xml.indexOf(cierre, i);
		if (fin === -1) throw new Error(`Elemento <${etiqueta}> sin cierre`);
		const apertura = siguienteApertura(xml, etiqueta, i);
		if (apertura !== -1 && apertura < fin) {
			const finEtiqueta = xml.indexOf('>', apertura);
			if (xml[finEtiqueta - 1] !== '/') profundidad++;
			i = finEtiqueta + 1;
		} else {
			profundidad--;
			i = fin + cierre.length;
			if (profundidad === 0) return i;
		}
	}
}

/** Elementos `etiqueta` de primer nivel dentro de `xml` (los anidados quedan dentro de su padre). */
export function elementos(xml: string, etiqueta: string): Fragmento[] {
	const resultado: Fragmento[] = [];
	let i = siguienteApertura(xml, etiqueta, 0);
	while (i !== -1) {
		const fin = finDeElemento(xml, etiqueta, i);
		resultado.push({ etiqueta, inicio: i, fin, xml: xml.slice(i, fin) });
		i = siguienteApertura(xml, etiqueta, fin);
	}
	return resultado;
}

const ETIQUETAS_CUERPO = ['w:p', 'w:tbl', 'w:sdt', 'w:sectPr'];

/** Bloques de primer nivel de `w:body`: párrafos, tablas, controles de contenido y sección final. */
export function bloquesCuerpo(documento: string): Fragmento[] {
	const inicioCuerpo = documento.indexOf('<w:body>');
	const finCuerpo = documento.lastIndexOf('</w:body>');
	if (inicioCuerpo === -1 || finCuerpo === -1) throw new Error('document.xml sin <w:body>');
	const desplazamiento = inicioCuerpo + '<w:body>'.length;
	const cuerpo = documento.slice(desplazamiento, finCuerpo);
	const bloques: Fragmento[] = [];
	let i = 0;
	while (i < cuerpo.length) {
		const candidatos = ETIQUETAS_CUERPO.map((etiqueta) => ({
			etiqueta,
			pos: siguienteApertura(cuerpo, etiqueta, i)
		})).filter((c) => c.pos !== -1);
		if (candidatos.length === 0) break;
		const { etiqueta, pos } = candidatos.reduce((a, b) => (b.pos < a.pos ? b : a));
		const fin = finDeElemento(cuerpo, etiqueta, pos);
		bloques.push({
			etiqueta,
			inicio: pos + desplazamiento,
			fin: fin + desplazamiento,
			xml: cuerpo.slice(pos, fin)
		});
		i = fin;
	}
	return bloques;
}

export function decodificarXml(texto: string): string {
	return texto
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

export function escaparXml(texto: string): string {
	return texto
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Texto visible de un fragmento: un renglón por párrafo; tabulaciones y saltos como espacio. */
export function texto(xml: string): string {
	return elementos(xml, 'w:p')
		.map((p) =>
			(p.xml.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? [])
				.map((t) =>
					t.startsWith('<w:t') && !t.startsWith('<w:tab')
						? decodificarXml(t.replace(/<[^>]+>/g, ''))
						: ' '
				)
				.join('')
		)
		.join('\n');
}

/**
 * Sustituye todo el contenido de un párrafo por un único run con `nuevoTexto`, conservando sus
 * propiedades de párrafo y el formato del primer run de texto.
 */
export function reemplazarTextoParrafo(parrafo: string, nuevoTexto: string): string {
	const etiquetaInicial = parrafo.slice(0, parrafo.indexOf('>') + 1);
	const apertura = etiquetaInicial.endsWith('/>') ? '<w:p>' : etiquetaInicial;
	const pPr = elementos(parrafo, 'w:pPr')[0]?.xml ?? '';
	const runConTexto = elementos(parrafo, 'w:r').find((r) => /<w:t[\s>]/.test(r.xml));
	const rPr = runConTexto ? (elementos(runConTexto.xml, 'w:rPr')[0]?.xml ?? '') : '';
	return `${apertura}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaparXml(nuevoTexto)}</w:t></w:r></w:p>`;
}
