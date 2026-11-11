import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HeaderBar from './HeaderBar.svelte';

describe('HeaderBar', () => {
	afterEach(() => vi.restoreAllMocks());

	it('ofrece «Nuevo reporte» solo a quien puede capturar', async () => {
		const { rerender } = render(HeaderBar);
		const acceso = page.getByRole('link', { name: 'Nuevo reporte' });
		await expect.element(acceso).toHaveAttribute('href', '/captura');
		await rerender({ puedeCapturar: false });
		await expect.element(acceso).not.toBeInTheDocument();
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
