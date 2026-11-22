// Reglas puras del «reporte fotográfico» de estimación (libro de Excel horizontal, una hoja por
// reporte): textos de fechas y periodos, descripción de la partida, reparto de fotos y actividades
// en hojas, cuadrícula de fotos, nombres de hoja y nombre del archivo.
import { MESES, type Caja } from './documento.ts';
import { FORMATOS_DESCARGA, TIPOS_DOCUMENTO } from './tipos-documento.ts';

/** Fotos por hoja: la cuadrícula de 4 × 2 del formato. */
export const FOTOS_POR_HOJA = 8;
/** Actividades por hoja: seis renglones en una columna o doce en dos. */
export const ACTIVIDADES_POR_HOJA = 12;
export const RENGLONES_ACTIVIDADES = 6;
/** Caja de cada foto (cm), la del formato: 11 × 8.25; la foto se ajusta sin deformarse. */
export const CAJA_FOTO_FOTOGRAFICO: Caja = { ancho: 11, alto: 8.25 };

export interface Segmento {
	desde: string;
	hasta: string;
}

function partes(fechaIso: string): { anio: number; mes: number; dia: number } {
	const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso);
	if (!coincidencia) throw new RangeError(`Fecha incompleta o inválida: «${fechaIso}»`);
	const [, anio, mes, dia] = coincidencia.map(Number);
	const fecha = new Date(Date.UTC(anio, mes - 1, dia));
	if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
		throw new RangeError(`Fecha inexistente: «${fechaIso}»`);
	}
	return { anio, mes, dia };
}

const dos = (numero: number) => String(numero).padStart(2, '0');

/** «2026-09-01» → «01/09/2026». */
export function fechaCorta(fechaIso: string): string {
	const { anio, mes, dia } = partes(fechaIso);
	return `${dos(dia)}/${dos(mes)}/${anio}`;
}

function validarSegmento({ desde, hasta }: Segmento): void {
	partes(desde);
	partes(hasta);
	if (hasta < desde) throw new RangeError('El periodo termina antes de empezar');
}

/**
 * Fechas de ejecución de la descripción: días sueltos unidos con «, » y « Y »
 * («01/09/2026 Y 07/09/2026») y los tramos como «DEL 15/06/2026 AL 30/06/2026».
 */
export function fechasEjecucion(dias: readonly Segmento[]): string {
	if (!dias.length) throw new RangeError('No hay días de ejecución');
	const textos = dias.map((segmento) => {
		validarSegmento(segmento);
		return segmento.desde === segmento.hasta
			? fechaCorta(segmento.desde)
			: `DEL ${fechaCorta(segmento.desde)} AL ${fechaCorta(segmento.hasta)}`;
	});
	return textos.length === 1
		? textos[0]
		: `${textos.slice(0, -1).join(', ')} Y ${textos[textos.length - 1]}`;
}

/** Periodo estimado: «01 SEPTIEMBRE 2026 AL 30 SEPTIEMBRE 2026». */
export function periodoEstimado(periodo: Segmento): string {
	validarSegmento(periodo);
	const texto = (fechaIso: string) => {
		const { anio, mes, dia } = partes(fechaIso);
		return `${dos(dia)} ${MESES[mes - 1]} ${anio}`;
	};
	return `${texto(periodo.desde)} AL ${texto(periodo.hasta)}`;
}

/** Periodo de contrato: «DEL 01 DE MARZO 2026 AL 28 DE FEBRERO 2027». */
export function periodoContrato(vigencia: Segmento): string {
	validarSegmento(vigencia);
	const texto = (fechaIso: string) => {
		const { anio, mes, dia } = partes(fechaIso);
		return `${dos(dia)} DE ${MESES[mes - 1]} ${anio}`;
	};
	return `DEL ${texto(vigencia.desde)} AL ${texto(vigencia.hasta)}`;
}

/**
 * Descripción de la partida: la actividad en mayúsculas con el sitio entre paréntesis (si la
 * actividad no lo menciona ya) y, en otro renglón, las fechas de ejecución.
 */
export function descripcionPartida({
	actividad,
	sitio,
	dias
}: {
	actividad: string;
	sitio?: string | null;
	dias: readonly Segmento[];
}): string {
	const titulo = actividad
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/[.\s]+$/, '')
		.toLocaleUpperCase('es-MX');
	const lugar = (sitio ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-MX');
	const conSitio = lugar && !titulo.includes(lugar) ? `${titulo} (${lugar})` : titulo;
	return `${conSitio}\nFECHA DE EJECUCIÓN: ${fechasEjecucion(dias)}`;
}

/** Renglón de la lista de actividades: «1._ Inspección visual». */
export function textoActividad(numero: number, actividad: string): string {
	return `${numero}._ ${actividad.trim().replace(/\s+/g, ' ')}`;
}

/** Columnas y filas de la cuadrícula según cuántas fotos lleva la hoja (hasta 4 × 2). */
export function cuadriculaFotos(fotos: number): { columnas: number; filas: number } {
	if (!Number.isInteger(fotos) || fotos < 0 || fotos > FOTOS_POR_HOJA) {
		throw new RangeError(`Una hoja admite de 0 a ${FOTOS_POR_HOJA} fotos`);
	}
	if (fotos <= 2) return { columnas: Math.max(fotos, 1), filas: 1 };
	return { columnas: Math.ceil(fotos / 2), filas: 2 };
}

/** Nombre de hoja válido en Excel: sin «[ ] : * ? / \», sin apóstrofos en los extremos y de 31 caracteres como máximo. */
function nombreHojaValido(texto: string, maximo = 31): string {
	const limpio = texto
		.replace(/[[\]:*?/\\]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^'+|'+$/g, '');
	return limpio.slice(0, maximo).trim() || 'Reporte';
}

