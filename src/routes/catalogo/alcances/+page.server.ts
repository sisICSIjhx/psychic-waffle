import { fail } from '@sveltejs/kit';
import { TIPOS_ALCANCE } from '$lib/dominio/esquemas';
import { alcanceDe, filtrarPor } from '$lib/server/alcance';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puedeEditarCatalogo } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();
const SIN_PERMISO = 'No tiene permiso para editar el catálogo.';

function tipoDe(formulario: FormData) {
	const tipo = texto(formulario, 'tipo');
	return (TIPOS_ALCANCE as readonly string[]).includes(tipo)
		? (tipo as (typeof TIPOS_ALCANCE)[number])
		: 'alcance';
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const repos = await datos();
	// Solo los proyectos con alguno de los centros de costo de quien consulta.
	const clientes = filtrarPor(
		await alcanceDe(repos, locals),
		'clientes',
		await repos.catalogo.listarClientes(),
		(c) => c.id
	);
	const proyecto =
		clientes.find((c) => c.clave === url.searchParams.get('proyecto')) ?? clientes[0] ?? null;
	const alcances = proyecto
		? await repos.catalogo.listarAlcancesPredeterminados({ clienteId: proyecto.id })
		: [];
	return { clientes, proyecto, alcances, puedeEditar: puedeEditarCatalogo(locals) };
};

export const actions: Actions = {
	guardar: async ({ request, locals }) => {
		if (!puedeEditarCatalogo(locals)) return fail(403, { accion: 'guardar', error: SIN_PERMISO });
		const formulario = await request.formData();
		const id = texto(formulario, 'id') || undefined;
		try {
			await (
				await datos()
			).catalogo.guardarAlcancePredeterminado({
				id,
				clienteId: id ? undefined : texto(formulario, 'clienteId'),
				tipo: tipoDe(formulario),
				grupo: texto(formulario, 'grupo') || null,
				texto: texto(formulario, 'texto')
			});
		} catch (error) {
			return fail(400, { accion: 'guardar', id: id ?? null, error: mensajeDeError(error) });
		}
		return { accion: 'guardar', mensaje: id ? 'Alcance actualizado.' : 'Alcance agregado.' };
	},

	alternar: async ({ request, locals }) => {
		if (!puedeEditarCatalogo(locals)) return fail(403, { accion: 'alternar', error: SIN_PERMISO });
		const formulario = await request.formData();
		const activo = texto(formulario, 'activo') === 'true';
		try {
			await (
				await datos()
			).catalogo.guardarAlcancePredeterminado({
				id: texto(formulario, 'id'),
				tipo: tipoDe(formulario),
				grupo: texto(formulario, 'grupo') || null,
				texto: texto(formulario, 'texto'),
				activo
			});
		} catch (error) {
			return fail(400, { accion: 'alternar', error: mensajeDeError(error) });
		}
		return {
			accion: 'alternar',
			mensaje: activo
				? 'Alcance activado.'
				: 'Alcance desactivado: ya no se ofrece en las partidas.'
		};
	},

	eliminar: async ({ request, locals }) => {
		if (!puedeEditarCatalogo(locals)) return fail(403, { accion: 'eliminar', error: SIN_PERMISO });
		const formulario = await request.formData();
		try {
			await (await datos()).catalogo.eliminarAlcancePredeterminado(texto(formulario, 'id'));
		} catch (error) {
			return fail(400, { accion: 'eliminar', error: mensajeDeError(error) });
		}
		return { accion: 'eliminar', mensaje: 'Alcance eliminado. Las partidas conservan su copia.' };
	}
};
