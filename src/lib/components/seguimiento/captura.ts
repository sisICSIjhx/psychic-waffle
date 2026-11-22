// Reglas pequeñas de la pantalla de captura del seguimiento: anclas de cada tarjeta, textos de fecha
// y qué documentos faltan. Sin Zod ni acceso a datos: lo usan los componentes y la ruta.
import type { SubmitFunction } from '@sveltejs/kit';
import type { PartidaDelMes } from '$lib/dominio/seguimiento-operativo';
import type {
	ActividadSeguimiento,
	ConceptoSeguimientoOperativo,
	SeguimientoOperativo
} from '$lib/server/repositorios/seguimiento';

export type Partida = PartidaDelMes<ActividadSeguimiento>;

/**
 * Estado de la captura de toda la página: qué tarjetas están enviando y la última respuesta del
 * servidor con el ancla de la tarjeta a la que corresponde.
 */
export interface EstadoCaptura {
	enviando: readonly string[];
	ancla: string | null;
	/** Acción del último envío («nuevaNocturna», «carpeta»…): dice qué formulario falló. */
	accion?: string | null;
	mensaje?: string;
	error?: string;
}

export const CAPTURA_EN_REPOSO: EstadoCaptura = { enviando: [], ancla: null };

/** Lo que le toca mostrar a una tarjeta: solo la que originó el envío recibe el mensaje. */
export interface ResultadoGuardado {
	fase: 'reposo' | 'enviando' | 'guardado';
	mensaje: string | null;
	error: string | null;
}

export function resultadoDe(captura: EstadoCaptura, ancla: string): ResultadoGuardado {
	const suyo = captura.ancla === ancla;
	const enviando = captura.enviando.includes(ancla);
	const mensaje = suyo && !enviando ? (captura.mensaje ?? null) : null;
	return {
		fase: enviando ? 'enviando' : mensaje ? 'guardado' : 'reposo',
		mensaje,
		error: suyo && !enviando ? (captura.error ?? null) : null
	};
}

/** «Guardado.» → «Guardado»: el texto corto que cabe junto al título de la tarjeta. */
export const textoBreve = (mensaje: string | null) => (mensaje ?? 'Guardado').replace(/\.$/, '');

/** Ejecuta `despues` cuando el envío terminó bien, sin perder lo que hace el `enviar` de la página. */
export function alGuardar(enviar: SubmitFunction, despues: () => void): SubmitFunction {
	return async (entrada) => {
		const fin = await enviar(entrada);
		if (!fin) return;
		return async (salida) => {
			await fin(salida);
			if (salida.result.type === 'success') despues();
		};
	};
}

export type ValorCapturado = SeguimientoOperativo['valores'][number]['valor'];
export type MapaValores = Map<string, ValorCapturado>;

export const claveValor = (actividad: string | null, conceptoId: string) =>
	`${actividad ?? ''}/${conceptoId}`;

/** Un ancla solo lleva letras, cifras, guiones y guiones bajos: sirve de `id` y de fragmento. */
export const ANCLA_VALIDA = /^[\w-]{1,150}$/;

/** Ancla de la tarjeta de una partida: `p-` y su grupo sin signos (`a:…:…` → `a-…-…`). */
export function anclaDePartida(grupo: string): string {
	return `p-${grupo.replace(/[^\w-]/g, '-')}`.slice(0, 150);
}

export const anclaDeCarpeta = (conceptoId: string) => `carpeta-${conceptoId}`;

const MESES_CORTOS = [
	'ene',
	'feb',
	'mar',
	'abr',
	'may',
	'jun',
	'jul',
	'ago',
	'sep',
	'oct',
	'nov',
	'dic'
] as const;

/** «5 nov» a partir de «2026-11-05»; vacío sin fecha. */
export function textoDiaMes(fecha: string | null | undefined): string {
	if (!fecha) return '';
	return `${Number(fecha.slice(8, 10))} ${MESES_CORTOS[Number(fecha.slice(5, 7)) - 1] ?? ''}`.trim();
}

/** Último día de «AAAA-MM» como «AAAA-MM-DD»: el tope de los campos de fecha del mes. */
export function ultimoDiaDelMes(mes: string): string {
	const [anio, numero] = mes.split('-').map(Number);
	const dia = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
	return `${mes}-${String(dia).padStart(2, '0')}`;
}

