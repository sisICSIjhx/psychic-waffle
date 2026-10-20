import { error as errorHttp, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import {
	esquemaAlcancePartida,
	esquemaHerramienta,
	type PartidaEntrada
} from '$lib/dominio/esquemas';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();
const opcional = (formulario: FormData, campo: string) => texto(formulario, campo) || null;
const marcado = (formulario: FormData, campo: string) => formulario.get(campo) === 'on';

function json<T>(formulario: FormData, campo: string, esquema: z.ZodType<T>): T {
	return esquema.parse(JSON.parse(texto(formulario, campo) || '[]'));
}

export const load: PageServerLoad = async ({ params, url }) => {
	const repos = await datos();
	const contratos = await repos.catalogo.listarContratos();
	if (params.id === 'nueva') {
		const contrato = contratos.find((c) => c.id === url.searchParams.get('contrato'));
		const sitio = contrato
			? (await repos.catalogo.listarSitios(contrato.id)).find(
					(s) => s.id === url.searchParams.get('sitio')
				)
			: undefined;
		if (!contrato || !sitio) errorHttp(400, 'Indique el contrato y el sitio de la partida');
		return {
			partida: null,
			contrato,
			sitio,
			equipos: await repos.catalogo.listarEquipos(sitio.id)
		};
	}
	const partida = await repos.catalogo.obtenerPartida(params.id).catch(() => null);
	if (!partida) errorHttp(404, 'Partida no encontrada');
	const contrato = contratos.find((c) => c.id === partida.contratoId)!;
	const sitio = (await repos.catalogo.listarSitios(contrato.id)).find(
		(s) => s.id === partida.sitioId
	)!;
	return { partida, contrato, sitio, equipos: await repos.catalogo.listarEquipos(partida.sitioId) };
};

export const actions: Actions = {
	guardar: async ({ request, params }) => {
		const formulario = await request.formData();
		let id: string;
		try {
			const cantidad = texto(formulario, 'cantidadAnual');
			const entrada: PartidaEntrada = {
				id: params.id === 'nueva' ? undefined : params.id,
				contratoId: texto(formulario, 'contratoId'),
				sitioId: texto(formulario, 'sitioId'),
				numero: texto(formulario, 'numero'),
				actividad: texto(formulario, 'actividad'),
				nombreCorto: opcional(formulario, 'nombreCorto'),
				descripcion: opcional(formulario, 'descripcion'),
				distribucion: opcional(formulario, 'distribucion') as 'produccion' | 'mantenimiento' | null,
				periodicidad: texto(formulario, 'periodicidad') as PartidaEntrada['periodicidad'],
				cantidadAnual: cantidad === '' ? null : Number(cantidad),
				entrega: opcional(formulario, 'entrega'),
				entregaOma: opcional(formulario, 'entregaOma'),
				entregaPropuesta: opcional(formulario, 'entregaPropuesta'),
				requiereOdm: marcado(formulario, 'requiereOdm'),
				requierePt: marcado(formulario, 'requierePt'),
				requiereAst: marcado(formulario, 'requiereAst'),
				materialesPor: opcional(formulario, 'materialesPor') as 'icsi' | 'cliente' | null,
				reportesHomologados: opcional(formulario, 'reportesHomologados'),
				tipoMantenimiento: texto(formulario, 'tipoMantenimiento') || 'Preventivo',
				objetivo: opcional(formulario, 'objetivo'),
				conclusionesBase: opcional(formulario, 'conclusionesBase'),
				disposicionFotos: texto(
					formulario,
					'disposicionFotos'
				) as PartidaEntrada['disposicionFotos'],
				proponeVerificacion: marcado(formulario, 'proponeVerificacion'),
				estadoCatalogo: texto(formulario, 'estadoCatalogo') as PartidaEntrada['estadoCatalogo'],
				alcances: json(formulario, 'alcances', z.array(esquemaAlcancePartida)),
				herramientas: json(formulario, 'herramientas', z.array(esquemaHerramienta)),
				equipoIds: json(formulario, 'equipoIds', z.array(z.uuid()))
			};
			id = (await (await datos()).catalogo.guardarPartida(entrada)).id;
		} catch (error) {
			return fail(400, { error: mensajeDeError(error) });
		}
		if (params.id === 'nueva') redirect(303, resolve('/catalogo/partidas/[id]', { id }));
		return { mensaje: 'Partida guardada.' };
	}
};
