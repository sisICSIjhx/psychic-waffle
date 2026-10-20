import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('muestra el panel de control con los indicadores del mes', async () => {
		render(Page, {
			data: {
				hoy: '2026-07-15',
				resumen: { programadas: 12, cumplidas: 7, pendientes: 5, vencidas: 2 },
				programasVigentes: 1,
				vencidos: [
					{
						partidaId: '00000000-0000-4000-8000-000000000001',
						numero: '7',
						actividad: 'Toma de potenciales',
						mes: '2026-06-01',
						faltan: 1,
						contratoId: '00000000-0000-4000-8000-000000000002',
						sitioId: '00000000-0000-4000-8000-000000000003',
						sitio: 'EM-99999'
					}
				],
				totalVencidos: 2,
				borradores: 3,
				enRevision: 1,
				recientes: []
			}
		});

		const heading = page.getByRole('heading', { level: 2, name: 'Indicadores del mes' });
		await expect.element(heading).toBeInTheDocument();
		await expect
			.element(page.getByText('JULIO 2026 · 1 programa(s) anual(es) vigente(s).'))
			.toBeInTheDocument();
		await expect.element(page.getByText('Realizado del mes')).toBeInTheDocument();
		const valores = [...document.querySelectorAll('.kpi-card')].map((tarjeta) =>
			(tarjeta as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
		);
		expect(valores).toEqual([
			'12 Partidas programadas del mes',
			'7 Realizado del mes',
			'5 Pendientes del mes',
			'2 Pendientes vencidos',
			'3 Borradores abiertos (+1 en revisión)'
		]);
		await expect
			.element(page.getByRole('link', { name: 'Ver en la planeación' }))
			.toHaveAttribute(
				'href',
				'/planeacion?contrato=00000000-0000-4000-8000-000000000002&sitio=00000000-0000-4000-8000-000000000003'
			);
	});
});
