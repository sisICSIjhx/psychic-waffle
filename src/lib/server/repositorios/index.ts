// Repositorios sobre un ClienteSql (PGlite o Supabase).
import type { ClienteSql } from '../bd/cliente.ts';
import { RepositorioAutenticacion } from './autenticacion.ts';
import { RepositorioCatalogo } from './catalogo.ts';
import { RepositorioEquipos } from './equipos.ts';
import { RepositorioPersonal } from './personal.ts';
import { RepositorioPrograma } from './programa.ts';
import { RepositorioReportes } from './reportes.ts';

export interface Repositorios {
	autenticacion: RepositorioAutenticacion;
	catalogo: RepositorioCatalogo;
	equipos: RepositorioEquipos;
	personal: RepositorioPersonal;
	programa: RepositorioPrograma;
	reportes: RepositorioReportes;
	cerrar(): Promise<void>;
}

export function crearRepositorios(sql: ClienteSql): Repositorios {
	return {
		autenticacion: new RepositorioAutenticacion(sql),
		catalogo: new RepositorioCatalogo(sql),
		equipos: new RepositorioEquipos(sql),
		personal: new RepositorioPersonal(sql),
		programa: new RepositorioPrograma(sql),
		reportes: new RepositorioReportes(sql),
		cerrar: async () => {
			await sql.cerrar?.();
		}
	};
}

export {
	RepositorioAutenticacion,
	RepositorioCatalogo,
	RepositorioEquipos,
	RepositorioPersonal,
	RepositorioPrograma,
	RepositorioReportes
};
