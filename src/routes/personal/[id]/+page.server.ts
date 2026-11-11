import { error as errorHttp, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { olvidarContextos } from '$lib/server/autenticacion/contexto';
import { generarContrasenaDe, quitarAcceso } from '$lib/server/autenticacion/servicio';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puedeAdministrarPersonal } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();

const SIN_PERMISO = 'No tiene permiso para administrar el personal.';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!puedeAdministrarPersonal(locals))
		errorHttp(403, 'No tiene permiso para administrar el personal');
	const repos = await datos();
	const centros = await repos.centrosCosto.listar();
	// Las cuentas solo se administran con el inicio de sesión activado (ver generarContrasena).
	const sesionActivada = Boolean(locals?.autenticacion);
	if (params.id === 'nuevo') return { persona: null, centros, creado: false, sesionActivada };
	const persona = await repos.personal.obtener(params.id).catch(() => null);
	if (!persona) errorHttp(404, 'Persona no encontrada');
	return { persona, centros, creado: url.searchParams.has('creado'), sesionActivada };
};

export const actions: Actions = {
	guardar: async ({ request, params, locals }) => {
		if (!puedeAdministrarPersonal(locals)) return fail(403, { error: SIN_PERMISO });
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
				fechaNacimiento: texto(formulario, 'fechaNacimiento') || null,
				correo: texto(formulario, 'correo') || null,
				sede: texto(formulario, 'sede') || null,
				rol: texto(formulario, 'rol'),
				// En el alta no hay casilla: toda persona nueva queda activa.
				activo: nueva || formulario.get('activo') === 'on',
				centroCostoIds: formulario.getAll('centroCostoIds').map(String)
			});
			id = persona.id;
		} catch (error) {
			return fail(400, { error: mensajeDeError(error) });
		} finally {
			// El rol, la baja o el nombre de alguien con sesión cambian en su siguiente petición.
			olvidarContextos();
		}
		if (nueva) redirect(303, `${resolve('/personal/[id]', { id })}?creado`);
		return { mensaje: 'Cambios guardados.' };
	},

	// La contraseña temporal viaja una sola vez, en esta respuesta; no se guarda ni se registra.
	generarContrasena: async ({ params, locals }) => {
		if (!puedeAdministrarPersonal(locals)) return fail(403, { errorAcceso: SIN_PERMISO });
		// Sin activar, la primera cuenta dejaría fuera a quien la genera antes de ver la contraseña.
		if (!locals.autenticacion) {
			return fail(400, { errorAcceso: 'Active primero el inicio de sesión.' });
		}
		try {
			const { temporal } = await generarContrasenaDe(await datos(), params.id);
			return { temporal };
		} catch (error) {
			return fail(400, { errorAcceso: mensajeDeError(error) });
		}
	},

	quitarAcceso: async ({ params, locals }) => {
		if (!puedeAdministrarPersonal(locals)) return fail(403, { errorAcceso: SIN_PERMISO });
		try {
			await quitarAcceso(await datos(), params.id);
			return { mensajeAcceso: 'Acceso retirado. La persona ya no puede iniciar sesión.' };
		} catch (error) {
			return fail(400, { errorAcceso: mensajeDeError(error) });
		}
	}
};
