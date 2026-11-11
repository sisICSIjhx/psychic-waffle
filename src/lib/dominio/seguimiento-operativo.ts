export const ESTADOS_SEGUIMIENTO = {
	pendiente: 'Pendiente',
	en_proceso: 'En proceso',
	hecho: 'Hecho'
} as const;

export const ESTADOS_CARPETA = {
	pendiente: 'Pendiente',
	en_proceso: 'En preparación',
	entregada: 'Entregada'
} as const;

export const MAX_ARCHIVO_CARPETA = 8 * 1024 * 1024;
