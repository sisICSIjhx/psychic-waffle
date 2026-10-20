// Auditoría de un paquete DOCX: detecta metadatos personales, comentarios, revisiones, texto
// oculto y restos de la fuente antes de versionar la plantilla o entregar un documento.
import JSZip from 'jszip';

export interface OpcionesAuditoria {
	/** Textos que no deben aparecer en ninguna parte del paquete (p. ej. nombres de la fuente). */
	textosProhibidos?: readonly string[];
	/** Valores aceptados para el autor en docProps/core.xml. */
	autoresPermitidos?: readonly string[];
}

const PARTES_PROHIBIDAS = [
	/^customXml\//,
	/^docProps\/custom\.xml$/,
	/^docProps\/thumbnail\./,
	/^word\/comments[^/]*\.xml$/,
	/^word\/people\.xml$/,
	/^word\/glossary\//
];

const MARCAS_PROHIBIDAS: [RegExp, string][] = [
	[/<w:ins[\s>]/, 'revisiones insertadas (w:ins)'],
	[/<w:del[\s>]/, 'revisiones eliminadas (w:del)'],
	[/<w:moveFrom[\s>]|<w:moveTo[\s>]/, 'movimientos con control de cambios'],
	[/<w:vanish\/>/, 'texto oculto (w:vanish)'],
	[/<w:commentRangeStart|<w:commentReference/, 'referencias a comentarios'],
	[/<w:attachedTemplate/, 'plantilla adjunta con ruta local'],
	[/<w:docVars>/, 'variables de documento'],
	[/o:gfxdata="/, 'datos binarios heredados de formas (o:gfxdata)']
];

/** Minúsculas sin acentos ni espacios repetidos, para comparar textos de forma robusta. */
export function normalizarParaComparar(texto: string): string {
	return texto
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

function textoPlano(xml: string): string {
	// Une los w:t para encontrar nombres partidos en varios runs.
	return xml.replace(/<w:tab\/>|<w:br\/>|<\/w:p>/g, ' ').replace(/<[^>]+>/g, '');
}

export async function auditarPaquete(
	docx: Uint8Array | ArrayBuffer,
	{ textosProhibidos = [], autoresPermitidos = ['', 'ICSI'] }: OpcionesAuditoria = {}
): Promise<string[]> {
	const zip = await JSZip.loadAsync(docx);
	const problemas: string[] = [];
	const nombres = Object.keys(zip.files).filter((n) => !zip.files[n].dir);

	for (const nombre of nombres) {
		if (PARTES_PROHIBIDAS.some((patron) => patron.test(nombre))) {
			problemas.push(`Parte no permitida: ${nombre}`);
		}
	}

	const core = zip.file('docProps/core.xml');
	if (core) {
		const xml = await core.async('string');
		for (const campo of ['dc:creator', 'cp:lastModifiedBy']) {
			const valor = new RegExp(`<${campo}>([^<]*)</${campo}>`).exec(xml)?.[1] ?? '';
			if (!autoresPermitidos.includes(valor))
				problemas.push(`docProps/core.xml: ${campo} con valor no permitido`);
		}
	}

	const prohibidos = textosProhibidos.map(normalizarParaComparar).filter((t) => t.length >= 4);
	for (const nombre of nombres.filter((n) => n.endsWith('.xml') || n.endsWith('.rels'))) {
		const xml = await zip.file(nombre)!.async('string');
		// Los estilos pueden declarar w:vanish sin ocultar contenido del documento.
		const esDefinicion = nombre === 'word/styles.xml' || nombre === 'word/numbering.xml';
		for (const [patron, descripcion] of MARCAS_PROHIBIDAS) {
			if (esDefinicion && descripcion.startsWith('texto oculto')) continue;
			if (patron.test(xml)) problemas.push(`${nombre}: ${descripcion}`);
		}
		if (prohibidos.length) {
			const plano = normalizarParaComparar(textoPlano(xml));
			for (const texto of prohibidos) {
				if (plano.includes(texto))
					problemas.push(`${nombre}: contiene un texto prohibido de la fuente`);
			}
		}
	}
	return problemas;
}
