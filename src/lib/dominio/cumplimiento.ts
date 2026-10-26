// Estados por partida y mes en dos ejes (ejecución y documental) e indicadores del programa a un mes de
// corte: PR, E, R, N y P con las fórmulas del libro de Virtual (cumplimiento = E / (E + N) y
// efectividad = E / (E + R)), donde N incluye lo que falta en meses terminados. Un solo cálculo para
// la matriz, la vista mensual, el tablero, «Mi trabajo» y la captura (cambio tablero-cumplimiento).
import { textoMes } from './textos.ts';

export type EstadoEjecucion =
	| 'sin_programa'
	| 'programado'
	| 'pendiente'
	| 'vencido'
	| 'reprogramado'
	| 'no_ejecutado'
	| 'ejecutado'
	| 'extra';

export type EstadoDocumental = 'ninguno' | 'sin_reporte' | 'reporte_en_borrador' | 'con_reporte';

/** Ajuste vigente de una celda (reprogramación o no ejecutado). */
export interface AjusteCelda {
	id: string;
	tipo: 'reprogramado' | 'no_ejecutado';
	mesOrigen: string;
	mesDestino: string | null;
	cantidad: number;
	motivo: string;
	nota: string | null;
	/** Ejecuciones emitidas ligadas a la reprogramación. */
	ejecuciones?: number;
}

/** Lo que necesita el cálculo de una celda (los campos de `CeldaPrograma`). */
export interface CeldaEvaluable {
	mes: string;
	programado: number | null;
	ejecucionesReportes: number;
	realizadoSinReporte: number;
	/** Reprogramado desde este mes a otro. */
	salida?: number;
	/** Reprogramado hacia este mes desde otro. */
	entrada?: number;
	noEjecutado?: number;
	reportesAbiertos?: { id: string; estado: 'borrador' | 'en_revision' }[];
	ajustes?: AjusteCelda[];
}

/** Un mes («AAAA-MM-DD») terminó respecto de la fecha de hoy. */
export function mesTerminado(mes: string, hoy: string): boolean {
	return mes.slice(0, 7) < hoy.slice(0, 7);
}

const mismoMes = (mes: string, hoy: string) => mes.slice(0, 7) === hoy.slice(0, 7);

/** Lo que el mes debe ejecutar: lo programado más lo que llega menos lo que sale. */
export const objetivo = (c: CeldaEvaluable) =>
	Math.max(0, (c.programado ?? 0) + (c.entrada ?? 0) - (c.salida ?? 0));
/** Lo esperado: el objetivo menos lo marcado como no ejecutado. */
export const esperado = (c: CeldaEvaluable) => Math.max(0, objetivo(c) - (c.noEjecutado ?? 0));
/** Ejecutado: reportes emitidos más realizados sin reporte. */
export const ejecutado = (c: CeldaEvaluable) => c.ejecucionesReportes + c.realizadoSinReporte;
export const faltan = (c: CeldaEvaluable) => Math.max(0, esperado(c) - ejecutado(c));
/** Lo ejecutado por encima de lo esperado. */
export const deMas = (c: CeldaEvaluable) => Math.max(0, ejecutado(c) - esperado(c));

export function estadoEjecucion(c: CeldaEvaluable, hoy: string): EstadoEjecucion {
	if ((c.programado ?? 0) <= 0 && (c.entrada ?? 0) <= 0) {
		return ejecutado(c) > 0 ? 'extra' : 'sin_programa';
	}
	if (faltan(c) > 0) {
		if (mesTerminado(c.mes, hoy)) return 'vencido';
		return mismoMes(c.mes, hoy) ? 'pendiente' : 'programado';
	}
	if ((c.noEjecutado ?? 0) > 0) return 'no_ejecutado';
	if (esperado(c) > 0) return 'ejecutado';
	return 'reprogramado';
}

export function estadoDocumental(c: CeldaEvaluable): EstadoDocumental {
	if (esperado(c) === 0 && ejecutado(c) === 0) return 'ninguno';
	if (c.ejecucionesReportes >= Math.max(esperado(c), 1)) return 'con_reporte';
	if (c.reportesAbiertos?.length) return 'reporte_en_borrador';
	return 'sin_reporte';
}

