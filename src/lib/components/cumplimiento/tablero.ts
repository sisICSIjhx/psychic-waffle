// Tablero de estatus de `/cumplimiento` (cambio kpi-estatus-centros): arma una tarjeta por centro de
// costo con el resumen de `api_estatus_centros`, las ordena del más atrasado al más al corriente y
// las filtra por estatus y por texto. Funciones puras: las usan la carga del servidor y la vista.
import { filasConcentrado, type CentroConcentrado } from '$lib/dominio/concentrado';
import type { ProgramaCumplimiento } from '$lib/dominio/cumplimiento';
import {
	ETIQUETA_ESTATUS,
	pendientesDeCentro,
	resumirCentro,
	type EstatusCentro,
	type Kpi,
	type Pendiente,
	type ResumenCentro
} from '$lib/dominio/estatus';
import { normalizarBusqueda } from '$lib/dominio/seleccion';
import { textoMes } from '$lib/dominio/textos';

export interface TarjetaTablero {
	centro: { id: string; clave: string; nombre: string; sinPlantilla: boolean };
	estatus: EstatusCentro;
	kpis: Kpi[];
	/** Hasta cinco pendientes y «y N más». */
	falta: Pendiente[];
	/** Cuántos pendientes hay en total (para ordenar). */
	pendientes: number;
	emergencias: number;
	/** Contrato del programa anual, para abrir su tablero de cumplimiento. */
	contratoId: string | null;
}

/** Orden de las tarjetas: lo que pide atención primero. «Sin datos» va antes que «Al corriente». */
export const ORDEN_TABLERO: readonly EstatusCentro[] = [
	'atrasado',
	'con_pendientes',
	'sin_datos',
	'al_corriente'
];

/** Orden de las píldoras del filtro. */
export const FILTROS_ESTATUS: readonly EstatusCentro[] = [
	'atrasado',
	'con_pendientes',
	'al_corriente',
	'sin_datos'
];

export const esEstatus = (valor: string | null): valor is EstatusCentro =>
	(FILTROS_ESTATUS as readonly string[]).includes(valor ?? '');

const SIN_RESUMEN = (sitioId: string): ResumenCentro => ({
	sitioId,
	plantillaId: null,
	origen: 'ninguno',
	mesTerminado: false,
	actividades: { programadas: 0, ejecutadas: 0, cobradas: null },
	em: null,
	documentos: { esperados: 0, hechos: 0, faltantes: [] },
	carpetas: [],
	emergencias: 0
});

const porcentajeDeEjecucion = (tarjeta: TarjetaTablero) =>
	tarjeta.kpis.find((k) => k.clave === 'ejecucion')?.porcentaje ?? null;

/** Atrasados primero; a igualdad, más pendientes, menor ejecución y, al final, la clave. */
export function ordenarTarjetas(tarjetas: readonly TarjetaTablero[]): TarjetaTablero[] {
	return [...tarjetas].sort((a, b) => {
		const grupo = ORDEN_TABLERO.indexOf(a.estatus) - ORDEN_TABLERO.indexOf(b.estatus);
		if (grupo) return grupo;
		if (a.pendientes !== b.pendientes) return b.pendientes - a.pendientes;
		const [pa, pb] = [porcentajeDeEjecucion(a), porcentajeDeEjecucion(b)];
		if (pa !== pb) return (pa ?? Infinity) - (pb ?? Infinity);
		return a.centro.clave.localeCompare(b.centro.clave, 'es', { numeric: true });
	});
}

/**
 * Una tarjeta por centro de costo visible, ya ordenadas. La ejecución de un centro con programa
 * anual es la acumulada del ciclo hasta el corte (el mismo cálculo del tablero de cumplimiento); la
 * de los demás, la del mes. Un centro sin fila en `resumenes` sale «Sin datos».
 */
