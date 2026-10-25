import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { PaginaReportes } from '$lib/dominio/esquemas';
import HistorialView from './HistorialView.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function fila(n: number, cambios: Partial<PaginaReportes['filas'][number]> = {}) {
	return {
		id: ID(n),
		partidaId: ID(900),
		sitioId: ID(901),
		titulo: `20.- VERIFICACIÓN DE VÁLVULAS ${n}. MAYO 2026`,
		clienteClave: 'ficticio',
		usuario: 'CLIENTE FICTICIO',
		contratoTexto: 'OC-FICTICIA',
		sitioTexto: 'EM-99999 SITIO FICTICIO',
		numeroPartida: '20',
		actividad: 'Verificación de válvulas',
		tags: 'PSV-2001',
		periodoMes: '2026-05-01',
		ocurrencia: null,
		estado: 'emitido' as const,
		revision: 0,
		actualizadoEn: '2026-05-20T00:00:00Z',
		documento: null,
		...cambios
	};
}

describe('HistorialView', () => {
	it('pagina conservando los filtros y ofrece abrir y descargar', async () => {
		render(HistorialView, {
			seleccion: {
				cliente: 'ficticio',
				contrato: '',
				sitio: '',
				partida: '',
				tag: 'PSV-2001',
				estado: 'emitido',
				desde: '2026-05',
				hasta: ''
			},
			resultado: {
				total: 45,
				pagina: 2,
				tamano: 20,
				filas: [fila(1), fila(2, { estado: 'borrador', documento: null })]
			}
		});
		await expect.element(page.getByText('21 a 40 de 45 reportes')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Siguiente' }))
			.toHaveAttribute(
				'href',
				'/historial?cliente=ficticio&tag=PSV-2001&estado=emitido&desde=2026-05&pagina=3'
			);
		await expect
			.element(page.getByRole('link', { name: 'Anterior' }))
			.toHaveAttribute('href', expect.stringContaining('pagina=1'));
		// Solo el emitido (o con documento) ofrece descarga; el borrador solo se abre.
		const descargas = page.getByRole('link', { name: 'Descargar' }).elements();
		expect(descargas).toHaveLength(1);
		expect(descargas[0].getAttribute('href')).toBe(`/reportes/${ID(1)}/documento`);
		expect(page.getByRole('link', { name: 'Abrir' }).elements()).toHaveLength(2);
	});

	it('ofrece volver aunque la página pedida ya no tenga reportes', async () => {
		render(HistorialView, {
			resultado: { total: 3, pagina: 2, tamano: 20, filas: [] }
		});
		await expect.element(page.getByText('Sin reportes con estos filtros')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Anterior' }))
			.toHaveAttribute('href', '/historial?pagina=1');
	});
});
