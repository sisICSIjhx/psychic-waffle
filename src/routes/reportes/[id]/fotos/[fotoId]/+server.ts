// Versión optimizada (JPEG, 1600 px) de una foto del reporte, o su miniatura de 480 px con
// `?tamano=mini`, para mostrarla en el editor.
import { error as errorHttp } from '@sveltejs/kit';
import { ErrorDatos } from '$lib/server/bd/cliente';
import { captura } from '$lib/server/datos';
import { cuerpoSinCopia } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, request }) => {
	const tamano = url.searchParams.get('tamano');
	if (tamano !== null && tamano !== 'mini') errorHttp(400, 'Tamaño de foto no válido');
	// Las fotos no cambian (cada carga tiene su propio id): si el navegador ya la tiene, basta un 304.
	const etiqueta = `"${params.fotoId}-${tamano ?? 'optimizada'}"`;
	const encabezados = {
		'Content-Type': 'image/jpeg',
		'Cache-Control': 'private, max-age=86400, immutable',
		ETag: etiqueta
	};
	const servicio = await captura();
	let datos: Buffer | null;
	try {
		// La foto debe pertenecer al reporte de la ruta; se valida también para responder 304.
		if (!(await servicio.fotoDelReporte(params.id, params.fotoId))) {
			errorHttp(404, 'Foto no encontrada');
		}
		if (request.headers.get('if-none-match') === etiqueta) {
			return new Response(null, { status: 304, headers: encabezados });
		}
		datos = await servicio
			.leerArchivoFoto(params.id, params.fotoId, tamano === 'mini' ? 'mini' : 'optimizada')
			.catch(() => null);
	} catch (error) {
		if (error instanceof ErrorDatos && error.tipo === 'no_encontrado') {
			errorHttp(404, 'No encontrado');
		}
		throw error;
	}
	if (!datos) errorHttp(404, 'Foto no encontrada');
	return new Response(cuerpoSinCopia(datos), {
		headers: { ...encabezados, 'Content-Length': String(datos.byteLength) }
	});
};
