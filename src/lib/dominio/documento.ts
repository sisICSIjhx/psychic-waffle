// Reglas puras del reporte FOR-ICSI-RMT-01: título, periodo, numeración de ilustraciones,
// agrupación de fotos por disposición, secciones y nombre de archivo.

export const MESES = [
	'ENERO',
	'FEBRERO',
	'MARZO',
	'ABRIL',
	'MAYO',
	'JUNIO',
	'JULIO',
	'AGOSTO',
	'SEPTIEMBRE',
	'OCTUBRE',
	'NOVIEMBRE',
	'DICIEMBRE'
] as const;

export type DisposicionFotos = 'cuadricula' | 'antes_durante_despues';
export type MomentoFoto = 'antes' | 'durante' | 'despues';
export type EstadoVerificacion = 'pendiente' | 'ok' | 'no_aplica' | 'con_observacion';

export interface Ocurrencia {
	tipo: 'semana' | 'quincena' | 'dia';
	numero: number;
}

export interface Periodo {
	anio: number;
	/** 1 a 12 */
	mes: number;
	/** Semana, quincena o día cuando la periodicidad es menor a mensual. */
	ocurrencia?: Ocurrencia | null;
}

export interface IdentidadReporte {
	numeroPartida: string | number;
	actividad: string;
	/** Nombre corto para el archivo; si falta se abrevia la actividad. */
	actividadCorta?: string | null;
	periodo: Periodo;
	tags?: readonly string[];
}

const ETIQUETA_OCURRENCIA: Record<Ocurrencia['tipo'], string> = {
	semana: 'SEMANA',
	quincena: 'QUINCENA',
	dia: 'DÍA'
};

const CODIGO_OCURRENCIA: Record<Ocurrencia['tipo'], string> = {
	semana: 'S',
	quincena: 'Q',
	dia: 'D'
};

function validarPeriodo({ anio, mes, ocurrencia }: Periodo): void {
	if (!Number.isInteger(anio) || anio < 2000 || anio > 2999)
		throw new RangeError(`Año inválido: ${anio}`);
	if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new RangeError(`Mes inválido: ${mes}`);
	if (ocurrencia && (!Number.isInteger(ocurrencia.numero) || ocurrencia.numero < 1)) {
		throw new RangeError(`Ocurrencia inválida: ${ocurrencia.numero}`);
	}
}

/** «7» → «07»; los números de partida no numéricos (p. ej. «7A») se conservan. */
export function numeroPartidaTexto(numero: string | number): string {
	const texto = String(numero).trim();
	return /^\d$/.test(texto) ? `0${texto}` : texto;
}

/** «MAYO 2026» o, con ocurrencia, «SEMANA 1 MAYO 2026». */
export function textoPeriodo(periodo: Periodo): string {
	validarPeriodo(periodo);
	const mes = `${MESES[periodo.mes - 1]} ${periodo.anio}`;
	const { ocurrencia } = periodo;
	return ocurrencia ? `${ETIQUETA_OCURRENCIA[ocurrencia.tipo]} ${ocurrencia.numero} ${mes}` : mes;
}

function actividadTitulo(actividad: string): string {
	return actividad
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/[.\s]+$/, '')
		.toLocaleUpperCase('es-MX');
}

/** Título del reporte: «07.- TOMA DE POTENCIALES TUBO-SUELO. MAYO 2026». */
export function tituloReporte({ numeroPartida, actividad, periodo }: IdentidadReporte): string {
	return `${numeroPartidaTexto(numeroPartida)}.- ${actividadTitulo(actividad)}. ${textoPeriodo(periodo)}`;
}

/** Las dos líneas de la portada: partida y actividad, y el periodo. */
export function tituloPortada({ numeroPartida, actividad, periodo }: IdentidadReporte): {
	linea1: string;
	linea2: string;
} {
	return {
		linea1: `${numeroPartidaTexto(numeroPartida)}.- ${actividadTitulo(actividad)}.`,
		linea2: textoPeriodo(periodo)
	};
}

