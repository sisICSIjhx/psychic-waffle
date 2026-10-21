import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SelectorBusqueda from './SelectorBusqueda.svelte';

const GRUPOS = [
	{ clave: 'pendientes', titulo: 'Pendientes' },
	{ clave: 'otras', titulo: 'Otras partidas' }
];
const OPCIONES = [
	{
		valor: 'p3',
		texto: '3.- Rótulos de identificación',
		grupo: 'pendientes',
		insignia: 'Vencida · junio 2026'
	},
	{
		valor: 'p7',
		texto: '7.- TOMA DE POTENCIALES TUBO-SUELO',
		grupo: 'pendientes',
		insignia: 'Pendiente · octubre 2026',
		detalle: 'Mensual'
	},
	{ valor: 'p12', texto: '12.- Verificación de válvulas', grupo: 'otras', detalle: 'Trimestral' }
];

function montar(valor: string | null = null) {
	const elegir = vi.fn();
	const target = document.body.appendChild(document.createElement('div'));
	render(SelectorBusqueda, {
		target,
		props: { id: 'partida', etiqueta: 'Partida', opciones: OPCIONES, grupos: GRUPOS, valor },
		events: { elegir }
	});
	return { elegir, campo: page.getByRole('combobox', { name: 'Partida' }) };
}

describe('SelectorBusqueda', () => {
	it('expone el patrón combobox con grupos y opciones', async () => {
		const { campo } = montar();
		await expect.element(campo).toHaveAttribute('aria-expanded', 'false');
		await campo.click();
		await expect.element(campo).toHaveAttribute('aria-expanded', 'true');
		const lista = page.getByRole('listbox', { name: 'Partida' });
		await expect.element(lista).toBeVisible();
		await expect.element(lista.getByRole('group', { name: 'Pendientes' })).toBeInTheDocument();
		expect(lista.getByRole('option').elements()).toHaveLength(3);
		await expect
			.element(lista.getByRole('option', { name: /3\.- Rótulos.*Vencida · junio 2026/ }))
			.toBeInTheDocument();
	});

	it('filtra sin acentos ni mayúsculas y avisa cuando nada coincide', async () => {
		const { campo } = montar();
		await campo.fill('rotulos');
		expect(page.getByRole('option').elements()).toHaveLength(1);
		await campo.fill('inexistente');
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Ninguna opción coincide con «inexistente».');
		await expect.element(campo).toHaveValue('inexistente');
	});

	it('se maneja con el teclado: flechas, Enter y Esc', async () => {
		const { campo, elegir } = montar();
		await campo.click();
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(campo).toHaveAttribute('aria-activedescendant', 'partida-opcion-p3');
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(campo).toHaveAttribute('aria-activedescendant', 'partida-opcion-p7');
		await expect
			.element(page.getByRole('option', { name: /7\.- TOMA/ }))
			.toHaveAttribute('aria-selected', 'true');
		await userEvent.keyboard('{Enter}');
		expect(elegir).toHaveBeenCalledTimes(1);
		expect(elegir.mock.calls[0][0].detail).toBe('p7');
		await expect.element(campo).toHaveValue('7.- TOMA DE POTENCIALES TUBO-SUELO');
		await expect.element(campo).toHaveAttribute('aria-expanded', 'false');
		await expect.element(campo).toHaveFocus();

		await userEvent.keyboard('{ArrowDown}');
		await expect.element(campo).toHaveAttribute('aria-expanded', 'true');
		await userEvent.keyboard('{Escape}');
		await expect.element(campo).toHaveAttribute('aria-expanded', 'false');
		expect(elegir).toHaveBeenCalledTimes(1);
	});

	it('elige con el ratón y muestra la opción elegida al salir', async () => {
		const { campo, elegir } = montar('p12');
		await expect.element(campo).toHaveValue('12.- Verificación de válvulas');
		await campo.fill('toma');
		await page.getByRole('option', { name: /7\.- TOMA/ }).click();
		expect(elegir.mock.calls[0][0].detail).toBe('p7');
		await expect.element(campo).toHaveValue('7.- TOMA DE POTENCIALES TUBO-SUELO');
	});
});
