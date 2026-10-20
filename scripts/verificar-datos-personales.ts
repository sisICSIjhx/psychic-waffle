// Verificación local previa a un commit: extrae en memoria los nombres de firmantes y autores de los
// reportes y libros de Excel de insumos/ y comprueba que no aparezcan en los archivos versionables
// (incluidos los DOCX y XLSX).
// Nunca imprime los nombres; solo rutas y número de coincidencias.
//
// Uso: node scripts/verificar-datos-personales.ts [carpeta de insumos]
import JSZip from 'jszip';
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { normalizarParaComparar } from '../src/lib/server/documentos/auditoria.ts';
import {
	bloquesCuerpo,
	decodificarXml,
	elementos,
	texto
} from '../src/lib/server/documentos/ooxml.ts';
import { firmantesDeHoja } from '../src/lib/server/importacion/catalogo.ts';
import { leerLibro } from '../src/lib/server/importacion/xlsx.ts';

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

async function* archivosEn(carpeta: string): AsyncGenerator<string> {
	for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
		const ruta = join(carpeta, entrada.name);
		if (entrada.isDirectory()) yield* archivosEn(ruta);
		else if (/\.(docx|xlsx)$/i.test(entrada.name) && !entrada.name.startsWith('~$')) yield ruta;
	}
}

/** Nombres bajo las etiquetas de firma de cada hoja (OPERADOR, AUTORIZA…) y autores del libro. */
async function nombresDeLibro(datos: Buffer): Promise<string[]> {
	const nombres = await autores(await JSZip.loadAsync(datos));
	for (const hoja of await leerLibro(datos)) {
		nombres.push(...firmantesDeHoja(hoja).map((f) => f.nombre));
	}
	return nombres;
}

async function autores(zip: JSZip): Promise<string[]> {
	const core = (await zip.file('docProps/core.xml')?.async('string')) ?? '';
	return [...core.matchAll(/<(?:dc:creator|cp:lastModifiedBy)>([^<]+)</g)].map((m) => m[1]);
}

/** Nombres de la tabla de firmas (todas las líneas salvo la última de cada celda) y del autor. */
async function nombresDe(ruta: string): Promise<string[]> {
	const datos = await readFile(ruta);
	if (ruta.toLowerCase().endsWith('.xlsx')) return nombresDeLibro(datos);
	const zip = await JSZip.loadAsync(datos);
	const nombres = await autores(zip);
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

function listarGit(argumentos: string[]): string[] {
	return execFileSync('git', ['ls-files', ...argumentos, '-z'], {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024
	})
		.split('\0')
		.filter(Boolean);
}

/** Versión preparada en el índice: es la que entraría en el próximo commit. */
function blobDelIndice(ruta: string): Buffer {
	return execFileSync('git', ['show', `:${ruta}`], { maxBuffer: 512 * 1024 * 1024 });
}

async function contenidoTextual(ruta: string, datos: Buffer): Promise<string | null> {
	const extension = extname(ruta).toLowerCase();
	if (extension === '.docx' || extension === '.xlsx') {
		const zip = await JSZip.loadAsync(datos);
		const partes = Object.keys(zip.files).filter((n) => n.endsWith('.xml') || n.endsWith('.rels'));
		const xml = await Promise.all(partes.map((n) => zip.file(n)!.async('string')));
		// Nombres de todas las partes (incluidas las huérfanas o binarias), decodificados como URI.
		const nombresPartes = Object.keys(zip.files).map((n) => {
			try {
				return decodeURIComponent(n);
			} catch {
				return n;
			}
		});
		// Se conservan los valores de atributos (descr, title…) además del texto visible.
		const contenido = xml.join(' ').replace(/<[^>]*?((?:\s[\w:.-]+="[^"]*")*)\s*\/?>/g, '$1 ');
		return `${nombresPartes.join(' ')} ${contenido}`;
	}
	if (!EXTENSIONES_TEXTO.has(extension)) return null;
	return datos.toString('utf8');
}

/** Versiones a revisar: la del índice (archivos rastreados) y la del árbol de trabajo. */
async function* versiones(): AsyncGenerator<{ etiqueta: string; ruta: string; datos: Buffer }> {
	for (const ruta of listarGit(['--cached'])) {
		yield { etiqueta: `${ruta} (índice)`, ruta, datos: blobDelIndice(ruta) };
		const local = await readFile(ruta).catch(() => null);
		if (local) yield { etiqueta: `${ruta} (árbol de trabajo)`, ruta, datos: local };
	}
	for (const ruta of listarGit(['--others', '--exclude-standard'])) {
		const local = await readFile(ruta).catch(() => null);
		if (local) yield { etiqueta: `${ruta} (sin rastrear)`, ruta, datos: local };
	}
}

const nombres = new Set<string>();
let reportes = 0;
let libros = 0;
for await (const ruta of archivosEn(carpetaInsumos)) {
	if (ruta.toLowerCase().endsWith('.xlsx')) libros++;
	else reportes++;
	for (const nombre of await nombresDe(ruta)) {
		const normalizado = normalizarParaComparar(nombre.replace(/^(ing|lic|arq|c|sr|sra)\.\s*/i, ''));
		// Solo nombres de al menos dos palabras, para no confundir palabras comunes.
		if (normalizado.length >= 8 && normalizado.includes(' ')) nombres.add(normalizado);
	}
}

let revisados = 0;
const hallazgos: string[] = [];
for await (const { etiqueta, ruta, datos } of versiones()) {
	if (ruta.startsWith(`${carpetaInsumos}/`)) continue;
	const contenido = await contenidoTextual(ruta, datos).catch(() => null);
	if (contenido === null) continue;
	revisados++;
	const plano = normalizarParaComparar(decodificarXml(contenido));
	const coincidencias = [...nombres].filter((n) => plano.includes(n)).length;
	if (coincidencias) hallazgos.push(`${etiqueta}: ${coincidencias} coincidencia(s)`);
}

console.log(
	`Reportes analizados: ${reportes}. Libros de Excel: ${libros}. Nombres de referencia: ${nombres.size}. Archivos revisados: ${revisados}.`
);
if (hallazgos.length) {
	console.error(
		`Se encontraron nombres de los insumos en archivos versionables:\n- ${hallazgos.join('\n- ')}`
	);
	process.exit(1);
}
console.log('Sin coincidencias: ningún archivo versionable contiene nombres de los insumos.');
