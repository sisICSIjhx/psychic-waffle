// Concentrado de centros de costo y tablero de cumplimiento del programa: indicadores a un mes de corte (por omisión, el mes en curso),
// con filtros por cliente, contrato, sitio y periodicidad en la dirección. Los cálculos los hace la
// vista con src/lib/dominio/cumplimiento.ts sobre el avance de cada programa.
import { PERIODICIDADES } from '$lib/dominio/esquemas';
import { fechaEnZona } from '$lib/dominio/fechas';
import { alcanceDe, centrosVisibles, filtrarPor } from '$lib/server/alcance';
import { datos } from '$lib/server/datos';
import { puede } from '$lib/server/permisos';
import type { PageServerLoad } from './$types';

/**
 * Centros de costo visibles y, de los que capturan sus actividades cada mes, cuántas programaron y
 * ejecutaron en el mes de corte. Los que tienen programa anual se miden con sus programas.
 */
async function centrosDelConcentrado(
	repos: Awaited<ReturnType<typeof datos>>,
	locals: App.Locals | undefined,
	corte: string
) {
	const centros = await repos.centrosCosto.listar(centrosVisibles(locals));
	const mensuales = centros.filter((c) => c.plantilla?.origenActividades === 'mensual');
	const meses = await Promise.all(
		mensuales.map((c) => repos.seguimiento.obtener(c.id, corte.slice(0, 7)))
	);
	return {
		centros: centros.map(({ id, clave, nombre, plantilla, contratos }) => ({
			id,
			clave,
			nombre,
			plantilla: plantilla && { origenActividades: plantilla.origenActividades },
			contratos: contratos.map((c) => ({ id: c.id, numero: c.numero }))
		})),
		actividades: Object.fromEntries(
			mensuales.map((c, i) => {
				const programadas = meses[i].actividades.filter((a) => a.programada);
				return [
					c.id,
					{
						programadas: programadas.length,
						ejecutadas: programadas.filter((a) => a.ejecutada).length
					}
				];
			})
		)
	};
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const repos = await datos();
	const hoy = fechaEnZona();
	const mesActual = `${hoy.slice(0, 7)}-01`;
	const pedido = url.searchParams.get('corte') ?? '';
	// Solo un mes real de 2000 a 2099; cualquier otro valor (p. ej., el año 0) usa el mes en curso.
	const corteValido = /^20\d{2}-(0[1-9]|1[0-2])$/.test(pedido) ? `${pedido}-01` : mesActual;
	// El corte no puede ser posterior al mes en curso.
	const corteLimitado = corteValido > mesActual;
	const corte = corteLimitado ? mesActual : corteValido;

	// Solo los contratos y centros de costo de quien consulta (cambio centros-costo-plantillas).
	const alcance = await alcanceDe(repos, locals);
	const clientes = filtrarPor(
		alcance,
		'clientes',
		await repos.catalogo.listarClientes(),
		(c) => c.id
	);
	const cliente = clientes.find((c) => c.clave === url.searchParams.get('cliente')) ?? null;
	const contratos = filtrarPor(
		alcance,
		'contratos',
		await repos.catalogo.listarContratos(cliente ? { clienteClave: cliente.clave } : {}),
		(c) => c.id
	);
	const contrato = contratos.find((c) => c.id === url.searchParams.get('contrato')) ?? null;
	const sitios = contrato
		? filtrarPor(alcance, 'sitios', await repos.catalogo.listarSitios(contrato.id), (s) => s.id)
		: [];
	const sitio = sitios.find((s) => s.id === url.searchParams.get('sitio')) ?? null;
	const periodicidad = url.searchParams.get('periodicidad');

	const programas = filtrarPor(
		alcance,
		'sitios',
		await repos.programa.obtenerCumplimiento({
			corte,
			...(cliente ? { clienteClave: cliente.clave } : {}),
			...(contrato ? { contratoId: contrato.id } : {}),
			...(sitio ? { sitioId: sitio.id } : {})
		}),
		(p) => p.sitio.id
	);
	// Concentrado (etapa 5): todos los centros de costo de quien consulta, tengan o no programa. Solo
	// sin filtro de contrato; con uno elegido la página es el detalle de ese contrato o centro.
	const concentrado =
		cliente || contrato ? null : await centrosDelConcentrado(repos, locals, corte);
	return {
		concentrado,
		verCobranza: puede(locals, 'verContrato') || puede(locals, 'verEnlacePrograma'),
		hoy,
		corte,
		corteLimitado,
		cliente,
		contratos,
		contrato,
		sitios,
		sitio,
		periodicidad: (PERIODICIDADES as readonly string[]).includes(periodicidad ?? '')
			? periodicidad
			: null,
		programas
	};
};
