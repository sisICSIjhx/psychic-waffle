import JSZip from 'jszip';
import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ANCHOS_FUENTES } from './anchos-fuentes';
import calibracion from './calibracion/paginas-word.v2.json';
import sharp from 'sharp';
import {
	datosPlantilla,
	prepararAlcances,
	VERSION_PLANTILLA,
	type ReporteDocumento
} from './generar';
import {
	calcularIndice,
	entradaPaginacion,
	FUENTES,
	GEOMETRIA_V2,
	paginar,
	paginasIndice,
	paginasPortada,
	type Bloque,
	type EntradaPaginacion
} from './paginacion';
import { preparadosSinImagen, reporteSintetico, type BaseSintetica } from './sinteticos';

const DATOS_PRUEBA = new URL('../../../../scripts/datos-prueba/', import.meta.url);
const PLANTILLA = new URL('../plantillas/FOR-ICSI-RMT-01.v2.docx', import.meta.url);

async function ejemplo(nombre: string) {
	return JSON.parse(await readFile(new URL(nombre, DATOS_PRUEBA), 'utf8'));
}

async function base(): Promise<BaseSintetica> {
	return (await ejemplo('manometros-cuadricula.json')).reporte;
}

/** Entrada del modelo de un ejemplo de scripts/datos-prueba con sus fotos de relleno. */
async function entradaDeEjemplo(nombre: string): Promise<EntradaPaginacion> {
	const { reporte } = await ejemplo(nombre);
	const sintetico = {
		...reporte,
		alcances: reporte.alcances.map((a: { fotos: { foto: number }[] }) => ({
			...a,
			fotos: a.fotos.map((f) => ({
				...f,
				descripcion: (f as { descripcion?: string }).descripcion ?? '',
				dim: f.foto % 3 === 0 ? [1200, 1600] : [1600, 1200]
			}))
		}))
	};
	return entradaPaginacion(
		datosPlantilla(sintetico as unknown as ReporteDocumento, preparadosSinImagen(sintetico))
	);
}

describe('anchos de fuente versionados', () => {
	it('reproduce las referencias de Arial y los interlineados de Word', () => {
		expect(FUENTES.arial.ancho('M', 2048)).toBe(1706);
		expect(FUENTES.arial.ancho('a', 2048)).toBe(1139);
		expect(FUENTES.arial.ancho(' ', 2048)).toBe(569);
		expect(FUENTES.arial.sencillo(12)).toBeCloseTo(13.8, 1);
		expect(FUENTES.aptosCursiva.sencillo(9)).toBeCloseTo(10.99, 2);
	});

	it('cubre todos los caracteres de los ejemplos', async () => {
		const textos = [];
		for (const archivo of await readdir(DATOS_PRUEBA)) {
			if (archivo.endsWith('.json'))
				textos.push(await readFile(new URL(archivo, DATOS_PRUEBA), 'utf8'));
		}
		const cubiertos = (clave: keyof typeof ANCHOS_FUENTES) =>
			new Set(
				ANCHOS_FUENTES[clave].rangos.flatMap(([desde, anchos]) =>
					anchos.flatMap((a, i) => (a >= 0 ? [desde + i] : []))
				)
			);
		const caracteres = [...new Set([...textos.join('')].map((c) => c.codePointAt(0)!))].filter(
			(c) => c >= 0x20
		);
		for (const fuente of ['arial', 'arialNegrita', 'aptos', 'aptosCursiva', 'openSans'] as const) {
			const set = cubiertos(fuente);
			expect(caracteres.filter((c) => !set.has(c)).map((c) => String.fromCodePoint(c))).toEqual([]);
		}
	});
});

describe('reportes sintéticos', () => {
	it('son deterministas y desde la semilla 65 varían la portada', async () => {
		const b = await base();
		expect(reporteSintetico(7, b)).toEqual(reporteSintetico(7, b));
		expect(reporteSintetico(7, b).tags).toEqual(b.tags);
		const variados = Array.from({ length: 40 }, (_, i) => reporteSintetico(65 + i, b));
		expect(variados.some((r) => (r.tags?.length ?? 0) > 6)).toBe(true);
		expect(variados.some((r) => r.encabezado.dias.length > 2)).toBe(true);
	});
});

describe('salto forzado en la franja dudosa', () => {
	const L = FUENTES.arial.sencillo(12);
	const titulo = (texto: string): Bloque => ({
		tipo: 'p',
		antes: 6,
		despues: 0,
		L: L * 1.4,
		n: 1,
		keepNext: true,
		keepLines: true,
		titulo: { nivel: 1, texto }
	});
	const relleno = (alto: number): Bloque => ({ tipo: 'fila', alto });
	// El título más el párrafo que arrastra (3 renglones de 13,8 × 276/240) y su espacio anterior.
	const parrafo: Bloque = { tipo: 'p', antes: 6, despues: 6, L: L * (276 / 240), n: 3 };
	const fin = (alto: number) => {
		const util = GEOMETRIA_V2.abajo - GEOMETRIA_V2.arriba;
		return util - alto;
	};
	const necesario = 6 + L * 1.4 + 6 + 3 * L * (276 / 240) - (L * (276 / 240) - L);

	it('pasa el título a la página siguiente si la holgura es de ±0,2 pt', () => {
		for (const holgura of [0.2, -0.2]) {
			const r = paginar([relleno(fin(necesario + holgura)), titulo('1. OBJETIVO'), parrafo], 3);
			expect(r.titulos[0]).toMatchObject({ pagina: 4, saltoForzado: holgura > 0 });
		}
	});

	it('no fuerza el salto con una holgura mayor que ε', () => {
		const r = paginar([relleno(fin(necesario + 5)), titulo('1. OBJETIVO'), parrafo], 3);
		expect(r.titulos[0]).toMatchObject({ pagina: 3, saltoForzado: false });
	});
});

