// Estatus de un centro de costo en un mes (cambio kpi-estatus-centros, D8 y D9): indicadores, estatus
// general y «qué falta», a partir del resumen que entrega `api_estatus_centros`. Funciones puras y
// sin Zod: las usan el servidor y los componentes del navegador.
import type { EstadoCarpeta, OrigenActividades } from './constantes.ts';
import { textoMonto } from './cobranza.ts';
import { porcentaje, semaforo, UMBRALES, type Semaforo } from './cumplimiento.ts';

/** Niveles en que se espera un documento: cada ejecución, cada partida o una vez al mes. */
export type NivelDocumento = 'actividad' | 'partida' | 'periodo';

/** Lo que un centro de costo tiene hecho y pendiente en un mes; una fila de `api_estatus_centros`. */
export interface ResumenCentro {
	sitioId: string;
	plantillaId: string | null;
	origen: OrigenActividades;
	/** El mes consultado ya terminó: lo que falte ejecutar ya es atraso, no trabajo en curso. */
	mesTerminado: boolean;
	/** Actividades del mes (programa anual + escritas a mano). */
	actividades: { programadas: number; ejecutadas: number; cobradas: number | null };
	/** null si la plantilla no tiene los indicadores de EM. */
	em: { programadas: number | null; realizadas: number | null; cobradas: number | null } | null;
	/** Casillas y estados esperados contra hechos, sin conceptos por definir ni con indicador. */
	documentos: {
		esperados: number;
		hechos: number;
		faltantes: { conceptoId: string; etiqueta: string; nivel: NivelDocumento; faltan: number }[];
	};
	carpetas: { conceptoId: string; etiqueta: string; estado: EstadoCarpeta; porDefinir: boolean }[];
	emergencias: number;
	/** Solo con la capacidad `verContrato`; ausente en otro caso. */
	finanzas?: {
		montoContrato: number | null;
		/** Suma de la cobranza mensual de todos los años; lo de los adicionales va aparte. */
		cobrado: number;
		facturado: number | null;
		mes: { estimacion: boolean; prefactura: boolean; factura: boolean; cobrado: boolean };
		adicionales: { cantidad: number; pactado: number; cobrado: number };
		contratoVencido: boolean;
		cartaFaltante: boolean;
		datosContrato: { esperados: number; capturados: number };
	};
}

/** Avance del programa anual acumulado al corte (lo calcula `dominio/concentrado.ts`). */
export interface AvancePrograma {
	planeado: number;
	ejecutado: number;
	/** Porcentaje sin redondear; null sin nada que medir. */
	avance: number | null;
}

export type ClaveKpi =
	| 'ejecucion'
	| 'em'
	| 'documentos'
	| 'carpetas'
	| 'cobranza'
	| 'cobro'
	| 'contrato';

export interface Kpi {
	clave: ClaveKpi;
	etiqueta: string;
	valor: number;
	/** Contra qué se mide; 0 si todavía no hay denominador. */
	total: number;
	/** Sin redondear; null sin denominador. */
	porcentaje: number | null;
	/** null: indicador informativo, no cambia el estatus. */
	semaforo: Semaforo | null;
	detalle: string;
	/** Solo en ejecución: actividades del mes o programa anual acumulado al corte. */
	alcance?: 'mes' | 'ciclo';
	/** Los valores son dinero (cobranza). */
	esMonto?: boolean;
}

export type EstatusCentro = 'atrasado' | 'con_pendientes' | 'al_corriente' | 'sin_datos';

/** Del más urgente al que no tiene qué medir: el orden del tablero. */
export const ESTATUS_CENTRO: readonly EstatusCentro[] = [
	'atrasado',
	'con_pendientes',
	'al_corriente',
	'sin_datos'
];

export const ETIQUETA_ESTATUS: Record<EstatusCentro, string> = {
	atrasado: 'Atrasado',
	con_pendientes: 'Con pendientes',
	al_corriente: 'Al corriente',
	sin_datos: 'Sin datos'
};

