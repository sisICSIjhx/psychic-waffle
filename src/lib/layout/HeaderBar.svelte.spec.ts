import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HeaderBar from './HeaderBar.svelte';

describe('HeaderBar', () => {
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
});
