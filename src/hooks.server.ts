// Encabezados de seguridad comunes a todas las respuestas y registro de errores inesperados sin
// exponer detalles internos al navegador. La CSP se configura en svelte.config.js (kit.csp).
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';

const ENCABEZADOS_SEGURIDAD: Readonly<Record<string, string>> = {
	// El navegador respeta el Content-Type declarado (fotos, DOCX) y no adivina otro.
	'X-Content-Type-Options': 'nosniff',
	// Nadie puede incrustar la aplicación en un marco (clickjacking); equivale a frame-ancestors.
	'X-Frame-Options': 'DENY',
	// Las URL internas (ids de reportes) no salen hacia otros sitios.
	'Referrer-Policy': 'same-origin',
	// La aplicación no usa estas capacidades del navegador.
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Resource-Policy': 'same-origin',
	// Herramienta interna: que los buscadores no la indexen.
	'X-Robots-Tag': 'noindex, nofollow'
};

export const handle: Handle = async ({ event, resolve }) => {
	const respuesta = await resolve(event);
	const encabezados = { ...ENCABEZADOS_SEGURIDAD };
	// HSTS solo tiene sentido (y solo se respeta) sobre HTTPS.
	if (event.url.protocol === 'https:') {
		encabezados['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
	}
	try {
		for (const [nombre, valor] of Object.entries(encabezados)) {
			if (!respuesta.headers.has(nombre)) respuesta.headers.set(nombre, valor);
		}
		return respuesta;
	} catch {
		// Algunas respuestas tienen encabezados inmutables: se copian en una nueva.
		const copia = new Response(respuesta.body, respuesta);
		for (const [nombre, valor] of Object.entries(encabezados)) {
			if (!copia.headers.has(nombre)) copia.headers.set(nombre, valor);
		}
		return copia;
	}
};

/** Errores no previstos: se registran con un identificador y el navegador solo recibe ese id. */
export const handleError: HandleServerError = ({ error, event, status }) => {
	const id = randomUUID().slice(0, 8);
	if (status !== 404)
		console.error(`[error ${id}] ${event.request.method} ${event.url.pathname}`, error);
	return {
		message: status === 404 ? 'No encontrado' : 'Ocurrió un error inesperado. Intente de nuevo.',
		id
	};
};