/** El borrador abierto incluye alguno en revisión. */
export const conReporteEnRevision = (c: CeldaEvaluable) =>
	!!c.reportesAbiertos?.some((r) => r.estado === 'en_revision');

export const ETIQUETA_EJECUCION: Record<EstadoEjecucion, string> = {
	sin_programa: 'Sin programa',
	programado: 'Programado',
	pendiente: 'Pendiente',
	vencido: 'Vencido',
	reprogramado: 'Reprogramado',
	no_ejecutado: 'No ejecutado',
	ejecutado: 'Ejecutado',
	extra: 'Realizado sin programar'
};

export const SIMBOLO_EJECUCION: Record<EstadoEjecucion, string> = {
	sin_programa: '',
	programado: '○',
	pendiente: '●',
	vencido: '!',
	reprogramado: '→',
	no_ejecutado: '✕',
	ejecutado: '✓',
	extra: '+'
};

/** Código corto del estado de ejecución en la matriz («E», «P», «PR»…); acompaña al símbolo. */
export const CODIGO_EJECUCION: Record<EstadoEjecucion, string> = {
	sin_programa: '',
	programado: 'PR',
	pendiente: 'P',
	vencido: 'V',
	reprogramado: 'RP',
	no_ejecutado: 'NE',
	ejecutado: 'E',
	extra: 'RSP'
};

export const ETIQUETA_DOCUMENTAL: Record<EstadoDocumental, string> = {
	ninguno: '',
	sin_reporte: 'Sin reporte',
	reporte_en_borrador: 'Reporte en borrador',
	con_reporte: 'Con reporte'
};

/** Código corto del documento en la matriz: «CR» con reporte, «B» borrador, «ER» en revisión, «S» sin. */
export function codigoDocumental(c: CeldaEvaluable): string {
	switch (estadoDocumental(c)) {
		case 'con_reporte':
			return 'CR';
		case 'reporte_en_borrador':
			return conReporteEnRevision(c) ? 'ER' : 'B';
		case 'sin_reporte':
			return 'S';
		default:
			return '';
	}
}

/** Nombre completo del estado documental: «Reporte en borrador (en revisión)». */
export function textoDocumental(c: CeldaEvaluable): string {
	const estado = estadoDocumental(c);
	if (estado === 'reporte_en_borrador' && conReporteEnRevision(c)) {
		return `${ETIQUETA_DOCUMENTAL[estado]} (en revisión)`;
	}
	return ETIQUETA_DOCUMENTAL[estado];
}

const mesCorto = (mes: string) => textoMes(mes, { corto: true }).slice(0, 3);

/** Anotaciones de la celda: «→ oct» por lo que sale y «+1 desde jun» por lo que llega. */
export function anotacionesCelda(c: CeldaEvaluable): string[] {
	const ajustes = c.ajustes ?? [];
	const salen = ajustes.filter((a) => a.tipo === 'reprogramado' && a.mesOrigen === c.mes);
	const llegan = ajustes.filter((a) => a.tipo === 'reprogramado' && a.mesDestino === c.mes);
	return [
		...salen.map((a) => `→ ${mesCorto(a.mesDestino!)}`),
		...llegan.map((a) => `+${a.cantidad} desde ${mesCorto(a.mesOrigen)}`)
	];
}

/** Detalle de la celda para el nombre accesible y la vista mensual: «3 de 4 ejecutadas». */
export function detalleCelda(c: CeldaEvaluable, hoy: string): string {
	const estado = estadoEjecucion(c, hoy);
	const total = esperado(c) + (c.noEjecutado ?? 0);
	const partes: string[] = [];
	if (estado === 'no_ejecutado' || (total > 1 && ejecutado(c) > 0)) {
		partes.push(`${Math.min(ejecutado(c), total)} de ${total} ejecutadas`);
	}
	const extra = deMas(c);
	if (extra > 0 && estado !== 'extra') partes.push(`${extra} de más`);
	if (objetivo(c) < (c.noEjecutado ?? 0)) partes.push('Los ajustes superan lo programado');
	return partes.join('; ');
}

// Indicadores al mes de corte (D7).

