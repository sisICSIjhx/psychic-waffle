// Descarga del DOCX de la versión vigente del reporte (se genera y registra si aún no existe).
import { error as errorHttp } from '@sveltejs/kit';
import { ErrorDatos } from '$lib/server/bd/cliente';
import { ErrorValidacion, esUuid } from '$lib/server/captura';
import { captura } from '$lib/server/datos';
import { cuerpoSinCopia, disposicionAdjunto } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	if (!esUuid(params.id)) errorHttp(404, 'Reporte no encontrado');
	try {
		const { datos, nombreArchivo } = await (await captura()).generarDocumento(params.id);
		// Sin copiar el búfer del documento; con Content-Length el navegador muestra el avance.
		return new Response(cuerpoSinCopia(datos), {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'Content-Disposition': disposicionAdjunto(nombreArchivo),
				'Content-Length': String(datos.byteLength),
				'Cache-Control': 'private, no-store'
			}
		});
	} catch (error) {
		if (error instanceof ErrorValidacion) errorHttp(422, error.message);
		if (error instanceof ErrorDatos && error.tipo === 'no_encontrado') {
			errorHttp(404, 'Reporte no encontrado');
		}
		throw error;
	}
};
