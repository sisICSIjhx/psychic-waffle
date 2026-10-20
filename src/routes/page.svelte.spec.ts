import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('muestra el panel de control con sus indicadores', async () => {
		render(Page);

		const heading = page.getByRole('heading', { level: 2, name: 'Indicadores del mes' });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(page.getByText('Realizado del mes')).toBeInTheDocument();
	});
});
