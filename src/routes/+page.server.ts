// Panel de control: indicadores del mes con los programas vigentes y los reportes registrados.
import { fechaEnZona } from '$lib/dominio/fechas';
import { pendientesVencidos, resumenDelMes } from '$lib/dominio/planeacion';
import { datos } from '$lib/server/datos';
import type { PageServerLoad } from './$types';

const MAXIMO_VENCIDOS = 8;

export const load: PageServerLoad = async () => {
	const repos = await datos();
	const hoy = fechaEnZona();
	const programas = (await repos.programa.listarProgramas()).filter(
		(p) => p.periodoInicio <= hoy && hoy <= p.periodoFin
	);
	const avances = await Promise.all(programas.map((p) => repos.programa.obtenerAvance(p.id)));
	const sitios = new Map((await repos.catalogo.listarSitios()).map((s) => [s.id, s]));
	const vencidos = avances
		.flatMap((a) =>
			pendientesVencidos(a.partidas, hoy).map((v) => ({
				...v,
				contratoId: a.programa.contratoId,
				sitioId: a.programa.sitioId,
				sitio: sitios.get(a.programa.sitioId)?.clave ?? ''
			}))
		)
		.sort((a, b) => a.mes.localeCompare(b.mes));
	const [borradores, enRevision, recientes] = await Promise.all([
		repos.reportes.listar({ estado: 'borrador', tamano: 1 }),
		repos.reportes.listar({ estado: 'en_revision', tamano: 1 }),
		repos.reportes.listar({ tamano: 5 })
	]);
	return {
		hoy,
		resumen: resumenDelMes(avances, hoy),
		programasVigentes: programas.length,
		vencidos: vencidos.slice(0, MAXIMO_VENCIDOS),
		totalVencidos: vencidos.length,
		borradores: borradores.total,
		enRevision: enRevision.total,
		recientes: recientes.filas
	};
};
