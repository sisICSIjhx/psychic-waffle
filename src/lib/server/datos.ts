// Acceso a datos de la aplicación: Supabase si el .env tiene sus credenciales; si no, PGlite
// persistido en STORAGE_DIR/pglite para trabajar en local sin credenciales.
import { env } from '$env/dynamic/private';
import { env as entornoPublico } from '$env/dynamic/public';
import { resolve } from 'node:path';
import { crearClienteSupabase } from './bd/supabase.ts';
import { crearRepositorios, type Repositorios } from './repositorios/index.ts';

let repositorios: Promise<Repositorios> | null = null;

async function crear(): Promise<Repositorios> {
	const url = entornoPublico.PUBLIC_SUPABASE_URL ?? '';
	const claveServicio = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
	if (url && claveServicio) return crearRepositorios(crearClienteSupabase(url, claveServicio));
	// Importación diferida: PGlite es dependencia de desarrollo.
	const { crearClientePglite } = await import('./bd/pglite.ts');
	const carpeta = resolve(env.STORAGE_DIR || 'storage', 'pglite');
	return crearRepositorios(await crearClientePglite(carpeta));
}

/** Repositorios compartidos por el proceso del servidor. */
export function datos(): Promise<Repositorios> {
	repositorios ??= crear().catch((error) => {
		repositorios = null;
		throw error;
	});
	return repositorios;
}
