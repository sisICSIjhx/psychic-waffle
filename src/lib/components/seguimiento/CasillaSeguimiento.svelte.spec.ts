import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CasillaSeguimiento from './CasillaSeguimiento.svelte';

function montar(props: Record<string, unknown>) {
	const formulario = document.body.appendChild(document.createElement('form'));
	render(CasillaSeguimiento, {
		target: formulario,
		props: { etiqueta: 'ODT', contexto: 'Partida de ejemplo, ejecución 1', ...props } as never
	});
	return formulario;
}

describe('CasillaSeguimiento', () => {
	it('muestra su nombre, mide 44 px y envía el estado contrario', async () => {
		montar({ marcada: false, puedeEditar: true });
		const casilla = page.getByRole('checkbox', { name: 'ODT · Partida de ejemplo, ejecución 1' });
		await expect.element(casilla).toHaveAttribute('aria-checked', 'false');
		await expect.element(casilla).toHaveTextContent('ODT');
		const boton = casilla.element() as HTMLButtonElement;
		expect(boton.type).toBe('submit');
		expect([boton.name, boton.value]).toEqual(['valor', 'true']);
		expect(boton.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
	});

	it('en el formulario de una ejecución envía el campo y el valor que se le indican', async () => {
		montar({
			marcada: true,
			puedeEditar: true,
			porDefinir: true,
			nombreCampo: 'marca',
			valorCampo: 'concepto-1:false'
		});
		const casilla = page.getByRole('checkbox', { name: /ODT · Partida de ejemplo.*por definir/ });
		await expect.element(casilla).toHaveAttribute('aria-checked', 'true');
		const boton = casilla.element() as HTMLButtonElement;
		expect([boton.name, boton.value]).toEqual(['marca', 'concepto-1:false']);
		await expect.element(page.getByText('Por definir')).toBeInTheDocument();
	});

	it('en solo consulta es texto con icono, sin control', async () => {
		const formulario = montar({ marcada: true, puedeEditar: false });
		expect(formulario.querySelector('button')).toBeNull();
		expect(formulario.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'✓ ODT · Partida de ejemplo, ejecución 1 · Hecho'
		);
	});
});