export interface Indicadores {
	/** Programado original. */
	PR: number;
	/** Ejecutado sin pasar de lo esperado. */
	E: number;
	/** Reprogramado desde los meses evaluados. */
	R: number;
	/** No ejecutado más lo que falta en meses terminados. */
	N: number;
	/** Lo que falta en el mes en curso más lo reprogramado a meses posteriores al corte. */
	P: number;
	/** Ejecuciones de más, aparte de los porcentajes. */
	extras: number;
	/** Ejecuciones cubiertas por reportes emitidos. */
	conReporte: number;
}

export const INDICADORES_VACIOS: Indicadores = {
	PR: 0,
	E: 0,
	R: 0,
	N: 0,
	P: 0,
	extras: 0,
	conReporte: 0
};

/** Indicadores de las celdas con mes hasta el corte («AAAA-MM-01»). */
export function indicadores(
	celdas: readonly CeldaEvaluable[],
	corte: string,
	hoy: string
): Indicadores {
	const total = { ...INDICADORES_VACIOS };
	for (const c of celdas) {
		if (c.mes > corte) continue;
		const terminado = mesTerminado(c.mes, hoy);
		const e = Math.min(ejecutado(c), esperado(c));
		total.PR += c.programado ?? 0;
		total.E += e;
		total.extras += deMas(c);
		total.N += (c.noEjecutado ?? 0) + (terminado ? faltan(c) : 0);
		total.P += terminado ? 0 : faltan(c);
		total.R += c.salida ?? 0;
		total.conReporte += Math.min(c.ejecucionesReportes, esperado(c));
		// Lo reprogramado a un mes posterior al corte sigue pendiente.
		for (const a of c.ajustes ?? []) {
			if (a.tipo === 'reprogramado' && a.mesOrigen === c.mes && (a.mesDestino ?? '') > corte) {
				total.P += a.cantidad;
			}
		}
	}
	return total;
}

export function sumarIndicadores(lista: readonly Indicadores[]): Indicadores {
	return lista.reduce(
		(suma, i) => ({
			PR: suma.PR + i.PR,
			E: suma.E + i.E,
			R: suma.R + i.R,
			N: suma.N + i.N,
			P: suma.P + i.P,
			extras: suma.extras + i.extras,
			conReporte: suma.conReporte + i.conReporte
		}),
		{ ...INDICADORES_VACIOS }
	);
}

/** Porcentaje sin redondear; null cuando el denominador es cero. */
export function porcentaje(a: number, b: number): number | null {
	return b === 0 ? null : (100 * a) / b;
}

export interface Porcentajes {
	cumplimiento: number | null;
	efectividad: number | null;
	conReporte: number | null;
}

export function porcentajes(i: Indicadores): Porcentajes {
	return {
		cumplimiento: porcentaje(i.E, i.E + i.N),
		efectividad: porcentaje(i.E, i.E + i.R),
		conReporte: porcentaje(i.conReporte, i.E)
	};
}

/** Porcentaje truncado para mostrar: «77 %» o «—». */
export function textoPorcentaje(valor: number | null): string {
	return valor === null ? '—' : `${Math.floor(valor + 1e-9)} %`;
}

export const UMBRALES = { cumplimiento: [75, 90], efectividad: [60, 80] } as const;

export type Semaforo = 'rojo' | 'amarillo' | 'verde';

export function semaforo(
	valor: number | null,
	[amarillo, verde]: readonly [number, number]
): Semaforo | null {
	if (valor === null) return null;
	if (valor >= verde) return 'verde';
	return valor >= amarillo ? 'amarillo' : 'rojo';
}

export const TEXTO_SEMAFORO: Record<Semaforo, string> = {
	rojo: 'Bajo la meta',
	amarillo: 'Cerca de la meta',
	verde: 'En meta'
};

// Vista mensual (D11): orden por urgencia.

const URGENCIA: Record<EstadoEjecucion, number> = {
	vencido: 0,
	pendiente: 1,
	programado: 2,
	reprogramado: 3,
	no_ejecutado: 4,
	extra: 5,
	ejecutado: 6,
	sin_programa: 7
};

