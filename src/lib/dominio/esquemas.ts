// Tipos y esquemas Zod de las entidades, compartidos por cliente y servidor. Reflejan el JSON que
// devuelven las funciones api_* de la base de datos (claves en camelCase).
import { z } from 'zod';

export const PERIODICIDADES = [
	'diaria',
	'semanal',
	'quincenal',
	'mensual',
	'bimestral',
	'trimestral',
	'cuatrimestral',
	'semestral',
	'anual',
	'cuando_aplique'
] as const;
export const DISPOSICIONES = ['cuadricula', 'antes_durante_despues'] as const;
export const TIPOS_ALCANCE = ['alcance', 'nota', 'norma'] as const;
export const FUNCIONES_FIRMA = ['elaboro', 'aprobo', 'recibio'] as const;
export const ESTADOS_REPORTE = ['borrador', 'en_revision', 'emitido', 'sustituido'] as const;
export const ESTADOS_VERIFICACION = ['pendiente', 'ok', 'no_aplica', 'con_observacion'] as const;
export const MOMENTOS_FOTO = ['antes', 'durante', 'despues'] as const;
/** Giro de una foto en grados, en el sentido de las agujas del reloj. */
export const ROTACIONES_FOTO = [0, 90, 180, 270] as const;
export const TIPOS_OCURRENCIA = ['semana', 'quincena', 'dia'] as const;

const id = z.uuid();
/** Fecha AAAA-MM-DD. */
const fecha = z.iso.date();
const marcaDeTiempo = z.string();
const textoOpcional = z.string().nullable();

export const esquemaCliente = z.object({
	id,
	clave: z.string().regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
	nombre: z.string().trim().min(1),
	razonSocial: z.string().trim().min(1)
});
export type Cliente = z.infer<typeof esquemaCliente>;

export const esquemaContrato = z.object({
	id,
	clienteId: id,
	numero: z.string().trim().min(1),
	descripcion: textoOpcional,
	vigenciaInicio: fecha,
	vigenciaFin: fecha,
	cliente: esquemaCliente.nullable(),
	vigente: z.boolean().optional(),
	/** Versión del dato para la concurrencia optimista de las ediciones. */
	actualizadoEn: marcaDeTiempo
});
export type Contrato = z.infer<typeof esquemaContrato>;

export const esquemaSitio = z.object({
	id,
	clave: z.string().trim().min(1),
	nombre: z.string(),
	actualizadoEn: marcaDeTiempo
});
export type Sitio = z.infer<typeof esquemaSitio>;

export const esquemaEquipo = z.object({
	id,
	sitioId: id,
	tag: z.string().trim().min(1),
	tipo: textoOpcional,
	marca: textoOpcional,
	modelo: textoOpcional,
	rango: textoOpcional,
	numeroSerie: textoOpcional
});
export type Equipo = z.infer<typeof esquemaEquipo>;

export const esquemaFirmante = z.object({
	id,
	contratoId: id,
	funcion: z.enum(FUNCIONES_FIRMA),
	nombre: z.string().trim().min(1),
	cargo: z.string(),
	empresa: z.string(),
	vigenteDesde: fecha,
	vigenteHasta: fecha.nullable(),
	actualizadoEn: marcaDeTiempo
});
export type Firmante = z.infer<typeof esquemaFirmante>;

export const esquemaFirmantesVigentes = z.object({
	elaboro: esquemaFirmante.nullable(),
	aprobo: esquemaFirmante.nullable(),
	recibio: esquemaFirmante.nullable()
});
export type FirmantesVigentes = z.infer<typeof esquemaFirmantesVigentes>;

// Bitácora del catálogo (cambio edicion-contratos-bitacora).
export const ENTIDADES_CATALOGO = ['contrato', 'sitio', 'firmante', 'contrato_sitio'] as const;
export const ACCIONES_CATALOGO = ['crear', 'editar', 'reemplazar', 'asociar', 'quitar'] as const;
export const ORIGENES_CAMBIO = ['interfaz', 'script'] as const;

export const esquemaCambioCampo = z.object({
	campo: z.string(),
	antes: z.string().nullable(),
	despues: z.string().nullable()
});
export type CambioCampo = z.infer<typeof esquemaCambioCampo>;

const contratoBreve = z.object({ id, numero: z.string() });

