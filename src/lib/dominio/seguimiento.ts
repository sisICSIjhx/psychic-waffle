// Reglas y etiquetas de las plantillas de seguimiento por centro de costo (cambio
// centros-costo-plantillas, D3 y D4). Reflejan las validaciones de la base para que la interfaz solo
// ofrezca combinaciones válidas. Sin Zod: lo usan los componentes del navegador.
import type {
	BloqueSeguimiento,
	IndicadorConcepto,
	ModoContrato,
	NivelConcepto,
	OrigenActividades,
	TipoConcepto
} from './constantes.ts';
import { BLOQUES_SEGUIMIENTO, INDICADORES_CONCEPTO, TIPOS_CONCEPTO } from './constantes.ts';

export const ETIQUETA_BLOQUE: Record<BloqueSeguimiento, string> = {
	contrato: 'Contrato',
	ordenes_compra: 'Órdenes de compra',
	programa: 'Programa y actividades',
	documentos: 'Documentos',
	carpetas: 'Carpetas'
};

export const AYUDA_BLOQUE: Record<BloqueSeguimiento, string> = {
	contrato: 'Datos del contrato: número, enlace, periodicidad, montos.',
	ordenes_compra: 'Datos de cada orden de compra, incluidas las adicionales.',
	programa: 'Cantidades del mes (por periodo), de cada actividad o de cada partida.',
	documentos: 'Casillas de cada ejecución (ODT, AST, PT…) o de cada partida (reporte).',
	carpetas: 'Entregas por periodo: quién entrega, quién recibe, fechas y acuse de recibido.'
};

export const ETIQUETA_TIPO: Record<TipoConcepto, string> = {
	casilla: 'Casilla (hecho)',
	estado: 'Estado (pendiente, en proceso, hecho)',
	cantidad: 'Cantidad',
	monto: 'Monto',
	enlace: 'Enlace',
	fecha: 'Fecha',
	texto: 'Texto',
	carpeta: 'Entrega de carpeta'
};

export const ETIQUETA_NIVEL: Record<NivelConcepto, string> = {
	contrato: 'Por contrato',
	orden_compra: 'Por orden de compra',
	periodo: 'Por mes',
	actividad: 'Por actividad',
	partida: 'Por partida'
};

/** Qué mide el concepto para los indicadores del centro de costo (cambio kpi-estatus-centros, D1). */
export const ETIQUETA_INDICADOR: Record<IndicadorConcepto, string> = {
	monto_contrato: 'Monto del contrato',
	monto_cobrado: 'Monto cobrado',
	monto_facturado: 'Monto facturado',
	periodicidad: 'Periodicidad',
	em_programadas: 'EM programadas',
	em_realizadas: 'EM realizadas',
	em_cobradas: 'EM con cobro',
	actividad_cobrada: 'Actividad cobrada'
};

/** Dónde tiene sentido cada indicador; la base valida lo mismo (`indicador_valido`). */
const DONDE_INDICADOR: Record<
	IndicadorConcepto,
	readonly [BloqueSeguimiento, TipoConcepto, NivelConcepto]
> = {
	monto_contrato: ['contrato', 'monto', 'contrato'],
	monto_cobrado: ['contrato', 'monto', 'contrato'],
	monto_facturado: ['contrato', 'monto', 'contrato'],
	periodicidad: ['contrato', 'texto', 'contrato'],
	em_programadas: ['programa', 'cantidad', 'periodo'],
	em_realizadas: ['programa', 'cantidad', 'periodo'],
	em_cobradas: ['programa', 'cantidad', 'periodo'],
	actividad_cobrada: ['programa', 'casilla', 'actividad']
};

/** Indicadores que puede declarar un concepto con ese bloque, tipo y nivel. */
export function indicadoresDeConcepto(
	bloque: BloqueSeguimiento,
	tipo: TipoConcepto,
	nivel: NivelConcepto
): IndicadorConcepto[] {
	return INDICADORES_CONCEPTO.filter((indicador) => {
		const [b, t, n] = DONDE_INDICADOR[indicador];
		return b === bloque && t === tipo && n === nivel;
	});
}

export const ETIQUETA_MODO_CONTRATO: Record<ModoContrato, string> = {
	obligatorio: 'Contrato obligatorio',
	opcional: 'Contrato opcional',
	sin_contrato: 'Sin contrato'
};

export const ETIQUETA_ORIGEN: Record<OrigenActividades, string> = {
	programa_anual: 'Del programa anual',
	mensual: 'Capturadas cada mes',
	ninguno: 'Sin actividades programadas'
};

/** Niveles que admite un bloque; el primero es el que se usa por omisión. */
export function nivelesDeBloque(bloque: BloqueSeguimiento): NivelConcepto[] {
	switch (bloque) {
		case 'contrato':
			return ['contrato'];
		case 'ordenes_compra':
			return ['orden_compra'];
		case 'programa':
			return ['periodo', 'actividad', 'partida'];
		case 'documentos':
			return ['actividad', 'partida'];
		case 'carpetas':
			return ['periodo'];
	}
}

/** Tipos que admite un bloque: las carpetas solo son entregas, y nadie más usa ese tipo. */
export function tiposDeBloque(bloque: BloqueSeguimiento): TipoConcepto[] {
	return bloque === 'carpetas' ? ['carpeta'] : TIPOS_CONCEPTO.filter((t) => t !== 'carpeta');
}

export function conceptoValido(
	bloque: BloqueSeguimiento,
	tipo: TipoConcepto,
	nivel: NivelConcepto
): boolean {
	return tiposDeBloque(bloque).includes(tipo) && nivelesDeBloque(bloque).includes(nivel);
}

/** Bloques que aplica una plantilla: los que tienen al menos un concepto, en el orden del plan. */
export function bloquesAplicados(conceptos: { bloque: BloqueSeguimiento }[]): BloqueSeguimiento[] {
	const presentes = new Set(conceptos.map((c) => c.bloque));
	return BLOQUES_SEGUIMIENTO.filter((b) => presentes.has(b));
}

/**
 * Estado del contrato de un centro de costo para la lista: sin plantilla no se exige nada; con una
 * plantilla que exige contrato y ninguno asociado, falta registrarlo.
 */
export function estadoContratoCentro(centro: {
	plantilla: { modoContrato: ModoContrato } | null;
	contratos: unknown[];
}): 'con_contrato' | 'pendiente' | 'sin_contrato' {
	if (centro.contratos.length > 0) return 'con_contrato';
	return centro.plantilla?.modoContrato === 'obligatorio' ? 'pendiente' : 'sin_contrato';
}
