// Selección guiada para crear un reporte: contrato vigente, sitio, partida, TAG y periodo. Cada paso
// es un parámetro de la URL; la acción «crear» genera el reporte prellenado y abre el editor.
import { error as errorHttp, fail, redirect } from '@sveltejs/kit';
import { mesesDeVigencia, modosDePeriodo, tipoOcurrencia } from '$lib/dominio/captura';
import type { Partida } from '$lib/dominio/esquemas';
import { fechaEnZona } from '$lib/dominio/fechas';
import { alcanceDe, exigirCentro, filtrarPor } from '$lib/server/alcance';
import { ErrorValidacion } from '$lib/server/captura';
import { captura, datos } from '$lib/server/datos';
import { datosDeSeleccion } from '$lib/server/seleccion-captura';
import { mensajeDeError } from '$lib/server/errores';
import { puede } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const hoy = () => fechaEnZona();

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!puede(locals, 'capturar')) errorHttp(403, 'Su rol no captura reportes.');
	const repos = await datos();
	// Solo los contratos y centros de costo de quien captura (cambio centros-costo-plantillas).
	const alcance = await alcanceDe(repos, locals);
	const cliente = url.searchParams.get('cliente');
	const clientes = filtrarPor(
		alcance,
		'clientes',
		await repos.catalogo.listarClientes(),
		(c) => c.id
	);
	const clienteElegido = clientes.find((c) => c.clave === cliente) ?? null;
	// Los borradores no dependen de la selección: se piden ya y se esperan al final.
	const borradoresPedidos = repos.reportes.listar({
		estado: 'borrador',
		tamano: 10,
		...(clienteElegido ? { clienteClave: clienteElegido.clave } : {}),
		...(alcance ? { sitioIds: [...alcance.sitios] } : {})
	});
	// Si otra consulta falla antes de esperarla, su error no debe quedar como rechazo sin manejar.
	borradoresPedidos.catch(() => undefined);
	// Solo contratos vigentes hoy; con ?cliente= solo los de ese cliente.
	const contratos = filtrarPor(
		alcance,
		'contratos',
		await repos.catalogo.listarContratos({
			vigentesEn: hoy(),
			...(clienteElegido ? { clienteClave: clienteElegido.clave } : {})
		}),
		(c) => c.id
	);
	const contrato =
		contratos.find((c) => c.id === url.searchParams.get('contrato')) ??
		(contratos.length === 1 ? contratos[0] : null);
	const sitios = contrato
		? filtrarPor(alcance, 'sitios', await repos.catalogo.listarSitios(contrato.id), (s) => s.id)
		: [];
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
	const seleccion = await datosDeSeleccion(repos, {
		contratoId: contrato?.id ?? null,
		sitioId: sitio?.id ?? null,
		partidas,
		partidaId: partida?.id ?? null,
		meses,
		// ?mes= llega desde una celda de la planeación o de «Mi trabajo».
		mesPedido: url.searchParams.get('mes') ?? '',
		hoy: hoy()
	});

	const borradores = await borradoresPedidos;
	return {
		cliente: clienteElegido,
		contratos,
		contrato,
		sitios,
		sitio,
		partidas,
		partida,
		tipoOcurrencia: partida ? tipoOcurrencia(partida.periodicidad) : null,
		mesCompletoOpcional: partida ? modosDePeriodo(partida.periodicidad).length > 1 : false,
		meses,
		...seleccion,
		// ?reprogramacion= llega desde la celda destino de la planeación o desde «Mi trabajo».
		reprogramacionPedida: url.searchParams.get('reprogramacion'),
		borradores: borradores.filas
	};
};

export const actions: Actions = {
	crear: async ({ request, locals }) => {
		const formulario = await request.formData();
		const tipo = String(formulario.get('ocurrenciaTipo') ?? '');
		const numero = Number(formulario.get('ocurrenciaNumero') ?? 0);
		const partidaId = String(formulario.get('partidaId') ?? '');
		// Una partida de otro centro de costo no existe para quien captura.
		await exigirCentro(await datos(), locals, 'partida', partidaId);
		let reporte;
		try {
			reporte = await (
				await captura()
			).crearReporte({
				partidaId,
				periodoMes: String(formulario.get('periodoMes') ?? ''),
				ocurrencia:
					tipo === 'semana' || tipo === 'quincena' || tipo === 'dia' ? { tipo, numero } : null,
				equipoIds: formulario.getAll('equipoIds').map(String),
				reprogramacionId: String(formulario.get('reprogramacionId') ?? '') || null
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
