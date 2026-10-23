// Textos de la bitácora del catálogo y del diálogo de confirmación: etiquetas de cada dato, «antes →
// después», el impacto de un cambio en los reportes, la validación del motivo y el mes desde el que
// aplica un cambio de firmante. Las fechas se muestran en la zona del negocio.
import type { CambioCampo, ImpactoCambio } from './esquemas.ts';
import { textoMesAnio } from './dias-ejecucion.ts';
import { ZONA_HORARIA } from './fechas.ts';
import { plural } from './textos.ts';

export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 500;

export const ETIQUETA_CAMPO: Record<string, string> = {
	numero: 'Número',
	descripcion: 'Descripción',
	vigenciaInicio: 'Inicio de la vigencia',
	vigenciaFin: 'Fin de la vigencia',
	clave: 'Clave',
	nombre: 'Nombre',
	cargo: 'Cargo',
	empresa: 'Empresa',
	vigenteDesde: 'Vigente desde',
	vigenteHasta: 'Vigente hasta',
	sitio: 'Sitio',
	usuario: 'Usuario',
	contrato: 'Número de contrato',
	'firmantes.elaboro': 'Firma de Elaboró',
	'firmantes.aprobo': 'Firma de Aprobó',
	'firmantes.recibio': 'Firma de Recibió'
};

export const ETIQUETA_ENTIDAD: Record<string, string> = {
	contrato: 'Contrato',
	sitio: 'Sitio',
	firmante: 'Firmante',
	contrato_sitio: 'Sitio del contrato'
};