describe('portada e índice', () => {
	it('con los datos de prueba ocupan una página cada uno; con datos extremos, dos', async () => {
		const entrada = await entradaDeEjemplo('manometros-cuadricula.json');
		expect(paginasPortada(entrada)).toBe(1);
		const muchosTag = {
			...entrada,
			encabezado: {
				...entrada.encabezado,
				tag: Array.from({ length: 60 }, (_, i) => `PI-${1000 + i}`).join(', ')
			}
		};
		expect(paginasPortada(muchosTag)).toBe(2);
		const titulos = Array.from({ length: 40 }, (_, i) => ({
			nivel: 2 as const,
			texto: `Título ${i}`
		}));
		expect(paginasIndice(titulos)).toBe(2);
		expect(calcularIndice(entrada).paginaInicialCuerpo).toBe(3);
	});
});

describe('geometría de la plantilla v2', () => {
	it('coincide con la versión y los márgenes de la plantilla', async () => {
		expect(GEOMETRIA_V2.versionPlantilla).toBe(VERSION_PLANTILLA);
		const zip = await JSZip.loadAsync(await readFile(PLANTILLA));
		const documento = await zip.file('word/document.xml')!.async('string');
		const secciones = [
			...documento.matchAll(/<w:pgSz w:w="(\d+)" w:h="(\d+)"\/><w:pgMar ([^>]*)\/>/g)
		];
		const cuerpo = secciones.at(-1)!;
		expect([cuerpo[1], cuerpo[2]]).toEqual(['12240', '15810']);
		expect(cuerpo[3]).toContain('w:top="1843"');
		expect(cuerpo[3]).toContain('w:bottom="720"');
		expect(cuerpo[3]).toContain('w:left="1418"');
	});
});

describe('precisión frente a Word (paginas-word.v2.json)', () => {
	const documentos = calibracion.documentos;

	it('el modelo actual repite las páginas medidas', async () => {
		const b = await base();
		let exactas = 0;
		let total = 0;
		let exactas25 = 0;
		let total25 = 0;
		for (const d of documentos) {
			const semilla = /^semilla-(\d+)$/.exec(d.nombre)?.[1];
			const entrada = semilla
				? (() => {
						const r = reporteSintetico(Number(semilla), b);
						return entradaPaginacion(
							datosPlantilla(r as unknown as ReporteDocumento, preparadosSinImagen(r))
						);
					})()
				: await entradaDeEjemplo(`${d.nombre}.json`);
			const modelo = calcularIndice(entrada).titulos.map((t) => t.pagina);
			// El cálculo del modelo no cambió desde que se midió el documento.
			expect(modelo, d.nombre).toEqual(d.modelo);
			d.titulos.forEach((pagina, i) => {
				total++;
				if (pagina === modelo[i]) exactas++;
				expect(Math.abs(pagina - modelo[i]), `${d.nombre} título ${i}`).toBeLessThanOrEqual(1);
				if (semilla && Number(semilla) >= 25) {
					total25++;
					if (pagina === modelo[i]) exactas25++;
				}
			});
			if (!semilla) {
				expect(d.titulos, d.nombre).toEqual(modelo);
				expect(d.indiceIgualAlActualizado, d.nombre).toBe(true);
			}
		}
		expect(exactas / total).toBeGreaterThanOrEqual(0.99);
		// Fuera de la calibración (semillas 25-104) se midió 98,9 %: los 11 títulos restantes salen de
		// cadenas keepNext que Word resuelve distinto según el caso; ninguno difiere más de una página.
		if (total25) expect(exactas25 / total25).toBeGreaterThanOrEqual(0.985);
	});
});

describe('fotos giradas', () => {
	it('el modelo recibe la altura de la foto girada y la usa en las páginas', async () => {
		// Una foto 16:9 mide 8 × 4,5 cm; girada 90° pasa a 3,375 × 6 cm.
		const datos = await sharp({
			create: { width: 1600, height: 900, channels: 3, background: '#778899' }
		})
			.jpeg()
			.toBuffer();
		const fuente = (await base()) as unknown as ReporteDocumento;
		const reporte = (rotacion: 0 | 90): ReporteDocumento =>
			({
				...fuente,
				disposicionFotos: 'cuadricula',
				alcances: [
					{
						titulo: 'Inspección visual',
						descripcion: '',
						estado: 'ok',
						fotos: Array.from({ length: 16 }, () => ({ datos, rotacion }))
					}
				]
			}) as ReporteDocumento;
		const entradas = await Promise.all(
			([0, 90] as const).map(async (rotacion) => {
				const r = reporte(rotacion);
				return entradaPaginacion(
					datosPlantilla(r, await prepararAlcances(r, Number.MAX_SAFE_INTEGER, 4))
				);
			})
		);
		const [recta, girada] = entradas.map((e) => e.alcances[0].cuadricula[0].izq.alto);
		expect(recta).toBeCloseTo(4.5, 2);
		expect(girada).toBeCloseTo(6, 2);
		// Las filas más altas empujan los títulos que siguen al alcance.
		const paginas = (e: EntradaPaginacion) => calcularIndice(e).titulos.map((t) => t.pagina);
		const [antes, despues] = entradas.map(paginas);
		expect(despues.every((pagina, i) => pagina >= antes[i])).toBe(true);
		expect(despues).not.toEqual(antes);
	});
});
