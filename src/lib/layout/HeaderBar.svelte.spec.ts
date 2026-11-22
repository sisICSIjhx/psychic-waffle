import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HeaderBar from './HeaderBar.svelte';

// La ventana de actividad invalida la página al registrar; fuera de SvelteKit se simula.
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn(async () => undefined) }));

describe('HeaderBar', () => {
	afterEach(() => vi.restoreAllMocks());

	it('«Capturar» despliega «Actividad» y «Reporte» solo a quien puede capturar', async () => {
		const { rerender } = render(HeaderBar);
		const capturar = page.getByLabelText('Capturar');
		const actividad = page.getByRole('button', { name: /^Actividad/ });
		const reporte = page.getByRole('link', { name: /^Reporte/ });
		await expect.poll(() => reporte.elements()).toHaveLength(0);
		await capturar.click();
		await expect.element(actividad).toBeVisible();
		await expect.element(reporte).toHaveAttribute('href', '/captura');
		// Esc cierra el menú y devuelve el foco al botón.
		await userEvent.keyboard('{Escape}');
		await expect.poll(() => reporte.elements()).toHaveLength(0);
		await expect.element(capturar).toHaveFocus();
		// Un clic fuera también lo cierra.
		await capturar.click();
		await expect.element(reporte).toBeVisible();
		document.body.click();
		await expect.poll(() => reporte.elements()).toHaveLength(0);

		await rerender({ puedeCapturar: false });
		await expect.element(capturar).not.toBeInTheDocument();
	});

	it('«Actividad» abre la ventana «Capturar actividad»', async () => {
		vi.spyOn(window, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ hoy: '2026-11-21', centros: [], personal: [] }))
		);
		render(HeaderBar);
		await page.getByLabelText('Capturar').click();
		// Sin los estilos de la página el menú queda fuera del visor: se pulsa la opción directamente.
		(page.getByRole('button', { name: /^Actividad/ }).element() as HTMLElement).click();
		await expect.element(page.getByRole('dialog', { name: 'Capturar actividad' })).toBeVisible();
		await expect
			.poll(() => page.getByRole('link', { name: /^Reporte/ }).elements())
			.toHaveLength(0);
	});

	it('avisa solo cuando el navegador pierde la conexión', async () => {
		const enLinea = vi.spyOn(Navigator.prototype, 'onLine', 'get').mockReturnValue(true);
		render(HeaderBar);
		const estado = page.getByRole('status');
		await expect.element(estado).toHaveTextContent('');
		expect(document.body.textContent).not.toContain('Conectado');

		enLinea.mockReturnValue(false);
		window.dispatchEvent(new Event('offline'));
		await expect.element(estado).toHaveTextContent('Sin conexión');

		enLinea.mockReturnValue(true);
		window.dispatchEvent(new Event('online'));
		await expect.element(estado).toHaveTextContent('');
	});
});
