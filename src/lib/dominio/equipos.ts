// Reglas del catálogo de equipos (cambio catalogo-equipos-proyecto): estados, intervalos de
// calibración, próxima fecha, filtros, indicadores y exportación a CSV con las columnas del Excel.
import type { EquipoCatalogo, EstadoEquipo } from './esquemas.ts';

export const ETIQUETAS_ESTADO_EQUIPO: Record<EstadoEquipo, string> = {
	en_servicio: 'En servicio',
	fuera_de_servicio: 'Fuera de servicio',
	fuera_de_operacion: 'Fuera de operación',
	baja: 'Dado de baja'
};

/** Intervalos con nombre propio; los demás se escriben «Cada N meses» o «Cada N años». */
export const INTERVALOS_CON_NOMBRE: readonly (readonly [number, string])[] = [
	[1, 'Mensual'],
	[2, 'Bimestral'],
	[3, 'Trimestral'],
	[4, 'Cuatrimestral'],
	[6, 'Semestral'],
	[12, 'Anual']
];

/** Días antes de la próxima calibración en que se considera «por vencer». */
export const DIAS_POR_VENCER = 30;

export type EstadoCalibracion = 'vencida' | 'por_vencer' | 'vigente' | 'sin_fecha';

export const ETIQUETAS_CALIBRACION: Record<EstadoCalibracion, string> = {
	vencida: 'Vencida',
	por_vencer: 'Por vencer',
	vigente: 'Vigente',
	sin_fecha: 'Sin fecha'
};

export function textoIntervalo(meses: number | null): string {
	if (meses === null) return '';
	const nombre = INTERVALOS_CON_NOMBRE.find(([n]) => n === meses)?.[1];
	if (nombre) return nombre;
	if (meses % 12 === 0) return `Cada ${meses / 12} años`;
	return `Cada ${meses} meses`;
}

const sinAcentos = (texto: string) =>
	texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Intervalo escrito en el Excel → meses. Acepta los nombres («Trimestral»), «C/5 AÑOS», «cada 2
 * años», «18 meses» y números. Vacío o «---» da null; un texto no reconocido, undefined.
 */
export function intervaloDesdeTexto(valor: string | number | null): number | null | undefined {
	if (valor === null) return null;
	if (typeof valor === 'number') return Number.isInteger(valor) && valor > 0 ? valor : undefined;
	const texto = sinAcentos(valor);
	if (!texto || /^[-–—/]+$|^n\/?a$/.test(texto)) return null;
	const nombre = INTERVALOS_CON_NOMBRE.find(([, etiqueta]) => sinAcentos(etiqueta) === texto);
	if (nombre) return nombre[0];
	const anios = /^(?:c\/|cada)?\s*(\d+)\s*anos?$/.exec(texto);
	if (anios) return Number(anios[1]) * 12;
	const meses = /^(?:c\/|cada)?\s*(\d+)\s*(?:mes|meses)?$/.exec(texto);
	if (meses && Number(meses[1]) > 0) return Number(meses[1]);
	return undefined;
}

/** Suma meses a una fecha AAAA-MM-DD; si el día no existe en el mes destino, toma el último. */
export function sumarMeses(fecha: string, meses: number): string {
	const [anio, mes, dia] = fecha.split('-').map(Number);
	const total = anio * 12 + (mes - 1) + meses;
	const anioDestino = Math.floor(total / 12);
	const mesDestino = (total % 12) + 1;
	const ultimoDia = new Date(Date.UTC(anioDestino, mesDestino, 0)).getUTCDate();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${anioDestino}-${pad(mesDestino)}-${pad(Math.min(dia, ultimoDia))}`;
}

type DatosCalibracion = Pick<
	EquipoCatalogo,
	'intervaloMeses' | 'ultimaCalibracion' | 'proximaCalibracion'
>;

/** La próxima fecha capturada o, si falta, la última más el intervalo (marcada como calculada). */
export function proximaCalibracion(equipo: DatosCalibracion): {
	fecha: string | null;
	calculada: boolean;
} {
	if (equipo.proximaCalibracion) return { fecha: equipo.proximaCalibracion, calculada: false };
	if (equipo.ultimaCalibracion && equipo.intervaloMeses) {
		return { fecha: sumarMeses(equipo.ultimaCalibracion, equipo.intervaloMeses), calculada: true };
	}
	return { fecha: null, calculada: false };
}

const diasEntre = (desde: string, hasta: string) =>
	Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

export function estadoCalibracion(equipo: DatosCalibracion, hoy: string): EstadoCalibracion {
	const { fecha } = proximaCalibracion(equipo);
	if (!fecha) return 'sin_fecha';
	const dias = diasEntre(hoy, fecha);
	if (dias < 0) return 'vencida';
	return dias <= DIAS_POR_VENCER ? 'por_vencer' : 'vigente';
}

/** «25/08/2026». */
export function textoFechaCorta(fecha: string | null): string {
	return fecha ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}` : '';
}

