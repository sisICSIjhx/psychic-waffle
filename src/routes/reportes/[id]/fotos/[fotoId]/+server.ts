// Versión optimizada (JPEG) de una foto del reporte, para mostrarla en el editor.
import { error as errorHttp } from '@sveltejs/kit';
import { ErrorDatos } from '$lib/server/bd/cliente';
import { captura } from '$lib/server/datos';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const servicio = await captura();
	let reporte;
	try {
		reporte = await servicio.obtener(params.id);
	} catch (error) {
		if (error instanceof ErrorDatos && error.tipo === 'no_encontrado')
			errorHttp(404, 'No encontrado');
		throw error;
	}
	const foto = await servicio.leerFoto(reporte, params.fotoId).catch(() => null);
	if (!foto) errorHttp(404, 'Foto no encontrada');
	return new Response(new Uint8Array(foto.datos), {
		headers: {
			'Content-Type': 'image/jpeg',
			// Las fotos no cambian: cada carga tiene su propio identificador.
			'Cache-Control': 'private, max-age=86400, immutable'
		}
	});
};
