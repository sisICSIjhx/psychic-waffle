import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { RolPersonal } from '$lib/dominio/constantes';
import { permisosDe } from '$lib/dominio/permisos';
import Sidebar from './Sidebar.svelte';

// Evita que los clics de prueba naveguen fuera del documento de pruebas.
const cancelarNavegacion = (evento: MouseEvent) => evento.preventDefault();

describe('Sidebar', () => {
	beforeEach(() => document.addEventListener('click', cancelarNavegacion));
	afterEach(() => document.removeEventListener('click', cancelarNavegacion));

	it('conserva los enlaces y sus nombres accesibles al mostrar solo los iconos', async () => {
		const { container } = render(Sidebar, { activeView: 'personal', colapsado: true });
		for (const nombre of [
			'Mi trabajo',
			'Programa',
			'Seguimiento',
			'Cumplimiento',
			'Historial',
			'Catálogo',
			'Equipos',
			'Personal'
		]) {
			await expect.element(page.getByRole('link', { name: nombre, exact: true })).toBeVisible();
		}
		await expect
			.element(page.getByRole('link', { name: 'Personal', exact: true }))
			.toHaveAttribute('aria-current', 'page');
		expect(container.querySelectorAll('.nav-item')).toHaveLength(8);
		expect(container.querySelector('.sidebar')?.classList.contains('colapsado')).toBe(true);
	});

	it('enlaza cada destino con su ruta', async () => {
		render(Sidebar, { activeView: 'dashboard' });

		const esperados: [string, string][] = [
			['Mi trabajo', '/'],
			['Programa', '/planeacion'],
			['Seguimiento', '/seguimiento'],
			['Cumplimiento', '/cumplimiento'],
			['Historial', '/historial'],
			['Catálogo', '/catalogo'],
			['Equipos', '/equipos'],
			['Personal', '/personal']
		];
		for (const [nombre, ruta] of esperados) {
			await expect
				.element(page.getByRole('link', { name: nombre, exact: true }))
				.toHaveAttribute('href', ruta);
		}
		expect(page.getByRole('link', { name: 'Prosasa' }).elements()).toHaveLength(0);
		// Sin sesión no hay perfil que ofrecer.
		expect(page.getByRole('link', { name: 'Mi perfil' }).elements()).toHaveLength(0);
		await expect
			.element(page.getByRole('link', { name: 'ICSI Reportes' }))
			.toHaveAttribute('href', '/');
	});

	it('no ofrece accesos de captura ni resalta otro destino al capturar', () => {
		const { container } = render(Sidebar, { activeView: 'captura' });
		expect(container.querySelector('a[href^="/captura"]')).toBeNull();
		expect(container.querySelector('[aria-current="page"]')).toBeNull();
	});

	it('anuncia la vista activa con aria-current', async () => {
		render(Sidebar, { activeView: 'historial' });
		await expect
			.element(page.getByRole('link', { name: 'Historial' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Mi trabajo' }))
			.not.toHaveAttribute('aria-current');
	});

	it('avisa al layout al navegar entre vistas', async () => {
		const navigate = vi.fn();
		// Con «events» las opciones de montaje requieren un destino explícito.
		const target = document.body.appendChild(document.createElement('div'));
		render(Sidebar, { target, props: { activeView: 'dashboard' }, events: { navigate } });

		await page.getByRole('link', { name: 'Historial' }).click();
		await page.getByRole('link', { name: 'Catálogo' }).click();

		expect(navigate).toHaveBeenCalledTimes(2);
		expect(navigate.mock.calls[0][0].detail).toEqual({ view: 'historial' });
		expect(navigate.mock.calls[1][0].detail).toEqual({ view: 'catalogo' });
	});

	it('sin inicio de sesión activado ofrece activarlo y no muestra cuenta', async () => {
		render(Sidebar, { activeView: 'dashboard' });
		await expect
			.element(page.getByRole('link', { name: 'Activar inicio de sesión' }))
			.toHaveAttribute('href', '/acceso/configurar');
		expect(page.getByRole('button', { name: 'Cerrar sesión' }).elements()).toHaveLength(0);
	});

	it('con sesión muestra a la persona, su perfil y el cierre, y solo lo que su rol usa', async () => {
		const sesion = (rol: RolPersonal) => ({
			activada: true,
			usuario: {
				nombre: 'Persona Ficticia',
				correo: 'persona@ficticio.test',
				rol,
				debeCambiar: false
			},
			permisos: permisosDe({ activada: true, rol })
		});
		const { rerender } = render(Sidebar, {
			activeView: 'perfil',
			sesion: sesion('mesa_directiva')
		});

		await expect.element(page.getByText('Persona Ficticia')).toBeInTheDocument();
		await expect.element(page.getByText('Mesa directiva')).toBeInTheDocument();
		const perfil = page.getByRole('link', { name: 'Mi perfil' });
		await expect.element(perfil).toHaveAttribute('href', '/perfil');
		await expect.element(perfil).toHaveAttribute('aria-current', 'page');
		const formulario = page
			.getByRole('button', { name: 'Cerrar sesión' })
			.element()
			.closest('form');
		expect(formulario?.getAttribute('action')).toBe('/acceso?/salir');
		expect(formulario?.getAttribute('method')?.toUpperCase()).toBe('POST');
		expect(page.getByRole('link', { name: 'Activar inicio de sesión' }).elements()).toHaveLength(0);

		// Mesa directiva puede consultar el personal.
		await expect.element(page.getByRole('link', { name: 'Personal' })).toBeInTheDocument();

		// El reporteador no puede consultar el personal.
		await rerender({ sesion: sesion('reporteador') });
		expect(page.getByRole('link', { name: 'Personal' }).elements()).toHaveLength(0);
	});

	it('aplica la clase de menú móvil abierto', async () => {
		const { container } = render(Sidebar, { isMobileOpen: true });
		expect(container.querySelector('aside')?.classList.contains('mobile-open')).toBe(true);
	});
});