/** Partidas del mes con algo que mostrar, de lo más urgente a lo ya ejecutado y con reporte. */
export function partidasDelMes<P extends { numero: string; celdas: CeldaEvaluable[] }>(
	partidas: readonly P[],
	mes: string,
	hoy: string
): { partida: P; celda: CeldaEvaluable; estado: EstadoEjecucion }[] {
	return partidas
		.flatMap((partida) => {
			const celda = partida.celdas.find((c) => c.mes === mes);
			if (!celda) return [];
			const visible =
				objetivo(celda) > 0 ||
				ejecutado(celda) > 0 ||
				(celda.ajustes?.length ?? 0) > 0 ||
				(celda.reportesAbiertos?.length ?? 0) > 0 ||
				(celda.salida ?? 0) > 0 ||
				(celda.noEjecutado ?? 0) > 0;
			return visible ? [{ partida, celda, estado: estadoEjecucion(celda, hoy) }] : [];
		})
		.sort((a, b) => {
			const documental = (x: CeldaEvaluable) => (estadoDocumental(x) === 'con_reporte' ? 1 : 0);
			return (
				URGENCIA[a.estado] - URGENCIA[b.estado] ||
				documental(a.celda) - documental(b.celda) ||
				a.partida.numero.localeCompare(b.partida.numero, 'es', { numeric: true })
			);
		});
}

// Vista semanal (D14, ampliada el 2026-10-25 con la matriz de semanas).

export interface EjecucionDelMes {
	id: string;
	partidaId: string;
	estado: 'borrador' | 'en_revision' | 'emitido';
	ocurrencia: { tipo: 'semana' | 'quincena' | 'dia'; numero: number } | null;
	reprogramacionId: string | null;
	diasEjecucion: { desde: string; hasta: string }[];
}

/** Semana del mes: número de ocurrencia (lunes a domingo) y sus días recortados al mes. */
export interface SemanaDelMes {
	numero: number;
	desde: string;
	hasta: string;
}

export type EstadoSemana = 'ejecutado' | 'pendiente' | 'programado' | 'vencido';
export type DocumentalSemana = 'con_reporte' | 'reporte_en_borrador' | 'sin_reporte';

/** Lo que muestra una partida en una semana de la matriz semanal. */
export interface CeldaSemana {
	estado: EstadoSemana;
	/** «Con reporte», «Borrador», «En revisión», «Sin reporte», «3 de 7 días» o «Realizado sin reporte». */
	documento: string;
	documental: DocumentalSemana;
	/** Reportes de la partida que cuentan en la semana («Visualizar»). */
	reportes: EjecucionDelMes[];
	/** Aclaración para el nombre accesible: «quincena 2», «lo que falta en el mes». */
	detalle: string;
}

type Rango = { desde: string; hasta: string };

function diasEntre(desde: string, hasta: string): string[] {
	const dias: string[] = [];
	const fin = new Date(`${hasta}T00:00:00Z`);
	for (let d = new Date(`${desde}T00:00:00Z`); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
		dias.push(d.toISOString().slice(0, 10));
	}
	return dias;
}

const seTraslapan = (a: Rango, b: Rango) => a.desde <= b.hasta && b.desde <= a.hasta;

/** Un periodo ya pasó, está en curso o es futuro respecto de hoy. */
function momento(rango: Rango, hoy: string): EstadoSemana {
	if (rango.hasta < hoy) return 'vencido';
	return rango.desde <= hoy ? 'pendiente' : 'programado';
}

function documentoDeReportes(
	reportes: readonly EjecucionDelMes[]
): Pick<CeldaSemana, 'documento' | 'documental'> | null {
	if (reportes.some((r) => r.estado === 'emitido'))
		return { documento: 'Con reporte', documental: 'con_reporte' };
	if (reportes.some((r) => r.estado === 'en_revision'))
		return { documento: 'En revisión', documental: 'reporte_en_borrador' };
	if (reportes.length) return { documento: 'Borrador', documental: 'reporte_en_borrador' };
	return null;
}

const SIN_REPORTE = { documento: 'Sin reporte', documental: 'sin_reporte' } as const;

/**
 * Una celda por semana del mes (null si la partida no tiene trabajo en ella), según la periodicidad:
 * - semanal: cada semana es una ocurrencia; con reporte emitido, ejecutada; si no y el mes aún no
 *   cumple lo esperado, vencida, pendiente o programada según la fecha de la semana;
 * - quincenal: cada semana sigue a la quincena de su último día, con la fecha de la quincena;
 * - diaria: los días de la semana cubiertos por emitidos («3 de 7 días»); completa, ejecutada;
 * - las demás (mensual a anual): los reportes con días de ejecución en la semana; lo que falta en el
 *   mes (sin contar lo que cubren los borradores) se ofrece en la semana en curso y las siguientes,
 *   o en la última si el mes ya terminó.
 * Con el mes cumplido, las semanas sin reporte quedan vacías.
 */
