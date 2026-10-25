// Extrae de archivos de fuente solo números (unidades por em, métricas verticales, avance de cada
// carácter cubierto y pares de kerning de la tabla `kern`) y escribe
// src/lib/server/documentos/anchos-fuentes.ts para el modelo de paginación del índice. Ni contornos
// ni archivos de fuente entran al repositorio.
//
// Uso (solo en local, en Windows con Office):
//   node scripts/extraer-anchos-fuentes.ts
// Toma Arial normal y negrita de C:\Windows\Fonts (mismos avances que Arimo y Liberation Sans), Aptos
// normal y cursiva de la caché de fuentes en la nube de Office y Open Sans normal de la fuente
// incrustada en la plantilla vigente (licencia OFL).
import JSZip from 'jszip';
import { readdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'src/lib/server/documentos/anchos-fuentes.ts');
const PLANTILLA = resolve(RAIZ, 'src/lib/server/plantillas/FOR-ICSI-RMT-01.v2.docx');
const NUBE = join(process.env.LOCALAPPDATA ?? '', 'Microsoft/FontCache/4/CloudFonts/Aptos');

/** Latín básico y latín-1, latín extendido A, puntuación general y el euro. */
const COBERTURA: [number, number][] = [
	[0x20, 0x7e],
	[0xa0, 0x17f],
	[0x2010, 0x2027],
	[0x2030, 0x203a],
	[0x20ac, 0x20ac]
];

interface FuenteLeida {
	nombre: string;
	subfamilia: string;
	upem: number;
	winAscent: number;
	winDescent: number;
	hheaLineGap: number;
	typoAscent: number;
	typoDescent: number;
	typoLineGap: number;
	xAvgCharWidth: number;
	rangos: [number, number[]][];
	kern: number[];
}

function leerFuente(b: Buffer): FuenteLeida {
	const n = b.readUInt16BE(4);
	const tablas: Record<string, number> = {};
	for (let i = 0; i < n; i++) {
		const o = 12 + i * 16;
		tablas[b.toString('latin1', o, o + 4)] = b.readUInt32BE(o + 8);
	}
	const head = tablas.head;
	const hhea = tablas.hhea;
	const os2 = tablas['OS/2'];
	const upem = b.readUInt16BE(head + 18);
	const nh = b.readUInt16BE(hhea + 34);
	const avance = (g: number) => b.readUInt16BE(tablas.hmtx + 4 * Math.min(g, nh - 1));
	const cm = tablas.cmap;
	let elegido: { off: number; fmt: number } | null = null;
	for (let i = 0; i < b.readUInt16BE(cm + 2); i++) {
		const pid = b.readUInt16BE(cm + 4 + i * 8);
		const eid = b.readUInt16BE(cm + 6 + i * 8);
		const off = cm + b.readUInt32BE(cm + 8 + i * 8);
		const fmt = b.readUInt16BE(off);
		if (pid === 3 && eid === 10 && fmt === 12) elegido = { off, fmt };
		if (!elegido && pid === 3 && eid === 1 && fmt === 4) elegido = { off, fmt };
	}
	if (!elegido) throw new Error('La fuente no tiene cmap de Windows');
	const tabla = elegido;
	const glifo = (cp: number): number => {
		const o = tabla.off;
		if (tabla.fmt === 4) {
			const segX2 = b.readUInt16BE(o + 6);
			const fines = o + 14;
			const inicios = fines + segX2 + 2;
			const deltas = inicios + segX2;
			const rangos = deltas + segX2;
			for (let s = 0; s < segX2 / 2; s++) {
				if (cp > b.readUInt16BE(fines + 2 * s)) continue;
				const ini = b.readUInt16BE(inicios + 2 * s);
				if (cp < ini) return 0;
				const delta = b.readInt16BE(deltas + 2 * s);
				const ro = b.readUInt16BE(rangos + 2 * s);
				if (ro === 0) return (cp + delta) & 0xffff;
				const gi = b.readUInt16BE(rangos + 2 * s + ro + 2 * (cp - ini));
				return gi ? (gi + delta) & 0xffff : 0;
			}
			return 0;
		}
		for (let k = 0; k < b.readUInt32BE(o + 12); k++) {
			const ini = b.readUInt32BE(o + 16 + 12 * k);
			const fin = b.readUInt32BE(o + 20 + 12 * k);
			if (cp >= ini && cp <= fin) return b.readUInt32BE(o + 24 + 12 * k) + (cp - ini);
		}
		return 0;
	};
	const nombres: Record<number, string> = {};
	const nm = tablas.name;
	const inicioCadenas = nm + b.readUInt16BE(nm + 4);
	for (let i = 0; i < b.readUInt16BE(nm + 2); i++) {
		const r = nm + 6 + 12 * i;
		const id = b.readUInt16BE(r + 6);
		if (b.readUInt16BE(r) !== 3 || (id !== 1 && id !== 2) || nombres[id]) continue;
		const s = b.subarray(
			inicioCadenas + b.readUInt16BE(r + 10),
			inicioCadenas + b.readUInt16BE(r + 10) + b.readUInt16BE(r + 8)
		);
		let t = '';
		for (let j = 0; j < s.length; j += 2) t += String.fromCharCode(s.readUInt16BE(j));
		nombres[id] = t;
	}
	const porGlifo = new Map<number, number[]>();
	const rangos: [number, number[]][] = COBERTURA.map(([desde, hasta]) => {
		const anchos: number[] = [];
		for (let cp = desde; cp <= hasta; cp++) {
			const g = glifo(cp);
			anchos.push(g ? avance(g) : -1);
			if (g) porGlifo.set(g, [...(porGlifo.get(g) ?? []), cp]);
		}
		return [desde, anchos];
	});
	const kern: number[] = [];
	if (tablas.kern !== undefined) {
		let o = tablas.kern + 4;
		for (let t = 0; t < b.readUInt16BE(tablas.kern + 2); t++) {
			const largo = b.readUInt16BE(o + 2);
			if (b.readUInt16BE(o + 4) >> 8 === 0) {
				for (let p = 0; p < b.readUInt16BE(o + 6); p++) {
					const q = o + 14 + 6 * p;
					for (const izquierda of porGlifo.get(b.readUInt16BE(q)) ?? []) {
						for (const derecha of porGlifo.get(b.readUInt16BE(q + 2)) ?? []) {
							kern.push(izquierda, derecha, b.readInt16BE(q + 4));
						}
					}
				}
			}
			o += largo;
		}
	}
	return {
		nombre: nombres[1] ?? '',
		subfamilia: nombres[2] ?? '',
		upem,
		winAscent: b.readUInt16BE(os2 + 74),
		winDescent: b.readUInt16BE(os2 + 76),
		hheaLineGap: b.readInt16BE(hhea + 8),
		typoAscent: b.readInt16BE(os2 + 68),
		typoDescent: b.readInt16BE(os2 + 70),
		typoLineGap: b.readInt16BE(os2 + 72),
		xAvgCharWidth: b.readInt16BE(os2 + 2),
		rangos,
		kern
	};
}

