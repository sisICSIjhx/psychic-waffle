// Reglas puras para elegir la partida de un reporte nuevo: búsqueda sin acentos ni mayúsculas,
// agrupación según el trabajo pendiente del programa y mes que se sugiere al elegirla.
import type { Ocurrencia } from './documento.ts';
import type { AvancePrograma, ReporteResumen } from './esquemas.ts';
import { estadoEjecucion, type EstadoEjecucion } from './cumplimiento.ts';
import type { BorradorResumen } from './planeacion.ts';

/** Texto comparable: sin acentos, en minúsculas y con los espacios normalizados. */
export function normalizarBusqueda(texto: string): string {
	return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Partidas que contienen todas las palabras de la consulta (en número o actividad). Si la consulta
 * es un número, la partida con ese número va primero; el resto conserva su orden.
 */
export function buscarPartidas<T extends { numero: string; actividad: string }>(
	partidas: readonly T[],
	consulta: string
): T[] {
	const palabras = normalizarBusqueda(consulta).split(' ').filter(Boolean);
	if (!palabras.length) return [...partidas];
	const coincidentes = partidas.filter((p) => {
		const texto = normalizarBusqueda(`${p.numero} ${p.actividad}`);
		return palabras.every((palabra) => texto.includes(palabra));
	});
	const numero = /^\d+$/.test(consulta.trim()) ? Number(consulta.trim()) : null;
	if (numero === null) return coincidentes;
	const exacta = (p: T) => (Number(p.numero) === numero ? 0 : 1);
	return coincidentes
		.map((p, i) => ({ p, i }))
		.sort((a, b) => exacta(a.p) - exacta(b.p) || a.i - b.i)
		.map(({ p }) => p);
}

/** Reporte de la partida elegida, para avisar si ya existe uno del periodo. */
export type ReporteDePartida = Pick<
	ReporteResumen,
	'id' | 'titulo' | 'estado' | 'periodoMes' | 'ocurrencia' | 'tags'
>;

export type GrupoPartida = 'con_borrador' | 'pendientes' | 'otras';

export const ETIQUETA_GRUPO: Record<GrupoPartida, string> = {
	con_borrador: 'Con borrador',
	pendientes: 'Pendientes',
	otras: 'Otras partidas'
};

export interface TrabajoDePartida {
	grupo: GrupoPartida;
	/** Meses vencidos anteriores al mes de referencia, del más antiguo al más reciente. */
	vencidos: string[];
	/** Estado de la celda del mes de referencia, si la partida tiene programa ese mes. */
	estadoMes: EstadoEjecucion | null;
	/** Borradores de la partida en los meses pendientes, del más reciente al más antiguo. */
	borradores: { id: string; titulo: string; periodoMes: string; ocurrencia: Ocurrencia | null }[];
}

/**
 * Trabajo pendiente de cada partida del sitio respecto del mes de referencia. Cada partida cae en
 * un solo grupo, por precedencia: «Con borrador» (algún borrador en sus meses pendientes),
 * «Pendientes» (vencidos anteriores o pendiente en el mes de referencia) y «Otras partidas».
 */
export function trabajoDePartidas(
	partidas: readonly { id: string }[],
	avance: AvancePrograma | null,
	borradores: readonly BorradorResumen[],
	mesReferencia: string,
	hoy: string
): Map<string, TrabajoDePartida> {
	const referencia = mesReferencia.slice(0, 7);
	const ordenados = [...borradores].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
	const resultado = new Map<string, TrabajoDePartida>();
	for (const { id } of partidas) {
		const celdas = avance?.partidas.find((p) => p.id === id)?.celdas ?? [];
		const vencidos = celdas
			.filter((c) => c.mes.slice(0, 7) < referencia && estadoEjecucion(c, hoy) === 'vencido')
			.map((c) => c.mes)
			.sort();
		const celdaMes = celdas.find((c) => c.mes.slice(0, 7) === referencia);
		const estadoMes = celdaMes ? estadoEjecucion(celdaMes, hoy) : null;
		// Un mes de referencia futuro (programado) cuenta como pendiente, igual que el mes en curso.
		const referenciaPendiente =
			estadoMes === 'pendiente' || estadoMes === 'vencido' || estadoMes === 'programado'
				? [celdaMes!.mes.slice(0, 7)]
				: [];
		const mesesPendientes = new Set([
			...vencidos.map((m) => m.slice(0, 7)),
			...referenciaPendiente
		]);
		const propios = ordenados
			.filter((b) => b.partidaId === id && mesesPendientes.has(b.periodoMes.slice(0, 7)))
			.map(({ id: idBorrador, titulo, periodoMes, ocurrencia }) => ({
				id: idBorrador,
				titulo,
				periodoMes,
				ocurrencia
			}));
		const grupo: GrupoPartida = propios.length
			? 'con_borrador'
			: mesesPendientes.size
				? 'pendientes'
				: 'otras';
		resultado.set(id, { grupo, vencidos, estadoMes, borradores: propios });
	}
	return resultado;
}

/**
 * Mes que se propone al elegir una partida sin mes en la dirección: su vencido más antiguo o, si no
 * tiene, el mes en curso; siempre dentro de los meses de la vigencia.
 */
export function mesSugerido(
	trabajo: TrabajoDePartida | undefined,
	meses: readonly string[],
	hoy: string
): string | null {
	const vencido = trabajo?.vencidos.find((m) => meses.includes(m));
	if (vencido) return vencido;
	const actual = meses.find((m) => m.slice(0, 7) === hoy.slice(0, 7));
	return actual ?? meses[0] ?? null;
}
