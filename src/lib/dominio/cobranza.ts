// Reglas puras de la pantalla «Contrato y cobranza» (etapa 4 del seguimiento). Sin Zod: lo usan los
// componentes del navegador.
import type { TipoConcepto } from './constantes.ts';

export type ValorConcepto = boolean | number | string | null;

const FORMATO_MONTO = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function textoMonto(monto: number): string {
	return FORMATO_MONTO.format(monto);
}

/**
 * Valor de un concepto a partir del campo de un formulario: una casilla vale por estar marcada, un
 * campo vacío es «sin dato» y los montos y cantidades llegan como número (NaN si no lo son, para que
 * la validación lo rechace).
 */
export function valorDeCampo(tipo: string, campo: string | null): ValorConcepto {
	if (tipo === 'casilla') return campo !== null;
	const texto = (campo ?? '').trim();
	if (!texto) return null;
	return tipo === 'monto' || tipo === 'cantidad' ? Number(texto) : texto;
}

export const PASOS_COBRANZA = [
	['estimacion', 'Estimación'],
	['prefactura', 'Prefactura'],
	['factura', 'Factura'],
	['cobrado', 'Cobrado']
] as const;
export type PasoCobranza = (typeof PASOS_COBRANZA)[number][0];

export interface MesCobranza extends Record<PasoCobranza, boolean> {
	/** Primer día del mes, `AAAA-MM-01`. */
	mes: string;
	montoCobrado: number | null;
}

/** Los doce meses del año, con lo registrado donde lo hay. */
export function mesesDelAnio(anio: number, registrados: MesCobranza[]): MesCobranza[] {
	const porMes = new Map(registrados.map((m) => [m.mes, m]));
	return Array.from({ length: 12 }, (_, i) => {
		const mes = `${anio}-${String(i + 1).padStart(2, '0')}-01`;
		return (
			porMes.get(mes) ?? {
				mes,
				estimacion: false,
				prefactura: false,
				factura: false,
				cobrado: false,
				montoCobrado: null
			}
		);
	});
}

export function totalCobrado(meses: { montoCobrado: number | null }[]): number {
	// En centavos, para que la suma no arrastre errores de coma flotante.
	return meses.reduce((suma, m) => suma + Math.round((m.montoCobrado ?? 0) * 100), 0) / 100;
}

export function esTipoNumerico(tipo: TipoConcepto): boolean {
	return tipo === 'monto' || tipo === 'cantidad';
}
