// Inicio «Mi trabajo»: avance del mes, tarjetas accionables y el siguiente trabajo de los programas
// vigentes, con los borradores que ya existen para cada pendiente.
import { fechaEnZona } from '$lib/dominio/fechas';
import { resumenDelMes, siguienteTrabajo } from '$lib/dominio/planeacion';
import { alcanceDe, centrosVisibles, filtrarPor } from '$lib/server/alcance';
import { datos } from '$lib/server/datos';
import type { PageServerLoad } from './$types';

const FILTROS = ['vencidos', 'mes', 'todos'] as const;
export type FiltroTrabajo = (typeof FILTROS)[number];

export const load: PageServerLoad = async ({ url, locals }) => {
	const repos = await datos();
	const hoy = fechaEnZona();
	// Solo el trabajo de los centros de costo de quien consulta (cambio centros-costo-plantillas).
	const sitioIds = centrosVisibles(locals) ?? undefined;
	// Consultas que no dependen de otras: arrancan juntas (con Supabase cada una es un viaje de red).
	const sitiosPedidos = repos.catalogo.listarSitios();
	const totalesPedidos = Promise.all([
		repos.reportes.listar({ estado: 'borrador', tamano: 1, sitioIds }),
		repos.reportes.listar({ estado: 'en_revision', tamano: 1, sitioIds })
	]);
	// Si otra consulta falla antes de esperarlas, su error no debe quedar como rechazo sin manejar.
	sitiosPedidos.catch(() => undefined);
	totalesPedidos.catch(() => undefined);
	const alcance = await alcanceDe(repos, locals);
	const programas = filtrarPor(
		alcance,
		'sitios',
		await repos.programa.listarProgramas(),
		(p) => p.sitioId
	).filter((p) => p.periodoInicio <= hoy && hoy <= p.periodoFin);
	const avances = await Promise.all(programas.map((p) => repos.programa.obtenerAvance(p.id)));
	const sitios = new Map((await sitiosPedidos).map((s) => [s.id, s]));

	// Los borradores se buscan completos en el rango de meses con trabajo pendiente: ninguno se
	// queda fuera por un límite y «Continuar borrador» aparece siempre que exista.
	const meses = siguienteTrabajo(avances, [], hoy).map((t) => t.mes);
	const borradores = meses.length
		? await repos.reportes.listarTodos({
				estado: 'borrador',
				desde: meses.reduce((a, b) => (a < b ? a : b)),
				hasta: meses.reduce((a, b) => (a > b ? a : b))
			})
		: [];
	const trabajo = siguienteTrabajo(avances, borradores, hoy).map((t) => ({
		...t,
		sitio: sitios.get(t.sitioId)?.clave ?? ''
	}));

	const [totalBorradores, enRevision] = await totalesPedidos;
	const ver = url.searchParams.get('ver');
	return {
		hoy,
		resumen: resumenDelMes(avances, hoy),
		programasVigentes: programas.length,
		trabajo,
		ver: FILTROS.find((f) => f === ver) ?? null,
		borradores: totalBorradores.total,
		enRevision: enRevision.total,
		/** Alcance limitado sin ningún centro de costo asignado: no hay trabajo que mostrar. */
		sinCentros: alcance !== null && alcance.sitios.size === 0
	};
};
