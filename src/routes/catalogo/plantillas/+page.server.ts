// Plantillas de seguimiento (cambio centros-costo-plantillas): lista, nueva, duplicar y eliminar.
// Solo para quien edita el catálogo.
import { error as errorHttp, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puedeEditarCatalogo } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();
const SIN_PERMISO = 'No tiene permiso para editar el catálogo.';

export const load: PageServerLoad = async ({ locals }) => {
	if (!puedeEditarCatalogo(locals)) errorHttp(403, SIN_PERMISO);
	return { plantillas: await (await datos()).centrosCosto.listarPlantillas() };
};

export const actions: Actions = {
	crear: async ({ request, locals }) => {
		if (!puedeEditarCatalogo(locals)) return fail(403, { accion: 'crear', error: SIN_PERMISO });
		const formulario = await request.formData();
		let id: string;
		try {
			const plantilla = await (
				await datos()
			).centrosCosto.guardarPlantilla({
				nombre: texto(formulario, 'nombre'),
				modoContrato: 'obligatorio',
				origenActividades: 'ninguno',
				conceptos: []
			});
			id = plantilla.id;
		} catch (error) {
			return fail(400, { accion: 'crear', error: mensajeDeError(error) });
		}
		redirect(303, resolve('/catalogo/plantillas/[id]', { id }));
	},

	duplicar: async ({ request, locals }) => {
		if (!puedeEditarCatalogo(locals)) return fail(403, { accion: 'duplicar', error: SIN_PERMISO });
		const formulario = await request.formData();
		let id: string;
		try {
			const copia = await (
				await datos()
			).centrosCosto.duplicarPlantilla(texto(formulario, 'id'), texto(formulario, 'nombre'));
			id = copia.id;
		} catch (error) {
			return fail(400, { accion: 'duplicar', error: mensajeDeError(error) });
		}
		redirect(303, resolve('/catalogo/plantillas/[id]', { id }));
	},

	eliminar: async ({ request, locals }) => {
		if (!puedeEditarCatalogo(locals)) return fail(403, { accion: 'eliminar', error: SIN_PERMISO });
		const formulario = await request.formData();
		try {
			await (await datos()).centrosCosto.eliminarPlantilla(texto(formulario, 'id'));
			return { accion: 'eliminar', mensaje: 'Plantilla eliminada.' };
		} catch (error) {
			return fail(400, { accion: 'eliminar', error: mensajeDeError(error) });
		}
	}
};
