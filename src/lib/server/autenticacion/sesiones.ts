// Identificador de sesión y su cookie (cambio inicio-sesion-roles, D4 y D5). El identificador es
// opaco; la base solo guarda su SHA-256, así que leer la base no da cookies válidas.
import { createHash, randomBytes } from 'node:crypto';

export const COOKIE_SESION = 'icsi_sesion';
/** Duración máxima de una sesión: 7 días desde que se inicia. */
export const DURACION_SESION_MINUTOS = 7 * 24 * 60;
/** Sin uso durante 12 horas, la sesión deja de valer. */
export const INACTIVIDAD_MINUTOS = 12 * 60;

export function nuevoToken(): string {
	return randomBytes(32).toString('base64url');
}

export function resumenDeToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Opciones de la cookie: inaccesible para los scripts, solo para este sitio y con HTTPS cuando el
 * sitio se sirve por HTTPS (en la red local por HTTP, `secure` impediría guardarla).
 */
export function opcionesCookie(url: URL) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:',
		maxAge: DURACION_SESION_MINUTOS * 60
	};
}
