// Centros de costo (cambio centros-costo-plantillas): lista con contrato, plantilla y personas, y
// alta o edición del nombre y la plantilla. Consultar es de todos (filtrado por alcance); editar,
// de quien edita el catálogo.
import { fail } from '@sveltejs/kit';
import { centrosVisibles } from '$lib/server/alcance';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puedeEditarCatalogo } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();
const SIN_PERMISO = 'No tiene permiso para editar el catálogo.';

export const load: PageServerLoad = async ({ locals }) => {
	const repos = await datos();
	const puedeEditar = puedeEditarCatalogo(locals);
	const [centros, plantillas] = await Promise.all([
		repos.centrosCosto.listar(centrosVisibles(locals)),
		puedeEditar ? repos.centrosCosto.listarPlantillas() : Promise.resolve([])
	]);
	return {
		centros,
		plantillas: plantillas.map((p) => ({ id: p.id, nombre: p.nombre })),
		puedeEditar
	};
};

export const actions: Actions = {
	guardar: async ({ request, locals }) => {
		if (!puedeEditarCatalogo(locals)) return fail(403, { accion: 'guardar', error: SIN_PERMISO });
		const formulario = await request.formData();
		const id = texto(formulario, 'id') || undefined;
		try {
			const centro = await (
				await datos()
			).centrosCosto.guardar({
				id,
				clave: id ? undefined : texto(formulario, 'clave'),
				nombre: texto(formulario, 'nombre'),
				plantillaId: texto(formulario, 'plantillaId') || null
			});
			return {
				accion: 'guardar',
				mensaje: id
					? `Centro de costo ${centro.clave} actualizado.`
					: `Centro de costo ${centro.clave} registrado.`
			};
		} catch (error) {
			return fail(400, { accion: 'guardar', error: mensajeDeError(error), id: id ?? null });
		}
	}
};
