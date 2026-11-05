import { error as errorHttp, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puedeAdministrarPersonal } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();

export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!puedeAdministrarPersonal(locals))
		errorHttp(403, 'No tiene permiso para administrar el personal');
	const repos = await datos();
	const clientes = await repos.catalogo.listarClientes();
	if (params.id === 'nuevo') return { persona: null, clientes, creado: false };
	const persona = await repos.personal.obtener(params.id).catch(() => null);
	if (!persona) errorHttp(404, 'Persona no encontrada');
	return { persona, clientes, creado: url.searchParams.has('creado') };
};

export const actions: Actions = {
	guardar: async ({ request, params, locals }) => {
		if (!puedeAdministrarPersonal(locals)) {
			return fail(403, { error: 'No tiene permiso para administrar el personal.' });
		}
		const formulario = await request.formData();
		const nueva = params.id === 'nuevo';
		let id: string;
		try {
			const persona = await (
				await datos()
			).personal.guardar({
				id: nueva ? undefined : params.id,
				nombre: texto(formulario, 'nombre'),
				apellidoPaterno: texto(formulario, 'apellidoPaterno'),
				apellidoMaterno: texto(formulario, 'apellidoMaterno') || null,
				fechaNacimiento: texto(formulario, 'fechaNacimiento'),
				correo: texto(formulario, 'correo') || null,
				rol: texto(formulario, 'rol'),
				// En el alta no hay casilla: toda persona nueva queda activa.
				activo: nueva || formulario.get('activo') === 'on',
				clienteIds: formulario.getAll('clienteIds').map(String)
			});
			id = persona.id;
		} catch (error) {
			return fail(400, { error: mensajeDeError(error) });
		}
		if (nueva) redirect(303, `${resolve('/personal/[id]', { id })}?creado`);
		return { mensaje: 'Cambios guardados.' };
	}
};
