// Planeación anual: matriz P/R del programa de un contrato y sitio, con filtros por distribución y
// periodicidad, pendientes vencidos y registro de realizados hechos fuera del sistema.
import { fail } from '@sveltejs/kit';
import { PERIODICIDADES } from '$lib/dominio/esquemas';
import { fechaEnZona } from '$lib/dominio/fechas';
import {
	filtrarPartidas,
	pendientesVencidos,
	programaVigente,
	type FiltroPlaneacion
} from '$lib/dominio/planeacion';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import type { Actions, PageServerLoad } from './$types';

const hoy = () => fechaEnZona();

export const load: PageServerLoad = async ({ url }) => {
	const repos = await datos();
	const fecha = hoy();
	const contratos = await repos.catalogo.listarContratos();
	const contrato =
		contratos.find((c) => c.id === url.searchParams.get('contrato')) ??
		contratos.find((c) => c.vigente) ??
		contratos[0] ??
		null;
	const sitios = contrato ? await repos.catalogo.listarSitios(contrato.id) : [];
	const sitio = sitios.find((s) => s.id === url.searchParams.get('sitio')) ?? sitios[0] ?? null;
	const programas =
		contrato && sitio
			? await repos.programa.listarProgramas({ contratoId: contrato.id, sitioId: sitio.id })
			: [];
	const programa =
		programas.find((p) => p.id === url.searchParams.get('programa')) ??
		programaVigente(programas, fecha);
	const avance = programa ? await repos.programa.obtenerAvance(programa.id) : null;

	const distribucion = url.searchParams.get('distribucion');
	const periodicidad = url.searchParams.get('periodicidad');
	const filtro: FiltroPlaneacion = {
		distribucion:
			distribucion === 'produccion' || distribucion === 'mantenimiento' ? distribucion : null,
		periodicidad: (PERIODICIDADES as readonly string[]).includes(periodicidad ?? '')
			? (periodicidad as FiltroPlaneacion['periodicidad'])
			: null
	};
	const partidas = avance ? filtrarPartidas(avance.partidas, filtro) : [];
	return {
		hoy: fecha,
		contratos,
		contrato,
		sitios,
		sitio,
		programas,
		programa,
		meses: avance?.programa.meses ?? [],
		partidas,
		totalPartidas: avance?.partidas.length ?? 0,
		vencidos: pendientesVencidos(partidas, fecha),
		filtro
	};
};

export const actions: Actions = {
	registrarRealizado: async ({ request }) => {
		const formulario = await request.formData();
		const texto = (campo: string) => String(formulario.get(campo) ?? '').trim();
		try {
			await (
				await datos()
			).programa.registrarRealizadoManual({
				programaId: texto('programaId'),
				partidaId: texto('partidaId'),
				mes: texto('mes'),
				cantidad: Number(texto('cantidad') || '1'),
				nota: texto('nota')
			});
			return { mensaje: 'Realizado registrado.' };
		} catch (error) {
			return fail(400, { error: mensajeDeError(error) });
		}
	}
};
