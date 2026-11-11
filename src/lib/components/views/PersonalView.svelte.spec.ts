import { expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { Personal } from '$lib/dominio/esquemas';
import PersonalView from './PersonalView.svelte';

const centro = { id: 'centro-prueba', clave: 'EM-90001', nombre: 'Centro de prueba' };
const persona: Personal = {
	id: 'persona-1',
	nombre: 'Ángela',
	apellidoPaterno: 'Gómez',
	apellidoMaterno: null,
	fechaNacimiento: null,
	correo: 'consulta@example.test',
	sede: 'Norte',
	rol: 'reporteador',
	activo: true,
	actualizadoEn: '2026-11-10T12:00:00Z',
	centrosCosto: [centro],
	acceso: null
};
const otra: Personal = {
	...persona,
	id: 'persona-2',
	nombre: 'Lucía',
	correo: 'administracion@example.test',
	sede: 'Sur',
	rol: 'administrador',
	centrosCosto: [],
	acceso: { debeCambiar: true, bloqueadaHasta: null, ultimoAccesoEn: null }
};
const inactiva: Personal = {
	...persona,
	id: 'persona-3',
	nombre: 'Sara',
	correo: null,
	activo: false
};

it('busca por nombre y correo y permite combinar, cerrar y restablecer filtros', async () => {
	render(PersonalView, { personal: [persona, otra, inactiva] });
	const buscar = page.getByRole('searchbox', { name: 'Buscar por nombre o correo' });
	const filtros = page.getByRole('button', { name: /Filtros avanzados/ });
	await expect.element(filtros).toHaveAttribute('aria-expanded', 'false');
	await expect.element(page.getByText('2 personas activas')).toBeVisible();
	await buscar.fill('GOMEZ angela');
	await expect.element(page.getByRole('cell', { name: 'Ángela Gómez' })).toBeVisible();
	await expect.element(page.getByRole('cell', { name: 'Lucía Gómez' })).not.toBeInTheDocument();
	await buscar.fill('administracion@example');
	await expect.element(page.getByRole('cell', { name: 'Lucía Gómez' })).toBeVisible();

	await filtros.click();
	await page.getByRole('combobox', { name: 'Rol' }).selectOptions('reporteador');
	await expect.element(page.getByText('Ninguna persona coincide', { exact: false })).toBeVisible();
	await buscar.fill('');
	await page.getByRole('combobox', { name: 'Sede' }).selectOptions('Norte');
	await page.getByRole('combobox', { name: 'Centro de costo asignado' }).selectOptions(centro.id);
	await page.getByRole('combobox', { name: 'Acceso' }).selectOptions('Sin cuenta');
	await page.getByRole('combobox', { name: 'Estado' }).selectOptions('inactivo');
	await expect.element(page.getByRole('cell', { name: 'Sara Gómez' })).toBeVisible();
	await expect.element(filtros).toHaveTextContent('5');

	await filtros.click();
	await expect.element(filtros).toHaveAttribute('aria-expanded', 'false');
	await expect.element(page.getByRole('cell', { name: 'Sara Gómez' })).toBeVisible();
	await filtros.click();
	await page.getByRole('button', { name: 'Restablecer filtros' }).click();
	await expect.element(page.getByText('2 personas activas')).toBeVisible();
	await expect.element(filtros).toHaveAccessibleName('Filtros avanzados');
});
