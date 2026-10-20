// Acceso a datos de la aplicación: Supabase si el .env tiene sus credenciales; si no, PGlite
// persistido en STORAGE_DIR/pglite para trabajar en local sin credenciales.
import { env } from '$env/dynamic/private';
import { env as entornoPublico } from '$env/dynamic/public';
import { resolve } from 'node:path';
import { crearClienteSupabase } from './bd/supabase.ts';
import { crearRepositorios, type Repositorios } from './repositorios/index.ts';

/**
 * Supabase con ambas variables; PGlite sin ninguna. Con solo una se detiene: usar en silencio una
 * base local distinta haría creer que se trabaja sobre Supabase.
 */
export function elegirOrigenDatos(url: string | undefined, claveServicio: string | undefined) {
	const hayUrl = Boolean(url?.trim());
	const hayClave = Boolean(claveServicio?.trim());
	if (hayUrl && hayClave) return 'supabase' as const;
	if (!hayUrl && !hayClave) return 'pglite' as const;
	throw new Error(
		`Configuración de Supabase incompleta: falta ${hayUrl ? 'SUPABASE_SERVICE_ROLE_KEY' : 'PUBLIC_SUPABASE_URL'} en el .env`
	);
}

let repositorios: Promise<Repositorios> | null = null;

async function crear(): Promise<Repositorios> {
	const url = entornoPublico.PUBLIC_SUPABASE_URL;
	const claveServicio = env.SUPABASE_SERVICE_ROLE_KEY;
	if (elegirOrigenDatos(url, claveServicio) === 'supabase') {
		return crearRepositorios(crearClienteSupabase(url!, claveServicio!));
	}
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
