// Resumen de estatus por centro de costo y mes (cambio kpi-estatus-centros, D8): una sola consulta
// para todos los centros visibles. Las reglas de los indicadores están en dominio/estatus.ts.
import { z } from 'zod';
import { ESTADOS_ENTREGA_CARPETA, ORIGENES_ACTIVIDADES } from '../../dominio/constantes.ts';
import type { ResumenCentro } from '../../dominio/estatus.ts';
import type { ClienteSql } from '../bd/cliente.ts';
import { mesSeguimiento } from './seguimiento.ts';

const cuenta = z.number().int().nonnegative();
const cantidad = z.number().nonnegative();

const resumen = z.object({
	sitioId: z.uuid(),
	plantillaId: z.uuid().nullable(),
	origen: z.enum(ORIGENES_ACTIVIDADES),
	mesTerminado: z.boolean(),
	actividades: z.object({ programadas: cuenta, ejecutadas: cuenta, cobradas: cuenta.nullable() }),
	em: z
		.object({
			programadas: cantidad.nullable(),
			realizadas: cantidad.nullable(),
			cobradas: cantidad.nullable()
		})
		.nullable(),
	documentos: z.object({
		esperados: cuenta,
		hechos: cuenta,
		faltantes: z.array(
			z.object({
				conceptoId: z.uuid(),
				etiqueta: z.string(),
				nivel: z.enum(['actividad', 'partida', 'periodo']),
				faltan: cuenta
			})
		)
	}),
	carpetas: z.array(
		z.object({
			conceptoId: z.uuid(),
			etiqueta: z.string(),
			estado: z.enum(ESTADOS_ENTREGA_CARPETA),
			porDefinir: z.boolean()
		})
	),
	emergencias: cuenta,
	finanzas: z
		.object({
			montoContrato: cantidad.nullable(),
			cobrado: cantidad,
			facturado: cantidad.nullable(),
			mes: z.object({
				estimacion: z.boolean(),
				prefactura: z.boolean(),
				factura: z.boolean(),
				cobrado: z.boolean()
			}),
			adicionales: z.object({ cantidad: cuenta, pactado: cantidad, cobrado: cantidad }),
			contratoVencido: z.boolean(),
			cartaFaltante: z.boolean(),
			datosContrato: z.object({ esperados: cuenta, capturados: cuenta })
		})
		.optional()
}) satisfies z.ZodType<ResumenCentro>;

const consulta = z.object({
	/** Centros de costo de quien consulta; null si su rol los abarca todos. */
	sitioIds: z.array(z.uuid()).nullable(),
	mes: mesSeguimiento,
	hoy: z.iso.date(),
	/** Lo decide el servidor con la capacidad `verContrato`: sin ella no sale nada financiero. */
	verContrato: z.boolean()
});
export type ConsultaEstatus = z.input<typeof consulta>;

export class RepositorioEstatus {
	private readonly sql: ClienteSql;

	constructor(sql: ClienteSql) {
		this.sql = sql;
	}

	/** Un resumen por centro de costo, por clave. Un centro fuera de `sitioIds` no aparece. */
	async obtener(filtro: ConsultaEstatus): Promise<ResumenCentro[]> {
		const entrada = consulta.parse(filtro);
		return z
			.array(resumen)
			.parse(
				await this.sql.llamar('api_estatus_centros', { ...entrada, mes: `${entrada.mes}-01` })
			);
	}

	/** El resumen de un solo centro (ya comprobado su alcance), o null si no existe. */
	async deCentro(
		sitioId: string,
		filtro: Omit<ConsultaEstatus, 'sitioIds'>
	): Promise<ResumenCentro | null> {
		return (await this.obtener({ ...filtro, sitioIds: [sitioId] }))[0] ?? null;
	}
}
