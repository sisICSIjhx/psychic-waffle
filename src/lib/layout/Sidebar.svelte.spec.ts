import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Sidebar from './Sidebar.svelte';

// Evita que los clics de prueba naveguen fuera del documento de pruebas.
const cancelarNavegacion = (evento: MouseEvent) => evento.preventDefault();

describe('Sidebar', () => {
	beforeEach(() => document.addEventListener('click', cancelarNavegacion));
	afterEach(() => document.removeEventListener('click', cancelarNavegacion));

	it('enlaza cada vista con su ruta y la captura por cliente', async () => {
		render(Sidebar, { activeView: 'dashboard' });

		const esperados: [string, string][] = [
			['Panel de Control', '/'],
			['Anual', '/planeacion'],
			['Cerritos', '/captura?cliente=cerritos'],
			['Proagro', '/captura?cliente=proagro'],
			['Virtual', '/captura?cliente=virtual'],
			['Historial Global', '/historial'],
			['Catálogo', '/catalogo']
		];
		for (const [nombre, ruta] of esperados) {
			await expect
				.element(page.getByRole('link', { name: nombre, exact: true }))
				.toHaveAttribute('href', ruta);
		}
		expect(page.getByRole('link', { name: 'Prosasa' }).elements()).toHaveLength(0);
		// Sin pantallas vacías: Personal y Mi Perfil vuelven con la autenticación.
		expect(page.getByRole('link', { name: 'Personal' }).elements()).toHaveLength(0);
		expect(page.getByRole('link', { name: 'Mi Perfil' }).elements()).toHaveLength(0);
		await expect.element(page.getByText('ICSI Reportes')).toBeInTheDocument();
	});

	it('marca como activo solo el acceso del cliente elegido', async () => {
		render(Sidebar, { activeView: 'captura', activeCliente: 'proagro' });

		await expect.element(page.getByRole('link', { name: 'Proagro' })).toHaveClass(/active/);
		await expect.element(page.getByRole('link', { name: 'Cerritos' })).not.toHaveClass(/active/);
		await expect.element(page.getByRole('link', { name: 'Anual' })).not.toHaveClass(/active/);
		// La página activa se anuncia también a los lectores de pantalla.
		await expect
			.element(page.getByRole('link', { name: 'Proagro' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Cerritos' }))
			.not.toHaveAttribute('aria-current');
	});

	it('anuncia la vista activa con aria-current', async () => {
		render(Sidebar, { activeView: 'historial' });
		await expect
			.element(page.getByRole('link', { name: 'Historial Global' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Panel de Control' }))
			.not.toHaveAttribute('aria-current');
	});

	it('avisa al layout al navegar entre vistas', async () => {
		const navigate = vi.fn();
		// Con «events» las opciones de montaje requieren un destino explícito.
		const target = document.body.appendChild(document.createElement('div'));
		render(Sidebar, { target, props: { activeView: 'dashboard' }, events: { navigate } });

		await page.getByRole('link', { name: 'Historial Global' }).click();
		await page.getByRole('link', { name: 'Virtual' }).click();

		expect(navigate).toHaveBeenCalledTimes(2);
		expect(navigate.mock.calls[0][0].detail).toEqual({ view: 'historial', cliente: undefined });
		expect(navigate.mock.calls[1][0].detail).toEqual({ view: 'captura', cliente: 'virtual' });
	});

	it('aplica la clase de menú móvil abierto', async () => {
		const { container } = render(Sidebar, { isMobileOpen: true });
		expect(container.querySelector('aside')?.classList.contains('mobile-open')).toBe(true);
	});
});