/** «Ilustración 2.n.m», con la descripción opcional a continuación. */
export function pieIlustracion(
	posicionAlcance: number,
	posicionFoto: number,
	descripcion = ''
): string {
	if (posicionAlcance < 1 || posicionFoto < 1) throw new RangeError('Las posiciones inician en 1');
	const numero = `Ilustración 2.${posicionAlcance}.${posicionFoto}`;
	const texto = descripcion.trim();
	return texto ? `${numero} ${texto}` : numero;
}

export interface FilaCuadricula<T> {
	izq: T;
	der: T | null;
}

/** Cuadrícula de dos columnas en el orden capturado; la última fila puede quedar con una foto. */
export function agruparCuadricula<T>(fotos: readonly T[]): FilaCuadricula<T>[] {
	const filas: FilaCuadricula<T>[] = [];
	for (let i = 0; i < fotos.length; i += 2) {
		filas.push({ izq: fotos[i], der: fotos[i + 1] ?? null });
	}
	return filas;
}

export interface FilaAntesDuranteDespues<T> {
	antes: T | null;
	durante: T | null;
	despues: T | null;
}

/**
 * Antes/durante/después: la fila k reúne la k-ésima foto de cada momento. Las fotos sin momento
 * se tratan como «durante».
 */
export function agruparAntesDuranteDespues<T extends { momento?: MomentoFoto | null }>(
	fotos: readonly T[]
): FilaAntesDuranteDespues<T>[] {
	const porMomento: Record<MomentoFoto, T[]> = { antes: [], durante: [], despues: [] };
	for (const foto of fotos) porMomento[foto.momento ?? 'durante'].push(foto);
	const total = Math.max(
		porMomento.antes.length,
		porMomento.durante.length,
		porMomento.despues.length
	);
	return Array.from({ length: total }, (_, k) => ({
		antes: porMomento.antes[k] ?? null,
		durante: porMomento.durante[k] ?? null,
		despues: porMomento.despues[k] ?? null
	}));
}

/** Fotos en el orden en que aparecen en el documento, que es el orden de su numeración. */
export function ordenDeAparicion<T extends { momento?: MomentoFoto | null }>(
	fotos: readonly T[],
	disposicion: DisposicionFotos
): T[] {
	if (disposicion === 'cuadricula') return [...fotos];
	return agruparAntesDuranteDespues(fotos).flatMap((fila) =>
		[fila.antes, fila.durante, fila.despues].filter((foto): foto is T => foto !== null)
	);
}

export interface Caja {
	/** cm */
	ancho: number;
	/** cm */
	alto: number;
}

/** Caja uniforme de cada foto por disposición (cm); la foto se ajusta conservando su proporción. */
export const CAJA_FOTO: Record<DisposicionFotos, Caja> = {
	cuadricula: { ancho: 8, alto: 6 },
	antes_durante_despues: { ancho: 5.2, alto: 6.5 }
};

/** Tamaño en cm que cabe en la caja sin deformar la imagen. */
export function ajustarACaja(anchoPx: number, altoPx: number, caja: Caja): Caja {
	if (anchoPx <= 0 || altoPx <= 0) throw new RangeError('Dimensiones de imagen inválidas');
	const escala = Math.min(caja.ancho / anchoPx, caja.alto / altoPx);
	const redondear = (valor: number) => Math.floor(valor * 100) / 100;
	return { ancho: redondear(anchoPx * escala), alto: redondear(altoPx * escala) };
}

export interface NumeracionSecciones {
	objetivo: 1;
	alcance: 2;
	herramientas: 3;
	verificacion: 4 | null;
	conclusiones: 4 | 5;
}

/** La tabla de verificación desplaza las conclusiones al número 5. */
export function numeracionSecciones(incluyeVerificacion: boolean): NumeracionSecciones {
	return {
		objetivo: 1,
		alcance: 2,
		herramientas: 3,
		verificacion: incluyeVerificacion ? 4 : null,
		conclusiones: incluyeVerificacion ? 5 : 4
	};
}

