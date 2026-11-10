// Inicio y cierre de sesión (cambio inicio-sesion-roles). La guardia de hooks.server.ts deja pasar
// esta ruta sin sesión; aquí se decide qué mostrar según el estado del acceso.
import { fail, redirect } from '@sveltejs/kit';
import { base, resolve } from '$app/paths';
import { destinoSeguro } from '$lib/server/autenticacion/acceso';
import { cerrarSesion, iniciarSesion } from '$lib/server/autenticacion/servicio';
import { COOKIE_SESION, opcionesCookie } from '$lib/server/autenticacion/sesiones';
import { datos } from '$lib/server/datos';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	// Sin cuentas no hay con qué entrar: primero se activa el inicio de sesión.
	if (!locals.autenticacion) redirect(303, resolve('/acceso/configurar'));
	const destino = destinoSeguro(url.searchParams.get('destino'));
	if (locals.usuario) redirect(303, `${base}${destino}`);
	return { destino };
};

export const actions: Actions = {
	entrar: async ({ request, cookies, url, getClientAddress }) => {
		const formulario = await request.formData();
		const correo = String(formulario.get('correo') ?? '').trim();
		const destino = destinoSeguro(String(formulario.get('destino') ?? ''));
		let direccion: string | null = null;
		try {
			direccion = getClientAddress();
		} catch {
			// Algunos entornos no conocen la dirección: todos comparten entonces el mismo límite.
		}
		const resultado = await iniciarSesion(await datos(), {
			correo,
			contrasena: String(formulario.get('contrasena') ?? ''),
			agente: request.headers.get('user-agent'),
			direccion
		});
		if (!resultado.ok) {
			// La contraseña no vuelve al formulario; el correo sí, para no escribirlo otra vez.
			return fail(resultado.motivo === 'limite' ? 429 : 400, {
				correo,
				destino,
				error: resultado.mensaje
			});
		}
		cookies.set(COOKIE_SESION, resultado.token, opcionesCookie(url));
		redirect(303, resultado.usuario.debeCambiar ? resolve('/perfil') : `${base}${destino}`);
	},

	salir: async ({ cookies }) => {
		await cerrarSesion(await datos(), cookies.get(COOKIE_SESION) ?? null);
		cookies.delete(COOKIE_SESION, { path: '/' });
		redirect(303, resolve('/acceso'));
	}
};