export function semanasDePartida(
	periodicidad: string,
	celda: CeldaEvaluable | undefined,
	ejecuciones: readonly EjecucionDelMes[],
	semanas: readonly SemanaDelMes[],
	hoy: string
): (CeldaSemana | null)[] {
	if (!semanas.length) return [];
	const pendiente = !!celda && faltan(celda) > 0;
	const mes: Rango = { desde: semanas[0].desde, hasta: semanas[semanas.length - 1].hasta };

	const conReportes = (
		reportes: EjecucionDelMes[],
		rango: Rango,
		detalle = ''
	): CeldaSemana | null => {
		const documento = documentoDeReportes(reportes);
		if (documento) {
			const estado = documento.documental === 'con_reporte' ? 'ejecutado' : momento(rango, hoy);
			return { estado, ...documento, reportes, detalle };
		}
		return pendiente
			? { estado: momento(rango, hoy), ...SIN_REPORTE, reportes: [], detalle }
			: null;
	};

	if (periodicidad === 'semanal') {
		return semanas.map((s) =>
			conReportes(
				ejecuciones.filter(
					(e) => e.ocurrencia?.tipo === 'semana' && e.ocurrencia.numero === s.numero
				),
				s
			)
		);
	}

	if (periodicidad === 'quincenal') {
		const quincenas = [
			{ numero: 1, desde: mes.desde, hasta: `${mes.desde.slice(0, 8)}15` },
			{ numero: 2, desde: `${mes.desde.slice(0, 8)}16`, hasta: mes.hasta }
		];
		return semanas.map((s) => {
			const q = s.hasta <= quincenas[0].hasta ? quincenas[0] : quincenas[1];
			return conReportes(
				ejecuciones.filter(
					(e) => e.ocurrencia?.tipo === 'quincena' && e.ocurrencia.numero === q.numero
				),
				q,
				`quincena ${q.numero}`
			);
		});
	}

	if (periodicidad === 'diaria') {
		const cubiertos = (estados: EjecucionDelMes['estado'][]) =>
			new Set(
				ejecuciones
					.filter((e) => estados.includes(e.estado))
					.flatMap((e) => e.diasEjecucion.flatMap((r) => diasEntre(r.desde, r.hasta)))
			);
		const emitidos = cubiertos(['emitido']);
		const abiertos = cubiertos(['borrador', 'en_revision']);
		return semanas.map((s) => {
			const dias = diasEntre(s.desde, s.hasta);
			const hechos = dias.filter((d) => emitidos.has(d)).length;
			const enBorrador = dias.filter((d) => !emitidos.has(d) && abiertos.has(d)).length;
			const reportes = ejecuciones.filter((e) => e.diasEjecucion.some((r) => seTraslapan(r, s)));
			const parcial = `${hechos} de ${dias.length} días`;
			if (hechos === dias.length)
				return {
					estado: 'ejecutado',
					documento: 'Con reporte',
					documental: 'con_reporte',
					reportes,
					detalle: parcial
				};
			if (!pendiente) {
				return hechos > 0
					? {
							estado: 'ejecutado',
							documento: parcial,
							documental: 'con_reporte',
							reportes,
							detalle: ''
						}
					: null;
			}
			const estado = momento(s, hoy);
			if (hechos > 0)
				return {
					estado,
					documento: parcial,
					documental: 'reporte_en_borrador',
					reportes,
					detalle: ''
				};
			if (enBorrador > 0)
				return {
					estado,
					documento: 'Borrador',
					documental: 'reporte_en_borrador',
					reportes,
					detalle: ''
				};
			return { estado, ...SIN_REPORTE, reportes, detalle: '' };
		});
	}

	// Mensual a anual: la semana no está planeada; lo que falta se puede hacer en cualquier semana.
	const porSemana = semanas.map((s) =>
		ejecuciones.filter((e) => e.diasEjecucion.some((r) => seTraslapan(r, s)))
	);
	const ninguna = porSemana.every((r) => r.length === 0);
	const mesPasado = mes.hasta < hoy;
	// Los borradores ya cubren parte de lo que falta: solo se ofrece el resto.
	const enCurso = ejecuciones.filter((e) => e.estado !== 'emitido').length;
	const porOfrecer = !!celda && faltan(celda) > enCurso;
	return semanas.map((s, i) => {
		const documento = documentoDeReportes(porSemana[i]);
		if (documento) {
			const estado = documento.documental === 'con_reporte' ? 'ejecutado' : momento(mes, hoy);
			return { estado, ...documento, reportes: porSemana[i], detalle: '' };
		}
		const ultima = i === semanas.length - 1;
		if (porOfrecer) {
			const detalle = 'lo que falta en el mes';
			if (mesPasado)
				return ultima ? { estado: 'vencido', ...SIN_REPORTE, reportes: [], detalle } : null;
			const estado = momento(s, hoy);
			return estado === 'vencido' ? null : { estado, ...SIN_REPORTE, reportes: [], detalle };
		}
		if (ninguna && ultima && celda && celda.realizadoSinReporte > 0) {
			return {
				estado: 'ejecutado',
				documento: 'Realizado sin reporte',
				documental: 'sin_reporte',
				reportes: [],
				detalle: 'registrado sin reporte emitido'
			};
		}
		return null;
	});
}

