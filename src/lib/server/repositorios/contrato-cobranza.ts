// Contrato, órdenes de compra, carta de finalización, enlace del programa anual y cobranza mensual
// de un centro de costo (etapa 4 del seguimiento, migración 0025).
import { z } from 'zod';
import { MODOS_CONTRATO, TIPOS_CONCEPTO } from '../../dominio/constantes.ts';
import type { ClienteSql } from '../bd/cliente.ts';

const valor = z.union([z.boolean(), z.number().nonnegative(), z.string().max(2048), z.null()]);
const valores = z.array(z.object({ conceptoId: z.uuid(), valor }));
const enlace = z
	.url({ protocol: /^https$/, hostname: /^[\w-]+\.sharepoint\.(com|us|de|cn)$/ })
	.max(2048)
	.nullable();
const monto = z.number().nonnegative().max(999_999_999_999.99).multipleOf(0.01);
const mesCobranza = z.object({
	mes: z.iso.date().regex(/-01$/),
	estimacion: z.boolean(),
	prefactura: z.boolean(),
	factura: z.boolean(),
	cobrado: z.boolean(),
	montoCobrado: monto.nullable()
});

const contrato = z.object({
	modoContrato: z.enum(MODOS_CONTRATO).nullable(),
	conceptos: z.array(
		z.object({
			id: z.uuid(),
			bloque: z.enum(['contrato', 'ordenes_compra']),
			tipo: z.enum(TIPOS_CONCEPTO),
			etiqueta: z.string()
		})
	),
	valores,
	ordenes: z.array(z.object({ id: z.uuid(), valores })),
	contratos: z.array(
		z.object({
			id: z.uuid(),
			numero: z.string(),
			vigenciaInicio: z.iso.date(),
			vigenciaFin: z.iso.date()
		})
	),
	carta: z.object({ fecha: z.iso.date().nullable(), enlace: z.string().nullable() }),
	cartaFaltante: z.boolean(),
	cobranza: z.array(mesCobranza)
});
const contratoCobranza = z.object({
	plantillaId: z.uuid().nullable(),
	/** Ausente si quien consulta no puede ver el enlace del programa anual. */
	programaEnlace: z.string().nullable().optional(),
	/** Ausente si quien consulta no puede ver el contrato ni la cobranza. */
	contrato: contrato.optional()
});
export type ContratoCobranza = z.infer<typeof contratoCobranza>;
export type DatosContrato = z.infer<typeof contrato>;

const comando = z.discriminatedUnion('accion', [
	z.object({ accion: z.literal('contrato'), valores }),
	z.object({ accion: z.literal('nuevaOrden'), id: z.uuid(), valores }),
	z.object({ accion: z.literal('editarOrden'), id: z.uuid(), valores }),
	z.object({ accion: z.literal('quitarOrden'), id: z.uuid() }),
	z.object({ accion: z.literal('carta'), fecha: z.iso.date().nullable(), enlace }),
	z.object({ accion: z.literal('programa'), enlace }),
	z.object({ accion: z.literal('cobranza'), meses: z.array(mesCobranza).min(1).max(12) })
]);
export type CambioContratoCobranza = z.infer<typeof comando>;

export const anioCobranza = z.coerce.number().int().min(2000).max(2100);

export class RepositorioContratoCobranza {
	private readonly sql: ClienteSql;

	constructor(sql: ClienteSql) {
		this.sql = sql;
	}

	/**
	 * `ver` decide qué sale de la base: sin `contrato` no se leen contrato, órdenes, carta ni
	 * cobranza; sin `programa`, tampoco el enlace del programa anual.
	 */
	async obtener(
		sitioId: string,
		anio: number,
		hoy: string,
		ver: { contrato: boolean; programa: boolean }
	): Promise<ContratoCobranza> {
		return contratoCobranza.parse(
			await this.sql.llamar('api_obtener_contrato_cobranza', {
				sitioId: z.uuid().parse(sitioId),
				anio: anioCobranza.parse(anio),
				hoy: z.iso.date().parse(hoy),
				verContrato: ver.contrato,
				verPrograma: ver.programa
			})
		);
	}

	async guardar(sitioId: string, cambios: unknown): Promise<void> {
		await this.sql.llamar('api_guardar_contrato_cobranza', {
			...comando.parse(cambios),
			sitioId: z.uuid().parse(sitioId)
		});
	}
}
