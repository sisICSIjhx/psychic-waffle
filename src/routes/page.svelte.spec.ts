import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('muestra «Mi trabajo» con el avance del mes y el siguiente trabajo', async () => {
		render(Page, {
			data: {
				hoy: '2026-07-15',
				resumen: { programadas: 12, cumplidas: 3, pendientes: 9, vencidas: 2 },
				programasVigentes: 1,
				trabajo: [],
				ver: null,
				borradores: 3,
				enRevision: 1
			}
		});

		await expect
			.element(
				page.getByRole('heading', { level: 2, name: 'Julio 2026: 3 de 12 partidas realizadas' })
			)
			.toBeInTheDocument();
		await expect.element(page.getByText('25 %')).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { level: 2, name: 'Siguiente trabajo' }))
			.toBeInTheDocument();
	});
});
