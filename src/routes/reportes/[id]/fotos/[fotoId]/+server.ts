// Versión optimizada (JPEG, 1600 px) de una foto del reporte, o su miniatura de 480 px con
// `?tamano=mini`, para mostrarla en el editor.
import { error as errorHttp } from '@sveltejs/kit';
import { ErrorDatos } from '$lib/server/bd/cliente';
import { captura } from '$lib/server/datos';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const tamano = url.searchParams.get('tamano');
	if (tamano !== null && tamano !== 'mini') errorHttp(400, 'Tamaño de foto no válido');
	const servicio = await captura();
	let reporte;
	try {
		reporte = await servicio.obtener(params.id);
	} catch (error) {
		if (error instanceof ErrorDatos && error.tipo === 'no_encontrado')
			errorHttp(404, 'No encontrado');
		throw error;
	}
	const datos =
		tamano === 'mini'
			? await servicio.leerMiniatura(reporte, params.fotoId).catch(() => null)
			: ((await servicio.leerFoto(reporte, params.fotoId).catch(() => null))?.datos ?? null);
	if (!datos) errorHttp(404, 'Foto no encontrada');
	return new Response(new Uint8Array(datos), {
		headers: {
			'Content-Type': 'image/jpeg',
			// Las fotos no cambian: cada carga tiene su propio identificador y el giro es un dato aparte.
			'Cache-Control': 'private, max-age=86400, immutable'
		}
	});
};
