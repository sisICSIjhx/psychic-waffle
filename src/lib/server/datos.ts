// Acceso a datos de la aplicación: Supabase si el .env tiene sus credenciales; si no, PGlite
// persistido en STORAGE_DIR/pglite para trabajar en local sin credenciales.
import { env } from '$env/dynamic/private';
import { env as entornoPublico } from '$env/dynamic/public';
import { carpetaAlmacenamiento, repositoriosDesdeEntorno, type Entorno } from './datos-entorno.ts';
import type { Repositorios } from './repositorios/index.ts';

export { elegirOrigenDatos } from './datos-entorno.ts';

function entorno(): Entorno {
	return {
		PUBLIC_SUPABASE_URL: entornoPublico.PUBLIC_SUPABASE_URL,
		SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
		STORAGE_DIR: env.STORAGE_DIR
	};
}

let repositorios: Promise<Repositorios> | null = null;

/** Repositorios compartidos por el proceso del servidor. */
export function datos(): Promise<Repositorios> {
	repositorios ??= repositoriosDesdeEntorno(entorno()).catch((error) => {
		repositorios = null;
		throw error;
	});
	return repositorios;
}

/** Carpeta del almacenamiento local configurada (STORAGE_DIR o ./storage). */
export function almacenamiento(): string {
	return carpetaAlmacenamiento(entorno());
}
