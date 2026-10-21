import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HeaderBar from './HeaderBar.svelte';

describe('HeaderBar', () => {
	afterEach(() => vi.restoreAllMocks());

	it('nombra el botón del menú móvil y anuncia si está abierto', async () => {
		const { rerender } = render(HeaderBar, { pageTitle: 'Historial Global', menuAbierto: false });
		const boton = page.getByRole('button', { name: 'Abrir el menú' });
		await expect.element(boton).toHaveAttribute('aria-expanded', 'false');
		await expect.element(boton).toHaveAttribute('aria-controls', 'menu-principal');

		await rerender({ menuAbierto: true });
		await expect
			.element(page.getByRole('button', { name: 'Cerrar el menú' }))
			.toHaveAttribute('aria-expanded', 'true');
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