/**
 * Una celda por día de la semana `semana` (ya recortada al mes) para la vista semanal:
 * - diaria: cada día es una ejecución; cubierto por un emitido, ejecutado; si no y el mes aún no
 *   cumple, vencido, pendiente o programado según la fecha del día;
 * - las demás: los reportes en los días de ejecución que cubren. Lo que falta de su ocurrencia
 *   (la semana para las semanales, la quincena del último día para las quincenales, el mes para las
 *   demás, sin contar lo que cubren los borradores) se ofrece en un solo día: hoy si la semana está
 *   en curso, el último día de la ocurrencia si ya pasó o su primer día si es futura, siempre que
 *   caiga en la semana.
 */
export function diasDePartida(
	periodicidad: string,
	celda: CeldaEvaluable | undefined,
	ejecuciones: readonly EjecucionDelMes[],
	semana: SemanaDelMes,
	hoy: string
): (CeldaSemana | null)[] {
	const dias = diasEntre(semana.desde, semana.hasta);
	const pendiente = !!celda && faltan(celda) > 0;
	const enDia = (dia: string) =>
		ejecuciones.filter((e) => e.diasEjecucion.some((r) => r.desde <= dia && dia <= r.hasta));
	const delDia = (dia: string): Rango => ({ desde: dia, hasta: dia });

	if (periodicidad === 'diaria') {
		return dias.map((dia) => {
			const reportes = enDia(dia);
			const documento = documentoDeReportes(reportes);
			if (documento?.documental === 'con_reporte')
				return { estado: 'ejecutado', ...documento, reportes, detalle: '' };
			if (!pendiente && !documento) return null;
			return {
				estado: momento(delDia(dia), hoy),
				...(documento ?? SIN_REPORTE),
				reportes,
				detalle: ''
			};
		});
	}

	// Ocurrencia a la que pertenece la semana y sus reportes.
	const mesInicio = `${semana.desde.slice(0, 8)}01`;
	const [anio, numeroMes] = mesInicio.split('-').map(Number);
	const mesFin = `${mesInicio.slice(0, 8)}${String(new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate()).padStart(2, '0')}`;
	let ocurrencia: Rango = { desde: mesInicio, hasta: mesFin };
	let propios = [...ejecuciones];
	let detalle = 'lo que falta en el mes';
	if (periodicidad === 'semanal') {
		ocurrencia = semana;
		propios = ejecuciones.filter(
			(e) => e.ocurrencia?.tipo === 'semana' && e.ocurrencia.numero === semana.numero
		);
		detalle = '';
	} else if (periodicidad === 'quincenal') {
		const numero = semana.hasta.slice(8) <= '15' ? 1 : 2;
		ocurrencia =
			numero === 1
				? { desde: mesInicio, hasta: `${mesInicio.slice(0, 8)}15` }
				: { desde: `${mesInicio.slice(0, 8)}16`, hasta: mesFin };
		propios = ejecuciones.filter(
			(e) => e.ocurrencia?.tipo === 'quincena' && e.ocurrencia.numero === numero
		);
		detalle = `quincena ${numero}`;
	}
	const emitidos = propios.filter((e) => e.estado === 'emitido').length;
	const enCurso = propios.length - emitidos;
	const porOfrecer =
		periodicidad === 'semanal' || periodicidad === 'quincenal'
			? pendiente && propios.length === 0
			: !!celda && faltan(celda) > enCurso;
	const enSemana = (dia: string) => dia >= semana.desde && dia <= semana.hasta;
	let diaOferta: string | null = null;
	if (porOfrecer) {
		if (enSemana(hoy)) diaOferta = hoy > ocurrencia.desde ? hoy : ocurrencia.desde;
		else if (semana.hasta < hoy) diaOferta = ocurrencia.hasta;
		else diaOferta = ocurrencia.desde > semana.desde ? ocurrencia.desde : semana.desde;
		if (!enSemana(diaOferta) || diaOferta > ocurrencia.hasta) diaOferta = null;
	}
	// Reportes de la ocurrencia sin días de ejecución: en el primer día de la semana.
	const sinDias = propios.filter((e) => e.diasEjecucion.length === 0);

	return dias.map((dia, i) => {
		const reportes = [...enDia(dia), ...(i === 0 ? sinDias : [])];
		const documento = documentoDeReportes(reportes);
		if (documento) {
			const estado =
				documento.documental === 'con_reporte' ? 'ejecutado' : momento(ocurrencia, hoy);
			return { estado, ...documento, reportes, detalle };
		}
		if (dia === diaOferta)
			return { estado: momento(delDia(dia), hoy), ...SIN_REPORTE, reportes: [], detalle };
		return null;
	});
}

