// Historial global: reportes con paginación y filtros por cliente, contrato, sitio, partida, TAG,
// periodo y estado. Los filtros viajan en la URL para poder compartir o volver a una búsqueda.
import { ESTADOS_REPORTE, type FiltroReportes } from '$lib/dominio/esquemas';
import { alcanceDe, filtrarPor } from '$lib/server/alcance';
import { datos } from '$lib/server/datos';
import type { PageServerLoad } from './$types';

const TAMANO_PAGINA = 20;

/** «AAAA-MM» (input type=month) → «AAAA-MM-01»; cualquier otra cosa se ignora. */
const mesDe = (valor: string | null) =>
	/^\d{4}-(0[1-9]|1[0-2])$/.test(valor ?? '') ? `${valor}-01` : null;

export const load: PageServerLoad = async ({ url, locals }) => {
	const repos = await datos();
	const parametro = (nombre: string) => url.searchParams.get(nombre)?.trim() || null;
	// Solo los reportes de los centros de costo de quien consulta (cambio centros-costo-plantillas);
	// el filtro va a la consulta para que el total y las páginas cuenten solo esos.
	const alcance = await alcanceDe(repos, locals);

	const clientes = filtrarPor(
		alcance,
		'clientes',
		await repos.catalogo.listarClientes(),
		(c) => c.id
	);
	const cliente = clientes.find((c) => c.clave === parametro('cliente')) ?? null;
	const contratos = filtrarPor(
		alcance,
		'contratos',
		await repos.catalogo.listarContratos(cliente ? { clienteClave: cliente.clave } : {}),
		(c) => c.id
	);
	const contrato = contratos.find((c) => c.id === parametro('contrato')) ?? null;
	const sitios = contrato
		? filtrarPor(alcance, 'sitios', await repos.catalogo.listarSitios(contrato.id), (s) => s.id)
		: [];
	const sitio = sitios.find((s) => s.id === parametro('sitio')) ?? null;
	const partidas =
		contrato && sitio
			? await repos.catalogo.listarPartidas({ contratoId: contrato.id, sitioId: sitio.id })
			: [];
	const partida = partidas.find((p) => p.id === parametro('partida')) ?? null;
	const estado = (ESTADOS_REPORTE as readonly string[]).includes(parametro('estado') ?? '')
		? (parametro('estado') as FiltroReportes['estado'])
		: null;
	const pagina = Math.max(1, Number.parseInt(parametro('pagina') ?? '1', 10) || 1);

	const filtro: FiltroReportes = {
		...(cliente ? { clienteClave: cliente.clave } : {}),
		...(contrato ? { contratoId: contrato.id } : {}),
		...(sitio ? { sitioId: sitio.id } : {}),
		...(partida ? { partidaId: partida.id } : {}),
		...(parametro('tag') ? { tag: parametro('tag')! } : {}),
		...(estado ? { estado } : {}),
		...(mesDe(parametro('desde')) ? { desde: mesDe(parametro('desde'))! } : {}),
		...(mesDe(parametro('hasta')) ? { hasta: mesDe(parametro('hasta'))! } : {}),
		...(alcance ? { sitioIds: [...alcance.sitios] } : {}),
		pagina,
		tamano: TAMANO_PAGINA
	};
	let resultado = await repos.reportes.listar(filtro);
	// Una página que ya no existe (p. ej. tras emitir borradores) muestra la última con resultados.
	if (resultado.filas.length === 0 && resultado.total > 0) {
		resultado = await repos.reportes.listar({
			...filtro,
			pagina: Math.ceil(resultado.total / TAMANO_PAGINA)
		});
	}
	return {
		contratos,
		sitios,
		partidas,
		seleccion: {
			cliente: cliente?.clave ?? '',
			contrato: contrato?.id ?? '',
			sitio: sitio?.id ?? '',
			partida: partida?.id ?? '',
			tag: parametro('tag') ?? '',
			estado: estado ?? '',
			desde: mesDe(parametro('desde'))?.slice(0, 7) ?? '',
			hasta: mesDe(parametro('hasta'))?.slice(0, 7) ?? ''
		},
		resultado
	};
};
