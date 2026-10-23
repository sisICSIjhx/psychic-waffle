import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { escribirIndice } from './indice';
import type { TituloPaginado } from './paginacion';

/** Paquete mínimo con el control del índice de la plantilla v2 y dos títulos en el cuerpo. */
async function paquete({ ajustes = '<w:settings/>', marcadorPrevio = false } = {}) {
	const zip = new JSZip();
	const titulo = (estilo: string, texto: string, pPr = '') =>
		`<w:p><w:pPr><w:pStyle w:val="${estilo}"/>${pPr}<w:jc w:val="left"/></w:pPr><w:r><w:t>${texto}</w:t></w:r></w:p>`;
	zip.file(
		'word/document.xml',
		'<w:document><w:body>' +
			(marcadorPrevio
				? '<w:p><w:bookmarkStart w:id="40" w:name="otro"/><w:bookmarkEnd w:id="40"/></w:p>'
				: '') +
			'<w:sdt><w:sdtPr><w:docPartObj><w:docPartGallery w:val="Table of Contents"/></w:docPartObj></w:sdtPr><w:sdtContent>' +
			'<w:p><w:pPr><w:pStyle w:val="TtuloTDC"/></w:pPr><w:r><w:t>Contenido</w:t></w:r></w:p>' +
			'<w:p><w:pPr><w:pStyle w:val="TDC1"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> TOC </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' +
			'</w:sdtContent></w:sdt>' +
			titulo('Level1', '1. OBJETIVO') +
			'<w:p><w:r><w:t>Texto</w:t></w:r></w:p>' +
			titulo('Alcances', 'Inspección &amp; limpieza', '<w:keepNext/>') +
			'</w:body></w:document>'
	);
	zip.file('word/settings.xml', ajustes);
	return zip.generateAsync({ type: 'uint8array' });
}

const TITULOS: TituloPaginado[] = [
	{ nivel: 1, texto: '1. OBJETIVO', pagina: 3, saltoForzado: false },
	{ nivel: 2, texto: 'Inspección & limpieza', pagina: 4, saltoForzado: true }
];

async function documento(docx: Uint8Array | Buffer) {
	return (await JSZip.loadAsync(docx)).file('word/document.xml')!.async('string');
}

describe('escribirIndice', () => {
	it('marca los títulos y escribe una entrada con hipervínculo y página por cada uno', async () => {
		const xml = await documento(
			await escribirIndice(await paquete({ marcadorPrevio: true }), TITULOS)
		);
		const marcadores = [...xml.matchAll(/<w:bookmarkStart w:id="(\d+)" w:name="(_Toc\d+)"\/>/g)];
		expect(marcadores.map((m) => m[2])).toEqual(['_Toc910000000', '_Toc910000001']);
		// Identificadores mayores que el marcador que ya existía (40).
		expect(marcadores.every((m) => Number(m[1]) > 40)).toBe(true);
		expect([...xml.matchAll(/<w:hyperlink w:anchor="(_Toc\d+)"/g)].map((m) => m[1])).toEqual([
			'_Toc910000000',
			'_Toc910000001'
		]);
		expect(xml).toContain('<w:t>2.1</w:t>');
		expect(xml).toContain('Inspección &amp; limpieza');
		expect([...xml.matchAll(/<w:t>(\d+)<\/w:t>/g)].map((m) => m[1])).toEqual(['3', '4']);
		const conteo = (tipo: string) => xml.match(new RegExp(`w:fldCharType="${tipo}"`, 'g'))!.length;
		expect(conteo('begin')).toBe(3);
		expect(conteo('separate')).toBe(3);
		expect(conteo('end')).toBe(3);
		// El párrafo de reserva desaparece.
		expect(xml).not.toContain('<w:instrText> TOC </w:instrText>');
	});

	it('pone pageBreakBefore después de pStyle, keepNext y keepLines en un salto forzado', async () => {
		const xml = await documento(await escribirIndice(await paquete(), TITULOS));
		expect(xml).toContain(
			'<w:pStyle w:val="Alcances"/><w:keepNext/><w:pageBreakBefore/><w:jc w:val="left"/>'
		);
		expect(xml.match(/<w:pageBreakBefore\/>/g)).toHaveLength(1);
	});

	it('se niega a entregar si no cuadran los títulos o si la plantilla pide actualizar campos', async () => {
		await expect(escribirIndice(await paquete(), TITULOS.slice(0, 1))).rejects.toThrow(
			'El documento tiene 2 títulos y el cálculo del índice 1'
		);
		await expect(
			escribirIndice(
				await paquete({ ajustes: '<w:settings><w:updateFields w:val="true"/></w:settings>' }),
				TITULOS
			)
		).rejects.toThrow(/pide actualizar campos/);
	});
});
