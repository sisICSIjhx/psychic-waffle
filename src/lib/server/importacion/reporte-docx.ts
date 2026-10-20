// Lectura de un reporte FOR-ICSI-RMT-01 existente (DOCX) para derivar partidas cuando no se tiene
// el catálogo oficial. Extrae encabezado, título, objetivo, alcances, herramientas, verificación y
// conclusiones. No lee la tabla de firmas: los firmantes son datos personales y se registran a mano.
import JSZip from 'jszip';
import { normalizarParaComparar } from '../documentos/auditoria.ts';
import { bloquesCuerpo, elementos, texto } from '../documentos/ooxml.ts';

export interface ReporteExistente {
	titulo: string;
	numero: string | null;
	actividad: string;
	encabezado: {
		usuario: string;
		contrato: string;
		sitio: string;
		tag: string;
		periodicidad: string;
		tipoMantenimiento: string;
	};
	objetivo: string[];
	introduccion: string[];
	alcances: { titulo: string; descripcion: string[] }[];
	herramientas: { cantidad: string | null; descripcion: string }[];
	tieneVerificacion: boolean;
	antesDuranteDespues: boolean;
	conclusiones: string[];
}

const limpio = (xml: string) => texto(xml).replace(/\s+/g, ' ').trim();
const estilo = (xml: string) => /<w:pStyle w:val="([^"]+)"/.exec(xml)?.[1] ?? '';
const comparable = (valor: string) => normalizarParaComparar(valor).toUpperCase();

const ETIQUETAS: Record<string, keyof ReporteExistente['encabezado']> = {
	'USUARIO:': 'usuario',
	'NO CONTRATO / OC:': 'contrato',
	'SITIO:': 'sitio',
	'TAG:': 'tag',
	'PERIODICIDAD:': 'periodicidad',
	'TIPO DE MANTENIMIENTO:': 'tipoMantenimiento'
};

/** «Partida 13.- Mantenimiento…» o «16.- VERIFICACIÓN A PSV 1801» → número y actividad. */
export function separarTitulo(titulo: string): { numero: string | null; actividad: string } {
	const coincidencia = /^\s*(?:partida\s*)?(\d+[A-Z]?)\s*[.\-–:]*\s*-?\s*(.*)$/i.exec(titulo);
	if (!coincidencia) return { numero: null, actividad: titulo.trim() };
	return { numero: coincidencia[1], actividad: coincidencia[2].replace(/[.\s]+$/, '').trim() };
}

export async function leerReporteExistente(
	datos: Uint8Array | ArrayBuffer
): Promise<ReporteExistente> {
	const zip = await JSZip.loadAsync(datos);
	const documento = (await zip.file('word/document.xml')?.async('string')) ?? '';
	const bloques = bloquesCuerpo(documento);

	// Título: primer párrafo del cuadro de texto de la portada (Choice; sin el respaldo VML).
	const portada = bloques.find((b) => b.xml.includes('<w:txbxContent'));
	const caja = portada ? elementos(portada.xml, 'w:txbxContent')[0] : undefined;
	const titulo = caja ? limpio(elementos(caja.xml, 'w:p')[0]?.xml ?? '') : '';

	const encabezado: ReporteExistente['encabezado'] = {
		usuario: '',
		contrato: '',
		sitio: '',
		tag: '',
		periodicidad: '',
		tipoMantenimiento: ''
	};
	const tablaEncabezado = bloques.find(
		(b) => b.etiqueta === 'w:tbl' && comparable(texto(b.xml)).includes('USUARIO:')
	);
	for (const fila of tablaEncabezado ? elementos(tablaEncabezado.xml, 'w:tr') : []) {
		const celdas = elementos(fila.xml, 'w:tc').map((c) => limpio(c.xml));
		const campo = ETIQUETAS[comparable(celdas[0] ?? '')];
		if (campo) encabezado[campo] = celdas.slice(1).filter(Boolean).join(' ').trim();
	}

	const resultado: ReporteExistente = {
		titulo,
		...separarTitulo(titulo),
		encabezado,
		objetivo: [],
		introduccion: [],
		alcances: [],
		herramientas: [],
		tieneVerificacion: false,
		antesDuranteDespues: false,
		conclusiones: []
	};

	// Disposición antes/durante/después: las tres etiquetas aparecen en el documento.
	const todo = comparable(texto(documento));
	resultado.antesDuranteDespues =
		/\bANTES\b/.test(todo) && /\bDURANTE\b/.test(todo) && /\bDESPUES\b/.test(todo);

	let seccion = '';
	for (const bloque of bloques) {
		const t = limpio(bloque.xml);
		const tipo = estilo(bloque.xml);
		if (bloque.etiqueta === 'w:p' && tipo === 'Level1') {
			const c = comparable(t);
			seccion = c.includes('OBJETIVO')
				? 'objetivo'
				: c.includes('ALCANCE')
					? 'alcance'
					: c.includes('HERRAMIENTAS')
						? 'herramientas'
						: c.includes('VERIFICACI')
							? 'verificacion'
							: c.includes('CONCLUSIONES')
								? 'conclusiones'
								: '';
			if (seccion === 'verificacion') resultado.tieneVerificacion = true;
			continue;
		}
		if (bloque.etiqueta === 'w:p' && tipo === 'Alcances') {
			if (t) resultado.alcances.push({ titulo: t.replace(/[.\s]+$/, ''), descripcion: [] });
			seccion = 'alcance';
			continue;
		}
		const actual = resultado.alcances.at(-1);
		const esPie = /^Ilustraci|^(ANTES|DURANTE|DESPU)/i.test(t);
		if (seccion === 'alcance' && actual) {
			if (bloque.etiqueta === 'w:p' && t && !esPie && !/<pic:pic|<w:drawing/.test(bloque.xml)) {
				actual.descripcion.push(t);
			}
		} else if (seccion === 'alcance' && t && bloque.etiqueta === 'w:p') {
			resultado.introduccion.push(t);
		} else if (seccion === 'objetivo' && t && bloque.etiqueta === 'w:p') {
			resultado.objetivo.push(t);
		} else if (seccion === 'conclusiones' && t && bloque.etiqueta === 'w:p') {
			resultado.conclusiones.push(t);
		} else if (seccion === 'herramientas' && bloque.etiqueta === 'w:tbl') {
			for (const fila of elementos(bloque.xml, 'w:tr').slice(1)) {
				const [, cantidad, descripcion] = elementos(fila.xml, 'w:tc').map((c) => limpio(c.xml));
				if (descripcion) {
					resultado.herramientas.push({
						cantidad: cantidad?.replace(/\.$/, '') || null,
						descripcion: descripcion.replace(/\.$/, '')
					});
				}
			}
		}
	}
	return resultado;
}

const PATRON_TAG = /\b(PI|PIT|TI|TIT|TE|PT|PSV|PCV|FE|FT|FIT|LT|LIT|TT|PDI|PDIT)[\s-]?(\d{3,4})\b/i;

/** TAG del nombre del archivo (más fiable: los encabezados a veces se copiaron) o del encabezado. */
export function tagDeReporte(encabezadoTag: string, nombreArchivo: string): string | null {
	for (const fuente of [nombreArchivo, encabezadoTag]) {
		const coincidencia = PATRON_TAG.exec(fuente);
		if (coincidencia) return `${coincidencia[1].toUpperCase()}-${coincidencia[2]}`;
	}
	return null;
}
