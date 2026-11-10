// Fuente única de las vistas del shell: ruta, título y accesos de captura por cliente.

export type VistaId =
	| 'dashboard'
	| 'planeacion'
	| 'cumplimiento'
	| 'captura'
	| 'historial'
	| 'catalogo'
	| 'equipos'
	| 'personal'
	| 'perfil';

export const routesByView = {
	dashboard: '/',
	planeacion: '/planeacion',
	cumplimiento: '/cumplimiento',
	captura: '/captura',
	historial: '/historial',
	catalogo: '/catalogo',
	equipos: '/equipos',
	personal: '/personal',
	perfil: '/perfil'
} as const satisfies Record<VistaId, string>;

export const titulosPorVista: Record<VistaId, string> = {
	dashboard: 'Mi trabajo',
	planeacion: 'Programa anual',
	cumplimiento: 'Cumplimiento del programa',
	captura: 'Capturar reporte',
	historial: 'Historial de reportes',
	catalogo: 'Catálogo de contratos',
	equipos: 'Catálogo de equipos',
	personal: 'Personal',
	perfil: 'Mi perfil'
};

/** Ceja del encabezado de cada vista: la ruta dentro del producto. */
const cejasPorVista: Record<VistaId, string> = {
	dashboard: 'Inicio',
	planeacion: 'Programa / Anual',
	cumplimiento: 'Programa / Cumplimiento',
	captura: 'Capturar / Nuevo reporte',
	historial: 'Consulta / Historial',
	catalogo: 'Consulta / Catálogo',
	equipos: 'Consulta / Equipos',
	personal: 'Administración',
	perfil: 'Cuenta'
};

/** Accesos del submenú Captura; todos llevan al mismo flujo filtrado por `?cliente=`. */
export const clientesCaptura = [
	{ clave: 'cerritos', etiqueta: 'Cerritos' },
	{ clave: 'proagro', etiqueta: 'Proagro' },
	{ clave: 'virtual', etiqueta: 'Virtual' }
] as const;

export type ClaveClienteCaptura = (typeof clientesCaptura)[number]['clave'];

const vistas = Object.keys(routesByView) as VistaId[];

/** Vista activa según la ruta; el editor `/reportes/[id]` pertenece a Captura. */
export function vistaDesdeRuta(pathname: string): VistaId | null {
	const segmento = pathname.split('/')[1] ?? '';
	if (segmento === '') return 'dashboard';
	if (segmento === 'reportes') return 'captura';
	return vistas.find((vista) => routesByView[vista] === `/${segmento}`) ?? null;
}

export function clienteCaptura(clave: string | null): (typeof clientesCaptura)[number] | null {
	return clientesCaptura.find((cliente) => cliente.clave === clave) ?? null;
}

/** En el editor (`/reportes/[id]`) el título es el del reporte abierto, si se conoce. */
export function tituloDePagina(
	pathname: string,
	cliente: string | null = null,
	tituloReporte: string | null = null
): string {
	const vista = vistaDesdeRuta(pathname);
	if (vista === null) return 'ICSI Reportes';
	if (pathname.split('/')[1] === 'reportes') return tituloReporte?.trim() || 'Reporte';
	const accesoCliente = vista === 'captura' ? clienteCaptura(cliente) : null;
	return accesoCliente ? `Capturar reporte: ${accesoCliente.etiqueta}` : titulosPorVista[vista];
}

export type EncabezadoPagina = { ceja: string | null; titulo: string };

/**
 * Encabezado que el layout pone sobre la página. El editor y el programa traen el suyo (con estado
 * y acciones) y devuelven null; las páginas internas del catálogo, de los equipos y del personal
 * llevan migas en lugar de ceja.
 */
export function encabezadoDePagina(
	pathname: string,
	cliente: string | null = null,
	datos: {
		contrato?: string | null;
		partida?: string | null;
		persona?: string | null;
		equipo?: string | null;
	} = {}
): EncabezadoPagina | null {
	const vista = vistaDesdeRuta(pathname);
	const [, primero, segundo] = pathname.split('/');
	if (vista === null || primero === 'reportes' || vista === 'planeacion') return null;
	if (vista === 'catalogo' && segundo === 'contratos') {
		return { ceja: null, titulo: datos.contrato ? `Contrato ${datos.contrato}` : 'Contrato' };
	}
	if (vista === 'equipos' && segundo) {
		return { ceja: null, titulo: datos.equipo ? `Equipo ${datos.equipo}` : 'Nuevo equipo' };
	}
	if (vista === 'personal' && segundo) {
		return { ceja: null, titulo: datos.persona || 'Nueva persona' };
	}
	if (vista === 'catalogo' && segundo === 'alcances') {
		return { ceja: null, titulo: 'Alcances predeterminados' };
	}
	if (vista === 'catalogo' && segundo === 'partidas') {
		return { ceja: null, titulo: datos.partida ? `Partida ${datos.partida}` : 'Nueva partida' };
	}
	const accesoCliente = vista === 'captura' ? clienteCaptura(cliente) : null;
	return {
		ceja: accesoCliente ? `Capturar / ${accesoCliente.etiqueta}` : cejasPorVista[vista],
		titulo: titulosPorVista[vista]
	};
}
