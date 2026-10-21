import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { TrabajoPendiente } from '$lib/dominio/planeacion';
import MiTrabajoView from './MiTrabajoView.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOY = '2026-10-21';

function pendiente(
	numero: number,
	mes: string,
	estado: TrabajoPendiente['estado'],
	cambios: Partial<TrabajoPendiente> = {}
): TrabajoPendiente & { sitio: string } {
	return {
		contratoId: ID(2),
		sitioId: ID(3),
		partidaId: ID(numero),
		numero: String(numero),
		actividad: `Actividad ${numero}`,
		periodicidad: 'mensual',
		mes,
		estado,
		faltan: 1,
		borradores: [],
		sitio: 'EM-99999',
		...cambios
	};
}

const base = {
	hoy: HOY,
	resumen: { programadas: 33, cumplidas: 5, pendientes: 28, vencidas: 2 },
	programasVigentes: 1,
	borradores: 4,
	enRevision: 1
};

describe('MiTrabajoView', () => {
	it('muestra el avance del mes en texto y con barra de progreso', async () => {
		render(MiTrabajoView, { ...base, trabajo: [] });
		const titulo = page.getByRole('heading', {
			name: 'Octubre 2026: 5 de 33 partidas realizadas'
		});
		await expect.element(titulo).toBeInTheDocument();
		await expect.element(page.getByRole('progressbar')).toHaveAttribute('value', '5');
		await expect.element(page.getByText('15 %')).toBeInTheDocument();
	});

	it('sin programas vigentes ofrece importarlos desde el catálogo', async () => {
		render(MiTrabajoView, { ...base, programasVigentes: 0, trabajo: [] });
		await expect
			.element(page.getByRole('heading', { name: 'No hay programas anuales vigentes' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Ir al catálogo' }))
			.toHaveAttribute('href', '/catalogo');
	});

	it('las tarjetas llevan a su lista y solo la de vencidos usa el color de peligro', async () => {
		const { container, unmount } = render(MiTrabajoView, { ...base, trabajo: [] });
		await expect
			.element(page.getByRole('link', { name: '4 Borradores abiertos' }))
			.toHaveAttribute('href', '/historial?estado=borrador');
		await expect
			.element(page.getByRole('link', { name: '1 En revisión' }))
			.toHaveAttribute('href', '/historial?estado=en_revision');
		await expect
			.element(page.getByRole('link', { name: '2 Pendientes vencidos' }))
			.toHaveAttribute('href', '/?ver=vencidos#siguiente-trabajo');
		expect([...container.querySelectorAll('.tarjeta.peligro')]).toHaveLength(1);
		unmount();

		const sinVencidos = render(MiTrabajoView, {
			...base,
			resumen: { ...base.resumen, vencidas: 0 },
			trabajo: []
		});
		expect(sinVencidos.container.querySelectorAll('.tarjeta.peligro')).toHaveLength(0);
	});

	it('lista el trabajo por urgencia con «Capturar» o «Continuar borrador»', async () => {
		render(MiTrabajoView, {
			...base,
			trabajo: [
				pendiente(3, '2026-06-01', 'vencido'),
				pendiente(15, '2026-10-01', 'pendiente', {
					periodicidad: 'semanal',
					faltan: 3,
					borradores: [
						{
							id: ID(501),
							titulo: 'Borrador semana 2',
							tags: null,
							ocurrencia: { tipo: 'semana', numero: 2 }
						}
					]
				})
			]
		});
		const elementos = [...document.querySelectorAll('.lista-trabajo > li')].map((li) =>
			(li as HTMLElement).innerText.replace(/\s+/g, ' ')
		);
		expect(elementos[0]).toMatch(/Vencido · junio 2026 Partida 3/);
		expect(elementos[1]).toMatch(/Pendiente · octubre 2026 Partida 15.*faltan 3/);

		await expect
			.element(page.getByRole('link', { name: 'Capturar partida 3 de junio 2026' }))
			.toHaveAttribute(
				'href',
				`/captura?contrato=${ID(2)}&sitio=${ID(3)}&partida=${ID(3)}&mes=2026-06-01`
			);
		await expect
			.element(page.getByRole('link', { name: 'Continuar borrador (Semana 2)' }))
			.toHaveAttribute('href', `/reportes/${ID(501)}`);
		await expect
			.element(page.getByRole('link', { name: 'Capturar partida 15 de octubre 2026' }))
			.toBeInTheDocument();
	});

	it('muestra los diez más urgentes, cuántos faltan y el filtro de vencidos', async () => {
		const trabajo = [
			...Array.from({ length: 3 }, (_, i) => pendiente(i + 1, '2026-06-01', 'vencido')),
			...Array.from({ length: 9 }, (_, i) => pendiente(i + 10, '2026-10-01', 'pendiente'))
		];
		const { unmount } = render(MiTrabajoView, { ...base, trabajo });
		expect(document.querySelectorAll('.lista-trabajo > li')).toHaveLength(10);
		await expect.element(page.getByText('2 pendientes más.')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Ver todos' }))
			.toHaveAttribute('href', '/?ver=todos#siguiente-trabajo');
		unmount();

		render(MiTrabajoView, { ...base, trabajo, ver: 'vencidos' });
		await expect
			.element(page.getByRole('heading', { name: 'Pendientes vencidos' }))
			.toBeInTheDocument();
		expect(document.querySelectorAll('.lista-trabajo > li')).toHaveLength(3);
	});

	it('sin pendientes dice que el trabajo está al día y ofrece capturar', async () => {
		render(MiTrabajoView, { ...base, trabajo: [] });
		await expect.element(page.getByText('El trabajo programado está al día.')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Ir a Capturar' }))
			.toHaveAttribute('href', '/captura');
		await expect
			.element(page.getByRole('link', { name: 'Revisar 4 borradores' }))
			.toBeInTheDocument();
	});
});
