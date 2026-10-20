// Descarga del DOCX de la versión vigente del reporte (se genera y registra si aún no existe).
import { error as errorHttp } from '@sveltejs/kit';
import { ErrorDatos } from '$lib/server/bd/cliente';
import { ErrorValidacion } from '$lib/server/captura';
import { captura } from '$lib/server/datos';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { datos, nombreArchivo } = await (await captura()).generarDocumento(params.id);
		return new Response(new Uint8Array(datos), {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
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
