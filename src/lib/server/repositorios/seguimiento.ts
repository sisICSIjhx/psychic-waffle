import { z } from 'zod';
import { ORIGENES_ACTIVIDADES, TIPOS_CONCEPTO } from '../../dominio/constantes.ts';
import type { ClienteSql } from '../bd/cliente.ts';

export const mesSeguimiento = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);

const concepto = z.object({
	id: z.uuid(),
	etiqueta: z.string(),
	bloque: z.enum(['programa', 'documentos', 'carpetas']),
	tipo: z.enum(TIPOS_CONCEPTO),
	nivel: z.enum(['periodo', 'actividad'])
});
const valor = z.union([z.boolean(), z.number().nonnegative(), z.string().max(2048), z.null()]);
const carpeta = z.object({
	conceptoId: z.uuid(),
	estado: z.enum(['pendiente', 'en_proceso', 'entregada']),
	entregaId: z.uuid().nullable(),
	recibe: z.string().trim().max(200).nullable(),
	fecha: z.iso.date().nullable(),
	enlace: z
		.url({ protocol: /^https$/, hostname: /^[\w-]+\.sharepoint\.(com|us|de|cn)$/ })
		.max(2048)
		.nullable(),
	archivoNombre: z.string().min(1).max(255).nullable(),
	version: z.number().int().nonnegative()
});
const seguimiento = z.object({
	plantillaId: z.uuid().nullable(),
	origen: z.enum(ORIGENES_ACTIVIDADES),
	conceptos: z.array(concepto),
	actividades: z.array(
		z.object({
			clave: z.string(),
			nombre: z.string(),
			ordinal: z.number().int().nullable(),
			fecha: z.iso.date().nullable(),
			ejecutada: z.boolean(),
			programada: z.boolean()
		})
	),
	valores: z.array(
		z.object({
			actividad: z.string().nullable(),
			conceptoId: z.uuid(),
			valor
		})
	),
	nocturnas: z.array(z.object({ id: z.uuid(), fecha: z.iso.date(), descripcion: z.string() })),
	carpetas: z.array(carpeta.extend({ entregaNombre: z.string().nullable() })),
	personal: z.array(z.object({ id: z.uuid(), nombre: z.string() }))
});
export type SeguimientoOperativo = z.infer<typeof seguimiento>;

const clave = z.string().min(1).max(100);
const datosActividad = {
	nombre: z.string().trim().min(1).max(250),
	fecha: z.iso.date().nullable()
};
const contexto = z.object({ sitioId: z.uuid(), mes: mesSeguimiento });
const comando = z.discriminatedUnion('accion', [
	z.object({ accion: z.literal('nuevaActividad'), id: z.uuid(), ...datosActividad }),
	z.object({ accion: z.literal('editarActividad'), actividad: clave, ...datosActividad }),
	z.object({ accion: z.literal('quitarActividad'), actividad: clave }),
	z.object({ accion: z.literal('ejecucion'), actividad: clave, valor: z.boolean() }),
	z.object({
		accion: z.literal('valor'),
		actividad: clave.nullable(),
		conceptoId: z.uuid(),
		valor
	}),
	z.object({ accion: z.literal('marcarFila'), actividad: clave }),
	z.object({ accion: z.literal('marcarMes') }),
	z.object({
		accion: z.literal('nuevaNocturna'),
		id: z.uuid(),
		fecha: z.iso.date(),
		descripcion: z.string().trim().min(1).max(1000)
	}),
	z.object({ accion: z.literal('quitarNocturna'), id: z.uuid() }),
	carpeta.extend({
		accion: z.literal('carpeta'),
		archivo: z.base64().nullable(),
		quitarArchivo: z.boolean()
	})
]);

export class RepositorioSeguimiento {
	private readonly sql: ClienteSql;

	constructor(sql: ClienteSql) {
		this.sql = sql;
	}

	async obtener(
		sitioId: string,
		mes: string,
		incluirPersonal = false
	): Promise<SeguimientoOperativo> {
		const entrada = contexto.parse({ sitioId, mes });
		return seguimiento.parse(
			await this.sql.llamar('api_obtener_seguimiento_operativo', {
				...entrada,
				mes: `${entrada.mes}-01`,
				incluirPersonal
			})
		);
	}

	async guardar(
		sitioId: string,
		mes: string,
		plantillaId: string | null,
		cambios: unknown
	): Promise<void> {
		const entrada = contexto.parse({ sitioId, mes });
		const datos = comando.parse(cambios);
		await this.sql.llamar('api_guardar_seguimiento_operativo', {
			...datos,
			...entrada,
			mes: `${entrada.mes}-01`,
			plantillaId: z.uuid().nullable().parse(plantillaId)
		});
	}

	async archivo(sitioId: string, mes: string, conceptoId: string) {
		const entrada = contexto.extend({ conceptoId: z.uuid() }).parse({ sitioId, mes, conceptoId });
		return z
			.object({ nombre: z.string(), datos: z.string() })
			.nullable()
			.parse(
				await this.sql.llamar('api_archivo_carpeta_seguimiento', {
					...entrada,
					mes: `${entrada.mes}-01`
				})
			);
	}
}
