// Etiquetas y reglas puras de la captura del seguimiento operativo. Sin Zod: lo usan los componentes
// del navegador.
import type { EstadoCarpeta } from './constantes.ts';

export const ESTADOS_SEGUIMIENTO = {
	pendiente: 'Pendiente',
	en_proceso: 'En proceso',
	hecho: 'Hecho'
} as const;

/** Camino de una carpeta (cambio kpi-estatus-centros, D5), en orden. */
export const ESTADOS_CARPETA: Record<EstadoCarpeta, string> = {
	pendiente: 'Pendiente',
	en_proceso: 'En preparación',
	entregada: 'Entregada',
	recibida_comentarios: 'Recibida con comentarios',
	recibida: 'Recibida correctamente'
};

/** La carpeta ya salió de nuestras manos: entregada o recibida. */
export function carpetaEntregada(estado: EstadoCarpeta): boolean {
	return estado === 'entregada' || estado === 'recibida_comentarios' || estado === 'recibida';
}

/** Solo «recibida correctamente» (con su acuse) cierra la carpeta. */
export function carpetaCerrada(estado: EstadoCarpeta): boolean {
	return estado === 'recibida';
}

export const MAX_ARCHIVO_CARPETA = 8 * 1024 * 1024;

/** Lo que una actividad dice de su partida (respuesta del seguimiento, D3). */
export interface ActividadDePartida {
	clave: string;
	/** La partida: todas sus actividades del mes lo comparten. */
	grupo: string;
	/** Nombre de la partida, sin el ordinal. */
	partida: string;
	ordinal: number | null;
	ejecutada: boolean;
	programada: boolean;
	/** La escribió una persona; con programa anual se muestra «Fuera del programa». */
	manual: boolean;
}

export interface PartidaDelMes<A extends ActividadDePartida = ActividadDePartida> {
	grupo: string;
	partida: string;
	manual: boolean;
	/** Clave de la primera actividad: ahí se captura un concepto de nivel «partida» (D2). */
	primera: string;
	/** En orden de ejecución (ordinal). */
	actividades: A[];
	ejecutadas: number;
}

/**
 * Actividades agrupadas por partida, en el orden en que llegan. La primera de cada partida es la de
 * menor ordinal: la misma regla que aplica la base al guardar un concepto por partida.
 */
export function partidasDelMes<A extends ActividadDePartida>(
	actividades: readonly A[]
): PartidaDelMes<A>[] {
	const porGrupo = new Map<string, A[]>();
	for (const actividad of actividades) {
		const lista = porGrupo.get(actividad.grupo);
		if (lista) lista.push(actividad);
		else porGrupo.set(actividad.grupo, [actividad]);
	}
	return [...porGrupo.entries()].map(([grupo, lista]) => {
		const ordenadas = [...lista].sort(
			(a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0) || (a.clave < b.clave ? -1 : 1)
		);
		return {
			grupo,
			partida: ordenadas[0].partida,
			manual: ordenadas[0].manual,
			primera: ordenadas[0].clave,
			actividades: ordenadas,
			ejecutadas: ordenadas.filter((a) => a.ejecutada).length
		};
	});
}

/** Horario de una atención de emergencia: «22:30 a 01:15», «desde las 22:30» o vacío. */
export function textoHorario(horaInicio: string | null, horaFin: string | null): string {
	if (horaInicio && horaFin) return `${horaInicio} a ${horaFin}`;
	if (horaInicio) return `desde las ${horaInicio}`;
	return horaFin ? `hasta las ${horaFin}` : '';
}
