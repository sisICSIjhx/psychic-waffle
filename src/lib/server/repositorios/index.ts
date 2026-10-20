// Repositorios sobre un ClienteSql (PGlite o Supabase).
import type { ClienteSql } from '../bd/cliente.ts';
import { RepositorioCatalogo } from './catalogo.ts';
import { RepositorioPrograma } from './programa.ts';
import { RepositorioReportes } from './reportes.ts';

export interface Repositorios {
	catalogo: RepositorioCatalogo;
	programa: RepositorioPrograma;
	reportes: RepositorioReportes;
	cerrar(): Promise<void>;
}

export function crearRepositorios(sql: ClienteSql): Repositorios {
	return {
		catalogo: new RepositorioCatalogo(sql),
		programa: new RepositorioPrograma(sql),
		reportes: new RepositorioReportes(sql),
		cerrar: async () => {
			await sql.cerrar?.();
		}
	};
}

export { RepositorioCatalogo, RepositorioPrograma, RepositorioReportes };