export const AYUDA_ESTATUS: Record<EstatusCentro, string> = {
	atrasado: 'Hay trabajo vencido o falta la carta de finalización.',
	con_pendientes: 'Hay cosas por hacer este mes.',
	al_corriente: 'Todo lo del mes está hecho.',
	sin_datos: 'Todavía no hay nada que medir en este mes.'
};

export const ETIQUETA_KPI: Record<ClaveKpi, string> = {
	ejecucion: 'Ejecución',
	em: 'Estaciones de medición',
	documentos: 'Documentos',
	carpetas: 'Carpetas',
	cobranza: 'Cobranza',
	cobro: 'Cobro de EM',
	contrato: 'Contrato'
};

// -------------------------------------------------------------------------------------------------
// Frases: singular y plural
// -------------------------------------------------------------------------------------------------

const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const faltan = (n: number, uno: string, varios: string) =>
	`${n === 1 ? 'Falta' : 'Faltan'} ${cuantos(n, uno, varios)}`;

const VOCAL = /[aeiouáéíóú]/i;
const ACENTO: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
const SIN_ACENTO: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
/** Palabras que cortan la concordancia: lo que sigue ya no es el nombre ni su adjetivo. */
const ENLACES = new Set([
	'de',
	'del',
	'la',
	'el',
	'los',
	'las',
	'y',
	'o',
	'a',
	'en',
	'por',
	'para'
]);

const esSigla = (palabra: string) => /^[A-ZÁÉÍÓÚÑ0-9]{2,}$/.test(palabra);
const esPalabra = (palabra: string) => /^[a-záéíóúüñ]+$/i.test(palabra);

/** Plural de una palabra española en singular: «reporte» → «reportes», «dictamen» → «dictámenes». */
function pluralDePalabra(palabra: string): string {
	const ultima = palabra.at(-1)!.toLowerCase();
	if ('aeiouáéó'.includes(ultima)) return `${palabra}s`;
	if (ultima === 'z') return `${palabra.slice(0, -1)}ces`;
	// Aguda con tilde: «reducción» → «reducciones».
	const penultima = palabra.at(-2)?.toLowerCase() ?? '';
	if ((ultima === 'n' || ultima === 's') && penultima in SIN_ACENTO) {
		return `${palabra.slice(0, -2)}${SIN_ACENTO[penultima]}${ultima}es`;
	}
	// Llana terminada en «n» sin tilde: al crecer se vuelve esdrújula («orden» → «órdenes»).
	if (ultima === 'n' && !/[áéíóú]/i.test(palabra)) {
		const nucleos = [...palabra.matchAll(/[aeiou]+/gi)];
		const tonico = nucleos.at(-2);
		if (tonico) {
			const grupo = tonico[0];
			// En un diptongo la tilde va en la vocal abierta; entre cerradas, en la segunda.
			const abierta = grupo.search(/[aeo]/i);
			const indice = tonico.index + (abierta >= 0 ? abierta : grupo.length - 1);
			return `${palabra.slice(0, indice)}${ACENTO[palabra[indice].toLowerCase()]}${palabra.slice(indice + 1)}es`;
		}
	}
	return `${palabra}es`;
}

/**
 * Cómo se nombra el concepto dentro de una frase. Una sigla no cambia; una etiqueta en singular se
 * pasa a plural junto con su adjetivo («reportes fotográficos»); una que ya está en plural
 * («Bitácoras», «Hojas de verificación») nombra un juego de documentos y no se cuenta por piezas.
 */
function nombreDeConcepto(etiqueta: string): { singular: string | null; plural: string } {
	const palabras = etiqueta.trim().split(/\s+/);
	const [primera] = palabras;
	if (esSigla(primera)) return { singular: etiqueta.trim(), plural: etiqueta.trim() };
	const enMinuscula = [primera.charAt(0).toLowerCase() + primera.slice(1), ...palabras.slice(1)];
	if (!esPalabra(primera) || /s$/i.test(primera) || !VOCAL.test(primera)) {
		return { singular: null, plural: enMinuscula.join(' ') };
	}
	const plural: string[] = [];
	let concuerda = true;
	for (const palabra of enMinuscula) {
		concuerda &&= esPalabra(palabra) && !esSigla(palabra) && !ENLACES.has(palabra.toLowerCase());
		plural.push(concuerda && !/s$/i.test(palabra) ? pluralDePalabra(palabra) : palabra);
	}
	return { singular: enMinuscula.join(' '), plural: plural.join(' ') };
}

