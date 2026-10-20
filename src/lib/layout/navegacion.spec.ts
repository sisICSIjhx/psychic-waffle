import { describe, expect, it } from 'vitest';
import {
	clienteCaptura,
	routesByView,
	tituloDePagina,
	vistaDesdeRuta,
	type VistaId
} from './navegacion';

describe('navegación entre vistas', () => {
	it('resuelve la vista de cada ruta declarada', () => {
		for (const [vista, ruta] of Object.entries(routesByView)) {
			expect(vistaDesdeRuta(ruta)).toBe(vista as VistaId);
		}
	});

	it('asigna el editor de reportes a Captura y desconoce rutas ajenas', () => {
		expect(vistaDesdeRuta('/reportes/123')).toBe('captura');
		expect(vistaDesdeRuta('/prosasa')).toBeNull();
		expect(vistaDesdeRuta('/dashboard')).toBeNull();
	});

	it('titula la captura según el cliente elegido', () => {
		expect(tituloDePagina('/captura', 'proagro')).toBe('Captura: Proagro');
		expect(tituloDePagina('/captura', 'desconocido')).toBe('Captura de Reportes');
		expect(tituloDePagina('/historial', 'proagro')).toBe('Historial Global');
		expect(tituloDePagina('/no-existe')).toBe('ICSI Reportes');
	});

	it('solo reconoce los clientes de captura vigentes', () => {
		expect(clienteCaptura('cerritos')?.etiqueta).toBe('Cerritos');
		expect(clienteCaptura('prosasa')).toBeNull();
		expect(clienteCaptura(null)).toBeNull();
	});
});
