// Índice ya resuelto en el DOCX generado: marcadores _Toc en los títulos del cuerpo y, dentro del
// control de contenido del índice, una entrada por título con hipervínculo y el campo PAGEREF con su
// página calculada, todo envuelto en el campo TOC (que sigue vivo para «Actualizar tabla»). Sin
// `w:updateFields` ni `w:dirty`, Word abre el documento sin pedir actualizar campos.
import JSZip from 'jszip';
import { escaparXml } from './ooxml.ts';
import type { TituloPaginado } from './paginacion.ts';

const ESTILOS_TITULO = /<w:pStyle w:val="(Level1|Alcances)"\/>/;
const PARRAFO = /<w:p(?:\s[^>]*)?>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g;

const run = (contenido: string, oculto = false) =>
	`<w:r><w:rPr><w:rStyle w:val="Hipervnculo"/><w:noProof/>${oculto ? '<w:webHidden/>' : ''}</w:rPr>${contenido}</w:r>`;
const campo = (tipo: 'begin' | 'separate' | 'end', oculto = false) =>
	run(`<w:fldChar w:fldCharType="${tipo}"/>`, oculto);

/** Escribe el índice y los marcadores; lanza un error si los títulos no cuadran con el cálculo. */
export async function escribirIndice(
	docx: Uint8Array,
	titulos: readonly TituloPaginado[]
): Promise<Buffer> {
	const zip = await JSZip.loadAsync(docx);
	const partes = Object.keys(zip.files).filter((n) =>
		/^word\/(document|settings|header\d*|footer\d*)\.xml$/.test(n)
	);
	for (const parte of partes) {
		const xml = await zip.file(parte)!.async('string');
		if (/<w:updateFields\b/.test(xml) || /w:dirty="(?:1|true)"/.test(xml)) {
			throw new Error(`La plantilla pide actualizar campos al abrir (${parte})`);
		}
	}
	const documento = await zip.file('word/document.xml')!.async('string');
	const inicioSdt = documento.indexOf('<w:docPartGallery w:val="Table of Contents"/>');
	const finSdt = documento.indexOf('</w:sdt>', inicioSdt);
	if (inicioSdt === -1 || finSdt === -1)
		throw new Error('La plantilla no tiene el control del índice');
	const antes = documento.slice(0, finSdt);
	let cuerpo = documento.slice(finSdt);

	// 1 y 2. Marcadores _Toc en los títulos, con identificadores mayores que los existentes.
	const maximo = Math.max(
		0,
		...[...documento.matchAll(/<w:bookmarkStart w:id="(\d+)"/g)].map((m) => Number(m[1]))
	);
	const anclas: string[] = [];
	let indiceTitulo = 0;
	cuerpo = cuerpo.replace(PARRAFO, (parrafo) => {
		if (!ESTILOS_TITULO.test(parrafo)) return parrafo;
		const k = indiceTitulo++;
		const titulo = titulos[k];
		const id = maximo + 1 + k;
		const nombre = `_Toc${String(910000000 + k)}`;
		anclas.push(nombre);
		const finPPr = parrafo.indexOf('</w:pPr>');
		if (finPPr === -1) throw new Error('Un título del cuerpo no tiene propiedades de párrafo');
		let pPr = parrafo.slice(0, finPPr);
		if (titulo?.saltoForzado) {
			// Orden del esquema: pStyle, keepNext, keepLines y después pageBreakBefore.
			const ultimo = [...pPr.matchAll(/<w:(?:pStyle|keepNext|keepLines)\b[^>]*\/>/g)].at(-1);
			const posicion = ultimo ? ultimo.index! + ultimo[0].length : pPr.indexOf('>') + 1;
			pPr = `${pPr.slice(0, posicion)}<w:pageBreakBefore/>${pPr.slice(posicion)}`;
		}
		const resto = parrafo.slice(finPPr + '</w:pPr>'.length, -'</w:p>'.length);
		return `${pPr}</w:pPr><w:bookmarkStart w:id="${id}" w:name="${nombre}"/>${resto}<w:bookmarkEnd w:id="${id}"/></w:p>`;
	});
	if (anclas.length !== titulos.length) {
		throw new Error(
			`El documento tiene ${anclas.length} títulos y el cálculo del índice ${titulos.length}`
		);
	}

	// 3. Entradas del índice con la estructura de los reportes originales.
	let numeroAlcance = 0;
	const entradas = titulos.map((t, i) => {
		const nivel2 = t.nivel === 2;
		const tabs = nivel2
			? '<w:tabs><w:tab w:val="left" w:pos="960"/><w:tab w:val="right" w:leader="dot" w:pos="9394"/></w:tabs>'
			: '<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9394"/></w:tabs>';
		const texto = nivel2
			? run(`<w:t>2.${++numeroAlcance}</w:t>`) +
				run('<w:tab/>') +
				run(`<w:t xml:space="preserve">${escaparXml(t.texto)}</w:t>`)
			: run(`<w:t xml:space="preserve">${escaparXml(t.texto)}</w:t>`);
		const inicioToc =
			i === 0
				? campo('begin') +
					run('<w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText>') +
					campo('separate')
				: '';
		const finToc = i === titulos.length - 1 ? campo('end') : '';
		return (
			`<w:p><w:pPr><w:pStyle w:val="${nivel2 ? 'TDC2' : 'TDC1'}"/>${tabs}<w:rPr><w:noProof/></w:rPr></w:pPr>${inicioToc}` +
			`<w:hyperlink w:anchor="${anclas[i]}" w:history="1">${texto}` +
			run('<w:tab/>', true) +
			campo('begin', true) +
			run(`<w:instrText xml:space="preserve"> PAGEREF ${anclas[i]} \\h </w:instrText>`, true) +
			campo('separate', true) +
			run(`<w:t>${t.pagina}</w:t>`, true) +
			campo('end', true) +
			`</w:hyperlink>${finToc}</w:p>`
		);
	});
	// El párrafo de reserva (TDC1 con el campo TOC vacío) se sustituye por las entradas.
	const reserva = [...antes.slice(inicioSdt).matchAll(PARRAFO)].find((m) =>
		m[0].includes('<w:pStyle w:val="TDC1"/>')
	);
	if (!reserva) throw new Error('La plantilla no tiene el párrafo de reserva del índice');
	const posicion = inicioSdt + reserva.index!;
	const nuevo =
		antes.slice(0, posicion) +
		entradas.join('') +
		antes.slice(posicion + reserva[0].length) +
		cuerpo;
	zip.file('word/document.xml', nuevo);
	return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