const DONDE_FALTA: Record<NivelDocumento, [string, string] | null> = {
	actividad: ['actividad', 'actividades'],
	partida: ['partida', 'partidas'],
	periodo: null
};

/** «Faltan 3 reportes», «Falta 1 ODT», «Faltan bitácoras en 2 actividades». */
export function fraseDocumentoFaltante(falta: {
	etiqueta: string;
	nivel: NivelDocumento;
	faltan: number;
}): string {
	const nombre = nombreDeConcepto(falta.etiqueta);
	if (nombre.singular !== null) return faltan(falta.faltan, nombre.singular, nombre.plural);
	const donde = DONDE_FALTA[falta.nivel];
	return donde
		? `Faltan ${nombre.plural} en ${cuantos(falta.faltan, ...donde)}`
		: `Faltan ${nombre.plural} del mes`;
}

/** «Carpeta de seguridad», o la etiqueta tal cual si ya dice «Carpeta…». */
export function nombreDeCarpeta(etiqueta: string): string {
	const limpia = etiqueta.trim();
	if (/^carpetas?\b/i.test(limpia)) return limpia.charAt(0).toUpperCase() + limpia.slice(1);
	const [primera] = limpia.split(/\s+/);
	return `Carpeta de ${esSigla(primera) ? limpia : limpia.charAt(0).toLowerCase() + limpia.slice(1)}`;
}

// -------------------------------------------------------------------------------------------------
// Indicadores
// -------------------------------------------------------------------------------------------------

const UMBRAL = UMBRALES.cumplimiento;

/** Con el mes en curso lo que falta todavía no es atraso: completo o con pendientes. */
function semaforoDelMes(valor: number, total: number, mesTerminado: boolean): Semaforo | null {
	if (total <= 0) return null;
	if (mesTerminado) return semaforo(porcentaje(valor, total), UMBRAL);
	return valor >= total ? 'verde' : 'amarillo';
}

/** Carpetas que cuentan: las que ya se sabe cómo son. */
const carpetasDefinidas = (resumen: ResumenCentro) => resumen.carpetas.filter((c) => !c.porDefinir);

const PASO_DEL_MES: [keyof NonNullable<ResumenCentro['finanzas']>['mes'], string][] = [
	['cobrado', 'cobrado'],
	['factura', 'con factura'],
	['prefactura', 'con prefactura'],
	['estimacion', 'con estimación']
];

const SIGUIENTE_PASO: Record<string, string> = {
	estimacion: 'Falta la prefactura del mes',
	prefactura: 'Falta la factura del mes',
	factura: 'Falta registrar el cobro del mes'
};

/**
 * Siguiente paso de una cobranza ya empezada y sin cobrar; null si el mes está cobrado o si todavía
 * no se registra nada (no se sabe si ese mes se cobra).
 */
export function siguientePasoDeCobranza(
	mes: NonNullable<ResumenCentro['finanzas']>['mes']
): string | null {
	if (mes.cobrado) return null;
	const ultimo = PASO_DEL_MES.find(([paso]) => mes[paso])?.[0];
	return ultimo ? SIGUIENTE_PASO[ultimo] : null;
}

/** Hasta dónde llegó la cobranza del mes: «cobrado», «con factura»… o «sin estimación». */
export function pasoDeCobranza(mes: NonNullable<ResumenCentro['finanzas']>['mes']): string {
	return PASO_DEL_MES.find(([paso]) => mes[paso])?.[1] ?? 'sin estimación';
}

/**
 * Indicadores que aplican al centro, en el orden en que se leen. `avance` es el del programa anual
 * acumulado al corte, si el centro tiene programa; sin él, la ejecución es la del mes.
 */
