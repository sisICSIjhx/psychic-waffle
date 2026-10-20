// Verificación local previa a un commit: extrae en memoria los nombres de firmantes y autores de los
// reportes de insumos/ y comprueba que no aparezcan en los archivos versionables (incluidos los DOCX).
// Nunca imprime los nombres; solo rutas y número de coincidencias.
//
// Uso: node scripts/verificar-datos-personales.ts [carpeta de insumos]
import JSZip from 'jszip';
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { normalizarParaComparar } from '../src/lib/server/documentos/auditoria.ts';
import { bloquesCuerpo, elementos, texto } from '../src/lib/server/documentos/ooxml.ts';

const carpetaInsumos = process.argv[2] ?? 'insumos';
const EXTENSIONES_TEXTO = new Set([
	'.ts',
	'.js',
	'.mjs',
	'.cjs',
	'.svelte',
	'.json',
	'.md',
	'.css',
	'.html',
	'.sql',
	'.ps1',
	'.yaml',
	'.yml',
	'.txt',
	''
]);

async function* docxEn(carpeta: string): AsyncGenerator<string> {
	for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
		const ruta = join(carpeta, entrada.name);
		if (entrada.isDirectory()) yield* docxEn(ruta);
		else if (entrada.name.toLowerCase().endsWith('.docx') && !entrada.name.startsWith('~$'))
			yield ruta;
	}
}

/** Nombres de la tabla de firmas (todas las líneas salvo la última de cada celda) y del autor. */
async function nombresDe(ruta: string): Promise<string[]> {
	const zip = await JSZip.loadAsync(await readFile(ruta));
	const nombres: string[] = [];
	const core = (await zip.file('docProps/core.xml')?.async('string')) ?? '';
	for (const m of core.matchAll(/<(?:dc:creator|cp:lastModifiedBy)>([^<]+)</g)) nombres.push(m[1]);
	const documento = (await zip.file('word/document.xml')?.async('string')) ?? '';
	const firmas = bloquesCuerpo(documento).find((b) => {
		const t = normalizarParaComparar(texto(b.xml));
		return b.etiqueta === 'w:tbl' && t.includes('elaboro') && t.includes('recibio');
	});
	if (!firmas) return nombres;
	const filas = elementos(firmas.xml, 'w:tr');
	const linea = filas.findIndex((f) => texto(f.xml).includes('____'));
	const filaNombres = filas[linea + 1];
	if (linea === -1 || !filaNombres) return nombres;
	for (const celda of elementos(filaNombres.xml, 'w:tc')) {
		const lineas = texto(celda.xml)
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
		nombres.push(...lineas.slice(0, -1));
		if (lineas.length > 2) nombres.push(lineas.slice(0, -1).join(' '));
	}
	return nombres;
}

function archivosVersionables(): string[] {
	const salida = execFileSync(
		'git',
		['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
		{
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024
		}
	);
	return salida.split('\0').filter(Boolean);
}

async function contenidoTextual(ruta: string): Promise<string | null> {
	const extension = extname(ruta).toLowerCase();
	if (extension === '.docx') {
		const zip = await JSZip.loadAsync(await readFile(ruta));
		const partes = Object.keys(zip.files).filter((n) => n.endsWith('.xml') || n.endsWith('.rels'));
		const xml = await Promise.all(partes.map((n) => zip.file(n)!.async('string')));
		return xml.join(' ').replace(/<[^>]+>/g, '');
	}
	if (!EXTENSIONES_TEXTO.has(extension)) return null;
	return readFile(ruta, 'utf8');
}

const nombres = new Set<string>();
let reportes = 0;
for await (const ruta of docxEn(carpetaInsumos)) {
	reportes++;
	for (const nombre of await nombresDe(ruta)) {
		const normalizado = normalizarParaComparar(nombre.replace(/^(ing|lic|arq|c|sr|sra)\.\s*/i, ''));
		// Solo nombres de al menos dos palabras, para no confundir palabras comunes.
		if (normalizado.length >= 8 && normalizado.includes(' ')) nombres.add(normalizado);
	}
}

let revisados = 0;
const hallazgos: string[] = [];
for (const ruta of archivosVersionables()) {
	if (ruta.startsWith(`${carpetaInsumos}/`)) continue;
	const contenido = await contenidoTextual(ruta).catch(() => null);
	if (contenido === null) continue;
	revisados++;
	const plano = normalizarParaComparar(contenido);
	const coincidencias = [...nombres].filter((n) => plano.includes(n)).length;
	if (coincidencias) hallazgos.push(`${ruta}: ${coincidencias} coincidencia(s)`);
}

console.log(
	`Reportes analizados: ${reportes}. Nombres de referencia: ${nombres.size}. Archivos revisados: ${revisados}.`
);
if (hallazgos.length) {
	console.error(
		`Se encontraron nombres de los insumos en archivos versionables:\n- ${hallazgos.join('\n- ')}`
	);
	process.exit(1);
}
console.log('Sin coincidencias: ningún archivo versionable contiene nombres de los insumos.');
