// Editor del reporte. El autoguardado, la carga de fotos y los cambios de estado llegan como acciones
// (el editor las invoca con fetch); cada una devuelve la versión vigente para la concurrencia optimista.
import { error as errorHttp, fail, redirect } from '@sveltejs/kit';
import { esquemaReporteGuardado, MOMENTOS_FOTO } from '$lib/dominio/esquemas';
import { ErrorDatos } from '$lib/server/bd/cliente';
import { ErrorValidacion } from '$lib/server/captura';
import { captura } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { LIMITE_FOTO_BYTES } from '$lib/server/fotos';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const servicio = await captura();
	let reporte;
	try {
		reporte = await servicio.obtener(params.id);
	} catch (error) {
		if (error instanceof ErrorDatos && error.tipo === 'no_encontrado') {
			errorHttp(404, 'Reporte no encontrado');
		}
		throw error;
	}
	const { partida, cambiado } = await servicio.estadoCatalogo(reporte);
	return {
		reporte,
		equiposPartida: partida.equipos,
		catalogoCambiado: cambiado,
		partidaPorConfirmar: partida.estadoCatalogo === 'por_confirmar'
	};
};

/** Respuesta de error uniforme: conflicto de versión (409), validación (422) u otro (400). */
function fallo(error: unknown) {
	if (error instanceof ErrorValidacion) {
		return fail(422, { error: error.message, observaciones: error.observaciones });
	}
	if (error instanceof ErrorDatos && error.tipo === 'conflicto') {
		return fail(409, {
			error: error.message,
			conflicto: error.detalle.motivo === 'version',
			observaciones: []
		});
	}
	return fail(400, { error: mensajeDeError(error), observaciones: [] });
}

const numero = (formulario: FormData, campo: string) => Number(formulario.get(campo) ?? 0);

export const actions: Actions = {
	guardar: async ({ request, params }) => {
		const formulario = await request.formData();
		try {
			const guardado = esquemaReporteGuardado.parse(
				JSON.parse(String(formulario.get('reporte') ?? '{}'))
			);
			if (guardado.id !== params.id)
				return fail(400, { error: 'Reporte distinto', observaciones: [] });
			const reporte = await (await captura()).guardar(guardado);
			return { reporte };
		} catch (error) {
			return fallo(error);
		}
	},

	fotos: async ({ request, params }) => {
		const formulario = await request.formData();
		const archivos = formulario.getAll('archivo').filter((a): a is File => a instanceof File);
		const momento = String(formulario.get('momento') ?? '');
		// Un archivo excesivo se rechaza sin leerlo completo.
		const rechazadas = archivos
			.filter((a) => a.size > LIMITE_FOTO_BYTES)
			.map((a) => ({
				nombre: a.name,
				motivo: `La foto pesa ${(a.size / 1048576).toFixed(1)} MB; el máximo es 15 MB por foto.`
			}));
		try {
			const resultado = await (
				await captura()
			).cargarFotos({
				reporteId: params.id,
				alcanceId: String(formulario.get('alcanceId') ?? ''),
				version: numero(formulario, 'version'),
				momento: (MOMENTOS_FOTO as readonly string[]).includes(momento)
					? (momento as (typeof MOMENTOS_FOTO)[number])
					: null,
				archivos: await Promise.all(
					archivos
						.filter((a) => a.size <= LIMITE_FOTO_BYTES)
						.map(async (a) => ({ nombre: a.name, datos: new Uint8Array(await a.arrayBuffer()) }))
				)
			});
			return { ...resultado, rechazadas: [...rechazadas, ...resultado.rechazadas] };
		} catch (error) {
			return fallo(error);
		}
	},

	estado: async ({ request, params }) => {
		const formulario = await request.formData();
		const estado = String(formulario.get('estado') ?? '');
		if (estado !== 'borrador' && estado !== 'en_revision' && estado !== 'emitido') {
			return fail(400, { error: 'Estado no válido', observaciones: [] });
		}
		try {
			const reporte = await (
				await captura()
			).cambiarEstado(params.id, numero(formulario, 'version'), estado);
			return { reporte };
		} catch (error) {
			return fallo(error);
		}
	},

	revision: async ({ params }) => {
		let revision;
		try {
			revision = await (await captura()).crearRevision(params.id);
		} catch (error) {
			return fallo(error);
		}
		redirect(303, `/reportes/${revision.id}`);
	},

	aplicarCatalogo: async ({ request, params }) => {
		const formulario = await request.formData();
		try {
			const reporte = await (
				await captura()
			).aplicarCatalogo(params.id, numero(formulario, 'version'));
			return { reporte };
		} catch (error) {
			return fallo(error);
		}
	}
};