// Tablero (D12, D13).

/** Programa con su contrato, sitio y avance (la lectura de api_obtener_cumplimiento). */
export interface ProgramaCumplimiento {
	contrato: { id: string; numero: string; cliente?: { nombre: string } | null };
	sitio: { id: string; clave: string; nombre: string };
	avance: {
		programa: { id: string; periodoInicio: string; periodoFin: string };
		partidas: {
			id: string;
			numero: string;
			actividad: string;
			periodicidad: string;
			celdas: CeldaEvaluable[];
		}[];
	};
}

const filtrarPeriodicidad = <T extends { periodicidad: string }>(
	partidas: readonly T[],
	periodicidad: string | null
): T[] => (periodicidad ? partidas.filter((p) => p.periodicidad === periodicidad) : [...partidas]);

export function indicadoresDePrograma(
	p: ProgramaCumplimiento,
	corte: string,
	hoy: string,
	periodicidad: string | null = null
): Indicadores {
	return sumarIndicadores(
		filtrarPeriodicidad(p.avance.partidas, periodicidad).map((t) =>
			indicadores(t.celdas, corte, hoy)
		)
	);
}

export interface FilaContrato<P extends ProgramaCumplimiento = ProgramaCumplimiento> {
	contrato: P['contrato'];
	sitios: { programa: P; indicadores: Indicadores }[];
	subtotal: Indicadores;
}

/** Una fila por sitio agrupada por contrato, con subtotales y total. */
export function tablaCumplimiento<P extends ProgramaCumplimiento>(
	programas: readonly P[],
	corte: string,
	hoy: string,
	periodicidad: string | null = null
): { contratos: FilaContrato<P>[]; total: Indicadores } {
	const contratos: FilaContrato<P>[] = [];
	for (const p of programas) {
		let fila = contratos.find((c) => c.contrato.id === p.contrato.id);
		if (!fila) {
			fila = { contrato: p.contrato, sitios: [], subtotal: { ...INDICADORES_VACIOS } };
			contratos.push(fila);
		}
		fila.sitios.push({
			programa: p,
			indicadores: indicadoresDePrograma(p, corte, hoy, periodicidad)
		});
	}
	for (const c of contratos) c.subtotal = sumarIndicadores(c.sitios.map((s) => s.indicadores));
	return { contratos, total: sumarIndicadores(contratos.map((c) => c.subtotal)) };
}

