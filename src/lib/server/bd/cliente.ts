// Interfaz común de acceso a datos: cada operación es una función SQL api_* (jsonb → jsonb) que se
// invoca igual en PGlite (desarrollo y pruebas) y en Supabase (rpc con la clave de servicio).

export interface ClienteSql {
	llamar<T = unknown>(funcion: string, argumentos?: Record<string, unknown>): Promise<T>;
	cerrar?(): Promise<void>;
}

export type TipoErrorDatos = 'no_encontrado' | 'conflicto' | 'invalido' | 'desconocido';

/** Error de datos con un tipo estable para la interfaz y el detalle que envía la base. */
export class ErrorDatos extends Error {
	readonly tipo: TipoErrorDatos;
	readonly codigo: string;
	readonly detalle: Record<string, unknown>;

	constructor(
		tipo: TipoErrorDatos,
		mensaje: string,
		codigo = '',
		detalle: Record<string, unknown> = {}
	) {
		super(mensaje);
		this.name = 'ErrorDatos';
		this.tipo = tipo;
		this.codigo = codigo;
		this.detalle = detalle;
	}
}

const TIPOS_POR_CODIGO: Record<string, TipoErrorDatos> = {
	IC404: 'no_encontrado',
	IC409: 'conflicto',
	IC422: 'invalido',
	// Restricciones de PostgreSQL: unicidad, llave foránea, verificación, nulos y formato.
	'23505': 'invalido',
	'23503': 'invalido',
	'23514': 'invalido',
	'23502': 'invalido',
	'22P02': 'invalido',
	'22007': 'invalido',
	'22008': 'invalido'
};

const FUNCION_PERMITIDA = /^api_[a-z_]+$/;

export function validarFuncion(funcion: string): void {
	if (!FUNCION_PERMITIDA.test(funcion))
		throw new Error(`Función de datos no permitida: ${funcion}`);
}

function detalleJson(detalle: unknown): Record<string, unknown> {
	if (typeof detalle !== 'string' || !detalle.trim().startsWith('{')) return {};
	try {
		return JSON.parse(detalle) as Record<string, unknown>;
	} catch {
		return {};
	}
}

/** Convierte un error de PGlite o de Supabase (code, message, detail/details) en ErrorDatos. */
export function convertirError(error: unknown): ErrorDatos {
	if (error instanceof ErrorDatos) return error;
	const e = (error ?? {}) as {
		code?: string;
		message?: string;
		detail?: unknown;
		details?: unknown;
	};
	const codigo = e.code ?? '';
	return new ErrorDatos(
		TIPOS_POR_CODIGO[codigo] ?? 'desconocido',
		e.message ?? String(error),
		codigo,
		detalleJson(e.detail ?? e.details)
	);
}
