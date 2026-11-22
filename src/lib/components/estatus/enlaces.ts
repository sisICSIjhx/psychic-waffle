// Enlaces de «Qué falta»: cada pendiente lleva al lugar donde se resuelve. En el tablero son rutas
// completas (`/seguimiento?centro=&mes=#ancla`, `/cobranza?centro=#ancla`); en la ficha de
// `/seguimiento`, anclas de la misma página.
import { resolve } from '$app/paths';
import type { EstatusCentro, Pendiente } from '$lib/dominio/estatus';

export interface DestinoPendiente {
	centroId: string;
	/** «AAAA-MM». */
	mes: string;
	/** La lista se muestra dentro de `/seguimiento`: sus pendientes son anclas de la página. */
	enSeguimiento?: boolean;
	/** Quien consulta puede abrir «Contrato y cobranza». */
	verCobranza?: boolean;
}

export const rutaSeguimiento = (centroId: string, mes: string) =>
	`${resolve('/seguimiento')}?centro=${centroId}&mes=${mes}`;

export const rutaCobranza = (centroId: string) => `${resolve('/cobranza')}?centro=${centroId}`;

/** Ancla de la sección: una carpeta tiene la suya (`#carpeta-<concepto>`). */
function anclaDe(pendiente: Pendiente): string {
	if (!pendiente.ancla) return '';
	return pendiente.ancla === 'carpetas' && pendiente.conceptoId
		? `#carpeta-${pendiente.conceptoId}`
		: `#${pendiente.ancla}`;
}

/** Dónde se resuelve un pendiente; null si quien consulta no puede abrir ese lugar. */
export function hrefDePendiente(pendiente: Pendiente, destino: DestinoPendiente): string | null {
	const ancla = anclaDe(pendiente);
	if (pendiente.destino === 'cobranza') {
		return destino.verCobranza ? `${rutaCobranza(destino.centroId)}${ancla}` : null;
	}
	if (destino.enSeguimiento) return ancla || null;
	return `${rutaSeguimiento(destino.centroId, destino.mes)}${ancla}`;
}

/** La lista de `queFalta` lista para `ListaQueFalta`. */
export function elementosQueFalta(
	falta: readonly Pendiente[],
	destino: DestinoPendiente
): { texto: string; href: string | null }[] {
	return falta.map((pendiente) => ({
		texto: pendiente.texto,
		href: hrefDePendiente(pendiente, destino)
	}));
}

/** Lo que se dice cuando la lista de pendientes está vacía. */
export function textoSinPendientes(estatus: EstatusCentro): string {
	if (estatus === 'sin_datos') {
		return 'Todavía no hay nada capturado este mes. Empiece por marcar las actividades ejecutadas.';
	}
	if (estatus === 'al_corriente') return 'Nada pendiente este mes.';
	return 'Nada pendiente este mes; la ejecución acumulada del programa anual va por debajo de lo planeado.';
}
