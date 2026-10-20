// Selección guiada para crear un reporte: contrato vigente, sitio, partida, TAG y periodo. Cada paso
// es un parámetro de la URL; la acción «crear» genera el reporte prellenado y abre el editor.
import { fail, redirect } from '@sveltejs/kit';
import { mesesDeVigencia, tipoOcurrencia } from '$lib/dominio/captura';
import type { Partida } from '$lib/dominio/esquemas';
import { fechaEnZona } from '$lib/dominio/fechas';
import { ErrorValidacion } from '$lib/server/captura';
import { captura, datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import type { Actions, PageServerLoad } from './$types';

const hoy = () => fechaEnZona();

export const load: PageServerLoad = async ({ url }) => {
	const repos = await datos();
	const cliente = url.searchParams.get('cliente');
	const clientes = await repos.catalogo.listarClientes();
	const clienteElegido = clientes.find((c) => c.clave === cliente) ?? null;
	// Solo contratos vigentes hoy; con ?cliente= solo los de ese cliente.
	const contratos = await repos.catalogo.listarContratos({
		vigentesEn: hoy(),
		...(clienteElegido ? { clienteClave: clienteElegido.clave } : {})
	});
	const contrato =
		contratos.find((c) => c.id === url.searchParams.get('contrato')) ??
		(contratos.length === 1 ? contratos[0] : null);
	const sitios = contrato ? await repos.catalogo.listarSitios(contrato.id) : [];
	const sitio =
		sitios.find((s) => s.id === url.searchParams.get('sitio')) ??
		(sitios.length === 1 ? sitios[0] : null);
	const partidas =
		contrato && sitio
			? await repos.catalogo.listarPartidas({ contratoId: contrato.id, sitioId: sitio.id })
			: [];
	const idPartida = url.searchParams.get('partida');
	let partida: Partida | null = null;
	if (idPartida && partidas.some((p) => p.id === idPartida)) {
		partida = await repos.catalogo.obtenerPartida(idPartida);
	}
	const meses = contrato ? mesesDeVigencia(contrato.vigenciaInicio, contrato.vigenciaFin) : [];
	// ?mes= llega desde una celda de la planeación; si no, se propone el mes en curso.
	const mesPedido = url.searchParams.get('mes') ?? '';
	const mesActual = `${hoy().slice(0, 7)}-01`;
	const borradores = await repos.reportes.listar({
		estado: 'borrador',
		tamano: 10,
		...(clienteElegido ? { clienteClave: clienteElegido.clave } : {})
	});
	return {
		cliente: clienteElegido,
		contratos,
		contrato,
		sitios,
		sitio,
		partidas,
		partida,
		tipoOcurrencia: partida ? tipoOcurrencia(partida.periodicidad) : null,
		meses,
		mesSugerido: meses.includes(mesPedido)
			? mesPedido
			: meses.includes(mesActual)
				? mesActual
				: (meses[0] ?? null),
		borradores: borradores.filas
	};
};

export const actions: Actions = {
	crear: async ({ request }) => {
		const formulario = await request.formData();
		const tipo = String(formulario.get('ocurrenciaTipo') ?? '');
		const numero = Number(formulario.get('ocurrenciaNumero') ?? 0);
		let reporte;
		try {
			reporte = await (
				await captura()
			).crearReporte({
				partidaId: String(formulario.get('partidaId') ?? ''),
				periodoMes: String(formulario.get('periodoMes') ?? ''),
				ocurrencia:
					tipo === 'semana' || tipo === 'quincena' || tipo === 'dia' ? { tipo, numero } : null,
				equipoIds: formulario.getAll('equipoIds').map(String)
			});
		} catch (error) {
			if (error instanceof ErrorValidacion) {
				return fail(400, { error: error.message, observaciones: error.observaciones });
			}
			return fail(400, { error: mensajeDeError(error), observaciones: [] });
		}
		redirect(303, `/reportes/${reporte.id}`);
	}
};
