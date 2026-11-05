// Repositorios sobre un ClienteSql (PGlite o Supabase).
import type { ClienteSql } from '../bd/cliente.ts';
import { RepositorioCatalogo } from './catalogo.ts';
import { RepositorioPersonal } from './personal.ts';
import { RepositorioPrograma } from './programa.ts';
import { RepositorioReportes } from './reportes.ts';

export interface Repositorios {
	catalogo: RepositorioCatalogo;
	personal: RepositorioPersonal;
	programa: RepositorioPrograma;
	reportes: RepositorioReportes;
	cerrar(): Promise<void>;
}

export function crearRepositorios(sql: ClienteSql): Repositorios {
	return {
		catalogo: new RepositorioCatalogo(sql),
		personal: new RepositorioPersonal(sql),
		programa: new RepositorioPrograma(sql),
		reportes: new RepositorioReportes(sql),
		cerrar: async () => {
			await sql.cerrar?.();
		}
	};
}

export { RepositorioCatalogo, RepositorioPersonal, RepositorioPrograma, RepositorioReportes };
