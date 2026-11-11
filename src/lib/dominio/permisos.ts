// Qué puede hacer cada rol (cambio inicio-sesion-roles, D8). Sin dependencias de servidor: lo usan
// la guardia de las peticiones y el menú. Consultar está permitido a toda persona con sesión.
import type { RolPersonal } from './constantes.ts';

export const CAPACIDADES = [
	/** Crear, editar, enviar y emitir reportes, con sus fotos. */
	'capturar',
	/** Registrar ejecuciones, reprogramar y marcar como no ejecutado en el programa. */
	'ajustarPrograma',
	/** Actualizar las actividades, documentos, atenciones y carpetas de seguimiento. */
	'editarSeguimiento',
	/** Contratos, centros de costo, partidas, firmantes, alcances predeterminados y equipos. */
	'editarCatalogo',
	'verPersonal',
	/** Alta, edición y baja del personal, y sus cuentas. */
	'administrarPersonal',
	/** Consultar contrato, montos, órdenes de compra, carta de finalización y cobranza. */
	'verContrato',
	/** Llenar contrato, órdenes de compra, carta de finalización y el enlace del programa anual. */
	'editarContrato',
	/** Consultar el enlace de SharePoint del programa anual. */
	'verEnlacePrograma',
	/** Llenar la cobranza mensual: estimación, prefactura, factura, cobrado y monto. */
	'editarCobranza'
] as const;
export type Capacidad = (typeof CAPACIDADES)[number];

export const CAPACIDADES_POR_ROL: Record<RolPersonal, readonly Capacidad[]> = {
	administrador: CAPACIDADES,
	lider_administrativo: [
		'capturar',
		'ajustarPrograma',
		'editarSeguimiento',
		'verContrato',
		'editarContrato',
		'verEnlacePrograma'
	],
	lider_operativo: ['capturar', 'ajustarPrograma', 'editarSeguimiento', 'verEnlacePrograma'],
	reporteador: ['capturar', 'editarSeguimiento'],
	mesa_directiva: ['verPersonal', 'verContrato', 'verEnlacePrograma'],
	contabilidad: ['verContrato', 'editarCobranza']
};

/**
 * Contrato, montos y cobranza exigen una sesión con el rol adecuado: no quedan abiertos mientras el
 * inicio de sesión no esté activado (plan de seguimiento, apartado 2.3 y etapa 4).
 */
export const CAPACIDADES_CON_SESION: readonly Capacidad[] = [
	'verContrato',
	'editarContrato',
	'verEnlacePrograma',
	'editarCobranza'
];

export function rolPuede(rol: RolPersonal, capacidad: Capacidad): boolean {
	return CAPACIDADES_POR_ROL[rol].includes(capacidad);
}

export type Permisos = Record<Capacidad, boolean>;

/**
 * Permisos de quien hace la petición. Sin inicio de sesión activado está permitido lo que ya existía
 * antes de las cuentas, pero no lo que exige sesión; activado y sin sesión, nada.
 */
export function permisosDe(sesion: { activada: boolean; rol: RolPersonal | null }): Permisos {
	const permitido = (capacidad: Capacidad) =>
		(!sesion.activada && !CAPACIDADES_CON_SESION.includes(capacidad)) ||
		(sesion.rol !== null && rolPuede(sesion.rol, capacidad));
	return Object.fromEntries(CAPACIDADES.map((c) => [c, permitido(c)])) as Permisos;
}

/** El estado sin inicio de sesión y el valor por omisión de los componentes. */
export const PERMISOS_ABIERTOS: Permisos = permisosDe({ activada: false, rol: null });

/** Lo que el armazón (menú y cabecera) sabe de la sesión; lo carga `+layout.server.ts`. */
export interface SesionArmazon {
	/** Existe alguna cuenta: la aplicación exige sesión. */
	activada: boolean;
	usuario: { nombre: string; correo: string; rol: RolPersonal; debeCambiar: boolean } | null;
	permisos: Permisos;
}

export const SESION_ABIERTA: SesionArmazon = {
	activada: false,
	usuario: null,
	permisos: PERMISOS_ABIERTOS
};
