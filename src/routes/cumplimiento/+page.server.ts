// Tablero de estatus de los centros de costo y cumplimiento del programa anual: indicadores a un mes
// de corte (por omisión, el mes en curso), con filtros por cliente, contrato, sitio, periodicidad,
// estatus y búsqueda en la dirección. El estatus de cada centro se calcula aquí
// (components/cumplimiento/tablero.ts sobre dominio/estatus.ts); los indicadores del programa anual
// los calcula la vista con src/lib/dominio/cumplimiento.ts.
import { esEstatus, tarjetasDelTablero } from '$lib/components/cumplimiento/tablero';
import type { ProgramaCumplimiento } from '$lib/dominio/cumplimiento';
import { PERIODICIDADES } from '$lib/dominio/esquemas';
import { fechaEnZona } from '$lib/dominio/fechas';
import { alcanceDe, centrosVisibles, filtrarPor } from '$lib/server/alcance';
import { datos } from '$lib/server/datos';
import { puede } from '$lib/server/permisos';
import type { PageServerLoad } from './$types';

/**
 * Tablero de estatus: una tarjeta por centro de costo visible, con una sola consulta del resumen
 * (`api_estatus_centros`). Lo financiero solo viaja si quien consulta tiene `verContrato`.
 */
async function tableroDeEstatus(
	repos: Awaited<ReturnType<typeof datos>>,
	locals: App.Locals | undefined,
	programas: readonly ProgramaCumplimiento[],
	corte: string,
	hoy: string
) {
	const visibles = centrosVisibles(locals);
	const centros = await repos.centrosCosto.listar(visibles);
	const resumenes = await repos.estatus.obtener({
		sitioIds: visibles,
		mes: corte.slice(0, 7),
		hoy,
		verContrato: puede(locals, 'verContrato')
	});
	return tarjetasDelTablero(
		centros.map(({ id, clave, nombre, plantilla, contratos }) => ({
			id,
			clave,
			nombre,
			plantilla: plantilla && { origenActividades: plantilla.origenActividades },
			contratos: contratos.map((c) => ({ id: c.id, numero: c.numero }))
		})),
		resumenes,
		programas,
		corte,
		hoy
	);
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
	// Tablero de estatus: todos los centros de costo de quien consulta, tengan o no programa. Solo sin
	// filtro de contrato; con uno elegido la página es el detalle de ese contrato o centro.
	const estatus = url.searchParams.get('estatus');
	const concentrado =
		cliente || contrato
			? null
			: {
					tarjetas: await tableroDeEstatus(
						repos,
						locals,
						programas as unknown as ProgramaCumplimiento[],
						corte,
						hoy
					),
					estatus: esEstatus(estatus) ? estatus : null,
					busqueda: (url.searchParams.get('q') ?? '').trim().slice(0, 100)
				};
	return {
		concentrado,
		// «Contrato y cobranza» solo se ofrece a quien ve el contrato: sin esa capacidad no hay finanzas.
		verCobranza: puede(locals, 'verContrato'),
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
