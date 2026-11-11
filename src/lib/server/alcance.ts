// Alcance de los datos por centro de costo (cambio centros-costo-plantillas, D7 y D8). Quien no tiene
// un rol que abarque todo solo ve, captura y ajusta lo de sus centros de costo. Sin inicio de sesión
// activado todos ven todo, como antes de que existieran las cuentas.
import { error } from '@sveltejs/kit';
import type { Repositorios } from './repositorios/index.ts';
import type { TipoRecurso } from './repositorios/centros-costo.ts';

export interface LocalesAlcance {
	autenticacion?: boolean;
	usuario?: { centrosCosto: string[] | null } | null;
}

/**
 * Ids de los centros de costo que puede ver quien hace la petición, o null si los ve todos. Con el
 * inicio de sesión activado y sin usuario (la guardia ya lo habría rechazado) no ve ninguno.
 */
export function centrosVisibles(locals: LocalesAlcance | undefined): string[] | null {
	if (!locals?.autenticacion) return null;
	if (!locals.usuario) return [];
	return locals.usuario.centrosCosto;
}

/** Centros de costo, contratos y proyectos visibles; null = todos. */
export interface Alcance {
	sitios: ReadonlySet<string>;
	contratos: ReadonlySet<string>;
	clientes: ReadonlySet<string>;
}

/** Un contrato es visible si tiene alguno de los centros de costo; un proyecto, si tiene un contrato. */
export async function alcanceDe(
	repos: Pick<Repositorios, 'centrosCosto'>,
	locals: LocalesAlcance | undefined
): Promise<Alcance | null> {
	const visibles = centrosVisibles(locals);
	if (visibles === null) return null;
	const sitios = new Set(visibles);
	const contratos = new Set<string>();
	const clientes = new Set<string>();
	if (sitios.size > 0) {
		for (const contrato of await repos.centrosCosto.contratosCentros()) {
			if (contrato.sitioIds.some((id) => sitios.has(id))) {
				contratos.add(contrato.contratoId);
				clientes.add(contrato.clienteId);
			}
		}
	}
	return { sitios, contratos, clientes };
}

/** Deja de una lista lo que está en el alcance; con alcance null la devuelve igual. */
export function filtrarPor<T>(
	alcance: Alcance | null,
	nivel: keyof Alcance,
	elementos: T[],
	idDe: (elemento: T) => string
): T[] {
	if (!alcance) return elementos;
	const permitidos = alcance[nivel];
	return elementos.filter((elemento) => permitidos.has(idDe(elemento)));
}

export function sitioVisible(alcance: Alcance | null, sitioId: string): boolean {
	return !alcance || alcance.sitios.has(sitioId);
}

/**
 * Para las acciones que reciben ids en el formulario: si ninguno de los centros de costo del recurso
 * es visible (o no existe), responde 404 como si no existiera. Sin alcance limitado no consulta.
 */
export async function exigirCentro(
	repos: Pick<Repositorios, 'centrosCosto'>,
	locals: LocalesAlcance | undefined,
	tipo: TipoRecurso,
	id: string
): Promise<void> {
	const visibles = centrosVisibles(locals);
	if (visibles === null) return;
	const valido = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
	const centros = valido ? await repos.centrosCosto.centrosDeRecurso(tipo, id) : [];
	if (!centros.some((centro) => visibles.includes(centro))) error(404, 'No encontrado');
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const RUTAS_RECURSO: readonly (readonly [RegExp, TipoRecurso])[] = [
	[new RegExp(`^/reportes/(${UUID})(?:/|$)`, 'i'), 'reporte'],
	[new RegExp(`^/catalogo/partidas/(${UUID})(?:/|$)`, 'i'), 'partida'],
	[new RegExp(`^/catalogo/contratos/(${UUID})(?:/|$)`, 'i'), 'contrato'],
	[new RegExp(`^/equipos/(${UUID})(?:/|$)`, 'i'), 'equipo']
];

/**
 * Recurso que pide una ruta de detalle (reporte con su documento y fotos, partida, contrato o
 * equipo), para comprobar su centro de costo en la guardia. Otras rutas devuelven null.
 */
export function recursoDeRuta(ruta: string): { tipo: TipoRecurso; id: string } | null {
	for (const [patron, tipo] of RUTAS_RECURSO) {
		const coincidencia = patron.exec(ruta);
		if (coincidencia) return { tipo, id: coincidencia[1].toLowerCase() };
	}
	return null;
}
