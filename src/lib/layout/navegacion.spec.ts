import { describe, expect, it } from 'vitest';
import {
	clienteCaptura,
	encabezadoDePagina,
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
		expect(tituloDePagina('/captura', 'proagro')).toBe('Capturar reporte: Proagro');
		expect(tituloDePagina('/captura', 'desconocido')).toBe('Capturar reporte');
		expect(tituloDePagina('/historial', 'proagro')).toBe('Historial de reportes');
		expect(tituloDePagina('/no-existe')).toBe('ICSI Reportes');
		expect(tituloDePagina('/')).toBe('Mi trabajo');
	});

	it('titula el editor con el reporte abierto', () => {
		expect(tituloDePagina('/reportes/123', null, '07.- TOMA DE POTENCIALES. MAYO 2026')).toBe(
			'07.- TOMA DE POTENCIALES. MAYO 2026'
		);
		expect(tituloDePagina('/reportes/123')).toBe('Reporte');
		expect(tituloDePagina('/captura', null, 'Otro')).toBe('Capturar reporte');
	});

	it('solo reconoce los clientes de captura vigentes', () => {
		expect(clienteCaptura('cerritos')?.etiqueta).toBe('Cerritos');
		expect(clienteCaptura('prosasa')).toBeNull();
		expect(clienteCaptura(null)).toBeNull();
	});

	it('pone ceja y título en cada página; el editor y el programa traen el suyo', () => {
		expect(encabezadoDePagina('/historial')).toEqual({
			ceja: 'Consulta / Historial',
			titulo: 'Historial de reportes'
		});
		expect(encabezadoDePagina('/captura', 'proagro')).toEqual({
			ceja: 'Capturar / Proagro',
			titulo: 'Capturar reporte'
		});
		expect(encabezadoDePagina('/catalogo/contratos/1', null, { contrato: 'OC-1' })).toEqual({
			ceja: null,
			titulo: 'Contrato OC-1'
		});
		expect(encabezadoDePagina('/catalogo/partidas/nueva')?.titulo).toBe('Nueva partida');
		expect(encabezadoDePagina('/personal/nuevo')?.titulo).toBe('Nueva persona');
		expect(encabezadoDePagina('/personal/1', null, { persona: 'Ana Ficticia' })?.titulo).toBe(
			'Ana Ficticia'
		);
		expect(encabezadoDePagina('/catalogo/alcances')).toEqual({
			ceja: null,
			titulo: 'Alcances predeterminados'
		});
		expect(encabezadoDePagina('/reportes/123')).toBeNull();
		expect(encabezadoDePagina('/planeacion')).toBeNull();
		expect(encabezadoDePagina('/no-existe')).toBeNull();
	});

	it('el tablero de cumplimiento tiene su ruta y su título', () => {
		expect(vistaDesdeRuta('/cumplimiento')).toBe('cumplimiento');
		expect(tituloDePagina('/cumplimiento')).toBe('Cumplimiento del programa');
	});
});
