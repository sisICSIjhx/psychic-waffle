import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Notificaciones from './Notificaciones.svelte';
import { notificaciones } from './notificaciones';

describe('Notificaciones', () => {
	it('anuncia el mensaje y «Deshacer» cancela la acción final', async () => {
		render(Notificaciones);
		const alDeshacer = vi.fn();
		const alVencer = vi.fn();
		notificaciones.mostrar({
			mensaje: 'Se quitó el alcance 2.3',
			textoDeshacer: 'Deshacer',
			alDeshacer,
			alVencer
		});

		const region = page.getByRole('status');
		await expect.element(region).toHaveTextContent('Se quitó el alcance 2.3');
		await page.getByRole('button', { name: 'Deshacer' }).click();
		expect(alDeshacer).toHaveBeenCalledTimes(1);
		expect(alVencer).not.toHaveBeenCalled();
		await expect.element(region).toHaveTextContent('');
	});
});