export function tarjetasDelTablero(
	centros: readonly CentroConcentrado[],
	resumenes: readonly ResumenCentro[],
	programas: readonly ProgramaCumplimiento[],
	corte: string,
	hoy: string
): TarjetaTablero[] {
	const porCentro = new Map(resumenes.map((r) => [r.sitioId, r]));
	return ordenarTarjetas(
		filasConcentrado(centros, programas, {}, corte, hoy).map((fila) => {
			const resumen = porCentro.get(fila.centro.id) ?? SIN_RESUMEN(fila.centro.id);
			const avance =
				fila.fuente === 'programa'
					? { planeado: fila.planeado, ejecutado: fila.ejecutado, avance: fila.avance }
					: null;
			const { estatus, kpis, falta } = resumirCentro(resumen, avance);
			return {
				centro: {
					id: fila.centro.id,
					clave: fila.centro.clave,
					nombre: fila.centro.nombre,
					sinPlantilla: !fila.centro.plantilla
				},
				estatus,
				kpis,
				falta,
				pendientes: pendientesDeCentro(resumen).length,
				emergencias: resumen.emergencias,
				contratoId: fila.contratoId
			};
		})
	);
}

export function cuentasPorEstatus(
	tarjetas: readonly TarjetaTablero[]
): Record<EstatusCentro, number> {
	const cuentas = { atrasado: 0, con_pendientes: 0, al_corriente: 0, sin_datos: 0 };
	for (const tarjeta of tarjetas) cuentas[tarjeta.estatus]++;
	return cuentas;
}

/** Tarjetas del estatus elegido cuya clave o nombre contiene todas las palabras de la búsqueda. */
export function filtrarTarjetas(
	tarjetas: readonly TarjetaTablero[],
	estatus: EstatusCentro | null,
	busqueda = ''
): TarjetaTablero[] {
	const palabras = normalizarBusqueda(busqueda).split(' ').filter(Boolean);
	return tarjetas.filter((tarjeta) => {
		if (estatus && tarjeta.estatus !== estatus) return false;
		if (!palabras.length) return true;
		const texto = normalizarBusqueda(`${tarjeta.centro.clave} ${tarjeta.centro.nombre}`);
		return palabras.every((palabra) => texto.includes(palabra));
	});
}

const PLURAL_ESTATUS: Record<EstatusCentro, [string, string]> = {
	atrasado: ['atrasado', 'atrasados'],
	con_pendientes: ['con pendientes', 'con pendientes'],
	al_corriente: ['al corriente', 'al corriente'],
	sin_datos: ['sin datos', 'sin datos']
};

/** «14 centros de costo en noviembre 2026: 2 atrasados, 5 con pendientes, 6 al corriente y 1 sin datos.» */
export function textoResumenTablero(tarjetas: readonly TarjetaTablero[], mes: string): string {
	const cuentas = cuentasPorEstatus(tarjetas);
	const partes = FILTROS_ESTATUS.map(
		(estatus) => `${cuentas[estatus]} ${PLURAL_ESTATUS[estatus][cuentas[estatus] === 1 ? 0 : 1]}`
	);
	const centros = tarjetas.length === 1 ? 'centro de costo' : 'centros de costo';
	return `${tarjetas.length} ${centros} en ${textoMes(mes)}: ${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}.`;
}

/** «Ningún centro de costo está "Atrasado" en noviembre 2026.» */
export function textoFiltroVacio(estatus: EstatusCentro, mes: string): string {
	return `Ningún centro de costo está «${ETIQUETA_ESTATUS[estatus]}» en ${textoMes(mes)}.`;
}

/** Mes anterior o siguiente de «AAAA-MM». */
export function mesVecino(mes: string, pasos: number): string {
	const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + pasos;
	return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export interface FiltrosTablero {
	/** Mes de corte, «AAAA-MM». */
	corte: string;
	estatus: EstatusCentro | null;
	/** Búsqueda por clave o nombre. */
	q: string;
	/** Periodicidad del programa anual; se conserva al cambiar de mes o de filtro. */
	periodicidad: string | null;
}

/** Consulta de la dirección del tablero («corte=2026-11&estatus=atrasado»); lo vacío no viaja. */
export function consultaTablero(filtros: FiltrosTablero): string {
	const consulta = new URLSearchParams({ corte: filtros.corte });
	if (filtros.estatus) consulta.set('estatus', filtros.estatus);
	if (filtros.q.trim()) consulta.set('q', filtros.q.trim());
	if (filtros.periodicidad) consulta.set('periodicidad', filtros.periodicidad);
	return consulta.toString();
}
