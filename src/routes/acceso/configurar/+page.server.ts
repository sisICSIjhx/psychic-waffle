// Activación del inicio de sesión: crea la primera cuenta, de un administrador, mientras no exista
// ninguna. Desde entonces la aplicación exige sesión y esta página deja de estar disponible.
import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { nombreCompleto } from '$lib/dominio/personal';
import { activarInicioSesion } from '$lib/server/autenticacion/servicio';
import { COOKIE_SESION, opcionesCookie } from '$lib/server/autenticacion/sesiones';
import { LARGO_MINIMO } from '$lib/server/autenticacion/contrasenas';
import { datos } from '$lib/server/datos';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.autenticacion) redirect(303, resolve('/acceso'));
	const candidatos = (await (await datos()).personal.listar())
		.filter((p) => p.activo && p.rol === 'administrador' && p.correo)
		.map((p) => ({ id: p.id, nombre: nombreCompleto(p), correo: p.correo as string }));
	return { candidatos, largoMinimo: LARGO_MINIMO };
};

export const actions: Actions = {
	activar: async ({ request, cookies, url }) => {
		const formulario = await request.formData();
		const personalId = String(formulario.get('personalId') ?? '');
		const resultado = await activarInicioSesion(await datos(), {
			personalId,
			contrasena: String(formulario.get('contrasena') ?? ''),
			confirmacion: String(formulario.get('confirmacion') ?? ''),
			agente: request.headers.get('user-agent')
		});
		if (!resultado.ok) return fail(400, { personalId, error: resultado.mensaje });
		cookies.set(COOKIE_SESION, resultado.token, opcionesCookie(url));
		redirect(303, resolve('/'));
	}
};
