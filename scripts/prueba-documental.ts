// Prueba documental: genera los reportes de ejemplo de scripts/datos-prueba/ con la plantilla v1.
//
// Uso: node scripts/prueba-documental.ts [--pdf] [archivo.json ...]
//
// Las fotos se toman, en local, del DOCX indicado en «fuenteFotos» (insumos/, sin versionar). Si no
// existe, se usan imágenes de relleno generadas, para que la prueba funcione en cualquier equipo.
// Los documentos se escriben en STORAGE_DIR/prueba-documental (por omisión ./storage, ignorado).
import JSZip from 'jszip';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { generarDocx, type ReporteDocumento } from '../src/lib/server/documentos/generar.ts';
import { convertirPdf } from '../src/lib/server/documentos/pdf.ts';
import type { MomentoFoto } from '../src/lib/dominio/documento.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA_DATOS = join(RAIZ, 'scripts/datos-prueba');
const SALIDA = join(resolve(RAIZ, process.env.STORAGE_DIR ?? 'storage'), 'prueba-documental');

interface FotoEjemplo {
	foto: number;
	descripcion?: string;
	momento?: MomentoFoto;
}

type ReporteEjemplo = Omit<ReporteDocumento, 'alcances'> & {
	alcances: (Omit<ReporteDocumento['alcances'][number], 'fotos'> & { fotos: FotoEjemplo[] })[];
};

interface Ejemplo {
	salida: string;
	fuenteFotos?: { ruta: string; orden: 'documento' | 'medios' };
	reporte: ReporteEjemplo;
}

/** Imágenes del DOCX fuente, en el orden en que aparecen o por nombre de medio. */
async function fotosDeFuente(ruta: string, orden: 'documento' | 'medios'): Promise<Uint8Array[]> {
	const zip = await JSZip.loadAsync(await readFile(ruta));
	const esFoto = (n: string) => /^word\/media\/image\d+\.(jpe?g|png)$/i.test(n);
	let partes: string[];
	if (orden === 'medios') {
		const numero = (n: string) => Number(/image(\d+)/.exec(n)![1]);
		partes = Object.keys(zip.files)
			.filter(esFoto)
			.sort((a, b) => numero(a) - numero(b));
	} else {
		const documento = await zip.file('word/document.xml')!.async('string');
		const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');
		const destino = new Map(
			[
				...rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="([^"]+)"/g)
			].map((m) => (m[1] ? [m[1], m[2]] : [m[4], m[3]]))
		);
		const vistos = new Set<string>();
		partes = [];
		for (const m of documento.matchAll(/<a:blip r:embed="([^"]+)"/g)) {
			const parte = `word/${destino.get(m[1])}`;
			if (esFoto(parte) && !vistos.has(parte)) {
				vistos.add(parte);
				partes.push(parte);
			}
		}
	}
	return Promise.all(partes.map((p) => zip.file(p)!.async('uint8array')));
}

async function fotoDeRelleno(numero: number): Promise<Uint8Array> {
	const [ancho, alto] = numero % 3 === 0 ? [1200, 1600] : [1600, 1200];
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="100%" height="100%" fill="#8a9bab"/><text x="50%" y="50%" font-size="160" font-family="Arial" fill="#fff" text-anchor="middle" dominant-baseline="middle">FOTO ${numero}</text></svg>`;
	return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function prepararReporte(
	ejemplo: Ejemplo
): Promise<{ reporte: ReporteDocumento; origen: string }> {
	const ruta = ejemplo.fuenteFotos ? resolve(RAIZ, ejemplo.fuenteFotos.ruta) : '';
	const fuente =
		ruta && existsSync(ruta) ? await fotosDeFuente(ruta, ejemplo.fuenteFotos!.orden) : [];
	const obtener = async (numero: number) =>
		fuente.length ? fuente[(numero - 1) % fuente.length] : fotoDeRelleno(numero);
	const alcances = [];
	for (const alcance of ejemplo.reporte.alcances) {
		const fotos = [];
		for (const f of alcance.fotos) {
			fotos.push({
				datos: await obtener(f.foto),
				descripcion: f.descripcion,
				momento: f.momento ?? null
			});
		}
		alcances.push({ ...alcance, fotos });
	}
	return {
		reporte: { ...ejemplo.reporte, alcances },
		origen: fuente.length
			? `${fuente.length} fotos de la fuente local`
			: 'imágenes de relleno (sin insumos)'
	};
}

const argumentos = process.argv.slice(2);
const conPdf = argumentos.includes('--pdf');
const archivos = argumentos.filter((a) => !a.startsWith('--'));
const ejemplos = archivos.length
	? archivos.map((a) => resolve(a))
	: (await readdir(CARPETA_DATOS))
			.filter((n) => n.endsWith('.json'))
			.sort()
			.map((n) => join(CARPETA_DATOS, n));

await mkdir(SALIDA, { recursive: true });
for (const archivo of ejemplos) {
	const ejemplo = JSON.parse(await readFile(archivo, 'utf8')) as Ejemplo;
	const inicio = performance.now();
	const { reporte, origen } = await prepararReporte(ejemplo);
	const resultado = await generarDocx(reporte);
	const destino = join(SALIDA, `${ejemplo.salida}.docx`);
	await writeFile(destino, resultado.docx);
	const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
	console.log(
		`${basename(archivo)} → ${destino}\n  ${resultado.fotos} fotos (${origen}), ${(resultado.bytes / 1048576).toFixed(1)} MB, ${segundos} s; nombre sugerido: ${resultado.nombreArchivo}`
	);
	if (conPdf) {
		const pdf = await convertirPdf(resultado.docx, resultado.nombreArchivo);
		if (pdf.disponible) {
			await writeFile(destino.replace(/\.docx$/, '.pdf'), pdf.pdf);
			console.log('  PDF de prueba generado.');
		} else {
			console.log(`  ${pdf.motivo}`);
		}
	}
}
