// Tablero de cumplimiento del programa: indicadores a un mes de corte (por omisión, el mes en curso),
// con filtros por cliente, contrato, sitio y periodicidad en la dirección. Los cálculos los hace la
// vista con src/lib/dominio/cumplimiento.ts sobre el avance de cada programa.
import { PERIODICIDADES } from '$lib/dominio/esquemas';
import { fechaEnZona } from '$lib/dominio/fechas';
import { datos } from '$lib/server/datos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const repos = await datos();
	const hoy = fechaEnZona();
	const mesActual = `${hoy.slice(0, 7)}-01`;
	const pedido = url.searchParams.get('corte') ?? '';
	const corteValido = /^\d{4}-\d{2}$/.test(pedido) ? `${pedido}-01` : mesActual;
	// El corte no puede ser posterior al mes en curso.
	const corteLimitado = corteValido > mesActual;
	const corte = corteLimitado ? mesActual : corteValido;

	const clientes = await repos.catalogo.listarClientes();
	const cliente = clientes.find((c) => c.clave === url.searchParams.get('cliente')) ?? null;
	const contratos = await repos.catalogo.listarContratos(
		cliente ? { clienteClave: cliente.clave } : {}
	);
	const contrato = contratos.find((c) => c.id === url.searchParams.get('contrato')) ?? null;
	const sitios = contrato ? await repos.catalogo.listarSitios(contrato.id) : [];
	const sitio = sitios.find((s) => s.id === url.searchParams.get('sitio')) ?? null;
	const periodicidad = url.searchParams.get('periodicidad');

	const programas = await repos.programa.obtenerCumplimiento({
		corte,
		...(cliente ? { clienteClave: cliente.clave } : {}),
		...(contrato ? { contratoId: contrato.id } : {}),
		...(sitio ? { sitioId: sitio.id } : {})
	});
	return {
		hoy,
		corte,
		corteLimitado,
		clientes,
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
