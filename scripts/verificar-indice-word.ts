// Verificación del índice calculado contra Word (solo en desarrollo, en Windows con Word instalado).
//
// Uso:
//   npm run verificar:indice [-- --desde 1 --hasta 120]
//   npm run verificar:indice -- <docx…>   (solo compara el índice guardado con el actualizado)
//
// Genera en STORAGE_DIR/verificacion-indice/ (ignorado) los 3 documentos de scripts/datos-prueba con
// fotos de relleno (cada tercera vertical) y los reportes sintéticos del rango de semillas (desde la 105,
// con fotos giradas); los abre en
// Word con scripts/paginas-word.ps1, compara la página de cada título con el modelo y el índice
// guardado con el que deja «Actualizar tabla», y escribe
// src/lib/server/documentos/calibracion/paginas-word.<versión>.json para las pruebas. No abre la base
// de datos ni forma parte de npm run test.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import {
	generarDocx,
	VERSION_PLANTILLA,
	type ReporteDocumento
} from '../src/lib/server/documentos/generar.ts';
import { reporteSintetico, type BaseSintetica } from '../src/lib/server/documentos/sinteticos.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVO_ENTORNO = join(RAIZ, '.env');
if (existsSync(ARCHIVO_ENTORNO)) process.loadEnvFile(ARCHIVO_ENTORNO);
const SALIDA = join(resolve(RAIZ, process.env.STORAGE_DIR ?? 'storage'), 'verificacion-indice');
const CALIBRACION = join(RAIZ, 'src/lib/server/documentos/calibracion');
const ARNES = join(RAIZ, 'scripts/paginas-word.ps1');
/** Criterios de precisión de D10; los mismos que exige paginacion.spec.ts. */
const MINIMO_TOTAL = 0.99;
const MINIMO_SUBCONJUNTO = 0.985;

const { values: opciones, positionals } = parseArgs({
	allowPositionals: true,
	options: { desde: { type: 'string', default: '1' }, hasta: { type: 'string', default: '120' } }
});

if (process.platform !== 'win32') {
	console.error('El arnés necesita Windows con Microsoft Word instalado.');
	process.exit(1);
}

interface MedicionWord {
	archivo: string;
	paginas: number;
	titulos: { nivel: number; texto: string; pagina: number }[];
	tocAntes: string;
	tocDespues: string;
}

function medirEnWord(archivos: string[]): { versionWord: string; documentos: MedicionWord[] } {
	const salida = join(SALIDA, `word-${Date.now()}.json`);
	execFileSync('powershell', ['-NoProfile', '-File', ARNES, salida, ...archivos], {
		stdio: 'inherit',
		timeout: 60 * 60 * 1000
	});
	// Se lee el archivo (UTF-8 con BOM): la consola de PowerShell convertiría las comillas tipográficas.
	const texto = readFileSync(salida, 'utf8');
	return JSON.parse(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto);
}

/** Índice como texto comparable: renglones sin espacios repetidos ni marcas de campo. */
const indiceComparable = (texto: string) =>
	texto
		// eslint-disable-next-line no-control-regex -- Word marca los campos con caracteres de control
		.replace(/[\u0001-\u0008\u0013-\u0015]/g, '')
		.split(/[\r\n]+/)
		.map((l) => l.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
		.join('\n');

async function fotoDeRelleno([ancho, alto]: [number, number]): Promise<Uint8Array> {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho / 4}" height="${alto / 4}"><rect width="100%" height="100%" fill="#8a9bab"/></svg>`;
	return sharp(Buffer.from(svg)).resize(ancho, alto).jpeg({ quality: 60 }).toBuffer();
}

async function generar(nombre: string, reporte: ReporteDocumento) {
	const resultado = await generarDocx(reporte);
	const ruta = join(SALIDA, `${nombre}.docx`);
	await writeFile(ruta, resultado.docx);
	return { nombre, ruta, titulos: resultado.indice.titulos };
}

await mkdir(SALIDA, { recursive: true });

if (positionals.length) {
	// Documentos con fotos reales: solo el índice guardado frente al actualizado.
	const medicion = medirEnWord(positionals.map((p) => resolve(p)));
	let diferentes = 0;
	for (const d of medicion.documentos) {
		const igual = indiceComparable(d.tocAntes) === indiceComparable(d.tocDespues);
		console.log(
			`${d.archivo}: ${igual ? 'índice igual al actualizado' : 'el índice difiere al actualizar'}`
		);
		if (!igual) diferentes++;
	}
	process.exit(diferentes ? 1 : 0);
}

