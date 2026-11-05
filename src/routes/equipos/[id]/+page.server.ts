import { error as errorHttp, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { ESTADOS_EQUIPO, type Cliente, type EstadoEquipo } from '$lib/dominio/esquemas';
import { fechaEnZona } from '$lib/dominio/fechas';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puedeEditarCatalogo } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();
const opcional = (formulario: FormData, campo: string) => texto(formulario, campo) || null;
const SIN_PERMISO = 'No tiene permiso para editar el catálogo.';

const enlaceLista = (proyecto: string | null | undefined, consulta = '') =>
	`${resolve('/equipos')}${proyecto ? `?proyecto=${encodeURIComponent(proyecto)}` : ''}${
		consulta ? `${proyecto ? '&' : '?'}${consulta}` : ''
	}`;

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const repos = await datos();
	const clientes = await repos.catalogo.listarClientes();
	const puedeEditar = puedeEditarCatalogo(locals);
	const pedido = clientes.find((c) => c.clave === url.searchParams.get('proyecto')) ?? null;

	if (params.id === 'nuevo') {
		if (!puedeEditar) errorHttp(403, SIN_PERMISO);
		const proyecto = pedido ?? clientes[0] ?? null;
		const sitios = proyecto ? await repos.equipos.sitiosDeProyecto(proyecto.id) : [];
		return { equipo: null, proyecto, sitios, hoy: fechaEnZona(), puedeEditar, creado: false };
	}

	const equipo = await repos.equipos.obtener(params.id).catch(() => null);
	if (!equipo) errorHttp(404, 'Equipo no encontrado');
	// Proyecto: el pedido en la consulta o el primero cuyos sitios incluyen el del equipo.
	let proyecto: Cliente | null = null;
	let sitios = pedido ? await repos.equipos.sitiosDeProyecto(pedido.id) : [];
	if (pedido && sitios.some((s) => s.id === equipo.sitioId)) proyecto = pedido;
	for (const cliente of proyecto ? [] : clientes) {
		const candidatos = await repos.equipos.sitiosDeProyecto(cliente.id);
		if (candidatos.some((s) => s.id === equipo.sitioId)) {
			proyecto = cliente;
			sitios = candidatos;
			break;
		}
	}
	if (!proyecto) sitios = [equipo.sitio].map((s) => ({ ...s, actualizadoEn: '' }));
	return {
		equipo,
		proyecto,
		sitios,
		hoy: fechaEnZona(),
		puedeEditar,
		creado: url.searchParams.has('creado')
	};
};

export const actions: Actions = {
	guardar: async ({ request, params, locals }) => {
		if (!puedeEditarCatalogo(locals)) return fail(403, { error: SIN_PERMISO });
		const formulario = await request.formData();
		const nuevo = params.id === 'nuevo';
		const estado = texto(formulario, 'estado');
		const intervalo = texto(formulario, 'intervaloMeses');
		let id: string;
		try {
			const equipo = await (
				await datos()
			).equipos.guardar({
				id: nuevo ? undefined : params.id,
				sitioId: texto(formulario, 'sitioId'),
				tag: texto(formulario, 'tag'),
				tipo: opcional(formulario, 'tipo'),
				marca: opcional(formulario, 'marca'),
				modelo: opcional(formulario, 'modelo'),
				numeroSerie: opcional(formulario, 'numeroSerie'),
				rango: opcional(formulario, 'rango'),
				resolucion: opcional(formulario, 'resolucion'),
				clase: opcional(formulario, 'clase'),
				ubicacion: opcional(formulario, 'ubicacion'),
				propietario: opcional(formulario, 'propietario'),
				responsable: opcional(formulario, 'responsable'),
				critico: formulario.get('critico') === 'on',
				estado: (ESTADOS_EQUIPO as readonly string[]).includes(estado)
					? (estado as EstadoEquipo)
					: 'en_servicio',
				intervaloMeses: intervalo ? Number(intervalo) : null,
				ultimaCalibracion: opcional(formulario, 'ultimaCalibracion'),
				proximaCalibracion: opcional(formulario, 'proximaCalibracion'),
				proveedor: opcional(formulario, 'proveedor'),
				notas: opcional(formulario, 'notas')
			});
			id = equipo.id;
		} catch (error) {
			return fail(400, { error: mensajeDeError(error) });
		}
		if (nuevo) {
			const proyecto = texto(formulario, 'proyecto');
			redirect(
				303,
				`${resolve('/equipos/[id]', { id })}?creado${proyecto ? `&proyecto=${encodeURIComponent(proyecto)}` : ''}`
			);
		}
		return { mensaje: 'Cambios guardados.' };
	},

	eliminar: async ({ request, params, locals }) => {
		if (!puedeEditarCatalogo(locals)) return fail(403, { error: SIN_PERMISO });
		const formulario = await request.formData();
		try {
			await (await datos()).equipos.eliminar(params.id);
		} catch (error) {
			return fail(400, { error: mensajeDeError(error) });
		}
		redirect(303, enlaceLista(texto(formulario, 'proyecto'), 'eliminado'));
	}
};