/** Fuente incrustada en un DOCX: se quita la ofuscación con la clave `w:fontKey` (ECMA-376). */
async function fuenteIncrustada(docx: string, nombre: string): Promise<Buffer> {
	const zip = await JSZip.loadAsync(readFileSync(docx));
	const tabla = (await zip.file('word/fontTable.xml')?.async('string')) ?? '';
	const rels = (await zip.file('word/_rels/fontTable.xml.rels')?.async('string')) ?? '';
	const bloque = new RegExp(`<w:font w:name="${nombre}"[\\s\\S]*?</w:font>`).exec(tabla)?.[0] ?? '';
	const incrustada = /<w:embedRegular r:id="(\w+)" w:fontKey="\{([0-9A-F-]+)\}"/.exec(bloque);
	if (!incrustada) throw new Error(`La plantilla no incrusta ${nombre} normal`);
	const destino = new RegExp(`Id="${incrustada[1]}"[^>]*Target="([^"]+)"`).exec(rels)?.[1];
	const datos = Buffer.from(await zip.file(`word/${destino}`)!.async('nodebuffer'));
	const hex = incrustada[2].replace(/-/g, '');
	const clave = Array.from({ length: 16 }, (_, i) =>
		parseInt(hex.slice(hex.length - 2 * (i + 1), hex.length - 2 * i), 16)
	);
	for (let i = 0; i < 32; i++) datos[i] ^= clave[i % 16];
	return datos;
}

const aptos = readdirSync(NUBE).map((n) => leerFuente(readFileSync(join(NUBE, n))));
const elegir = (subfamilia: string) => {
	const f = aptos.find((a) => a.nombre === 'Aptos' && a.subfamilia === subfamilia);
	if (!f) throw new Error(`No se encontró Aptos ${subfamilia} en ${NUBE}`);
	return f;
};
const fuentes = {
	arial: leerFuente(readFileSync('C:/Windows/Fonts/arial.ttf')),
	arialNegrita: leerFuente(readFileSync('C:/Windows/Fonts/arialbd.ttf')),
	aptos: elegir('Regular'),
	aptosCursiva: elegir('Italic'),
	openSans: leerFuente(await fuenteIncrustada(PLANTILLA, 'Open Sans'))
};

const cuerpo = Object.entries(fuentes)
	.map(([clave, f]) => {
		const { nombre, subfamilia, rangos, kern, ...metricas } = f;
		return `\t${clave}: {\n\t\tnombre: ${JSON.stringify(`${nombre} ${subfamilia}`)},\n${Object.entries(
			metricas
		)
			.map(([k, v]) => `\t\t${k}: ${v},`)
			.join('\n')}\n\t\trangos: ${JSON.stringify(rangos)},\n\t\tkern: ${JSON.stringify(kern)}\n\t}`;
	})
	.join(',\n');
await writeFile(
	DESTINO,
	`// Generado por scripts/extraer-anchos-fuentes.ts; no editar a mano.
// Solo números de métricas (unidades por em, métricas verticales, avance por carácter con -1 si la
// fuente no lo tiene, y pares de kerning [izquierda, derecha, valor]) para el modelo de paginación.
// Arial normal y negrita: arial.ttf y arialbd.ttf de Windows (avances idénticos a Arimo y Liberation
// Sans). Aptos normal y cursiva: caché de Office. Ambas del equipo de desarrollo y versionadas solo como
// números con la aceptación del usuario (2026-10-21). Open Sans normal: fuente incrustada en la
// plantilla (OFL).
export interface AnchosFuente {
	nombre: string;
	upem: number;
	winAscent: number;
	winDescent: number;
	hheaLineGap: number;
	typoAscent: number;
	typoDescent: number;
	typoLineGap: number;
	xAvgCharWidth: number;
	/** [primer código, avances en unidades por em] */
	rangos: [number, number[]][];
	kern: number[];
}

export const ANCHOS_FUENTES: Record<'arial' | 'arialNegrita' | 'aptos' | 'aptosCursiva' | 'openSans', AnchosFuente> = {
${cuerpo}
};
`
);
console.log(
	`Anchos escritos en ${DESTINO}: ${Object.entries(fuentes)
		.map(([k, f]) => `${k} (${f.nombre} ${f.subfamilia}, ${f.kern.length / 3} pares)`)
		.join(', ')}`
);