const PALABRAS_VACIAS = new Set([
	'A',
	'AL',
	'CON',
	'DE',
	'DEL',
	'E',
	'EL',
	'EN',
	'LA',
	'LAS',
	'LOS',
	'O',
	'PARA',
	'POR',
	'SOBRE',
	'U',
	'Y'
]);

/** Mayúsculas ASCII sin acentos; cualquier otro carácter se convierte en separador. */
function normalizarToken(texto: string): string[] {
	return texto
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toUpperCase()
		.split(/[^A-Z0-9]+/)
		.filter(Boolean);
}

/** Abreviatura de la actividad para el nombre de archivo, sin palabras vacías y con tope de largo. */
export function abreviarActividad(actividad: string, maximo = 30): string {
	const palabras = normalizarToken(actividad).filter((p) => !PALABRAS_VACIAS.has(p));
	let resultado = '';
	for (const palabra of palabras) {
		const siguiente = resultado ? `${resultado}-${palabra}` : palabra;
		if (siguiente.length > maximo) break;
		resultado = siguiente;
	}
	return resultado || palabras[0]?.slice(0, maximo) || 'REPORTE';
}

function tagParaArchivo(tag: string): string {
	return normalizarToken(tag).join('-');
}

/**
 * Nombre del DOCX: «P13_MANOMETROS_PI-0001_2026-06.docx». Con varios TAG se usa el primero en el
 * orden del reporte seguido de «+N». Solo contiene A-Z, 0-9, «-», «_», «+» y «.», válidos en Windows.
 */
export function nombreArchivo(identidad: IdentidadReporte): string {
	const { numeroPartida, actividad, actividadCorta, periodo } = identidad;
	validarPeriodo(periodo);
	const partida = normalizarToken(numeroPartidaTexto(numeroPartida)).join('') || '0';
	const actividadArchivo = actividadCorta?.trim()
		? normalizarToken(actividadCorta).join('-')
		: abreviarActividad(actividad);
	const tags = (identidad.tags ?? []).map(tagParaArchivo).filter(Boolean);
	const tag =
		tags.length === 0 ? '' : tags.length === 1 ? tags[0] : `${tags[0]}+${tags.length - 1}`;
	const mes = String(periodo.mes).padStart(2, '0');
	const ocurrencia = periodo.ocurrencia
		? `-${CODIGO_OCURRENCIA[periodo.ocurrencia.tipo]}${periodo.ocurrencia.numero}`
		: '';
	return [`P${partida}`, actividadArchivo, tag, `${periodo.anio}-${mes}${ocurrencia}`]
		.filter(Boolean)
		.join('_')
		.concat('.docx');
}

/** Fecha del encabezado: «18 / MAYO / 2026». Exige una fecha completa AAAA-MM-DD. */
export function fechaEncabezado(fechaIso: string): string {
	const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso);
	if (!coincidencia) throw new RangeError(`Fecha incompleta o inválida: «${fechaIso}»`);
	const [, anio, mes, dia] = coincidencia.map(Number);
	const fecha = new Date(Date.UTC(anio, mes - 1, dia));
	if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
		throw new RangeError(`Fecha inexistente: «${fechaIso}»`);
	}
	return `${String(dia).padStart(2, '0')} / ${MESES[mes - 1]} / ${anio}`;
}

/** TAG del encabezado: todos en el orden del reporte, o «N/A» si no hay. */
export function textoTags(tags: readonly string[] | undefined): string {
	const limpios = (tags ?? []).map((t) => t.trim()).filter(Boolean);
	return limpios.length ? limpios.join(', ') : 'N/A';
}

export const TEXTO_ESTADO_VERIFICACION: Record<EstadoVerificacion, string> = {
	pendiente: 'Pendiente',
	ok: 'OK',
	no_aplica: 'No aplica',
	con_observacion: 'Con observación'
};
