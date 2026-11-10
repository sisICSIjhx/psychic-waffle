// Constantes del dominio (listas cerradas y etiquetas) sin dependencias. Viven aparte de los esquemas
// Zod para que los componentes del navegador las usen sin descargar Zod; esquemas.ts las reexporta.

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
/** Dónde está el archivo de una foto; de SharePoint la base solo guarda la URL. */
export const ALMACENAMIENTOS_FOTO = ['local', 'sharepoint'] as const;
export const ROLES_PERSONAL = [
	'administrador',
	'lider_administrativo',
	'lider_operativo',
	'reporteador',
	'mesa_directiva',
	'contabilidad'
] as const;
export type RolPersonal = (typeof ROLES_PERSONAL)[number];

/** Estados de un equipo del catálogo; «baja» no cuenta en los indicadores. */
export const ESTADOS_EQUIPO = [
	'en_servicio',
	'fuera_de_servicio',
	'fuera_de_operacion',
	'baja'
] as const;
export type EstadoEquipo = (typeof ESTADOS_EQUIPO)[number];

// Bitácora del catálogo (cambio edicion-contratos-bitacora).
export const ENTIDADES_CATALOGO = ['contrato', 'sitio', 'firmante', 'contrato_sitio'] as const;
export const ACCIONES_CATALOGO = ['crear', 'editar', 'reemplazar', 'asociar', 'quitar'] as const;
export const ORIGENES_CAMBIO = ['interfaz', 'script'] as const;

// Ajustes del programa (cambio tablero-cumplimiento): el plan original no cambia; lo reprogramado y
// lo no ejecutado se registran aparte.
export const TIPOS_AJUSTE = ['reprogramado', 'no_ejecutado'] as const;
export const MOTIVOS_AJUSTE = [
	'cliente_operacion',
	'clima',
	'materiales_refacciones',
	'acceso_permisos',
	'personal',
	'otro'
] as const;
export type MotivoAjuste = (typeof MOTIVOS_AJUSTE)[number];
export const ETIQUETA_MOTIVO_AJUSTE: Record<MotivoAjuste, string> = {
	cliente_operacion: 'Cliente u operación',
	clima: 'Clima',
	materiales_refacciones: 'Materiales o refacciones',
	acceso_permisos: 'Acceso o permisos',
	personal: 'Personal',
	otro: 'Otro'
};
