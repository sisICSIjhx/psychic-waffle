// Sesión y permisos de cada petición (cambio inicio-sesion-roles), encabezados de seguridad comunes
// a todas las respuestas y registro de errores inesperados sin exponer detalles internos al
// navegador. La CSP se configura en svelte.config.js (kit.csp).
import { error, json, redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { base } from '$app/paths';
import { centrosVisibles, recursoDeRuta } from '$lib/server/alcance';
import { decidirAcceso } from '$lib/server/autenticacion/acceso';
import { contextoDeAcceso } from '$lib/server/autenticacion/contexto';
import { COOKIE_SESION } from '$lib/server/autenticacion/sesiones';
import { datos } from '$lib/server/datos';

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

type Evento = Parameters<Handle>[0]['event'];

/**
 * Llena `locals` con la sesión validada y aplica la política de acceso antes de cualquier carga o
 * acción. Devuelve una respuesta si la petición no debe seguir; las redirecciones y los errores se
 * lanzan para que SvelteKit los entregue en la forma que espera cada tipo de petición.
 */
async function aplicarAcceso(event: Evento): Promise<Response | null> {
	const token = event.cookies.get(COOKIE_SESION) ?? null;
	const contexto = await contextoDeAcceso((await datos()).autenticacion, token);
	event.locals.autenticacion = contexto.activada;
	event.locals.usuario = contexto.usuario;
	// Una cookie que ya no corresponde a ninguna sesión se retira.
	if (token && !contexto.usuario) event.cookies.delete(COOKIE_SESION, { path: '/' });

	const ruta = event.url.pathname.slice(base.length) || '/';
	const decision = decidirAcceso(contexto, {
		ruta,
		busqueda: event.url.search,
		metodo: event.request.method,
		navegacion:
			event.isDataRequest || (event.request.headers.get('accept') ?? '').includes('text/html')
	});
	if (decision.tipo === 'redirigir') redirect(303, `${base}${decision.a}`);
	if (decision.tipo === 'rechazar') return rechazar(event, decision.estado, decision.mensaje);
	// Un reporte, partida, contrato o equipo de un centro de costo ajeno no existe para quien lo pide
	// (cambio centros-costo-plantillas, D8): cubre la carga, las acciones, el documento y las fotos.
	const visibles = centrosVisibles(event.locals);
	const recurso = visibles ? recursoDeRuta(ruta) : null;
	if (visibles && recurso) {
		const centros = await (await datos()).centrosCosto.centrosDeRecurso(recurso.tipo, recurso.id);
		if (!centros.some((id) => visibles.includes(id))) return rechazar(event, 404, 'No encontrado');
	}
	return null;
}

function rechazar(event: Evento, estado: number, mensaje: string): Response {
	// Las acciones de formulario esperan un resultado con esta forma para mostrar el mensaje.
	if (event.request.headers.get('x-sveltekit-action') === 'true') {
		return json({ type: 'error', status: estado, error: { message: mensaje } }, { status: estado });
	}
	error(estado, mensaje);
}

export const handle: Handle = async ({ event, resolve }) => {
	const respuesta = (await aplicarAcceso(event)) ?? (await resolve(event));
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