export function kpisDeCentro(resumen: ResumenCentro, avance: AvancePrograma | null = null): Kpi[] {
	const kpis: Kpi[] = [];
	const { actividades, em, documentos, finanzas } = resumen;
	const delMes = `${actividades.ejecutadas} de ${cuantos(actividades.programadas, 'actividad', 'actividades')} del mes`;

	if (avance && avance.planeado > 0) {
		kpis.push({
			clave: 'ejecucion',
			etiqueta: ETIQUETA_KPI.ejecucion,
			valor: avance.ejecutado,
			total: avance.planeado,
			porcentaje: avance.avance,
			semaforo: semaforo(avance.avance, UMBRAL),
			detalle: actividades.programadas
				? `Programa anual, acumulado al corte · ${delMes}`
				: 'Programa anual, acumulado al corte',
			alcance: 'ciclo'
		});
	} else if (actividades.programadas > 0) {
		kpis.push({
			clave: 'ejecucion',
			etiqueta: ETIQUETA_KPI.ejecucion,
			valor: actividades.ejecutadas,
			total: actividades.programadas,
			porcentaje: porcentaje(actividades.ejecutadas, actividades.programadas),
			semaforo: semaforoDelMes(
				actividades.ejecutadas,
				actividades.programadas,
				resumen.mesTerminado
			),
			detalle: `${delMes} ejecutadas`,
			alcance: 'mes'
		});
	}

	if (em) {
		const realizadas = em.realizadas ?? 0;
		const programadas = em.programadas ?? 0;
		kpis.push({
			clave: 'em',
			etiqueta: ETIQUETA_KPI.em,
			valor: realizadas,
			total: programadas,
			porcentaje: porcentaje(realizadas, programadas),
			semaforo: semaforoDelMes(realizadas, programadas, resumen.mesTerminado),
			detalle: programadas
				? `${realizadas} de ${programadas} EM realizadas`
				: 'Sin EM programadas en el mes'
		});
	}

	if (documentos.esperados > 0) {
		kpis.push({
			clave: 'documentos',
			etiqueta: ETIQUETA_KPI.documentos,
			valor: documentos.hechos,
			total: documentos.esperados,
			porcentaje: porcentaje(documentos.hechos, documentos.esperados),
			// Un documento que falta es un pendiente, no un atraso.
			semaforo: documentos.hechos >= documentos.esperados ? 'verde' : 'amarillo',
			detalle: `${documentos.hechos} de ${cuantos(documentos.esperados, 'documento', 'documentos')}`
		});
	}

	const carpetas = carpetasDefinidas(resumen);
	if (carpetas.length) {
		const recibidas = carpetas.filter((c) => c.estado === 'recibida').length;
		const entregadas = carpetas.filter(
			(c) => c.estado === 'entregada' || c.estado === 'recibida_comentarios'
		).length;
		kpis.push({
			clave: 'carpetas',
			etiqueta: ETIQUETA_KPI.carpetas,
			valor: recibidas,
			total: carpetas.length,
			porcentaje: porcentaje(recibidas, carpetas.length),
			// Por conteo de estados, no por umbral: mientras no estén todas recibidas hay pendientes.
			semaforo: recibidas === carpetas.length ? 'verde' : 'amarillo',
			detalle:
				`${recibidas} de ${carpetas.length} ${recibidas === 1 ? 'recibida' : 'recibidas'} correctamente` +
				(entregadas ? ` · ${cuantos(entregadas, 'entregada', 'entregadas')}` : '')
		});
	}

	if (finanzas) {
		const monto = finanzas.montoContrato ?? 0;
		kpis.push({
			clave: 'cobranza',
			etiqueta: ETIQUETA_KPI.cobranza,
			valor: finanzas.cobrado,
			total: monto,
			porcentaje: porcentaje(finanzas.cobrado, monto),
			semaforo: null,
			detalle:
				`Mes ${pasoDeCobranza(finanzas.mes)}` +
				(finanzas.adicionales.cantidad
					? ` · adicionales: ${textoMonto(finanzas.adicionales.cobrado)} de ${textoMonto(finanzas.adicionales.pactado)}`
					: ''),
			esMonto: true
		});
	}

	// Cuántas de las EM (o de las actividades) realizadas llevan cobro: informativo.
	if (em && em.cobradas !== null) {
		const realizadas = em.realizadas ?? 0;
		kpis.push({
			clave: 'cobro',
			etiqueta: ETIQUETA_KPI.cobro,
			valor: em.cobradas,
			total: realizadas,
			porcentaje: porcentaje(em.cobradas, realizadas),
			semaforo: null,
			detalle: `${em.cobradas} de ${realizadas} EM realizadas con cobro`
		});
	} else if (actividades.cobradas !== null && actividades.ejecutadas > 0) {
		kpis.push({
			clave: 'cobro',
			etiqueta: 'Cobro de actividades',
			valor: actividades.cobradas,
			total: actividades.ejecutadas,
			porcentaje: porcentaje(actividades.cobradas, actividades.ejecutadas),
			semaforo: null,
			detalle: `${actividades.cobradas} de ${cuantos(actividades.ejecutadas, 'actividad ejecutada', 'actividades ejecutadas')} con cobro`
		});
	}

	if (finanzas) {
		const { esperados, capturados } = finanzas.datosContrato;
		const pendientes = Math.max(0, esperados - capturados);
		if (esperados > 0 || finanzas.cartaFaltante || finanzas.contratoVencido) {
			kpis.push({
				clave: 'contrato',
				etiqueta: ETIQUETA_KPI.contrato,
				valor: Math.min(capturados, esperados),
				total: esperados,
				porcentaje: porcentaje(Math.min(capturados, esperados), esperados),
				semaforo: finanzas.cartaFaltante ? 'rojo' : pendientes ? 'amarillo' : 'verde',
				detalle: finanzas.cartaFaltante
					? 'Contrato terminado: falta la carta de finalización'
					: pendientes
						? faltan(pendientes, 'dato del contrato', 'datos del contrato')
						: finanzas.contratoVencido
							? 'Contrato terminado, con carta de finalización'
							: 'Datos del contrato completos'
			});
		}
	}
	return kpis;
}

