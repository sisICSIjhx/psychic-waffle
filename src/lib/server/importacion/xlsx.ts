// Lector mínimo de libros .xlsx (solo lectura) sobre JSZip: hojas, cadenas compartidas, texto
// enriquecido, tipos de celda y celdas combinadas. Suficiente para importar el catálogo sin
// depender de una biblioteca de hojas de cálculo completa.
import JSZip from 'jszip';
import { decodificarXml } from '../documentos/ooxml.ts';

export type ValorCelda = string | number | boolean | null;

export interface Hoja {
	nombre: string;
	/** filas[i][j]: fila i + 1 y columna j + 1 de Excel. */
	filas: ValorCelda[][];
	combinadas: Rango[];
	/** Relleno de cada celda (véase leerRellenos); vacío si no tiene. */
	rellenos: string[][];
}

export interface Rango {
	filaInicio: number;
	columnaInicio: number;
	filaFin: number;
	columnaFin: number;
}

/** «AB12» → { fila: 11, columna: 27 } (fila en base 0, columna en base 0). */
export function referenciaACoordenadas(referencia: string): { fila: number; columna: number } {
	const coincidencia = /^([A-Z]+)(\d+)$/.exec(referencia.toUpperCase());
	if (!coincidencia) throw new Error(`Referencia de celda inválida: ${referencia}`);
	let columna = 0;
	for (const letra of coincidencia[1]) columna = columna * 26 + (letra.charCodeAt(0) - 64);
	return { fila: Number(coincidencia[2]) - 1, columna: columna - 1 };
}

function textoDe(xml: string): string {
	// Concatena todos los <t> del elemento (texto enriquecido incluido), sin la guía fonética.
	const sinFonetica = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
	return [...sinFonetica.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g)]
		.map((m) => decodificarXml(m[1] ?? ''))
		.join('');
}

function leerCadenasCompartidas(xml: string): string[] {
	return [...xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => textoDe(m[1] ?? ''));
}

function valorDeCelda(celda: string, cadenas: string[]): ValorCelda {
	const tipo = /\st="([^"]+)"/.exec(celda.slice(0, celda.indexOf('>') + 1))?.[1] ?? 'n';
	if (tipo === 'inlineStr') return textoDe(/<is>([\s\S]*?)<\/is>/.exec(celda)?.[1] ?? '');
	const v = /<v>([\s\S]*?)<\/v>/.exec(celda)?.[1];
	if (v === undefined) return null;
	switch (tipo) {
		case 's':
			return cadenas[Number(v)] ?? '';
		case 'str':
		case 'e':
			return decodificarXml(v);
		case 'b':
			return v === '1';
		default: {
			const numero = Number(v);
			return Number.isFinite(numero) ? numero : decodificarXml(v);
		}
	}
}

/**
 * Relleno de cada estilo de celda (índice de cellXfs): «» sin relleno, «rgb:FF00B050» o
 * «tema:0[:tinte]». Sirve para leer programas que marcan los meses con color.
 */
function leerRellenos(estilos: string): string[] {
	const seccion = (etiqueta: string) => {
		const inicio = estilos.indexOf(`<${etiqueta}`);
		return inicio === -1 ? '' : estilos.slice(inicio, estilos.indexOf(`</${etiqueta}>`, inicio));
	};
	const rellenos = [...seccion('fills').matchAll(/<fill>([\s\S]*?)<\/fill>|<fill\/>/g)].map((m) => {
		const relleno = m[1] ?? '';
		if (!/patternType="solid"/.test(relleno)) return '';
		const primerPlano = /<fgColor\s([^>]*)\/?>/.exec(relleno)?.[1] ?? '';
		const rgb = /rgb="([0-9A-Fa-f]{6,8})"/.exec(primerPlano)?.[1];
		if (rgb) return `rgb:${rgb.toUpperCase()}`;
		const tema = /theme="(\d+)"/.exec(primerPlano)?.[1];
		const tinte = /tint="([-\d.]+)"/.exec(primerPlano)?.[1];
		if (tema) return `tema:${tema}${tinte ? `:${Number(tinte).toFixed(2)}` : ''}`;
		const indexado = /indexed="(\d+)"/.exec(primerPlano)?.[1];
		return indexado ? `indexado:${indexado}` : 'solido';
	});
	return [...seccion('cellXfs').matchAll(/<xf\s[^>]*?\/?>/g)].map(
		(m) => rellenos[Number(/fillId="(\d+)"/.exec(m[0])?.[1] ?? 0)] ?? ''
	);
}