/**
 * Nombres de las hojas: el número de partida; cuando se repite, «13 (2)», «13 (3)»… como en el
 * libro que se arma a mano. Ningún nombre se repite ni choca con los reservados.
 */
export function nombresDeHoja(
	partidas: readonly (string | number)[],
	reservados: readonly string[] = []
): string[] {
	const usados = new Set(reservados.map((r) => r.toLocaleLowerCase('es-MX')));
	const veces = new Map<string, number>();
	return partidas.map((partida) => {
		const base = nombreHojaValido(String(partida), 25);
		const clave = base.toLocaleLowerCase('es-MX');
		let numero = (veces.get(clave) ?? 0) + 1;
		let nombre = numero === 1 ? base : `${base} (${numero})`;
		while (usados.has(nombre.toLocaleLowerCase('es-MX'))) nombre = `${base} (${++numero})`;
		veces.set(clave, numero);
		usados.add(nombre.toLocaleLowerCase('es-MX'));
		return nombre;
	});
}

export interface EntradaReparto {
	numeroPartida: string | number;
	/** Actividades realizadas, en orden; se numeran desde 1. */
	actividades: readonly string[];
	/** Por cada foto, el número de la actividad que ilustra (o null si no corresponde a ninguna). */
	fotos: readonly (number | null | undefined)[];
}

export interface HojaReparto {
	/** Índice del reporte en la entrada. */
	reporte: number;
	nombre: string;
	/** Página de la hoja y total del libro («n DE m»). */
	pagina: number;
	total: number;
	actividades: { numero: number; texto: string }[];
	/** Índices de las fotos del reporte que van en esta hoja. */
	fotos: number[];
}

function trozos<T>(lista: readonly T[], tamano: number): T[][] {
	const resultado: T[][] = [];
	for (let i = 0; i < lista.length; i += tamano) resultado.push(lista.slice(i, i + tamano));
	return resultado;
}

/**
 * Reparte cada reporte en hojas. Un reporte ocupa una hoja y, si tiene más fotos de las que caben,
 * las hojas siguientes repiten sus datos y su lista de actividades. Si la lista no cabe en una hoja
 * se parte en tramos, y cada tramo lleva las fotos de sus actividades. Todo reporte tiene al menos
 * una hoja, aunque no tenga fotos.
 */
export function repartirHojas(
	reportes: readonly EntradaReparto[],
	{
		fotosPorHoja = FOTOS_POR_HOJA,
		actividadesPorHoja = ACTIVIDADES_POR_HOJA,
		nombresReservados = [] as readonly string[]
	} = {}
): HojaReparto[] {
	if (!Number.isInteger(fotosPorHoja) || fotosPorHoja < 1 || fotosPorHoja > FOTOS_POR_HOJA) {
		throw new RangeError(`Las fotos por hoja van de 1 a ${FOTOS_POR_HOJA}`);
	}
	const hojas: Omit<HojaReparto, 'nombre' | 'pagina' | 'total'>[] = [];
	reportes.forEach((reporte, indice) => {
		// Cada actividad conserva su número aunque alguna anterior venga en blanco y no se liste.
		const numeradas = reporte.actividades
			.map((texto, i) => ({ numero: i + 1, texto: texto.trim() }))
			.filter((actividad) => actividad.texto);
		const validos = new Set(numeradas.map((actividad) => actividad.numero));
		const tramos = numeradas.length ? trozos(numeradas, actividadesPorHoja) : [[]];
		tramos.forEach((tramo, t) => {
			const delTramo = new Set(tramo.map((actividad) => actividad.numero));
			// Las fotos sin actividad, o con un número que no está en la lista, van con el primer tramo.
			const fotos = reporte.fotos.flatMap((actividad, f) => {
				const numero = actividad ?? 0;
				return delTramo.has(numero) || (t === 0 && !validos.has(numero)) ? [f] : [];
			});
			const grupos = fotos.length ? trozos(fotos, fotosPorHoja) : [[]];
			for (const grupo of grupos) hojas.push({ reporte: indice, actividades: tramo, fotos: grupo });
		});
	});
	const nombres = nombresDeHoja(
		hojas.map((h) => reportes[h.reporte].numeroPartida),
		nombresReservados
	);
	return hojas.map((hoja, i) => ({
		...hoja,
		nombre: nombres[i],
		pagina: i + 1,
		total: hojas.length
	}));
}

/** «3 DE 33». */
export function textoPagina(pagina: number, total: number): string {
	return `${pagina} DE ${total}`;
}

/**
 * Nombre del libro: «REPORTE-FOTOGRAFICO_PRO-AGRO-PRV-016-2026_EST-07-PARCIAL.xlsx». Solo contiene
 * A-Z, 0-9, «-», «_» y «.», válidos en Windows.
 */
export function nombreArchivoFotografico({
	contrato,
	estimacion
}: {
	contrato: string;
	estimacion: string;
}): string {
	const ficha = (texto: string) =>
		texto
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toUpperCase()
			.split(/[^A-Z0-9]+/)
			.filter(Boolean)
			.join('-');
	const partesNombre = ['REPORTE-FOTOGRAFICO', ficha(contrato), `EST-${ficha(estimacion) || '0'}`];
	const { extension } = FORMATOS_DESCARGA[TIPOS_DOCUMENTO['reporte-fotografico'].formato];
	return partesNombre.filter(Boolean).join('_').slice(0, 120).concat(extension);
}