/** Reportes afectados por un cambio del catálogo, por estado. */
export const esquemaImpactoCambio = z.object({
	borradores: z.number().int(),
	borradoresIds: z.array(id).default([]),
	borradoresActualizados: z.array(id).default([]),
	borradoresConAviso: z.array(id).default([]),
	enRevision: z.number().int(),
	emitidos: z.number().int(),
	sustituidos: z.number().int(),
	otrosContratos: z.array(contratoBreve).default([]),
	/** Primer mes cuyos reportes toman al firmante nuevo. */
	desdeMes: fecha.optional()
});
export type ImpactoCambio = z.infer<typeof esquemaImpactoCambio>;

export const esquemaResultadoEdicion = z.object({
	ensayo: z.boolean(),
	cambios: z.array(esquemaCambioCampo),
	impacto: esquemaImpactoCambio,
	aplicado: z
		.object({
			cambioId: id,
			borradoresActualizados: z.array(id),
			borradoresConAviso: z.array(id)
		})
		.optional()
});
export type ResultadoEdicion = z.infer<typeof esquemaResultadoEdicion>;

export const esquemaCambioCatalogo = z.object({
	id,
	entidad: z.enum(ENTIDADES_CATALOGO),
	entidadId: id,
	contratoId: id.nullable(),
	accion: z.enum(ACCIONES_CATALOGO),
	cambios: z.array(esquemaCambioCampo),
	motivo: z.string().nullable(),
	efectos: z.record(z.string(), z.unknown()),
	usuarioId: id.nullable(),
	usuarioTexto: z.string().nullable(),
	origen: z.enum(ORIGENES_CAMBIO),
	realizadoEn: marcaDeTiempo
});
export type CambioCatalogo = z.infer<typeof esquemaCambioCatalogo>;

export const esquemaPaginaCambios = z.object({
	total: z.number().int().nonnegative(),
	pagina: z.number().int().positive(),
	tamano: z.number().int().positive(),
	filas: z.array(esquemaCambioCatalogo)
});
export type PaginaCambios = z.infer<typeof esquemaPaginaCambios>;

export const esquemaResumenSitio = z.object({
	sitioId: id,
	partidas: z.number().int(),
	programas: z.number().int(),
	reportes: z.number().int(),
	otrosContratos: z.array(contratoBreve)
});
export type ResumenSitio = z.infer<typeof esquemaResumenSitio>;

/** Datos del contrato que cambiaron desde la copia que recibió el reporte. */
export const esquemaEstadoContratoReporte = z.object({
	cambiado: z.boolean(),
	datos: z.array(z.object({ campo: z.string(), reporte: z.unknown(), contrato: z.unknown() }))
});
export type EstadoContratoReporte = z.infer<typeof esquemaEstadoContratoReporte>;

export const esquemaAlcancePartida = z.object({
	id: id.optional(),
	orden: z.number().int().positive().optional(),
	tipo: z.enum(TIPOS_ALCANCE),
	texto: z.string().trim().min(1)
});
export type AlcancePartida = z.infer<typeof esquemaAlcancePartida>;

export const esquemaHerramienta = z.object({
	id: id.optional(),
	orden: z.number().int().positive().optional(),
	cantidad: textoOpcional,
	descripcion: z.string().trim().min(1)
});
export type Herramienta = z.infer<typeof esquemaHerramienta>;

const camposPartida = {
	contratoId: id,
	sitioId: id,
	numero: z.string().trim().min(1),
	actividad: z.string().trim().min(1),
	nombreCorto: textoOpcional,
	descripcion: textoOpcional,
	distribucion: z.enum(['produccion', 'mantenimiento']).nullable(),
	periodicidad: z.enum(PERIODICIDADES),
	cantidadAnual: z.number().nonnegative().nullable(),
	entrega: textoOpcional,
	entregaOma: textoOpcional,
	entregaPropuesta: textoOpcional,
	requiereOdm: z.boolean(),
	requierePt: z.boolean(),
	requiereAst: z.boolean(),
	materialesPor: z.enum(['icsi', 'cliente']).nullable(),
	reportesHomologados: textoOpcional,
	tipoMantenimiento: z.string(),
	objetivo: textoOpcional,
	conclusionesBase: textoOpcional,
	disposicionFotos: z.enum(DISPOSICIONES),
	proponeVerificacion: z.boolean(),
	estadoCatalogo: z.enum(['confirmado', 'por_confirmar'])
};