/** Un relleno «marca» la celda si es sólido y no es blanco (tema 0 sin tinte o FFFFFF). */
export function esRellenoMarcado(relleno: string | undefined): boolean {
	return Boolean(relleno) && relleno !== 'tema:0' && !/^rgb:(FF)?FFFFFF$/.test(relleno ?? '');
}

function leerHoja(
	nombre: string,
	xml: string,
	cadenas: string[],
	rellenosPorEstilo: string[]
): Hoja {
	const filas: ValorCelda[][] = [];
	const rellenos: string[][] = [];
	const datos = xml.slice(xml.indexOf('<sheetData'), xml.indexOf('</sheetData>'));
	for (const celda of datos.matchAll(/<c\s[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)) {
		const referencia = /\sr="([A-Z]+\d+)"/.exec(celda[0])?.[1];
		if (!referencia) continue;
		const { fila, columna } = referenciaACoordenadas(referencia);
		const estilo = /\ss="(\d+)"/.exec(celda[0].slice(0, celda[0].indexOf('>') + 1))?.[1];
		const relleno = estilo === undefined ? '' : (rellenosPorEstilo[Number(estilo)] ?? '');
		if (relleno) (rellenos[fila] ??= [])[columna] = relleno;
		const valor = valorDeCelda(celda[0], cadenas);
		if (valor === null || valor === '') continue;
		(filas[fila] ??= [])[columna] = valor;
	}
	for (let i = 0; i < filas.length; i++) filas[i] ??= [];
	const combinadas = [...xml.matchAll(/<mergeCell\s+ref="([A-Z]+\d+):([A-Z]+\d+)"/g)].map((m) => {
		const inicio = referenciaACoordenadas(m[1]);
		const fin = referenciaACoordenadas(m[2]);
		return {
			filaInicio: inicio.fila,
			columnaInicio: inicio.columna,
			filaFin: fin.fila,
			columnaFin: fin.columna
		};
	});
	return { nombre, filas, combinadas, rellenos };
}

export async function leerLibro(datos: Uint8Array | ArrayBuffer): Promise<Hoja[]> {
	const zip = await JSZip.loadAsync(datos);
	const leer = async (parte: string) => (await zip.file(parte)?.async('string')) ?? '';
	const libro = await leer('xl/workbook.xml');
	if (!libro) throw new Error('El archivo no es un libro de Excel (.xlsx) válido');
	const relaciones = await leer('xl/_rels/workbook.xml.rels');
	const destinos = new Map<string, string>();
	for (const r of relaciones.matchAll(/<Relationship\s[^>]*>/g)) {
		const id = /\sId="([^"]+)"/.exec(r[0])?.[1];
		const destino = /\sTarget="([^"]+)"/.exec(r[0])?.[1];
		if (id && destino) destinos.set(id, destino.replace(/^\/?xl\//, ''));
	}
	const cadenas = leerCadenasCompartidas(await leer('xl/sharedStrings.xml'));
	const rellenos = leerRellenos(await leer('xl/styles.xml'));
	const hojas: Hoja[] = [];
	for (const hoja of libro.matchAll(/<sheet\s[^>]*>/g)) {
		const nombre = decodificarXml(/\sname="([^"]*)"/.exec(hoja[0])?.[1] ?? '');
		const destino = destinos.get(/\sr:id="([^"]+)"/.exec(hoja[0])?.[1] ?? '');
		if (!destino) continue;
		hojas.push(leerHoja(nombre, await leer(`xl/${destino}`), cadenas, rellenos));
	}
	return hojas;
}

/** Valor de una celda considerando las combinadas: toma el de la esquina superior izquierda. */
export function valorEn(hoja: Hoja, fila: number, columna: number): ValorCelda {
	const directo = hoja.filas[fila]?.[columna];
	if (directo !== undefined && directo !== null) return directo;
	const rango = hoja.combinadas.find(
		(r) =>
			fila >= r.filaInicio &&
			fila <= r.filaFin &&
			columna >= r.columnaInicio &&
			columna <= r.columnaFin
	);
	return rango ? (hoja.filas[rango.filaInicio]?.[rango.columnaInicio] ?? null) : null;
}

/** Número de serie de fecha de Excel (sistema 1900) → AAAA-MM-DD. */
export function fechaDeSerieExcel(serie: number): string {
	const milisegundos = Math.round((serie - 25569) * 86400 * 1000);
	return new Date(milisegundos).toISOString().slice(0, 10);
}
