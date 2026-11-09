import { fail } from '@sveltejs/kit';
import { fechaEnZona } from '$lib/dominio/fechas';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { leerExcelEquipos } from '$lib/server/importacion/equipos';
import { LIMITE_LIBRO_BYTES } from '$lib/server/importacion/xlsx';
import { puedeEditarCatalogo } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();

export const load: PageServerLoad = async ({ url, locals }) => {
	const repos = await datos();
	const clientes = await repos.catalogo.listarClientes();
	const proyecto =
		clientes.find((c) => c.clave === url.searchParams.get('proyecto')) ?? clientes[0] ?? null;
	const [equipos, sitios] = proyecto
		? await Promise.all([
				repos.equipos.listarDeProyecto(proyecto.id),
				repos.equipos.sitiosDeProyecto(proyecto.id)
			])
		: [[], []];
	return {
		clientes,
		proyecto,
		equipos,
		sitios,
		hoy: fechaEnZona(),
		eliminado: url.searchParams.has('eliminado'),
		puedeEditar: puedeEditarCatalogo(locals)
	};
};

export const actions: Actions = {
	/** «Revisar» (ensayo, sin escribir) o «Importar» el Excel en un sitio del proyecto. */
	importar: async ({ request, locals }) => {
		if (!puedeEditarCatalogo(locals)) {
			return fail(403, { accion: 'importar', error: 'No tiene permiso para editar el catálogo.' });
		}
		const formulario = await request.formData();
		const ensayo = texto(formulario, 'modo') !== 'importar';
		const archivo = formulario.get('archivo');
		const sitioId = texto(formulario, 'sitioId');
		if (!(archivo instanceof File) || archivo.size === 0) {
			return fail(400, { accion: 'importar', error: 'Elija el archivo de Excel (.xlsx).' });
		}
		if (archivo.size > LIMITE_LIBRO_BYTES) {
			return fail(400, {
				accion: 'importar',
				error: `El archivo supera los ${LIMITE_LIBRO_BYTES / 1048576} MB.`
			});
		}
		try {
			const repos = await datos();
			const sitios = await repos.equipos.sitiosDeProyecto(texto(formulario, 'clienteId'));
			if (!sitios.some((s) => s.id === sitioId)) {
				return fail(400, { accion: 'importar', error: 'Elija un sitio del proyecto.' });
			}
			const lectura = await leerExcelEquipos(await archivo.arrayBuffer());
			if (lectura.equipos.length === 0) {
				return fail(400, {
					accion: 'importar',
					error: 'El archivo no tiene equipos con «Equipo ID».',
					avisos: lectura.avisos
				});
			}
			const resultado = await repos.equipos.importar(sitioId, lectura.equipos, ensayo);
			const sitio = sitios.find((s) => s.id === sitioId)!;
			return {
				accion: 'importar',
				ensayo,
				archivo: archivo.name,
				hoja: lectura.hoja,
				sitio: sitio.clave,
				leidos: lectura.equipos.length,
				resultado,
				avisos: lectura.avisos,
				mensaje: ensayo
					? undefined
					: `Importación terminada en ${sitio.clave}: ${resultado.nuevos} nuevos y ${resultado.actualizados} actualizados.`
			};
		} catch (error) {
			return fail(400, { accion: 'importar', error: mensajeDeError(error) });
		}
	}
};
