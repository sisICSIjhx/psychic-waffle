// Fuente única de las vistas del shell: ruta, título y accesos de captura por cliente.

export type VistaId =
	| 'dashboard'
	| 'planeacion'
	| 'cumplimiento'
	| 'captura'
	| 'historial'
	| 'catalogo'
	| 'personal'
	| 'perfil';

export const routesByView = {
	dashboard: '/',
	planeacion: '/planeacion',
	cumplimiento: '/cumplimiento',
	captura: '/captura',
	historial: '/historial',
	catalogo: '/catalogo',
	personal: '/personal',
	perfil: '/perfil'
} as const satisfies Record<VistaId, string>;

export const titulosPorVista: Record<VistaId, string> = {
	dashboard: 'Mi trabajo',
	planeacion: 'Planeación Anual',
	cumplimiento: 'Cumplimiento del programa',
	captura: 'Captura de Reportes',
	historial: 'Historial Global',
	catalogo: 'Catálogo de Contratos',
	personal: 'Administración de Personal',
	perfil: 'Mi Perfil'
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
	return accesoCliente ? `Captura: ${accesoCliente.etiqueta}` : titulosPorVista[vista];
}