/** Mes vecino de «AAAA-MM». */
export function mesVecino(mes: string, pasos: number): string {
	const [anio, numero] = mes.split('-').map(Number);
	const total = anio * 12 + (numero - 1) + pasos;
	return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Un documento es lo que se marca como hecho: casilla o estado, sin indicador propio. */
export function esDocumento(concepto: ConceptoSeguimientoOperativo): boolean {
	return (concepto.tipo === 'casilla' || concepto.tipo === 'estado') && concepto.indicador === null;
}

export function valorHecho(concepto: ConceptoSeguimientoOperativo, valor: ValorCapturado): boolean {
	return concepto.tipo === 'casilla' ? valor === true : valor === 'hecho';
}

export interface AvanceDocumentos {
	esperados: number;
	hechos: number;
}

/**
 * Documentos esperados contra hechos, con la misma regla del estatus: los de cada actividad
 * ejecutada, los de cada partida con alguna ejecución y los del mes una vez. Los «por definir» y los
 * que alimentan un indicador no cuentan.
 */
export function avanceDeDocumentos(
	conceptos: readonly ConceptoSeguimientoOperativo[],
	partidas: readonly { primera: string; actividades: readonly ActividadSeguimiento[] }[],
	valores: MapaValores
): AvanceDocumentos {
	let esperados = 0;
	let hechos = 0;
	const contar = (concepto: ConceptoSeguimientoOperativo, actividad: string | null) => {
		esperados++;
		if (valorHecho(concepto, valores.get(claveValor(actividad, concepto.id)) ?? null)) hechos++;
	};
	for (const concepto of conceptos) {
		if (!esDocumento(concepto) || concepto.porDefinir) continue;
		if (concepto.nivel === 'periodo') contar(concepto, null);
		for (const partida of partidas) {
			const ejecutadas = partida.actividades.filter((a) => a.ejecutada);
			if (concepto.nivel === 'partida' && ejecutadas.length) contar(concepto, partida.primera);
			if (concepto.nivel === 'actividad') for (const a of ejecutadas) contar(concepto, a.clave);
		}
	}
	return { esperados, hechos };
}

export interface AvancePartida {
	programadas: number;
	ejecutadas: number;
	faltanDocumentos: number;
	/** Todo ejecutado y con todos sus documentos. */
	completa: boolean;
}

/** Lo ejecutado y lo que falta de una partida, con los documentos que se marcan en ella. */
export function avanceDePartida(
	partida: Partida,
	conceptos: readonly ConceptoSeguimientoOperativo[],
	valores: MapaValores
): AvancePartida {
	const programadas = partida.actividades.filter((a) => a.programada);
	const ejecutadas = programadas.filter((a) => a.ejecutada).length;
	const documentos = avanceDeDocumentos(conceptos, [partida], valores);
	const faltanDocumentos = documentos.esperados - documentos.hechos;
	return {
		programadas: programadas.length,
		ejecutadas,
		faltanDocumentos,
		completa: programadas.length > 0 && ejecutadas === programadas.length && faltanDocumentos === 0
	};
}

/**
 * Partidas en el orden en que se conocen: las del programa por su número («2 · …» antes de
 * «12 · …») y, después, las escritas a mano en el orden en que se agregaron.
 */
export function ordenarPartidas(partidas: readonly Partida[]): Partida[] {
	const delPrograma = partidas
		.filter((p) => !p.manual)
		.sort((a, b) => a.partida.localeCompare(b.partida, 'es', { numeric: true }));
	return [...delPrograma, ...partidas.filter((p) => p.manual)];
}

/** Hasta cuántas ejecuciones pendientes se muestran desplegadas sin que la página se alargue. */
export const MAX_EJECUCIONES_ABIERTAS = 8;

/**
 * Partidas que se muestran abiertas al cargar. Con poco pendiente, todas las que tienen algo por
 * hacer; con mucho (un programa con decenas de ejecuciones), solo las que ya se empezaron o tienen
 * una ejecución prevista para hoy y, si no hay ninguna, la primera pendiente. Las demás quedan
 * plegadas con su resumen, a un toque.
 */
export function partidasAbiertas(
	partidas: readonly Partida[],
	conceptos: readonly ConceptoSeguimientoOperativo[],
	valores: MapaValores,
	hoy: string
): Set<string> {
	const pendientes = partidas.filter((p) => !avanceDePartida(p, conceptos, valores).completa);
	const ejecuciones = pendientes.reduce((suma, p) => suma + p.actividades.length, 0);
	if (ejecuciones <= MAX_EJECUCIONES_ABIERTAS) return new Set(pendientes.map((p) => p.grupo));
	const enCurso = pendientes.filter(
		(p) => p.ejecutadas > 0 || p.actividades.some((a) => a.fecha === hoy && !a.ejecutada)
	);
	return new Set((enCurso.length ? enCurso : pendientes.slice(0, 1)).map((p) => p.grupo));
}
