// Historial global: reportes con paginación y filtros por cliente, contrato, sitio, partida, TAG,
// periodo y estado. Los filtros viajan en la URL para poder compartir o volver a una búsqueda.
import { ESTADOS_REPORTE, type FiltroReportes } from '$lib/dominio/esquemas';
import { datos } from '$lib/server/datos';
import type { PageServerLoad } from './$types';

const TAMANO_PAGINA = 20;

/** «AAAA-MM» (input type=month) → «AAAA-MM-01»; cualquier otra cosa se ignora. */
const mesDe = (valor: string | null) => (/^\d{4}-\d{2}$/.test(valor ?? '') ? `${valor}-01` : null);

export const load: PageServerLoad = async ({ url }) => {
	const repos = await datos();
	const parametro = (nombre: string) => url.searchParams.get(nombre)?.trim() || null;

	const clientes = await repos.catalogo.listarClientes();
	const cliente = clientes.find((c) => c.clave === parametro('cliente')) ?? null;
	const contratos = await repos.catalogo.listarContratos(
		cliente ? { clienteClave: cliente.clave } : {}
	);
	const contrato = contratos.find((c) => c.id === parametro('contrato')) ?? null;
	const sitios = contrato ? await repos.catalogo.listarSitios(contrato.id) : [];
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
		pagina,
		tamano: TAMANO_PAGINA
	};
	const resultado = await repos.reportes.listar(filtro);
	return {
		clientes,
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
