// Reglas puras de la planeación anual: pendientes vencidos, filtros de la matriz, resumen del mes
// para el panel de control y siguiente trabajo. El estado de cada celda (con los ajustes de
// reprogramado y no ejecutado) sale de cumplimiento.ts.
import { estadoEjecucion, faltan, objetivo } from './cumplimiento.ts';
import type { Ocurrencia } from './documento.ts';
import type { AvancePrograma, ReporteResumen } from './esquemas.ts';

export { mesTerminado } from './cumplimiento.ts';

type PartidaAvance = AvancePrograma['partidas'][number];

export interface FiltroPlaneacion {
	distribucion?: 'produccion' | 'mantenimiento' | null;
	periodicidad?: PartidaAvance['periodicidad'] | null;
}

export function filtrarPartidas(
	partidas: readonly PartidaAvance[],
	{ distribucion, periodicidad }: FiltroPlaneacion
): PartidaAvance[] {
	return partidas.filter(
		(p) =>
			(!distribucion || p.distribucion === distribucion) &&
			(!periodicidad || p.periodicidad === periodicidad)
	);
}

export interface PendienteVencido {
	partidaId: string;
	numero: string;
	actividad: string;
	mes: string;
	faltan: number;
}

/** Celdas vencidas de las partidas, del mes más antiguo al más reciente. */
export function pendientesVencidos(
	partidas: readonly PartidaAvance[],
	hoy: string
): PendienteVencido[] {
	return partidas
		.flatMap((p) =>
			p.celdas
				.filter((c) => estadoEjecucion(c, hoy) === 'vencido')
				.map((c) => ({
					partidaId: p.id,
					numero: p.numero,
					actividad: p.actividad,
					mes: c.mes,
					faltan: faltan(c)
				}))
		)
		.sort(
			(a, b) =>
				a.mes.localeCompare(b.mes) || a.numero.localeCompare(b.numero, 'es', { numeric: true })
		);
}

export interface ResumenMes {
	/** Partidas con algo por ejecutar en el mes (lo programado más lo que llega reprogramado). */
	programadas: number;
	/** De ellas, las ya ejecutadas. */
	cumplidas: number;
	/** Las que aún tienen algo por ejecutar (lo no ejecutado no cuenta como pendiente). */
	pendientes: number;
	/** Celdas vencidas de meses anteriores (partida y mes). */
	vencidas: number;
}

/**
 * Indicadores del mes de `hoy` para los programas dados. Se cuentan partidas y no cantidades: una
 * partida diaria programa unos 30 por mes y dominaría cualquier suma.
 */
export function resumenDelMes(avances: readonly AvancePrograma[], hoy: string): ResumenMes {
	const resumen: ResumenMes = { programadas: 0, cumplidas: 0, pendientes: 0, vencidas: 0 };
	const mes = `${hoy.slice(0, 7)}-01`;
	for (const avance of avances) {
		for (const partida of avance.partidas) {
			for (const celda of partida.celdas) {
				const estado = estadoEjecucion(celda, hoy);
				if (estado === 'vencido') resumen.vencidas++;
				if (celda.mes !== mes || objetivo(celda) <= 0) continue;
				resumen.programadas++;
				if (estado === 'ejecutado') resumen.cumplidas++;
				else if (estado === 'pendiente') resumen.pendientes++;
			}
		}
	}
	return resumen;
}

/** El programa vigente en la fecha, o el más reciente si ninguno la incluye. */
export function programaVigente<T extends { periodoInicio: string; periodoFin: string }>(
	programas: readonly T[],
	hoy: string
): T | null {
	return (
		programas.find((p) => p.periodoInicio <= hoy && hoy <= p.periodoFin) ??
		[...programas].sort((a, b) => b.periodoInicio.localeCompare(a.periodoInicio))[0] ??
		null
	);
}

/** Lo que necesita «Mi trabajo» de cada borrador para relacionarlo con un pendiente. */
export type BorradorResumen = Pick<
	ReporteResumen,
	'id' | 'partidaId' | 'sitioId' | 'periodoMes' | 'ocurrencia' | 'titulo' | 'tags' | 'actualizadoEn'
>;

export interface TrabajoPendiente {
	contratoId: string;
	sitioId: string;
	partidaId: string;
	numero: string;
	actividad: string;
	periodicidad: PartidaAvance['periodicidad'];
	/** Primer día del mes del pendiente («AAAA-MM-01»). */
	mes: string;
	estado: 'vencido' | 'pendiente';
	/** Ejecuciones programadas que aún no se realizan en ese mes. */
	faltan: number;
	/** Reprogramación que llega a ese mes y aún falta por reportar (para la captura). */
	reprogramacionId: string | null;
	/** Borradores de esa partida, sitio y mes, del más reciente al más antiguo. */
	borradores: { id: string; titulo: string; tags: string | null; ocurrencia: Ocurrencia | null }[];
}

/**
 * Pendientes de los programas para «Mi trabajo», por urgencia: primero los vencidos, del mes más
 * antiguo al más reciente, y después los pendientes del mes en curso (los de meses futuros no). Cada
 * uno trae los borradores que coinciden por partida, sitio y mes.
 */
export function siguienteTrabajo(
	avances: readonly AvancePrograma[],
	borradores: readonly BorradorResumen[],
	hoy: string
): TrabajoPendiente[] {
	const mesActual = `${hoy.slice(0, 7)}-01`;
	const ordenados = [...borradores].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
	const trabajo: TrabajoPendiente[] = [];
	for (const { programa, partidas } of avances) {
		for (const partida of partidas) {
			for (const celda of partida.celdas) {
				const estado = estadoEjecucion(celda, hoy);
				if (estado !== 'vencido' && !(estado === 'pendiente' && celda.mes === mesActual)) continue;
				trabajo.push({
					contratoId: programa.contratoId,
					sitioId: programa.sitioId,
					partidaId: partida.id,
					numero: partida.numero,
					actividad: partida.actividad,
					periodicidad: partida.periodicidad,
					mes: celda.mes,
					estado,
					faltan: faltan(celda),
					reprogramacionId:
						celda.ajustes.find(
							(a) =>
								a.tipo === 'reprogramado' &&
								a.mesDestino === celda.mes &&
								a.ejecuciones < a.cantidad
						)?.id ?? null,
					borradores: ordenados
						.filter(
							(b) =>
								b.partidaId === partida.id &&
								b.sitioId === programa.sitioId &&
								b.periodoMes.slice(0, 7) === celda.mes.slice(0, 7)
						)
						.map(({ id, titulo, tags, ocurrencia }) => ({ id, titulo, tags, ocurrencia }))
				});
			}
		}
	}
	const rango = (t: TrabajoPendiente) => (t.estado === 'vencido' ? 0 : 1);
	return trabajo.sort(
		(a, b) =>
			rango(a) - rango(b) ||
			a.mes.localeCompare(b.mes) ||
			a.numero.localeCompare(b.numero, 'es', { numeric: true })
	);
}