export const esquemaPartida = z.object({
	id,
	...camposPartida,
	actualizadoEn: marcaDeTiempo,
	alcances: z.array(esquemaAlcancePartida),
	herramientas: z.array(esquemaHerramienta),
	equipos: z.array(esquemaEquipo)
});
export type Partida = z.infer<typeof esquemaPartida>;

/** Entrada para guardar una partida completa; los hijos se reemplazan. */
export const esquemaPartidaEntrada = z
	.object({
		id: id.optional(),
		...camposPartida,
		alcances: z.array(esquemaAlcancePartida),
		herramientas: z.array(esquemaHerramienta),
		equipoIds: z.array(id)
	})
	.partial({
		nombreCorto: true,
		descripcion: true,
		distribucion: true,
		cantidadAnual: true,
		entrega: true,
		entregaOma: true,
		entregaPropuesta: true,
		requiereOdm: true,
		requierePt: true,
		requiereAst: true,
		materialesPor: true,
		reportesHomologados: true,
		tipoMantenimiento: true,
		objetivo: true,
		conclusionesBase: true,
		disposicionFotos: true,
		proponeVerificacion: true,
		estadoCatalogo: true,
		alcances: true,
		herramientas: true,
		equipoIds: true
	});
export type PartidaEntrada = z.input<typeof esquemaPartidaEntrada>;

export const esquemaPartidaResumen = z.object({
	id,
	contratoId: id,
	sitioId: id,
	numero: z.string(),
	actividad: z.string(),
	nombreCorto: textoOpcional,
	periodicidad: z.enum(PERIODICIDADES),
	distribucion: z.enum(['produccion', 'mantenimiento']).nullable(),
	cantidadAnual: z.number().nullable(),
	disposicionFotos: z.enum(DISPOSICIONES),
	proponeVerificacion: z.boolean(),
	estadoCatalogo: z.enum(['confirmado', 'por_confirmar']),
	tieneEquipos: z.boolean()
});
export type PartidaResumen = z.infer<typeof esquemaPartidaResumen>;

export const esquemaPrograma = z.object({
	id,
	contratoId: id,
	sitioId: id,
	nombre: textoOpcional,
	periodoInicio: fecha,
	periodoFin: fecha,
	meses: z.array(fecha)
});
export type Programa = z.infer<typeof esquemaPrograma>;

export const esquemaCeldaPrograma = z.object({
	mes: fecha,
	programado: z.number().nullable(),
	realizado: z.number(),
	reportes: z.array(id),
	/** Ejecuciones con reporte emitido (varios reportes por TAG del mismo periodo cuentan una). */
	ejecucionesReportes: z.number(),
	/** Marcas R del Excel y realizados capturados a mano. */
	realizadoSinReporte: z.number()
});
export type CeldaPrograma = z.infer<typeof esquemaCeldaPrograma>;

export const esquemaAvancePrograma = z.object({
	programa: esquemaPrograma,
	partidas: z.array(
		z.object({
			id,
			numero: z.string(),
			actividad: z.string(),
			periodicidad: z.enum(PERIODICIDADES),
			distribucion: z.enum(['produccion', 'mantenimiento']).nullable(),
			cantidadAnual: z.number().nullable(),
			celdas: z.array(esquemaCeldaPrograma),
			totalProgramado: z.number(),
			totalRealizado: z.number(),
			diferencia: z.number().nullable()
		})
	)
});
export type AvancePrograma = z.infer<typeof esquemaAvancePrograma>;

export const esquemaRealizadoManual = z.object({
	id,
	programaId: id,
	partidaId: id,
	mes: fecha,
	cantidad: z.number().positive(),
	nota: z.string().trim().min(1),
	registradoEn: marcaDeTiempo
});
export type RealizadoManual = z.infer<typeof esquemaRealizadoManual>;

export const esquemaOcurrencia = z.object({
	tipo: z.enum(TIPOS_OCURRENCIA),
	numero: z.number().int().positive()
});

export const esquemaFirmaReporte = z.object({
	nombre: z.string(),
	cargo: z.string(),
	empresa: z.string()
});
export const esquemaFirmasReporte = z.object({
	elaboro: esquemaFirmaReporte.optional(),
	aprobo: esquemaFirmaReporte.optional(),
	recibio: esquemaFirmaReporte.optional()
});
export type FirmasReporte = z.infer<typeof esquemaFirmasReporte>;

