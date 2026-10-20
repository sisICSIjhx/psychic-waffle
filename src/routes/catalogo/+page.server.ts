import { fail } from '@sveltejs/kit';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();

export const load: PageServerLoad = async () => {
	const repos = await datos();
	const [clientes, contratos] = await Promise.all([
		repos.catalogo.listarClientes(),
		repos.catalogo.listarContratos()
	]);
	const conteos = await Promise.all(
		contratos.map(async (contrato) => {
			const partidas = await repos.catalogo.listarPartidas({ contratoId: contrato.id });
			return {
				contratoId: contrato.id,
				partidas: partidas.length,
				porConfirmar: partidas.filter((p) => p.estadoCatalogo === 'por_confirmar').length
			};
		})
	);
	return { clientes, contratos, conteos };
};

export const actions: Actions = {
	crearCliente: async ({ request }) => {
		const formulario = await request.formData();
		try {
			const cliente = await (
				await datos()
			).catalogo.guardarCliente({
				clave: texto(formulario, 'clave').toLowerCase(),
				nombre: texto(formulario, 'nombre'),
				razonSocial: texto(formulario, 'razonSocial')
			});
			return { accion: 'crearCliente', mensaje: `Cliente ${cliente.nombre} registrado.` };
		} catch (error) {
			return fail(400, { accion: 'crearCliente', error: mensajeDeError(error) });
		}
	},

	crearContrato: async ({ request }) => {
		const formulario = await request.formData();
		try {
			const contrato = await (
				await datos()
			).catalogo.guardarContrato({
				clienteId: texto(formulario, 'clienteId'),
				numero: texto(formulario, 'numero'),
				descripcion: texto(formulario, 'descripcion') || null,
				vigenciaInicio: texto(formulario, 'vigenciaInicio'),
				vigenciaFin: texto(formulario, 'vigenciaFin')
			});
			return { accion: 'crearContrato', mensaje: `Contrato ${contrato.numero} registrado.` };
		} catch (error) {
			return fail(400, { accion: 'crearContrato', error: mensajeDeError(error) });
		}
	}
};
