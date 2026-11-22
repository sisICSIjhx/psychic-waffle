import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SelectorPersonas from './SelectorPersonas.svelte';

// Personas ficticias: más de seis para que aparezca la búsqueda.
const PERSONAS = [
	'Persona Uno',
	'Persona Dos',
	'Persona Tres',
	'Técnico Álvarez',
	'Técnica Benítez',
	'Operador Cruz',
	'Operadora Díaz'
].map((nombre, i) => ({ id: `id-${i + 1}`, nombre }));

function montar(elegidas: string[] = []) {
	const formulario = document.body.appendChild(document.createElement('form'));
	render(SelectorPersonas, {
		target: formulario,
		props: {
			id: 'asistentes',
			leyenda: 'Quién asistió (opcional)',
			nombre: 'asistentes',
			personas: PERSONAS,
			elegidas
		}
	});
	return formulario;
}

const visibles = (formulario: HTMLElement) =>
	[...formulario.querySelectorAll('li')]
		.filter((li) => !li.hidden)
		.map((li) => li.textContent?.trim());

describe('SelectorPersonas', () => {
	it('es un grupo de casillas con nombre que el formulario envía por persona', async () => {
		const formulario = montar(['id-2']);
		await expect
			.element(page.getByRole('group', { name: 'Quién asistió (opcional)' }))
			.toBeInTheDocument();
		await page.getByRole('checkbox', { name: 'Persona Tres' }).click();
		expect(new FormData(formulario).getAll('asistentes')).toEqual(['id-2', 'id-3']);
		await expect.element(page.getByRole('status')).toHaveTextContent('2 personas elegidas');
	});

	it('busca sin acentos y nunca oculta a quien ya está elegido', async () => {
		const formulario = montar();
		await page.getByRole('checkbox', { name: 'Persona Uno' }).click();
		await page.getByRole('searchbox', { name: 'Buscar persona' }).fill('alvarez');
		await expect.poll(() => visibles(formulario)).toEqual(['Persona Uno', 'Técnico Álvarez']);

		await page.getByRole('searchbox', { name: 'Buscar persona' }).fill('zzz');
		await expect.poll(() => visibles(formulario)).toEqual(['Persona Uno']);
		await expect.element(page.getByText('Nadie coincide con «zzz».')).toBeInTheDocument();
		await expect.element(page.getByRole('status')).toHaveTextContent('1 persona elegida');
	});
});