export const esquemaFoto = z.object({
	id,
	alcanceId: id,
	orden: z.number().int().positive(),
	descripcion: z.string(),
	momento: z.enum(MOMENTOS_FOTO).nullable(),
	rutaOriginal: z.string(),
	rutaOptimizada: z.string(),
	ancho: z.number().int().positive(),
	alto: z.number().int().positive(),
	bytes: z.number().int().positive(),
	tipoMime: z.string(),
	rotacion: z.union(ROTACIONES_FOTO.map((r) => z.literal(r))).default(0)
});
export type Foto = z.infer<typeof esquemaFoto>;

export const esquemaAlcanceReporte = z.object({
	id,
	orden: z.number().int().positive(),
	titulo: z.string(),
	descripcion: z.string(),
	estadoVerificacion: z.enum(ESTADOS_VERIFICACION),
	observaciones: z.string(),
	partidaAlcanceId: id.nullable(),
	fotos: z.array(esquemaFoto)
});
export type AlcanceReporte = z.infer<typeof esquemaAlcanceReporte>;

export const esquemaDocumentoGenerado = z.object({
	id,
	reporteId: id.optional(),
	reporteVersion: z.number().int(),
	versionPlantilla: z.string(),
	ruta: z.string(),
	nombreArchivo: z.string(),
	bytes: z.number().int().positive(),
	generadoEn: marcaDeTiempo
});
export type DocumentoGenerado = z.infer<typeof esquemaDocumentoGenerado>;

/** Un día (desde = hasta) o un rango de días de ejecución. */
export const esquemaSegmentoDias = z.object({ desde: fecha, hasta: fecha });
export type SegmentoDiasEsquema = z.infer<typeof esquemaSegmentoDias>;

/**
 * Días de ejecución: a lo sumo 31 segmentos en orden, sin traslapes y de un solo mes (que sea el del
 * periodo lo controla la base).
 */
export const esquemaDiasEjecucion = z
	.array(esquemaSegmentoDias)
	.max(31)
	.refine(
		(segmentos) =>
			segmentos.every(
				(s, i) =>
					s.desde <= s.hasta &&
					s.desde.slice(0, 7) === segmentos[0].desde.slice(0, 7) &&
					s.hasta.slice(0, 7) === segmentos[0].desde.slice(0, 7) &&
					(i === 0 || s.desde > segmentos[i - 1].hasta)
			),
		'Los días de ejecución deben estar en orden, sin repetirse y en un solo mes'
	);

export const esquemaReporte = z.object({
	id,
	contratoId: id,
	sitioId: id,
	partidaId: id,
	periodoMes: fecha,
	ocurrencia: esquemaOcurrencia.nullable(),
	/** Primer día de ejecución, derivado de los días (solo lectura). */
	fechaEjecucion: fecha.nullable(),
	/** Último día de ejecución, derivado de los días (solo lectura). */
	fechaEjecucionFin: fecha.nullable(),
	diasEjecucion: esquemaDiasEjecucion,
	titulo: z.string(),
	usuario: z.string(),
	contratoTexto: z.string(),
	sitioTexto: z.string(),
	periodicidad: z.string(),
	tipoMantenimiento: z.string(),
	actividad: z.string(),
	numeroPartida: z.string(),
	nombreCorto: textoOpcional,
	objetivo: z.string(),
	introduccion: z.string(),
	conclusiones: z.string(),
	disposicionFotos: z.enum(DISPOSICIONES),
	incluyeVerificacion: z.boolean(),
	firmantes: esquemaFirmasReporte,
	estado: z.enum(ESTADOS_REPORTE),
	version: z.number().int().positive(),
	revision: z.number().int().nonnegative(),
	sustituyeA: id.nullable(),
	emitidoEn: marcaDeTiempo.nullable(),
	creadoEn: marcaDeTiempo,
	actualizadoEn: marcaDeTiempo,
	alcances: z.array(esquemaAlcanceReporte),
	herramientas: z.array(esquemaHerramienta),
	equipos: z.array(esquemaEquipo.extend({ orden: z.number().int().positive() })),
	documentos: z.array(esquemaDocumentoGenerado),
	/** Huella del contenido del catálogo copiado o aplicado por última vez. */
	catalogoHuella: z.string()
});
export type Reporte = z.infer<typeof esquemaReporte>;

