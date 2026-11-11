// Mi perfil: datos de la cuenta y cambio de contraseña. Con una contraseña temporal, la guardia de
// hooks.server.ts trae aquí a la persona hasta que la cambie.
import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { ETIQUETAS_ROL, textoCentros } from '$lib/dominio/personal';
import { LARGO_MINIMO } from '$lib/server/autenticacion/contrasenas';
import { cambiarContrasena } from '$lib/server/autenticacion/servicio';
import { COOKIE_SESION } from '$lib/server/autenticacion/sesiones';
import { datos } from '$lib/server/datos';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const usuario = locals?.usuario;
	if (!usuario) return { cuenta: null, largoMinimo: LARGO_MINIMO };
	const persona = await (await datos()).personal.obtener(usuario.id);
	return {
		cuenta: {
			nombre: usuario.nombre,
			correo: usuario.correo,
			rol: ETIQUETAS_ROL[usuario.rol],
			sede: persona.sede,
			centrosCosto: textoCentros(persona),
			debeCambiar: usuario.debeCambiar
		},
		largoMinimo: LARGO_MINIMO
	};
};

export const actions: Actions = {
	cambiarContrasena: async ({ request, cookies, locals }) => {
		const usuario = locals.usuario;
		if (!usuario) return fail(401, { error: 'Inicie sesión para cambiar su contraseña.' });
		const formulario = await request.formData();
		const resultado = await cambiarContrasena(
			await datos(),
			usuario,
			{
				actual: String(formulario.get('actual') ?? ''),
				nueva: String(formulario.get('nueva') ?? ''),
				confirmacion: String(formulario.get('confirmacion') ?? '')
			},
			cookies.get(COOKIE_SESION) ?? null
		);
		if (!resultado.ok) return fail(400, { error: resultado.mensaje });
		// Quien venía obligado a cambiarla sigue a su trabajo; los demás se quedan en el perfil.
		if (usuario.debeCambiar) redirect(303, resolve('/'));
		return { mensaje: 'Contraseña cambiada. Las demás sesiones abiertas se cerraron.' };
	}
};