// -------------------------------------------------------------------------------------------------
// Qué falta
// -------------------------------------------------------------------------------------------------

/** Secciones a las que lleva un pendiente; la pantalla las usa como ancla (`#actividades`…). */
export type AnclaPendiente =
	| 'actividades'
	| 'carpetas'
	| 'emergencias'
	| 'contrato'
	| 'carta'
	| 'cobranza'
	| 'adicionales';

/** Un pendiente en palabras del usuario y el lugar donde se resuelve. */
export interface Pendiente {
	texto: string;
	destino: 'seguimiento' | 'cobranza';
	ancla?: AnclaPendiente;
	/** Concepto de la plantilla (documento o carpeta) al que se refiere. */
	conceptoId?: string;
}

export const MAX_PENDIENTES = 5;

/** Todo lo que falta, del más urgente al menos, sin recortar. */
export function pendientesDeCentro(resumen: ResumenCentro): Pendiente[] {
	const lista: Pendiente[] = [];
	const { actividades, em, documentos, finanzas } = resumen;
	const carpetas = carpetasDefinidas(resumen);
	const deCarpetas = (estados: EstadoCarpeta[], frase: (nombre: string) => string) =>
		carpetas
			.filter((c) => estados.includes(c.estado))
			.map(
				(c): Pendiente => ({
					texto: frase(nombreDeCarpeta(c.etiqueta)),
					destino: 'seguimiento',
					ancla: 'carpetas',
					conceptoId: c.conceptoId
				})
			);

	if (finanzas?.cartaFaltante) {
		lista.push({ texto: 'Falta la carta de finalización', destino: 'cobranza', ancla: 'carta' });
	}
	const porEjecutar = actividades.programadas - actividades.ejecutadas;
	if (porEjecutar > 0) {
		lista.push({
			texto: faltan(porEjecutar, 'actividad por ejecutar', 'actividades por ejecutar'),
			destino: 'seguimiento',
			ancla: 'actividades'
		});
	}
	const emPorRealizar = (em?.programadas ?? 0) - (em?.realizadas ?? 0);
	if (em && em.programadas === null) {
		lista.push({
			texto: 'Faltan las EM programadas del mes',
			destino: 'seguimiento',
			ancla: 'actividades'
		});
	} else if (emPorRealizar > 0) {
		lista.push({
			texto: faltan(emPorRealizar, 'EM por realizar', 'EM por realizar'),
			destino: 'seguimiento',
			ancla: 'actividades'
		});
	}
	// Una carpeta devuelta con comentarios espera correcciones: va antes que lo demás de papelería.
	lista.push(
		...deCarpetas(
			['recibida_comentarios'],
			(c) => `${c} con comentarios: falta corregirla y entregarla de nuevo`
		)
	);
	lista.push(
		...[...documentos.faltantes]
			.sort((a, b) => b.faltan - a.faltan)
			.map(
				(falta): Pendiente => ({
					texto: fraseDocumentoFaltante(falta),
					destino: 'seguimiento',
					ancla: 'actividades',
					conceptoId: falta.conceptoId
				})
			)
	);
	lista.push(...deCarpetas(['pendiente', 'en_proceso'], (c) => `${c} sin entregar`));
	lista.push(...deCarpetas(['entregada'], (c) => `${c} entregada: falta que la reciban`));
	if (finanzas) {
		const paso = siguientePasoDeCobranza(finanzas.mes);
		if (paso) lista.push({ texto: paso, destino: 'cobranza', ancla: 'cobranza' });
		const datos = finanzas.datosContrato.esperados - finanzas.datosContrato.capturados;
		if (datos > 0) {
			lista.push({
				texto: faltan(datos, 'dato del contrato', 'datos del contrato'),
				destino: 'cobranza',
				ancla: 'contrato'
			});
		}
	}
	return lista;
}

