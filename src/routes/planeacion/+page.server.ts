// Planeación anual: matriz P/R del programa de un contrato y sitio (vista anual, mensual o semanal),
// con filtros por distribución y periodicidad, pendientes vencidos, ajustes (reprogramado y no
// ejecutado) y registro de realizados hechos fuera del sistema.
import { fail } from '@sveltejs/kit';
import { MOTIVOS_AJUSTE, PERIODICIDADES, type MotivoAjuste } from '$lib/dominio/esquemas';
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
	const meses = avance?.programa.meses ?? [];
	const pedida = url.searchParams.get('vista');
	const vista: 'anual' | 'mensual' | 'semanal' =
		pedida === 'mensual' || pedida === 'semanal' ? pedida : 'anual';
	// Mes de las vistas mensual y semanal: el pedido, el en curso si está en el periodo o el primero.
	const mesPedido = `${(url.searchParams.get('mes') ?? '').slice(0, 7)}-01`;
	const mesVista =
		meses.find((m) => m === mesPedido) ??
		meses.find((m) => m.slice(0, 7) === fecha.slice(0, 7)) ??
		meses[0] ??
		null;
	const semana = Math.max(1, Number(url.searchParams.get('semana')) || 1);
	const ejecucionesMes =
		vista === 'semanal' && programa && mesVista
			? await repos.programa.listarEjecucionesMes(programa.id, mesVista)
			: [];
	return {
		vista,
		mesVista,
		semana,
		ejecucionesMes,
		hoy: fecha,
		contratos,
		contrato,
		sitios,
		sitio,
		programas,
		programa,
		meses,
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
	},

	// Reprograma lo que falta de una partida y mes, o lo marca como no ejecutado.
	registrarAjuste: async ({ request }) => {
		const formulario = await request.formData();
		const texto = (campo: string) => String(formulario.get(campo) ?? '').trim();
		const tipo = texto('tipo') === 'no_ejecutado' ? 'no_ejecutado' : 'reprogramado';
		const motivo = texto('motivo') as MotivoAjuste;
		if (!MOTIVOS_AJUSTE.includes(motivo)) {
			return fail(400, { accion: 'registrarAjuste', error: 'Elija el motivo.' });
		}
		try {
			const ajuste = await (
				await datos()
			).programa.registrarAjuste({
				programaId: texto('programaId'),
				partidaId: texto('partidaId'),
				tipo,
				mesOrigen: texto('mesOrigen'),
				mesDestino: tipo === 'reprogramado' ? texto('mesDestino') || null : null,
				cantidad: Number(texto('cantidad') || '1'),
				motivo,
				nota: texto('nota') || null
			});
			return { accion: 'registrarAjuste', ajuste };
		} catch (error) {
			return fail(400, { accion: 'registrarAjuste', error: mensajeDeError(error) });
		}
	},

	anularAjuste: async ({ request }) => {
		const formulario = await request.formData();
		try {
			const ajuste = await (
				await datos()
			).programa.anularAjuste(String(formulario.get('id') ?? ''));
			return { accion: 'anularAjuste', ajuste, mensaje: 'Ajuste anulado.' };
		} catch (error) {
			return fail(400, { accion: 'anularAjuste', error: mensajeDeError(error) });
		}
	}
};
