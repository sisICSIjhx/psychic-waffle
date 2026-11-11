import { fail } from '@sveltejs/kit';
import { alcanceDe, filtrarPor } from '$lib/server/alcance';
import { datos } from '$lib/server/datos';
import { mensajeDeError } from '$lib/server/errores';
import { puedeEditarCatalogo } from '$lib/server/permisos';
import type { Actions, PageServerLoad } from './$types';

const texto = (formulario: FormData, campo: string) => String(formulario.get(campo) ?? '').trim();

export const load: PageServerLoad = async ({ locals }) => {
	const repos = await datos();
	const [clientes, todos, alcance] = await Promise.all([
		repos.catalogo.listarClientes(),
		repos.catalogo.listarContratos(),
		alcanceDe(repos, locals)
	]);
	// Quien no edita el catálogo solo consulta los contratos de sus centros de costo.
	const contratos = filtrarPor(alcance, 'contratos', todos, (c) => c.id);
	const conteos = await Promise.all(
		contratos.map(async (contrato) => {
			// Solo las partidas de los centros de costo visibles.
			const partidas = filtrarPor(
				alcance,
				'sitios',
				await repos.catalogo.listarPartidas({ contratoId: contrato.id }),
				(p) => p.sitioId
			);
			return {
				contratoId: contrato.id,
				partidas: partidas.length,
				porConfirmar: partidas.filter((p) => p.estadoCatalogo === 'por_confirmar').length
			};
		})
	);
	return {
		clientes: filtrarPor(alcance, 'clientes', clientes, (c) => c.id),
		contratos,
		conteos,
		puedeEditar: puedeEditarCatalogo(locals)
	};
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
			return { accion: 'crearCliente', mensaje: `Proyecto ${cliente.nombre} registrado.` };
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