const generados: Awaited<ReturnType<typeof generar>>[] = [];
const datosPrueba = join(RAIZ, 'scripts/datos-prueba');
for (const archivo of (await readdir(datosPrueba)).filter((n) => n.endsWith('.json')).sort()) {
	const ejemplo = JSON.parse(await readFile(join(datosPrueba, archivo), 'utf8'));
	const reporte: ReporteDocumento = {
		...ejemplo.reporte,
		alcances: await Promise.all(
			ejemplo.reporte.alcances.map(async (a: { fotos: { foto: number }[] }) => ({
				...a,
				fotos: await Promise.all(
					a.fotos.map(async (f) => ({
						...f,
						datos: await fotoDeRelleno(f.foto % 3 === 0 ? [1200, 1600] : [1600, 1200])
					}))
				)
			}))
		)
	};
	generados.push(await generar(basename(archivo, '.json'), reporte));
}
const base: BaseSintetica = JSON.parse(
	await readFile(join(datosPrueba, 'manometros-cuadricula.json'), 'utf8')
).reporte;
for (let semilla = Number(opciones.desde); semilla <= Number(opciones.hasta); semilla++) {
	const sintetico = reporteSintetico(semilla, base);
	const reporte: ReporteDocumento = {
		...sintetico,
		alcances: await Promise.all(
			sintetico.alcances.map(async (a) => ({
				...a,
				fotos: await Promise.all(
					a.fotos.map(async (f) => ({
						descripcion: f.descripcion,
						momento: f.momento,
						rotacion: f.rotacion,
						datos: await fotoDeRelleno(f.dim)
					}))
				)
			}))
		)
	};
	generados.push(await generar(`semilla-${semilla}`, reporte));
}
console.log(`Generados ${generados.length} documentos en ${SALIDA}; midiendo en Word…`);

const medicion = medirEnWord(generados.map((g) => g.ruta));
const porArchivo = new Map(medicion.documentos.map((d) => [d.archivo, d]));
let exactas = 0;
let total = 0;
let documentosExactos = 0;
let mayores = 0;
const resultados = generados.map((g) => {
	const word = porArchivo.get(basename(g.ruta))!;
	const diferencias = g.titulos.flatMap((t, i) => {
		total++;
		const pagina = word.titulos[i]?.pagina;
		if (pagina === t.pagina) {
			exactas++;
			return [];
		}
		if (Math.abs((pagina ?? 0) - t.pagina) > 1) mayores++;
		return [`${i}: modelo ${t.pagina}, Word ${pagina}`];
	});
	if (!diferencias.length) documentosExactos++;
	const indiceIgual = indiceComparable(word.tocAntes) === indiceComparable(word.tocDespues);
	if (diferencias.length || !indiceIgual) {
		console.log(
			`  ${g.nombre}: ${diferencias.join('; ') || 'páginas iguales'}${indiceIgual ? '' : '; el índice difiere al actualizar'}`
		);
	}
	return {
		nombre: g.nombre,
		paginas: word.paginas,
		titulos: word.titulos.map((t) => t.pagina),
		modelo: g.titulos.map((t) => t.pagina),
		saltosForzados: g.titulos.flatMap((t, i) => (t.saltoForzado ? [i] : [])),
		indiceIgualAlActualizado: indiceIgual
	};
});
// Criterios de D10 (indice-docx-actualizado): exactitud total, documentos de prueba exactos con su
// índice igual al actualizado y ninguna diferencia mayor de una página. Solo un resultado que los
// cumple reemplaza la calibración que usan las pruebas.
const semilla = (r: { nombre: string }) => Number(/^semilla-(\d+)$/.exec(r.nombre)?.[1] ?? 0);
const subconjunto = resultados.filter((r) => semilla(r) >= 25 && semilla(r) <= 104);
// Solo una corrida con todas las semillas 1-104 puede reemplazar la calibración.
const completas = Array.from({ length: 104 }, (_, i) => i + 1).every((n) =>
	resultados.some((r) => semilla(r) === n)
);
const exactasSub = subconjunto.reduce(
	(n, r) => n + r.titulos.filter((p, i) => p === r.modelo[i]).length,
	0
);
const totalSub = subconjunto.reduce((n, r) => n + r.titulos.length, 0);
const pruebasExactas = resultados
	.filter((r) => !r.nombre.startsWith('semilla-'))
	.every((r) => r.indiceIgualAlActualizado && r.titulos.every((p, i) => p === r.modelo[i]));
const fallas = [
	exactas / total < MINIMO_TOTAL ? `exactitud total menor de ${MINIMO_TOTAL * 100} %` : '',
	totalSub && exactasSub / totalSub < MINIMO_SUBCONJUNTO
		? `exactitud de las semillas 25 en adelante menor de ${MINIMO_SUBCONJUNTO * 100} %`
		: '',
	pruebasExactas ? '' : 'algún documento de prueba no es exacto',
	mayores ? 'hay diferencias mayores de una página' : '',
	completas ? '' : 'la corrida no incluye todas las semillas 1-104'
].filter(Boolean);
const nombre = `paginas-word.${VERSION_PLANTILLA.split('.').at(-1)}.json`;
const destino = fallas.length ? join(SALIDA, `rechazado-${nombre}`) : join(CALIBRACION, nombre);
await mkdir(dirname(destino), { recursive: true });
await writeFile(
	destino,
	JSON.stringify(
		{
			versionPlantilla: VERSION_PLANTILLA,
			versionWord: medicion.versionWord,
			semillas: [Number(opciones.desde), Number(opciones.hasta)],
			documentos: resultados
		},
		null,
		'\t'
	) + '\n'
);
const porcentaje = ((100 * exactas) / total).toFixed(1);
const porcentajeSub = totalSub ? ((100 * exactasSub) / totalSub).toFixed(1) : '—';
console.log(
	`${exactas}/${total} títulos exactos (${porcentaje} %; semillas 25 en adelante: ${porcentajeSub} %), ${documentosExactos}/${generados.length} documentos exactos, ${mayores} diferencias mayores de una página. Resultados en ${destino}.`
);
if (fallas.length) {
	console.error(`No cumple los criterios: ${fallas.join('; ')}. La calibración no se reemplazó.`);
	process.exit(1);
}
