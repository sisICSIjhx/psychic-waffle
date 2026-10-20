// Mensajes de error comprensibles para la interfaz a partir de los errores del servidor.
import { ZodError } from 'zod';
import { ErrorDatos } from './bd/cliente.ts';
import { ErrorImportacion } from './importacion/catalogo.ts';

export function mensajeDeError(error: unknown): string {
	if (error instanceof ErrorImportacion) return error.message;
	if (error instanceof ZodError) {
		const campos = [...new Set(error.issues.map((i) => i.path.join('.') || 'datos'))];
		return `Revise los datos: ${campos.join(', ')}`;
	}
	if (error instanceof ErrorDatos) {
		const existente = error.detalle.existente as { clave?: string; nombre?: string } | undefined;
		if (error.detalle.motivo === 'sitio_duplicado' && existente) {
			return `${error.message}: ${existente.clave ?? ''} ${existente.nombre ?? ''}`.trim();
		}
		if (error.tipo === 'desconocido') return 'No se pudo completar la operación. Intente de nuevo.';
		return error.message;
	}
	return 'Ocurrió un error inesperado. Intente de nuevo.';
}
