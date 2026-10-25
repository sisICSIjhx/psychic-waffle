import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BotonesSegmentados from './BotonesSegmentados.svelte';

const OPCIONES = [
	{ valor: 'ok', texto: 'OK' },
	{ valor: 'no_aplica', texto: 'No aplica' },
	{ valor: 'con_observacion', texto: 'Con observación' }
];

function montar(valor = 'pendiente') {
	const change = vi.fn();
	const target = document.body.appendChild(document.createElement('div'));
	const montado = render(BotonesSegmentados, {
		target,
		props: { id: 'estado-1', etiqueta: 'Verificación del alcance 2.1', opciones: OPCIONES, valor },
		events: { change }
	});
	return { ...montado, change };
}

const tabulables = () =>
	[...document.querySelectorAll('[role=radio]')].filter((b) => b.getAttribute('tabindex') === '0');

describe('BotonesSegmentados', () => {
	it('elige con un clic y deja solo la opción elegida en la tabulación', async () => {
		const { change } = montar();
		const grupo = page.getByRole('radiogroup', { name: 'Verificación del alcance 2.1' });
		await expect.element(grupo).toBeInTheDocument();
		// Sin elección, la primera opción recibe el foco con Tab.
		expect(tabulables().map((b) => b.textContent?.trim())).toEqual(['OK']);

		await page.getByRole('radio', { name: 'Con observación' }).click();
		expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ detail: 'con_observacion' }));
		await expect
			.element(page.getByRole('radio', { name: 'Con observación' }))
			.toHaveAttribute('aria-checked', 'true');
		expect(tabulables().map((b) => b.textContent?.trim())).toEqual(['✓ Con observación']);
	});

	it('las flechas mueven la elección y el foco, con vuelta al inicio', async () => {
		const { change } = montar('ok');
		(document.querySelector('[role=radio]') as HTMLButtonElement).focus();

		await userEvent.keyboard('{ArrowRight}');
		await expect.element(page.getByRole('radio', { name: 'No aplica' })).toHaveFocus();
		await expect
			.element(page.getByRole('radio', { name: 'No aplica' }))
			.toHaveAttribute('aria-checked', 'true');

		await userEvent.keyboard('{ArrowRight}{ArrowRight}');
		await expect.element(page.getByRole('radio', { name: 'OK' })).toHaveFocus();
		expect(change.mock.calls.map(([e]) => e.detail)).toEqual([
			'no_aplica',
			'con_observacion',
			'ok'
		]);
	});
});
