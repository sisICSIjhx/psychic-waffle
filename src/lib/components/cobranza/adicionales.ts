// Textos y sumas de la sección «Adicionales» de /cobranza. Funciones puras, sin Zod.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const partes = (fecha: string) => ({
	anio: fecha.slice(0, 4),
	mes: MESES[Number(fecha.slice(5, 7)) - 1] ?? '',
	dia: String(Number(fecha.slice(8, 10)))
});

/** «5 nov 2026», para fechas `AAAA-MM-DD`. */
export function textoDia(fecha: string): string {
	const { dia, mes, anio } = partes(fecha);
	return `${dia} ${mes} ${anio}`;
}

/**
 * Periodo de ejecución en pocas palabras: «1 al 15 nov 2026», «28 oct al 3 nov 2026», «Desde el
 * 1 nov 2026», «Hasta el 15 nov 2026» o cadena vacía si no hay fechas.
 */
export function textoPeriodo(inicio: string | null, fin: string | null): string {
	if (inicio && fin) {
		if (inicio === fin) return textoDia(inicio);
		const a = partes(inicio);
		const b = partes(fin);
		if (a.anio !== b.anio) return `${textoDia(inicio)} al ${textoDia(fin)}`;
		return a.mes === b.mes
			? `${a.dia} al ${textoDia(fin)}`
			: `${a.dia} ${a.mes} al ${textoDia(fin)}`;
	}
	if (inicio) return `Desde el ${textoDia(inicio)}`;
	if (fin) return `Hasta el ${textoDia(fin)}`;
	return '';
}

/** Pactado y cobrado de todos los adicionales, sumados en centavos para no arrastrar decimales. */
export function totalesDeAdicionales(
	adicionales: readonly { montoPactado: number | null; montoCobrado: number | null }[]
): { cantidad: number; pactado: number; cobrado: number } {
	const suma = (campo: 'montoPactado' | 'montoCobrado') =>
		adicionales.reduce((total, a) => total + Math.round((a[campo] ?? 0) * 100), 0) / 100;
	return {
		cantidad: adicionales.length,
		pactado: suma('montoPactado'),
		cobrado: suma('montoCobrado')
	};
}

/** Un trabajo adicional al contrato del centro, como lo entrega `repos.contratoCobranza` (D6). */
export interface Adicional {
	id: string;
	ordenCompra: string;
	descripcion: string | null;
	fechaSolicitud: string | null;
	periodoInicio: string | null;
	periodoFin: string | null;
	montoPactado: number | null;
	montoCobrado: number | null;
}

/** Resultado de un envío: lo que devolvió la acción y el lugar de la página que lo muestra. */
export interface ResultadoGuardar {
	mensaje?: string;
	error?: string;
	ancla?: string;
}
