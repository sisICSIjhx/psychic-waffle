import { z } from 'zod';
import {
	ESTADOS_ENTREGA_CARPETA,
	INDICADORES_CONCEPTO,
	ORIGENES_ACTIVIDADES,
	TIPOS_CONCEPTO
} from '../../dominio/constantes.ts';
import type { ClienteSql } from '../bd/cliente.ts';

export const mesSeguimiento = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);

const concepto = z.object({
	id: z.uuid(),
	etiqueta: z.string(),
	bloque: z.enum(['programa', 'documentos', 'carpetas']),
	tipo: z.enum(TIPOS_CONCEPTO),
	/** «partida»: se captura una vez por partida, en su primera actividad. */
	nivel: z.enum(['periodo', 'actividad', 'partida']),
	indicador: z.enum(INDICADORES_CONCEPTO).nullable(),
	/** Se muestra con la insignia «Por definir», admite captura y no cuenta en los indicadores. */
	porDefinir: z.boolean(),
	/** Carpeta a la que pertenece un documento, si la plantilla lo dice. */
	carpetaId: z.uuid().nullable()
});
const valor = z.union([z.boolean(), z.number().nonnegative(), z.string().max(2048), z.null()]);
const enlace = z
	.url({ protocol: /^https$/, hostname: /^[\w-]+\.sharepoint\.(com|us|de|cn)$/ })
	.max(2048)
	.nullable();
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const carpeta = z.object({
	conceptoId: z.uuid(),
	estado: z.enum(ESTADOS_ENTREGA_CARPETA),
	entregaId: z.uuid().nullable(),
	recibe: z.string().trim().max(200).nullable(),
	/** Fecha de entrega. */
	fecha: z.iso.date().nullable(),
	enlace,
	archivoNombre: z.string().min(1).max(255).nullable(),
	fechaRecepcion: z.iso.date().nullable(),
	comentarios: z.string().trim().max(1000).nullable(),
	acuseEnlace: enlace,
	acuseArchivoNombre: z.string().min(1).max(255).nullable(),
	version: z.number().int().nonnegative()
});
const actividad = z.object({
	clave: z.string(),
	nombre: z.string(),
	ordinal: z.number().int().nullable(),
	fecha: z.iso.date().nullable(),
	ejecutada: z.boolean(),
	programada: z.boolean(),
	/** La partida: `a:<programa>:<partida>` o la clave base de una escrita a mano. */
	grupo: z.string(),
	/** Nombre de la partida, sin el ordinal. */
	partida: z.string(),
	/** La escribió una persona (con programa anual: «Fuera del programa»). */
	manual: z.boolean()
});
const persona = z.object({ id: z.uuid(), nombre: z.string() });
const seguimiento = z.object({
	plantillaId: z.uuid().nullable(),
	origen: z.enum(ORIGENES_ACTIVIDADES),
	conceptos: z.array(concepto),
	actividades: z.array(actividad),
	valores: z.array(
		z.object({
			actividad: z.string().nullable(),
			conceptoId: z.uuid(),
			valor
		})
	),
	/** Atenciones de emergencia (la tabla conserva su nombre). */
	nocturnas: z.array(
		z.object({
			id: z.uuid(),
			fecha: z.iso.date(),
			horaInicio: hora.nullable(),
			horaFin: hora.nullable(),
			descripcion: z.string().nullable(),
			asistentes: z.array(persona)
		})
	),
	carpetas: z.array(carpeta.extend({ entregaNombre: z.string().nullable() })),
	/** Personal activo, solo para quien puede editar. */
	personal: z.array(persona)
});
export type SeguimientoOperativo = z.infer<typeof seguimiento>;
export type ConceptoSeguimientoOperativo = z.infer<typeof concepto>;
export type ActividadSeguimiento = z.infer<typeof actividad>;
export type CarpetaSeguimiento = SeguimientoOperativo['carpetas'][number];
export type AtencionEmergencia = SeguimientoOperativo['nocturnas'][number];

const clave = z.string().min(1).max(100);
const datosActividad = {
	nombre: z.string().trim().min(1).max(250),
	fecha: z.iso.date().nullable()
};
const contexto = z.object({ sitioId: z.uuid(), mes: mesSeguimiento });
const comando = z.discriminatedUnion('accion', [
	// Una partida escrita a mano con `veces` actividades en el mes (por omisión, una).
	z.object({
		accion: z.literal('nuevaActividad'),
		id: z.uuid(),
		...datosActividad,
		veces: z.number().int().min(1).max(31).optional()
	}),
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
		horaInicio: hora.nullable().optional(),
		horaFin: hora.nullable().optional(),
		asistentes: z.array(z.uuid()).max(50).optional(),
		descripcion: z.string().trim().min(1).max(1000).nullable().optional()
	}),
	z.object({ accion: z.literal('quitarNocturna'), id: z.uuid() }),
	// Solo `estado` y `version` son obligatorios: un dato que no viene conserva lo guardado, de modo
	// que cada paso (preparar, entregar, recibir) envía lo suyo.
	z.object({
		accion: z.literal('carpeta'),
		conceptoId: z.uuid(),
		estado: z.enum(ESTADOS_ENTREGA_CARPETA),
		version: z.number().int().nonnegative(),
		entregaId: z.uuid().nullable().optional(),
		recibe: z.string().trim().max(200).nullable().optional(),
		fecha: z.iso.date().nullable().optional(),
		enlace: enlace.optional(),
		archivo: z.base64().nullable().optional(),
		archivoNombre: z.string().min(1).max(255).nullable().optional(),
		quitarArchivo: z.boolean().optional(),
		fechaRecepcion: z.iso.date().nullable().optional(),
		comentarios: z.string().trim().max(1000).nullable().optional(),
		acuseEnlace: enlace.optional(),
		acuseArchivo: z.base64().nullable().optional(),
		acuseArchivoNombre: z.string().min(1).max(255).nullable().optional(),
		quitarAcuse: z.boolean().optional()
	})
]);
export type CambioSeguimiento = z.infer<typeof comando>;

/** Qué archivo de una carpeta se descarga: el de la carpeta o el acuse de recibido. */
export const ADJUNTOS_CARPETA = ['carpeta', 'acuse'] as const;
export type AdjuntoCarpeta = (typeof ADJUNTOS_CARPETA)[number];

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

	/** Archivo de la carpeta o, con `adjunto` = «acuse», su acuse de recibido. */
	async archivo(
		sitioId: string,
		mes: string,
		conceptoId: string,
		adjunto: AdjuntoCarpeta = 'carpeta'
	) {
		const entrada = contexto.extend({ conceptoId: z.uuid() }).parse({ sitioId, mes, conceptoId });
		return z
			.object({ nombre: z.string(), datos: z.string() })
			.nullable()
			.parse(
				await this.sql.llamar('api_archivo_carpeta_seguimiento', {
					...entrada,
					mes: `${entrada.mes}-01`,
					adjunto: z.enum(ADJUNTOS_CARPETA).parse(adjunto)
				})
			);
	}
}
