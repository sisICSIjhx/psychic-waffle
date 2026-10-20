// Creación de los repositorios a partir de variables de entorno, sin depender de SvelteKit: la usan
// la aplicación (datos.ts) y los scripts locales.
import { resolve } from 'node:path';
import { crearClienteSupabase } from './bd/supabase.ts';
import { crearRepositorios, type Repositorios } from './repositorios/index.ts';

export interface Entorno {
	PUBLIC_SUPABASE_URL?: string;
	SUPABASE_SERVICE_ROLE_KEY?: string;
	STORAGE_DIR?: string;
}

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

/** Carpeta del almacenamiento local (fotos, documentos y base PGlite). */
export function carpetaAlmacenamiento(entorno: Entorno): string {
	return resolve(entorno.STORAGE_DIR?.trim() || 'storage');
}

export async function repositoriosDesdeEntorno(entorno: Entorno): Promise<Repositorios> {
	const url = entorno.PUBLIC_SUPABASE_URL;
	const claveServicio = entorno.SUPABASE_SERVICE_ROLE_KEY;
	if (elegirOrigenDatos(url, claveServicio) === 'supabase') {
		return crearRepositorios(crearClienteSupabase(url!, claveServicio!));
	}
	// Importación diferida: PGlite es dependencia de desarrollo.
	const { crearClientePglite } = await import('./bd/pglite.ts');
	return crearRepositorios(
		await crearClientePglite(resolve(carpetaAlmacenamiento(entorno), 'pglite'))
	);
}
