// Captura de actividades del programa anual desde la barra superior (cambio capturar-actividad).
// GET sin `centro`: centros de costo visibles con su programa vigente y personal activo. GET con
// `centro`: partidas del programa vigente de ese centro con lo que falta por mes. POST: registra si
// la actividad se realizó (marca de ejecución) o no (ajuste «No ejecutado»). La guardia exige
// `capturar` para el POST; aquí se aplica el alcance por centro de costo.
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import {
	errorFechaActividad,
	fechaEfectiva,
	mesDeFecha,
	NOTA_ACTIVIDAD_NO_REALIZADA,
	NOTA_ACTIVIDAD_REALIZADA,
	type CentroActividad,
	type PartidaActividad,
	type PersonaActividad
} from '$lib/dominio/actividades';
import { faltan } from '$lib/dominio/cumplimiento';
import { fechaEnZona } from '$lib/dominio/fechas';
import { nombreCompleto } from '$lib/dominio/personal';
import { programaVigente } from '$lib/dominio/planeacion';
import { centrosVisibles, exigirCentro, sitioVisible, alcanceDe } from '$lib/server/alcance';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import type { Repositorios } from '$lib/server/repositorios/index';
import type { RequestHandler } from './$types';

/** Programa vigente hoy de cada centro de costo (o el más reciente). */
async function programasPorCentro(repos: Repositorios, hoy: string) {
	const porSitio = new Map<
		string,
		Awaited<ReturnType<Repositorios['programa']['listarProgramas']>>
	>();
	for (const programa of await repos.programa.listarProgramas()) {
		porSitio.set(programa.sitioId, [...(porSitio.get(programa.sitioId) ?? []), programa]);
	}
	return (sitioId: string) => programaVigente(porSitio.get(sitioId) ?? [], hoy);
}

export const GET: RequestHandler = async ({ locals, url }) => {
	const repos = await datos();
	const hoy = fechaEnZona();
	const vigente = await programasPorCentro(repos, hoy);
	const centroPedido = url.searchParams.get('centro');

	if (centroPedido) {
		const alcance = await alcanceDe(repos, locals);
		if (!z.uuid().safeParse(centroPedido).success || !sitioVisible(alcance, centroPedido)) {
			error(404, 'No encontrado');
		}
		const programa = vigente(centroPedido);
		if (!programa) return json({ partidas: [] satisfies PartidaActividad[] });
		const avance = await repos.programa.obtenerAvance(programa.id);
		const partidas: PartidaActividad[] = avance.partidas.map((p) => ({
			id: p.id,
			numero: p.numero,
			actividad: p.actividad,
			periodicidad: p.periodicidad,
			faltan: Object.fromEntries(
				p.celdas.filter((c) => faltan(c) > 0).map((c) => [c.mes, faltan(c)])
			)
		}));
		return json({ partidas });
	}

	const centros: CentroActividad[] = (await repos.centrosCosto.listar(centrosVisibles(locals)))
		.map((c) => {
			const programa = vigente(c.id);
			return {
				id: c.id,
				clave: c.clave,
				nombre: c.nombre,
				programa: programa
					? {
							id: programa.id,
							periodoInicio: programa.periodoInicio,
							periodoFin: programa.periodoFin
						}
					: null
			};
		})
		.sort((a, b) => a.clave.localeCompare(b.clave, 'es', { numeric: true }));
	const personal: PersonaActividad[] = (await repos.personal.listar())
		.filter((p) => p.activo)
		.map((p) => ({
			id: p.id,
			nombre: nombreCompleto(p),
			centroIds: p.centrosCosto.map((c) => c.id)
		}))
		.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
	return json({ hoy, centros, personal });
};

const esquemaCaptura = z.object({
	programaId: z.uuid(),
	partidaId: z.uuid(),
	realizada: z.boolean(),
	fecha: z.string().nullish(),
	personalIds: z.array(z.uuid()).max(50).default([])
});

export const POST: RequestHandler = async ({ locals, request }) => {
	const captura = esquemaCaptura.safeParse(await request.json().catch(() => null));
	if (!captura.success)
		return json({ error: 'Revise los datos de la actividad.' }, { status: 400 });
	const { programaId, partidaId, realizada, personalIds } = captura.data;
	const repos = await datos();
	await exigirCentro(repos, locals, 'programa', programaId);
	const programa = (await repos.programa.listarProgramas()).find((p) => p.id === programaId);
	if (!programa) error(404, 'No encontrado');
	const hoy = fechaEnZona();
	const fecha = fechaEfectiva(captura.data.fecha, hoy);
	const problema = errorFechaActividad(fecha, hoy, programa);
	if (problema) return json({ error: problema }, { status: 400 });
	const mes = mesDeFecha(fecha);
	try {
		if (realizada) {
			const marca = await repos.programa.marcarEjecutado({
				programaId,
				partidaId,
				mes,
				cantidad: 1,
				fecha,
				nota: NOTA_ACTIVIDAD_REALIZADA,
				personalIds
			});
			return json({ tipo: 'realizada', fecha, mes, id: marca.id });
		}
		const ajuste = await repos.programa.registrarAjuste({
			programaId,
			partidaId,
			tipo: 'no_ejecutado',
			mesOrigen: mes,
			cantidad: 1,
			motivo: 'otro',
			nota: NOTA_ACTIVIDAD_NO_REALIZADA
		});
		return json({ tipo: 'no_realizada', fecha, mes, id: ajuste.id });
	} catch (causa) {
		return json({ error: mensajeDeError(causa) }, { status: 400 });
	}
};
