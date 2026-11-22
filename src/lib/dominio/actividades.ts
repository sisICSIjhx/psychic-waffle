// Captura de actividades del programa anual desde la barra superior (cambio capturar-actividad).
// Reglas puras compartidas por la ventana y la ruta `/actividades`: sin Zod, porque el navegador
// también las usa.
import type { PERIODICIDADES } from './constantes.ts';

type Periodicidad = (typeof PERIODICIDADES)[number];

/** Centro de costo visible para quien captura, con su programa vigente o null si no tiene. */
export interface CentroActividad {
	id: string;
	clave: string;
	nombre: string;
	programa: { id: string; periodoInicio: string; periodoFin: string } | null;
}

/** Partida del programa con lo que falta por ejecutar en cada mes («AAAA-MM-01» → cantidad). */
export interface PartidaActividad {
	id: string;
	numero: string;
	actividad: string;
	periodicidad: Periodicidad;
	faltan: Record<string, number>;
}

/** Persona activa que puede haber realizado la actividad. */
export interface PersonaActividad {
	id: string;
	nombre: string;
	centroIds: string[];
}

/** Lo que envía la ventana al registrar. */
export interface CapturaActividad {
	programaId: string;
	partidaId: string;
	realizada: boolean;
	/** «AAAA-MM-DD»; vacía o null = hoy. */
	fecha?: string | null;
	personalIds?: string[];
}

export const NOTA_ACTIVIDAD_REALIZADA = 'Registrado desde «Capturar actividad»';
export const NOTA_ACTIVIDAD_NO_REALIZADA = 'No realizada (registrado desde «Capturar actividad»)';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** La fecha indicada o, si se dejó vacía, la de hoy. */
export function fechaEfectiva(fecha: string | null | undefined, hoy: string): string {
	return fecha?.trim() ? fecha.trim() : hoy;
}

/** Primer día del mes de una fecha «AAAA-MM-DD». */
export const mesDeFecha = (fecha: string) => `${fecha.slice(0, 7)}-01`;

/**
 * Motivo por el que no se puede registrar la actividad en esa fecha, o null si se puede. `fecha` es
 * la efectiva (ya con la de hoy si venía vacía).
 */
export function errorFechaActividad(
	fecha: string,
	hoy: string,
	programa: { periodoInicio: string; periodoFin: string }
): string | null {
	if (!FECHA.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) {
		return 'La fecha no es válida.';
	}
	if (fecha > hoy) return 'La fecha no puede ser posterior a hoy.';
	if (fecha < programa.periodoInicio || fecha > programa.periodoFin) {
		return 'La fecha está fuera del periodo del programa anual.';
	}
	return null;
}

/** Lo que falta por ejecutar de la partida en el mes de la fecha. */
export function faltanEnFecha(partida: Pick<PartidaActividad, 'faltan'>, fecha: string): number {
	return partida.faltan[mesDeFecha(fecha)] ?? 0;
}
