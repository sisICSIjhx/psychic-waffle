// Extrae el contenido técnico de un reporte FOR-ICSI-RMT-01 existente (sin la tabla de firmas) para
// preparar datos de ejemplo. Uso local: node scripts/extraer-reporte.ts "<reporte>.docx" > salida.json
// La salida puede contener datos del cliente: revisarla antes de versionar cualquier parte.
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { bloquesCuerpo, elementos, texto } from '../src/lib/server/documentos/ooxml.ts';

const ruta = process.argv[2];
if (!ruta) {
	console.error('Uso: node scripts/extraer-reporte.ts "<reporte>.docx"');
	process.exit(1);
}
const zip = await JSZip.loadAsync(await readFile(ruta));
const documento = await zip.file('word/document.xml')!.async('string');
const estilo = (xml: string) => /<w:pStyle w:val="([^"]+)"/.exec(xml)?.[1] ?? '';
const limpio = (xml: string) => texto(xml).replace(/\s+/g, ' ').trim();

type Alcance = { titulo: string; descripcion: string[]; fotos: number; pies: string[] };
const salida = {
	objetivo: [] as string[],
	introduccion: [] as string[],
	alcances: [] as Alcance[],
	herramientas: [] as string[][],
	verificacion: [] as string[][],
	conclusiones: [] as string[]
};
let seccion = '';
for (const bloque of bloquesCuerpo(documento)) {
	const t = limpio(bloque.xml);
	if (bloque.etiqueta === 'w:p' && estilo(bloque.xml) === 'Level1') {
		const n = t.toUpperCase();
		seccion = n.includes('OBJETIVO')
			? 'objetivo'
			: n.includes('ALCANCE')
				? 'alcance'
				: n.includes('HERRAMIENTAS')
					? 'herramientas'
					: n.includes('VERIFICACI')
						? 'verificacion'
						: n.includes('CONCLUSIONES')
							? 'conclusiones'
							: '';
		continue;
	}
	if (bloque.etiqueta === 'w:p' && estilo(bloque.xml) === 'Alcances') {
		if (t) salida.alcances.push({ titulo: t, descripcion: [], fotos: 0, pies: [] });
		seccion = 'alcance';
		continue;
	}
	const fotos = (bloque.xml.match(/<pic:pic/g) ?? []).length;
	const actual = salida.alcances.at(-1);
	if (seccion === 'alcance' && actual) {
		actual.fotos += fotos;
		if (bloque.etiqueta === 'w:tbl' || fotos) {
			actual.pies.push(
				...texto(bloque.xml)
					.split('\n')
					.map((l) => l.trim())
					.filter((l) => /^Ilustraci/i.test(l))
			);
		} else if (t && !/^Ilustraci|^(ANTES|DURANTE|DESPU)/i.test(t)) actual.descripcion.push(t);
	} else if (seccion === 'alcance' && t) salida.introduccion.push(t);
	else if (seccion === 'objetivo' && t) salida.objetivo.push(t);
	else if (seccion === 'conclusiones' && t) salida.conclusiones.push(t);
	else if (
		(seccion === 'herramientas' || seccion === 'verificacion') &&
		bloque.etiqueta === 'w:tbl'
	) {
		const filas = elementos(bloque.xml, 'w:tr')
			.slice(1)
			.map((tr) => elementos(tr.xml, 'w:tc').map((tc) => limpio(tc.xml)));
		salida[seccion].push(...filas);
	}
}
console.log(JSON.stringify(salida, null, 1));