/**
 * Lo que falta para estar al corriente, por urgencia: hasta cinco pendientes y, si hay más, un
 * último «y N más» que lleva al seguimiento del centro.
 */
export function queFalta(resumen: ResumenCentro, maximo = MAX_PENDIENTES): Pendiente[] {
	const todos = pendientesDeCentro(resumen);
	if (todos.length <= maximo) return todos;
	return [
		...todos.slice(0, maximo),
		{ texto: `y ${todos.length - maximo} más`, destino: 'seguimiento' }
	];
}

// -------------------------------------------------------------------------------------------------
// Estatus general
// -------------------------------------------------------------------------------------------------

/** Indicadores del trabajo del mes: los ve cualquier rol y deciden si hay algo que medir. */
const KPI_OPERATIVOS: readonly ClaveKpi[] = ['ejecucion', 'em', 'documentos', 'carpetas'];

/**
 * Atrasado: algún indicador en rojo o falta la carta de finalización. Sin datos: ningún indicador
 * operativo (ejecución, EM, documentos, carpetas) tiene contra qué medirse. Con pendientes: algún
 * indicador en amarillo o algo en «qué falta». Al corriente: nada de lo anterior, con la lista de
 * pendientes vacía.
 */
export function estatusDeCentro(kpis: readonly Kpi[], resumen: ResumenCentro): EstatusCentro {
	if (resumen.finanzas?.cartaFaltante || kpis.some((k) => k.semaforo === 'rojo')) return 'atrasado';
	if (!kpis.some((k) => KPI_OPERATIVOS.includes(k.clave) && k.total > 0)) return 'sin_datos';
	if (kpis.some((k) => k.semaforo === 'amarillo') || pendientesDeCentro(resumen).length) {
		return 'con_pendientes';
	}
	return 'al_corriente';
}

export interface EstatusDeCentro {
	estatus: EstatusCentro;
	kpis: Kpi[];
	falta: Pendiente[];
}

/** Todo junto, para una tarjeta del tablero o la ficha del centro. */
export function resumirCentro(
	resumen: ResumenCentro,
	avance: AvancePrograma | null = null
): EstatusDeCentro {
	const kpis = kpisDeCentro(resumen, avance);
	return { estatus: estatusDeCentro(kpis, resumen), kpis, falta: queFalta(resumen) };
}