export const ETIQUETA_ACCION: Record<string, string> = {
	crear: 'Alta',
	editar: 'Corrección',
	reemplazar: 'Cambio de firmante',
	asociar: 'Asociación',
	quitar: 'Quita'
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Valor de un dato para mostrarlo: fechas como «dd/mm/aaaa» y vacío como «—». */
export function valorCambio(valor: string | null | undefined): string {
	if (valor === null || valor === undefined || valor === '') return '—';
	return FECHA.test(valor)
		? `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`
		: valor;
}

/** «Número: OC-1 → OC-2»; en las altas, solo el valor nuevo. */
export function describirCambio(cambio: CambioCampo): string {
	const etiqueta = ETIQUETA_CAMPO[cambio.campo] ?? cambio.campo;
	if (cambio.antes === null) return `${etiqueta}: ${valorCambio(cambio.despues)}`;
	return `${etiqueta}: ${valorCambio(cambio.antes)} → ${valorCambio(cambio.despues)}`;
}

/**
 * Impacto de un cambio en los reportes, en frases cortas para el diálogo y la bitácora. `dato` es el
 * nombre del dato en minúsculas («número», «nombre del sitio») para «conserva el número anterior».
 */
export function resumenImpacto(impacto: ImpactoCambio, dato = 'dato'): string[] {
	const frases: string[] = [];
	if (impacto.borradores) frases.push(plural(impacto.borradores, 'borrador', 'borradores'));
	const conserva = (cantidad: number, singular: string, enPlural: string) =>
		`${plural(cantidad, singular, enPlural)} ${cantidad === 1 ? 'conserva' : 'conservan'} el ${dato} anterior`;
	if (impacto.enRevision) {
		frases.push(
			`${conserva(impacto.enRevision, 'reporte en revisión', 'reportes en revisión')}; regréselo a borrador para actualizarlo`
		);
	}
	if (impacto.emitidos) frases.push(conserva(impacto.emitidos, 'emitido', 'emitidos'));
	if (impacto.sustituidos) frases.push(conserva(impacto.sustituidos, 'sustituido', 'sustituidos'));
	if (impacto.otrosContratos.length) {
		frases.push(
			`También cambia en ${impacto.otrosContratos.length === 1 ? 'el contrato' : 'los contratos'} ${impacto.otrosContratos.map((k) => k.numero).join(', ')}`
		);
	}
	if (impacto.desdeMes)
		frases.push(`Los reportes desde ${textoMesAnio(impacto.desdeMes)} usarán al nuevo firmante`);
	return frases;
}

/** Efectos aplicados, para la notificación y el historial. */
export function resumenEfectos(efectos: {
	borradoresActualizados?: unknown;
	borradoresConAviso?: unknown;
}): string[] {
	const cantidad = (valor: unknown) => (Array.isArray(valor) ? valor.length : 0);
	const frases: string[] = [];
	const actualizados = cantidad(efectos.borradoresActualizados);
	const conAviso = cantidad(efectos.borradoresConAviso);
	if (actualizados) {
		frases.push(`${plural(actualizados, 'borrador actualizado', 'borradores actualizados')}`);
	}
	if (conAviso) frases.push(`${plural(conAviso, 'borrador', 'borradores')} con aviso`);
	return frases;
}

/** Motivo de 10 a 500 caracteres sin contar los espacios al inicio ni al final. */
export function validarMotivo(texto: string): { valido: boolean; mensaje: string } {
	const largo = texto.trim().length;
	if (largo < MOTIVO_MINIMO) {
		const faltan = MOTIVO_MINIMO - largo;
		return {
			valido: false,
			mensaje: `Faltan al menos ${plural(faltan, 'carácter', 'caracteres')}.`
		};
	}
	if (largo > MOTIVO_MAXIMO) {
		return {
			valido: false,
			mensaje: `Sobran ${plural(largo - MOTIVO_MAXIMO, 'carácter', 'caracteres')}.`
		};
	}
	return { valido: true, mensaje: '' };
}

/** Primer mes cuyo día 1 es igual o posterior a `desde`: desde él los reportes usan al firmante nuevo. */
export function mesDesdeCambio(desde: string): string {
	const anio = Number(desde.slice(0, 4));
	const mes = Number(desde.slice(5, 7));
	if (desde.slice(8, 10) === '01') return `${desde.slice(0, 7)}-01`;
	const siguiente = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
	return `${siguiente.anio}-${String(siguiente.mes).padStart(2, '0')}-01`;
}

/** Primer día del mes siguiente a `hoy`: la fecha que se propone para cambiar de firmante. */
export function primerDiaMesSiguiente(hoy: string): string {
	return mesDesdeCambio(`${hoy.slice(0, 7)}-02`);
}

/** Fecha y hora de un registro en la Ciudad de México: «22/10/2026 14:05». */
export function fechaHoraLocal(instante: string): string {
	const partes = new Intl.DateTimeFormat('es-MX', {
		timeZone: ZONA_HORARIA,
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(new Date(instante));
	const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
	return `${de('day')}/${de('month')}/${de('year')} ${de('hour')}:${de('minute')}`;
}

/** Lo que una vigencia corregida deja fuera, para mostrarlo junto a sus campos. */
export function textoFueraDeVigencia(
	fuera: { tipo: string; sitio: string | null; meses: string[] }[]
): string[] {
	return fuera.map((f) => {
		const meses = f.meses.map((m) => textoMesAnio(m)).join(', ');
		return f.tipo === 'programa'
			? `Programa de ${f.sitio ?? 'un sitio'}: ${meses}`
			: f.tipo === 'meses'
				? `Meses programados de ${f.sitio ?? 'un sitio'}: ${meses}`
				: f.tipo === 'realizados'
					? `Realizados registrados de ${f.sitio ?? 'un sitio'}: ${meses}`
					: `Reportes de ${meses}`;
	});
}

/** Nombre del dato que conservan los reportes emitidos, para «conserva el número anterior». */
export function datoDelCambio(tipo: string, cambios: CambioCampo[]): string {
	if (tipo === 'contrato' && cambios.length === 1 && cambios[0].campo === 'numero') return 'número';
	if (tipo === 'contrato') return 'dato del contrato';
	if (tipo === 'sitio') return 'sitio';
	if (tipo === 'corregirFirmante' || tipo === 'cambiarFirmante') return 'firmante';
	return 'dato';
}
