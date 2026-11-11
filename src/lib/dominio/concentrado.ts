// Concentrado de centros de costo (etapa 5 del seguimiento): una fila por centro con lo ejecutado
// contra lo planeado. Reutiliza los indicadores y porcentajes del tablero de cumplimiento; solo
// decide de dónde sale el avance de cada centro.
import type { OrigenActividades } from './constantes.ts';
import {
	indicadoresDePrograma,
	porcentaje,
	porcentajes,
	semaforo,
	sumarIndicadores,
	UMBRALES,
	type ProgramaCumplimiento,
	type Semaforo
} from './cumplimiento.ts';

export interface CentroConcentrado {
	id: string;
	clave: string;
	nombre: string;
	plantilla: { origenActividades: OrigenActividades } | null;
	contratos: { id: string; numero: string }[];
}

/** Actividades del mes de corte capturadas en el seguimiento de un centro. */
export interface ActividadesDelMes {
	programadas: number;
	ejecutadas: number;
}

/**
 * De dónde sale el avance: del programa anual (acumulado del ciclo hasta el corte), del seguimiento
 * mensual (solo el mes de corte) o de ningún lado si el centro no programa actividades.
 */
export type FuenteAvance = 'programa' | 'seguimiento';

export interface FilaConcentrado {
	centro: CentroConcentrado;
	fuente: FuenteAvance | null;
	planeado: number;
	ejecutado: number;
	/** Sin redondear; null sin fuente o sin nada planeado. */
	avance: number | null;
	semaforo: Semaforo | null;
	/** Contrato del programa, para abrir el tablero del centro. */
	contratoId: string | null;
}

export const ETIQUETA_FUENTE: Record<FuenteAvance, string> = {
	programa: 'Programa anual, acumulado al corte',
	seguimiento: 'Seguimiento del mes'
};

export function filasConcentrado(
	centros: readonly CentroConcentrado[],
	programas: readonly ProgramaCumplimiento[],
	actividades: Readonly<Record<string, ActividadesDelMes>>,
	corte: string,
	hoy: string,
	periodicidad: string | null = null
): FilaConcentrado[] {
	return centros.map((centro) => {
		const suyos = programas.filter((p) => p.sitio.id === centro.id);
		const delMes = actividades[centro.id];
		let fuente: FuenteAvance | null = null;
		let planeado = 0;
		let ejecutado = 0;
		let avance: number | null = null;
		if (suyos.length) {
			// El mismo cálculo que el tablero: ejecutado contra lo que ya debía estar ejecutado.
			const i = sumarIndicadores(
				suyos.map((p) => indicadoresDePrograma(p, corte, hoy, periodicidad))
			);
			fuente = 'programa';
			planeado = i.PR;
			ejecutado = i.E;
			avance = porcentajes(i).cumplimiento;
		} else if (centro.plantilla?.origenActividades === 'mensual' && delMes?.programadas) {
			fuente = 'seguimiento';
			planeado = delMes.programadas;
			ejecutado = delMes.ejecutadas;
			avance = porcentaje(ejecutado, planeado);
		}
		return {
			centro,
			fuente,
			planeado,
			ejecutado,
			avance,
			semaforo: semaforo(avance, UMBRALES.cumplimiento),
			contratoId: suyos[0]?.contrato.id ?? null
		};
	});
}

/** Cuántos centros hay en cada estado del semáforo, y cuántos sin avance que medir. */
export function resumenConcentrado(
	filas: readonly FilaConcentrado[]
): Record<Semaforo | 'sinDatos', number> {
	const resumen = { verde: 0, amarillo: 0, rojo: 0, sinDatos: 0 };
	for (const fila of filas) resumen[fila.semaforo ?? 'sinDatos']++;
	return resumen;
}

/** Por qué un centro no tiene avance, para decirlo en su fila. */
export function motivoSinAvance(fila: FilaConcentrado): string {
	const origen = fila.centro.plantilla?.origenActividades;
	if (!fila.centro.plantilla) return 'Sin plantilla de seguimiento';
	if (origen === 'programa_anual') return 'Sin programa anual en el mes de corte';
	if (origen === 'mensual') return 'Sin actividades capturadas en el mes';
	return 'Sin actividades programadas';
}
