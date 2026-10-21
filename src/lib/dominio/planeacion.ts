// Reglas puras de la planeación anual: estado de cada celda P/R, pendientes vencidos, filtros de la
// matriz y resumen del mes para el panel de control.
import type { Ocurrencia } from './documento.ts';
import type { AvancePrograma, CeldaPrograma, ReporteResumen } from './esquemas.ts';

type PartidaAvance = AvancePrograma['partidas'][number];

/**
 * - sin_programa: nada programado ni realizado.
 * - cumplido: lo realizado cubre lo programado.
 * - pendiente: falta realizar en el mes en curso o en uno futuro.
 * - vencido: el mes ya terminó y falta realizar.
 * - extra: se realizó sin estar programado.
 */
export type EstadoCelda = 'sin_programa' | 'cumplido' | 'pendiente' | 'vencido' | 'extra';

/** Un mes («AAAA-MM-DD») está vencido cuando ya terminó respecto de la fecha de hoy. */
export function mesTerminado(mes: string, hoy: string): boolean {
	return mes.slice(0, 7) < hoy.slice(0, 7);
}

export function estadoCelda(celda: CeldaPrograma, hoy: string): EstadoCelda {
	const programado = celda.programado ?? 0;
	if (programado <= 0) return celda.realizado > 0 ? 'extra' : 'sin_programa';
	if (celda.realizado >= programado) return 'cumplido';
	return mesTerminado(celda.mes, hoy) ? 'vencido' : 'pendiente';
}

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
				.filter((c) => estadoCelda(c, hoy) === 'vencido')
				.map((c) => ({
					partidaId: p.id,
					numero: p.numero,
					actividad: p.actividad,
					mes: c.mes,
					faltan: (c.programado ?? 0) - c.realizado
				}))
		)
		.sort(
			(a, b) =>
				a.mes.localeCompare(b.mes) || a.numero.localeCompare(b.numero, 'es', { numeric: true })
		);
}

export interface ResumenMes {
	/** Partidas con algo programado en el mes. */
	programadas: number;
	/** De ellas, las que ya cubren lo programado. */
	cumplidas: number;
	/** Las que aún no lo cubren. */
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
				const estado = estadoCelda(celda, hoy);
				if (estado === 'vencido') resumen.vencidas++;
				if (celda.mes !== mes || (celda.programado ?? 0) <= 0) continue;
				resumen.programadas++;
				if (estado === 'cumplido') resumen.cumplidas++;
				else resumen.pendientes++;
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
	'id' | 'partidaId' | 'sitioId' | 'periodoMes' | 'ocurrencia' | 'titulo' | 'actualizadoEn'
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
	/** Borradores de esa partida, sitio y mes, del más reciente al más antiguo. */
	borradores: { id: string; titulo: string; ocurrencia: Ocurrencia | null }[];
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
				const estado = estadoCelda(celda, hoy);
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
					faltan: (celda.programado ?? 0) - celda.realizado,
					borradores: ordenados
						.filter(
							(b) =>
								b.partidaId === partida.id &&
								b.sitioId === programa.sitioId &&
								b.periodoMes.slice(0, 7) === celda.mes.slice(0, 7)
						)
						.map(({ id, titulo, ocurrencia }) => ({ id, titulo, ocurrencia }))
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
