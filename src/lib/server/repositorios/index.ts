// Repositorios sobre un ClienteSql (PGlite o Supabase).
import type { ClienteSql } from '../bd/cliente.ts';
import { RepositorioAutenticacion } from './autenticacion.ts';
import { RepositorioCatalogo } from './catalogo.ts';
import { RepositorioCentrosCosto } from './centros-costo.ts';
import { RepositorioContratoCobranza } from './contrato-cobranza.ts';
import { RepositorioEquipos } from './equipos.ts';
import { RepositorioPersonal } from './personal.ts';
import { RepositorioPrograma } from './programa.ts';
import { RepositorioReportes } from './reportes.ts';
import { RepositorioSeguimiento } from './seguimiento.ts';

export interface Repositorios {
	autenticacion: RepositorioAutenticacion;
	catalogo: RepositorioCatalogo;
	centrosCosto: RepositorioCentrosCosto;
	contratoCobranza: RepositorioContratoCobranza;
	equipos: RepositorioEquipos;
	personal: RepositorioPersonal;
	programa: RepositorioPrograma;
	reportes: RepositorioReportes;
	seguimiento: RepositorioSeguimiento;
	cerrar(): Promise<void>;
}

export function crearRepositorios(sql: ClienteSql): Repositorios {
	return {
		autenticacion: new RepositorioAutenticacion(sql),
		catalogo: new RepositorioCatalogo(sql),
		centrosCosto: new RepositorioCentrosCosto(sql),
		contratoCobranza: new RepositorioContratoCobranza(sql),
		equipos: new RepositorioEquipos(sql),
		personal: new RepositorioPersonal(sql),
		programa: new RepositorioPrograma(sql),
		reportes: new RepositorioReportes(sql),
		seguimiento: new RepositorioSeguimiento(sql),
		cerrar: async () => {
			await sql.cerrar?.();
		}
	};
}

export {
	RepositorioAutenticacion,
	RepositorioCatalogo,
	RepositorioCentrosCosto,
	RepositorioEquipos,
	RepositorioPersonal,
	RepositorioPrograma,
	RepositorioReportes
};