/** Desglose por partida de un programa (con un sitio elegido). */
export function desglosePorPartida<P extends ProgramaCumplimiento>(
	p: P,
	corte: string,
	hoy: string,
	periodicidad: string | null = null
): { partida: P['avance']['partidas'][number]; indicadores: Indicadores }[] {
	return filtrarPeriodicidad(p.avance.partidas, periodicidad).map((partida) => ({
		partida,
		indicadores: indicadores(partida.celdas, corte, hoy)
	}));
}

const mesSiguiente = (mes: string) => {
	const [a, m] = [Number(mes.slice(0, 4)), Number(mes.slice(5, 7))];
	return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
};

/** %cumplimiento y %efectividad de cada mes evaluado, con solo las celdas de ese mes. */
export function tendencia(
	programas: readonly ProgramaCumplimiento[],
	corte: string,
	hoy: string,
	periodicidad: string | null = null
): { mes: string; cumplimiento: number | null; efectividad: number | null }[] {
	const inicio = programas
		.map((p) => `${p.avance.programa.periodoInicio.slice(0, 7)}-01`)
		.sort()[0];
	if (!inicio) return [];
	const meses: string[] = [];
	for (let mes = inicio; mes <= corte; mes = mesSiguiente(mes)) meses.push(mes);
	return meses.map((mes) => {
		const i = sumarIndicadores(
			programas.flatMap((p) =>
				filtrarPeriodicidad(p.avance.partidas, periodicidad).map((t) =>
					indicadores(
						t.celdas.filter((c) => c.mes === mes),
						mes,
						hoy
					)
				)
			)
		);
		const { cumplimiento, efectividad } = porcentajes(i);
		return { mes, cumplimiento, efectividad };
	});
}

export interface ReporteQueFalta {
	contratoId: string;
	sitioId: string;
	sitio: string;
	partidaId: string;
	numero: string;
	actividad: string;
	mes: string;
	cantidad: number;
	/** Borrador más reciente («Continuar borrador»). */
	reporteId: string | null;
}

/**
 * Reportes que faltan en los meses evaluados, cada celda en un solo grupo por precedencia: borradores
 * abiertos, vencidos sin reporte y ejecutados sin reporte; del mes más antiguo al más reciente.
 */
export function reportesQueFaltan(
	programas: readonly ProgramaCumplimiento[],
	corte: string,
	hoy: string,
	periodicidad: string | null = null
): {
	abiertos: ReporteQueFalta[];
	vencidos: ReporteQueFalta[];
	ejecutadosSinReporte: ReporteQueFalta[];
} {
	const grupos = {
		abiertos: [] as ReporteQueFalta[],
		vencidos: [] as ReporteQueFalta[],
		ejecutadosSinReporte: [] as ReporteQueFalta[]
	};
	for (const p of programas) {
		for (const t of filtrarPeriodicidad(p.avance.partidas, periodicidad)) {
			for (const c of t.celdas) {
				if (c.mes > corte) continue;
				const base = {
					contratoId: p.contrato.id,
					sitioId: p.sitio.id,
					sitio: p.sitio.clave,
					partidaId: t.id,
					numero: t.numero,
					actividad: t.actividad,
					mes: c.mes,
					reporteId: null
				};
				const sinCubrir =
					Math.min(ejecutado(c), esperado(c)) - Math.min(c.ejecucionesReportes, esperado(c));
				if (c.reportesAbiertos?.length && (faltan(c) > 0 || sinCubrir > 0)) {
					grupos.abiertos.push({
						...base,
						cantidad: Math.max(faltan(c), sinCubrir),
						reporteId: c.reportesAbiertos[0].id
					});
				} else if (faltan(c) > 0 && mesTerminado(c.mes, hoy)) {
					grupos.vencidos.push({ ...base, cantidad: faltan(c) });
				} else if (sinCubrir > 0) {
					grupos.ejecutadosSinReporte.push({ ...base, cantidad: sinCubrir });
				}
			}
		}
	}
	const orden = (a: ReporteQueFalta, b: ReporteQueFalta) =>
		a.mes.localeCompare(b.mes) ||
		a.sitio.localeCompare(b.sitio) ||
		a.numero.localeCompare(b.numero, 'es', { numeric: true });
	for (const lista of Object.values(grupos)) lista.sort(orden);
	return grupos;
}