export function marcaModelo(equipo: Pick<EquipoCatalogo, 'marca' | 'modelo'>): string {
	return [equipo.marca, equipo.modelo].filter(Boolean).join(' / ');
}

export interface FiltroEquipos {
	texto?: string;
	sitioId?: string | null;
	estado?: EstadoEquipo | null;
	calibracion?: EstadoCalibracion | null;
	soloCriticos?: boolean;
}

export function filtrarEquipos(
	equipos: EquipoCatalogo[],
	filtro: FiltroEquipos,
	hoy: string
): EquipoCatalogo[] {
	const buscado = sinAcentos(filtro.texto ?? '');
	return equipos.filter((e) => {
		if (filtro.sitioId && e.sitioId !== filtro.sitioId) return false;
		if (filtro.estado && e.estado !== filtro.estado) return false;
		if (filtro.soloCriticos && !e.critico) return false;
		if (filtro.calibracion) {
			// Como en los indicadores, un equipo dado de baja no tiene calibración pendiente.
			if (e.estado === 'baja' && filtro.estado !== 'baja') return false;
			if (estadoCalibracion(e, hoy) !== filtro.calibracion) return false;
		}
		if (!buscado) return true;
		return [e.tag, e.tipo, e.marca, e.modelo, e.numeroSerie, e.ubicacion, e.notas]
			.filter((v): v is string => !!v)
			.some((v) => sinAcentos(v).includes(buscado));
	});
}

export interface IndicadoresEquipos {
	total: number;
	enServicio: number;
	criticos: number;
	vencidas: number;
	porVencer: number;
	bajas: number;
}

/** Los dados de baja solo se cuentan en `bajas`. */
export function indicadoresEquipos(equipos: EquipoCatalogo[], hoy: string): IndicadoresEquipos {
	const vigentes = equipos.filter((e) => e.estado !== 'baja');
	const calibracion = vigentes.map((e) => estadoCalibracion(e, hoy));
	return {
		total: vigentes.length,
		enServicio: vigentes.filter((e) => e.estado === 'en_servicio').length,
		criticos: vigentes.filter((e) => e.critico).length,
		vencidas: calibracion.filter((c) => c === 'vencida').length,
		porVencer: calibracion.filter((c) => c === 'por_vencer').length,
		bajas: equipos.length - vigentes.length
	};
}

/** Encabezados del Excel «Catálogo de equipos», en su orden; el CSV agrega el sitio al inicio. */
export const COLUMNAS_EXCEL_EQUIPOS = [
	'Equipo ID',
	'Nombre',
	'Marca/Modelo',
	'No. de serie',
	'Rango',
	'Resolución',
	'Clase/Tolerancia',
	'Ubicación',
	'Propietario',
	'Responsable',
	'Crítico',
	'Estado',
	'Intervalo (meses)',
	'Última calibración/verificación',
	'Próxima calibración/verificación',
	'Proveedor',
	'Notas'
] as const;

/** CSV con BOM (Excel lo abre en UTF-8) y fechas dd/mm/aaaa. */
export function csvEquipos(equipos: EquipoCatalogo[]): string {
	const campo = (valor: string) => `"${valor.replace(/"/g, '""')}"`;
	const filas = [
		['Sitio', ...COLUMNAS_EXCEL_EQUIPOS],
		...equipos.map((e) => [
			e.sitio.clave,
			e.tag,
			e.tipo ?? '',
			marcaModelo(e),
			e.numeroSerie ?? '',
			e.rango ?? '',
			e.resolucion ?? '',
			e.clase ?? '',
			e.ubicacion ?? '',
			e.propietario ?? '',
			e.responsable ?? '',
			e.critico ? 'Sí' : '',
			ETIQUETAS_ESTADO_EQUIPO[e.estado],
			textoIntervalo(e.intervaloMeses),
			textoFechaCorta(e.ultimaCalibracion),
			textoFechaCorta(proximaCalibracion(e).fecha),
			e.proveedor ?? '',
			e.notas ?? ''
		])
	];
	return `\uFEFF${filas.map((f) => f.map(campo).join(',')).join('\r\n')}`;
}
