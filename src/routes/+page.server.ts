// Inicio «Mi trabajo»: avance del mes, tarjetas accionables y el siguiente trabajo de los programas
// vigentes, con los borradores que ya existen para cada pendiente.
import { fechaEnZona } from '$lib/dominio/fechas';
import { resumenDelMes, siguienteTrabajo } from '$lib/dominio/planeacion';
import { datos } from '$lib/server/datos';
import type { PageServerLoad } from './$types';

const FILTROS = ['vencidos', 'mes', 'todos'] as const;
export type FiltroTrabajo = (typeof FILTROS)[number];

export const load: PageServerLoad = async ({ url }) => {
	const repos = await datos();
	const hoy = fechaEnZona();
	const programas = (await repos.programa.listarProgramas()).filter(
		(p) => p.periodoInicio <= hoy && hoy <= p.periodoFin
	);
	const avances = await Promise.all(programas.map((p) => repos.programa.obtenerAvance(p.id)));
	const sitios = new Map((await repos.catalogo.listarSitios()).map((s) => [s.id, s]));

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

	const [totalBorradores, enRevision] = await Promise.all([
		repos.reportes.listar({ estado: 'borrador', tamano: 1 }),
		repos.reportes.listar({ estado: 'en_revision', tamano: 1 })
	]);
	const ver = url.searchParams.get('ver');
	return {
		hoy,
		resumen: resumenDelMes(avances, hoy),
		programasVigentes: programas.length,
		trabajo,
		ver: FILTROS.find((f) => f === ver) ?? null,
		borradores: totalBorradores.total,
		enRevision: enRevision.total
	};
};
