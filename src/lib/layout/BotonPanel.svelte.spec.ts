import { page } from 'vitest/browser';
import { expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BotonPanel from './BotonPanel.svelte';

it('distingue el panel abierto con tres puntos y anuncia el estado del control', async () => {
	const { container, rerender } = render(BotonPanel, { abierto: false });
	const boton = page.getByRole('button', { name: 'Expandir panel lateral' });
	await expect.element(boton).toHaveAttribute('aria-expanded', 'false');
	await expect.element(boton).toHaveAttribute('aria-controls', 'menu-principal');
	expect(container.querySelectorAll('circle')).toHaveLength(0);

	await rerender({ abierto: true });
	await expect
		.element(page.getByRole('button', { name: 'Colapsar panel lateral' }))
		.toHaveAttribute('aria-expanded', 'true');
	expect(container.querySelectorAll('circle')).toHaveLength(3);
});
