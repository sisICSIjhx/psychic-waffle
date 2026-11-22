// Cómo se nombra y se escribe un indicador en pantalla (barra y tabla del tablero).
import { textoPorcentaje } from '$lib/dominio/cumplimiento';
import type { Kpi } from '$lib/dominio/estatus';

/** «Ejecución del ciclo» (programa anual, acumulado) o «Ejecución del mes»; los demás, su etiqueta. */
export function nombreDeKpi(kpi: Kpi): string {
	if (kpi.clave !== 'ejecucion' || !kpi.alcance) return kpi.etiqueta;
	return kpi.alcance === 'ciclo' ? 'Ejecución del ciclo' : 'Ejecución del mes';
}

/** El indicador tiene contra qué medirse. */
export const kpiConDatos = (kpi: Kpi) => kpi.total > 0 && kpi.porcentaje !== null;

/**
 * «8 de 10»; con dinero, el porcentaje («62 %»: los montos van en contrato y cobranza); sin
 * denominador, «Sin datos».
 */
export function cifraDeKpi(kpi: Kpi): string {
	if (!kpiConDatos(kpi)) return 'Sin datos';
	return kpi.esMonto ? textoPorcentaje(kpi.porcentaje) : `${kpi.valor} de ${kpi.total}`;
}
