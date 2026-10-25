import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Dialogo from './Dialogo.svelte';

/** Botón que «abre» el diálogo, para comprobar a dónde vuelve el foco. */
function botonDeOrigen() {
	const boton = document.body.appendChild(document.createElement('button'));
	boton.textContent = 'Emitir';
	boton.focus();
	return boton;
}

function montar() {
	const confirmar = vi.fn();
	const cancelar = vi.fn();
	const target = document.body.appendChild(document.createElement('div'));
	const montado = render(Dialogo, {
		target,
		props: { id: 'prueba', titulo: '¿Emitir el reporte?', textoConfirmar: 'Emitir' },
		events: { confirmar, cancelar }
	});
	return { ...montado, confirmar, cancelar };
}

describe('Dialogo', () => {
	it('abre con el foco en la opción segura y Esc cancela devolviendo el foco', async () => {
		const origen = botonDeOrigen();
		const { rerender, confirmar, cancelar } = montar();

		await rerender({ abierto: true });
		const dialogo = page.getByRole('dialog', { name: '¿Emitir el reporte?' });
		await expect.element(dialogo).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

		await userEvent.keyboard('{Escape}');
		await expect.element(dialogo).not.toBeInTheDocument();
		expect(cancelar).toHaveBeenCalledTimes(1);
		expect(confirmar).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(origen);
		origen.remove();
	});

	it('confirma solo con el botón de la acción', async () => {
		const origen = botonDeOrigen();
		const { rerender, confirmar } = montar();
		await rerender({ abierto: true });

		await page.getByRole('button', { name: 'Emitir', exact: true }).last().click();
		expect(confirmar).toHaveBeenCalledTimes(1);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		origen.remove();
	});

	it('no confirma mientras la acción está deshabilitada', async () => {
		const origen = botonDeOrigen();
		const { rerender, confirmar } = montar();
		await rerender({ abierto: true, confirmarDeshabilitado: true });
		const boton = page.getByRole('button', { name: 'Emitir', exact: true }).last();
		await expect.element(boton).toBeDisabled();
		(boton.element() as HTMLButtonElement).click();
		expect(confirmar).not.toHaveBeenCalled();
		await expect.element(page.getByRole('dialog')).toBeVisible();
		await rerender({ confirmarDeshabilitado: false });
		await boton.click();
		expect(confirmar).toHaveBeenCalledTimes(1);
		origen.remove();
	});
});
