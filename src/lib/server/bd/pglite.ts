// Implementación PGlite (PostgreSQL en WebAssembly) para desarrollo y pruebas, sin credenciales.
import { PGlite } from '@electric-sql/pglite';
import { aplicarMigraciones, leerMigraciones, type Migracion } from './migraciones.ts';
import { convertirError, validarFuncion, type ClienteSql } from './cliente.ts';

export interface ClientePglite extends ClienteSql {
	bd: PGlite;
	cerrar(): Promise<void>;
}

/**
 * Abre PGlite en memoria (sin `carpeta`) o persistido en disco, y aplica las migraciones pendientes.
 */
export async function crearClientePglite(
	carpeta?: string,
	migraciones?: Migracion[]
): Promise<ClientePglite> {
	const bd = carpeta ? new PGlite(carpeta) : new PGlite();
	await aplicarMigraciones(bd, migraciones ?? (await leerMigraciones()));
	return {
		bd,
		async llamar<T>(funcion: string, argumentos: Record<string, unknown> = {}): Promise<T> {
			validarFuncion(funcion);
			try {
				const resultado = await bd.query<{ r: T }>(`select public.${funcion}($1::jsonb) as r`, [
					JSON.stringify(argumentos)
				]);
				return resultado.rows[0].r;
			} catch (error) {
				throw convertirError(error);
			}
		},
		cerrar: () => bd.close()
	};
}