/** Reporte nuevo ya prellenado desde el catálogo. */
export const esquemaReporteNuevo = z.object({
	id: id.optional(),
	partidaId: id,
	periodoMes: fecha,
	ocurrencia: esquemaOcurrencia.nullable().optional(),
	diasEjecucion: esquemaDiasEjecucion.optional(),
	titulo: z.string().min(1),
	usuario: z.string(),
	contratoTexto: z.string(),
	sitioTexto: z.string(),
	periodicidad: z.string(),
	tipoMantenimiento: z.string(),
	actividad: z.string(),
	numeroPartida: z.string(),
	nombreCorto: textoOpcional.optional(),
	objetivo: z.string(),
	introduccion: z.string(),
	conclusiones: z.string(),
	disposicionFotos: z.enum(DISPOSICIONES),
	incluyeVerificacion: z.boolean(),
	firmantes: esquemaFirmasReporte,
	alcances: z.array(
		z.object({
			titulo: z.string(),
			descripcion: z.string(),
			partidaAlcanceId: id.nullable().optional()
		})
	),
	herramientas: z.array(esquemaHerramienta),
	equipoIds: z.array(id),
	catalogoHuella: z.string().optional()
});
export type ReporteNuevo = z.input<typeof esquemaReporteNuevo>;

/** Estado completo de un borrador al guardarlo (autoguardado). */
export const esquemaReporteGuardado = z.object({
	id,
	version: z.number().int().positive(),
	diasEjecucion: esquemaDiasEjecucion,
	titulo: z.string().min(1),
	tipoMantenimiento: z.string(),
	objetivo: z.string(),
	introduccion: z.string(),
	conclusiones: z.string(),
	incluyeVerificacion: z.boolean(),
	firmantes: esquemaFirmasReporte,
	alcances: z.array(
		z.object({
			id: id.optional(),
			titulo: z.string(),
			descripcion: z.string(),
			estadoVerificacion: z.enum(ESTADOS_VERIFICACION),
			observaciones: z.string(),
			partidaAlcanceId: id.nullable().optional(),
			fotos: z.array(
				z.object({
					id,
					descripcion: z.string(),
					momento: z.enum(MOMENTOS_FOTO).nullable(),
					// Sin giro la foto conserva el suyo (p. ej., un envío de una pestaña anterior).
					rotacion: z.union(ROTACIONES_FOTO.map((r) => z.literal(r))).optional()
				})
			)
		})
	),
	herramientas: z.array(esquemaHerramienta),
	equipoIds: z.array(id)
});
export type ReporteGuardado = z.input<typeof esquemaReporteGuardado>;

export const esquemaReporteResumen = z.object({
	id,
	/** Desde 0013: relacionan el reporte con su partida y sitio sin comparar textos. */
	partidaId: id,
	sitioId: id,
	titulo: z.string(),
	clienteClave: z.string(),
	usuario: z.string(),
	contratoTexto: z.string(),
	sitioTexto: z.string(),
	numeroPartida: z.string(),
	actividad: z.string(),
	tags: z.string().nullable(),
	periodoMes: fecha,
	ocurrencia: esquemaOcurrencia.nullable(),
	estado: z.enum(ESTADOS_REPORTE),
	revision: z.number().int(),
	actualizadoEn: marcaDeTiempo,
	documento: z.object({ id, nombreArchivo: z.string(), generadoEn: marcaDeTiempo }).nullable()
});
export type ReporteResumen = z.infer<typeof esquemaReporteResumen>;

export const esquemaPaginaReportes = z.object({
	total: z.number().int().nonnegative(),
	pagina: z.number().int().positive(),
	tamano: z.number().int().positive(),
	filas: z.array(esquemaReporteResumen)
});
export type PaginaReportes = z.infer<typeof esquemaPaginaReportes>;

export const esquemaFiltroReportes = z
	.object({
		clienteClave: z.string(),
		contratoId: id,
		sitioId: id,
		partidaId: id,
		tag: z.string().trim().min(1),
		estado: z.enum(ESTADOS_REPORTE),
		desde: fecha,
		hasta: fecha,
		pagina: z.number().int().positive(),
		tamano: z.number().int().positive().max(100)
	})
	.partial();
export type FiltroReportes = z.input<typeof esquemaFiltroReportes>;
