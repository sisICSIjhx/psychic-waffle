import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Foto } from '$lib/dominio/esquemas';
import FotosAlcance from './FotosAlcance.svelte';

const ALCANCE = '00000000-0000-4000-8000-000000000100';

const idFoto = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function foto(n: number, descripcion: string, momento: Foto['momento'] = null): Foto {
	return {
		id: idFoto(n),
		alcanceId: ALCANCE,
		orden: n,
		descripcion,
		momento,
		rutaOriginal: '',
		rutaOptimizada: '',
		ancho: 640,
		alto: 480,
		bytes: 1000,
		tipoMime: 'image/jpeg',
		rotacion: 0
	};
}

const destino = () => document.body.appendChild(document.createElement('div'));

const varias = (cantidad: number) =>
	Array.from({ length: cantidad }, (_, i) => foto(i + 1, `Foto ${i + 1}`));

/** Descripción y pie de cada foto, en el orden en que se muestran. */
function fotosMostradas(contenedor: HTMLElement) {
	return [...contenedor.querySelectorAll('.foto')].map((elemento) => ({
		pie: elemento.querySelector('.pie')?.textContent?.trim(),
		descripcion: (elemento.querySelector('.descripcion') as HTMLInputElement).value
	}));
}

const descripciones = (contenedor: HTMLElement) =>
	fotosMostradas(contenedor).map((f) => f.descripcion);

const tarjeta = (contenedor: HTMLElement, n: number) =>
	contenedor.querySelector(`[data-foto="${idFoto(n)}"]`) as HTMLElement;

/** Arrastra la miniatura de una foto y la suelta en `destino` (a la izquierda o la derecha). */
function arrastrarFoto(
	contenedor: HTMLElement,
	n: number,
	destino: HTMLElement,
	lado: 'antes' | 'despues' = 'antes'
) {
	const datos = new DataTransfer();
	const origen = tarjeta(contenedor, n).querySelector('.miniatura') as HTMLElement;
	origen.dispatchEvent(new DragEvent('dragstart', { dataTransfer: datos, bubbles: true }));
	const caja = destino.getBoundingClientRect();
	const punto = {
		clientX: lado === 'antes' ? caja.left + 2 : caja.right - 2,
		clientY: lado === 'antes' ? caja.top + 2 : caja.bottom - 2
	};
	for (const tipo of ['dragenter', 'dragover', 'drop'] as const) {
		destino.dispatchEvent(
			new DragEvent(tipo, { dataTransfer: datos, bubbles: true, cancelable: true, ...punto })
		);
	}
	origen.dispatchEvent(new DragEvent('dragend', { dataTransfer: datos, bubbles: true }));
}

describe('FotosAlcance', () => {
	it('ofrece los espacios ANTES, DURANTE y DESPUÉS y numera en ese orden', async () => {
		const { container } = render(FotosAlcance, {
			fotos: [foto(1, 'Después', 'despues'), foto(2, 'Antes', 'antes'), foto(3, 'Durante', null)],
			posicionAlcance: 1,
			disposicion: 'antes_durante_despues'
		});
		const espacios = [...container.querySelectorAll('.etiqueta-espacio')].map((e) =>
			e.textContent?.trim()
		);
		expect(espacios).toEqual(['ANTES', 'DURANTE', 'DESPUÉS']);
		expect(fotosMostradas(container)).toEqual([
			{ pie: 'Ilustración 2.1.1', descripcion: 'Antes' },
			{ pie: 'Ilustración 2.1.2', descripcion: 'Durante' },
			{ pie: 'Ilustración 2.1.3', descripcion: 'Después' }
		]);
		await expect.element(page.getByText('Agregar fotos (DESPUÉS)')).toBeInTheDocument();
	});

	it('nombra las acciones con el pie, en orden de tabulación, y muestra la barra con el foco', async () => {
		const { container } = render(FotosAlcance, {
			fotos: [foto(1, 'Uno'), foto(2, 'Dos')],
			posicionAlcance: 3
		});
		const nombres = [...tarjeta(container, 2).querySelectorAll('button')]
			.filter((b) => b.tabIndex >= 0)
			.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());
		expect(nombres).toEqual([
			'Ampliar la Ilustración 2.3.2',
			'Girar a la derecha la Ilustración 2.3.2',
			'Reemplazar la Ilustración 2.3.2',
			'Quitar la Ilustración 2.3.2',
			'Más acciones de la Ilustración 2.3.2',
			'Reordenar la Ilustración 2.3.2'
		]);
		// La miniatura amplía con el puntero, pero no repite la parada de tabulación de la barra.
		expect((tarjeta(container, 2).querySelector('.miniatura') as HTMLElement).tabIndex).toBe(-1);
		expect(tarjeta(container, 2).querySelector('img')).toBeNull();

		const barra = tarjeta(container, 2).querySelector('.barra') as HTMLElement;
		expect(getComputedStyle(barra).opacity).toBe('0');
		(barra.querySelector('button') as HTMLElement).focus();
		await vi.waitFor(() => expect(getComputedStyle(barra).opacity).toBe('1'));
	});

	it('en solo lectura solo permite ampliar', async () => {
		const { container } = render(FotosAlcance, {
			fotos: [foto(1, 'Uno')],
			soloLectura: true
		});
		const botones = [...container.querySelectorAll('button')];
		expect(botones.map((b) => b.getAttribute('aria-label'))).toEqual([
			'Ampliar la Ilustración 2.1.1'
		]);
		expect(botones[0].tabIndex).toBe(0);
		expect(container.querySelector('input[type=file]')).toBeNull();
		expect((container.querySelector('.descripcion') as HTMLInputElement).disabled).toBe(true);
	});

	it('no ensancha un contenedor angosto con títulos de alcance largos', async () => {
		const target = document.body.appendChild(document.createElement('div'));
		target.style.width = '280px';
		render(FotosAlcance, {
			target,
			props: {
				fotos: [foto(1, 'Uno'), foto(2, 'Dos')],
				otrosAlcances: [
					{ id: 'otro', etiqueta: `2.1 ${'Inspección visual del derecho de vía '.repeat(4)}` }
				]
			}
		});
		// Sin los estilos globales el campo de archivo no se oculta; se mide la lista de fotos.
		const lista = target.querySelector('.lista-fotos') as HTMLElement;
		expect(lista.scrollWidth).toBeLessThanOrEqual(280);
		for (const elemento of target.querySelectorAll('.foto')) {
			expect(elemento.getBoundingClientRect().width).toBeLessThanOrEqual(280);
		}
	});

	it('acepta fotos soltadas sobre el grupo, conserva el botón y no numera las ocultas', async () => {
		const cargar = vi.fn();
		const quitar = vi.fn();
		const { container } = render(FotosAlcance, {
			target: destino(),
			props: {
				fotos: [foto(1, 'Uno'), foto(2, 'Dos'), foto(3, 'Tres')],
				posicionAlcance: 1,
				ocultas: { [idFoto(1)]: 1 }
			},
			events: { cargar, quitar }
		});
		expect(fotosMostradas(container)).toEqual([
			{ pie: 'Ilustración 2.1.1', descripcion: 'Dos' },
			{ pie: 'Ilustración 2.1.2', descripcion: 'Tres' }
		]);

		const datos = new DataTransfer();
		for (const nombre of ['a.jpg', 'b.pdf']) datos.items.add(new File(['x'], nombre));
		// Soltar archivos sobre una tarjeta los carga una sola vez, en su grupo.
		tarjeta(container, 2).dispatchEvent(
			new DragEvent('drop', { dataTransfer: datos, bubbles: true, cancelable: true })
		);
		expect(cargar).toHaveBeenCalledTimes(1);
		expect(cargar.mock.calls[0][0].detail.archivos.map((a: File) => a.name)).toEqual([
			'a.jpg',
			'b.pdf'
		]);
		await expect.element(page.getByText('Agregar fotos')).toBeInTheDocument();

		await page.getByRole('button', { name: 'Quitar la Ilustración 2.1.2' }).click();
		expect(quitar.mock.calls[0][0].detail).toEqual({ fotoId: idFoto(3), pie: 'Ilustración 2.1.2' });
	});

	describe('giro', () => {
		const giro = (contenedor: HTMLElement, n: number) =>
			(tarjeta(contenedor, n).querySelector('.giro') as HTMLElement).style.transform;

		it('dos clics dejan la foto a 180° y una apaisada a 90° se reduce a 0,75', async () => {
			const { container } = render(FotosAlcance, { fotos: [foto(1, 'Uno'), foto(2, 'Dos')] });
			const boton = page.getByRole('button', { name: 'Girar a la derecha la Ilustración 2.1.1' });
			await boton.click();
			expect(giro(container, 1)).toBe('rotate(90deg) scale(0.75)');
			await expect
				.poll(() => container.querySelector('[aria-live]')?.textContent)
				.toBe('Ilustración 2.1.1 girada a 90°');
			await boton.click();
			expect(giro(container, 1)).toBe('rotate(180deg) scale(1)');
			expect(giro(container, 2)).toBe('rotate(0deg) scale(1)');
		});

		it('en solo lectura se ve girada, sin el botón', async () => {
			const { container } = render(FotosAlcance, {
				fotos: [{ ...foto(1, 'Uno'), rotacion: 270 }],
				soloLectura: true
			});
			expect(giro(container, 1)).toBe('rotate(270deg) scale(0.75)');
			expect(container.querySelector('[aria-label^="Girar"]')).toBeNull();
		});
	});

	describe('Más acciones', () => {
		it('mueve antes y renumera; en la primera foto del grupo no hay «Mover antes»', async () => {
			const { container } = render(FotosAlcance, {
				fotos: [foto(1, 'Uno'), foto(2, 'Dos'), foto(3, 'Tres')],
				posicionAlcance: 2
			});
			await page.getByRole('button', { name: 'Más acciones de la Ilustración 2.2.1' }).click();
			await expect.element(page.getByRole('button', { name: 'Mover antes' })).toBeDisabled();
			await userEvent.keyboard('{Escape}');

			await page.getByRole('button', { name: 'Más acciones de la Ilustración 2.2.3' }).click();
			await page.getByRole('button', { name: 'Mover antes' }).click();
			expect(fotosMostradas(container)).toEqual([
				{ pie: 'Ilustración 2.2.1', descripcion: 'Uno' },
				{ pie: 'Ilustración 2.2.2', descripcion: 'Tres' },
				{ pie: 'Ilustración 2.2.3', descripcion: 'Dos' }
			]);
			// El menú se cierra y el foco vuelve a «Más acciones» de la foto movida.
			await expect
				.element(page.getByRole('button', { name: 'Más acciones de la Ilustración 2.2.2' }))
				.toHaveFocus();
		});

		it('cambia el espacio, mueve a otro alcance y cierra con Esc devolviendo el foco', async () => {
			const mover = vi.fn();
			const { container } = render(FotosAlcance, {
				target: destino(),
				props: {
					fotos: [foto(1, 'Antes', 'antes'), foto(2, 'Durante', 'durante')],
					disposicion: 'antes_durante_despues',
					otrosAlcances: [{ id: 'otro', etiqueta: '2.2 Limpieza' }]
				},
				events: { mover }
			});
			const mas = page.getByRole('button', { name: 'Más acciones de la Ilustración 2.1.1' });
			await mas.click();
			await expect
				.element(page.getByRole('button', { name: 'ANTES', exact: true }))
				.toHaveAttribute('aria-pressed', 'true');
			await page.getByRole('button', { name: 'DESPUÉS', exact: true }).click();
			expect(fotosMostradas(container)).toEqual([
				{ pie: 'Ilustración 2.1.1', descripcion: 'Durante' },
				{ pie: 'Ilustración 2.1.2', descripcion: 'Antes' }
			]);
			expect(
				container.querySelectorAll('.grupo-fotos')[2].querySelector('.descripcion')
			).toHaveProperty('value', 'Antes');

			const otraMas = page.getByRole('button', { name: 'Más acciones de la Ilustración 2.1.2' });
			await otraMas.click();
			await expect.element(otraMas).toHaveAttribute('aria-expanded', 'true');
			await userEvent.keyboard('{Escape}');
			await expect.element(otraMas).toHaveAttribute('aria-expanded', 'false');
			await expect.element(otraMas).toHaveFocus();

			await otraMas.click();
			await page.getByRole('button', { name: 'Mover a otro alcance…' }).click();
			await page.getByRole('button', { name: '2.2 Limpieza' }).click();
			expect(mover.mock.calls[0][0].detail).toEqual({ fotoId: idFoto(1), alcanceId: 'otro' });
		});
	});

	describe('arrastre para reordenar', () => {
		it('reordena y renumera al soltar sobre otra foto, sin cargar archivos', async () => {
			const cargar = vi.fn();
			const { container } = render(FotosAlcance, {
				target: destino(),
				props: { fotos: [foto(1, 'Uno'), foto(2, 'Dos'), foto(3, 'Tres')], posicionAlcance: 1 },
				events: { cargar }
			});
			arrastrarFoto(container, 3, tarjeta(container, 1), 'antes');
			await vi.waitFor(() => expect(descripciones(container)).toEqual(['Tres', 'Uno', 'Dos']));
			expect(fotosMostradas(container)[0].pie).toBe('Ilustración 2.1.1');
			expect(cargar).not.toHaveBeenCalled();
			await vi.waitFor(() =>
				expect(container.querySelector('[aria-live]')?.textContent).toBe(
					'Ilustración 2.1.1, posición 1 de 3'
				)
			);
		});

		it('soltar en otra columna cambia el espacio y en el espacio libre la deja al final', async () => {
			const { container } = render(FotosAlcance, {
				fotos: [foto(1, 'A1', 'antes'), foto(2, 'A2', 'antes'), foto(3, 'D1', 'despues')],
				disposicion: 'antes_durante_despues'
			});
			const grupos = container.querySelectorAll<HTMLElement>('.grupo-fotos');
			arrastrarFoto(container, 1, tarjeta(container, 3), 'despues');
			await vi.waitFor(() => expect(grupos[2].querySelectorAll('.descripcion')).toHaveLength(2));
			expect(descripciones(container)).toEqual(['A2', 'D1', 'A1']);

			// En el espacio libre del grupo DURANTE (sin fotos) queda al final de ese grupo.
			arrastrarFoto(container, 2, grupos[1]);
			await vi.waitFor(() =>
				expect(grupos[1].querySelector('.descripcion')).toHaveProperty('value', 'A2')
			);
			expect(grupos[0].querySelectorAll('.foto')).toHaveLength(0);
		});

		it('otro alcance no acepta la foto arrastrada', async () => {
			const primero = render(FotosAlcance, {
				fotos: [foto(1, 'Uno'), foto(2, 'Dos')],
				posicionAlcance: 1
			});
			const segundo = render(FotosAlcance, {
				fotos: [{ ...foto(3, 'Tres'), alcanceId: 'otro' }],
				posicionAlcance: 2
			});
			const datos = new DataTransfer();
			tarjeta(primero.container, 1)
				.querySelector('.miniatura')!
				.dispatchEvent(new DragEvent('dragstart', { dataTransfer: datos, bubbles: true }));
			const sobre = new DragEvent('dragover', {
				dataTransfer: datos,
				bubbles: true,
				cancelable: true
			});
			tarjeta(segundo.container, 3).dispatchEvent(sobre);
			expect(sobre.defaultPrevented).toBe(false);
			tarjeta(segundo.container, 3).dispatchEvent(
				new DragEvent('drop', { dataTransfer: datos, bubbles: true, cancelable: true })
			);
			expect(descripciones(primero.container)).toEqual(['Uno', 'Dos']);
			expect(descripciones(segundo.container)).toEqual(['Tres']);
		});
	});

	describe('modo de agarre con el teclado', () => {
		it('Espacio, ← dos veces y Espacio la dejan primera; Esc restaura', async () => {
			const { container } = render(FotosAlcance, { fotos: varias(6), posicionAlcance: 1 });
			const vivo = () => container.querySelector('[aria-live]')?.textContent;
			(tarjeta(container, 3).querySelector('.asa') as HTMLElement).focus();
			await userEvent.keyboard(' ');
			await vi.waitFor(() => expect(vivo()).toContain('Ilustración 2.1.3 tomada, posición 3 de 6'));
			await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
			await vi.waitFor(() => expect(descripciones(container)[0]).toBe('Foto 3'));
			await expect
				.element(page.getByRole('button', { name: 'Reordenar la Ilustración 2.1.1' }))
				.toHaveFocus();
			await userEvent.keyboard(' ');
			await vi.waitFor(() => expect(vivo()).toBe('Se soltó la Ilustración 2.1.1, posición 1 de 6'));

			await userEvent.keyboard(' {ArrowRight}{ArrowRight}');
			await vi.waitFor(() => expect(descripciones(container)[2]).toBe('Foto 3'));
			await userEvent.keyboard('{Escape}');
			await vi.waitFor(() =>
				expect(descripciones(container)).toEqual([
					'Foto 3',
					'Foto 1',
					'Foto 2',
					'Foto 4',
					'Foto 5',
					'Foto 6'
				])
			);
			expect(vivo()).toContain('Se canceló el movimiento');
			await expect
				.element(page.getByRole('button', { name: 'Reordenar la Ilustración 2.1.1' }))
				.toHaveFocus();
		});

		it('en antes/durante/después ← y → cambian de columna con el foco en el asa', async () => {
			const { container } = render(FotosAlcance, {
				fotos: [foto(1, 'A1', 'antes'), foto(2, 'D1', 'durante')],
				disposicion: 'antes_durante_despues'
			});
			(tarjeta(container, 1).querySelector('.asa') as HTMLElement).focus();
			await userEvent.keyboard(' {ArrowRight}');
			const grupos = container.querySelectorAll('.grupo-fotos');
			await vi.waitFor(() => expect(grupos[1].querySelectorAll('.foto')).toHaveLength(2));
			expect(grupos[1].querySelector('.descripcion')).toHaveProperty('value', 'A1');
			await expect
				.element(page.getByRole('button', { name: 'Reordenar la Ilustración 2.1.1' }))
				.toHaveFocus();
			await userEvent.keyboard('{ArrowRight} ');
			await vi.waitFor(() => expect(grupos[2].querySelectorAll('.foto')).toHaveLength(1));
			expect(descripciones(container)).toEqual(['D1', 'A1']);
		});
	});

	describe('vista ampliada', () => {
		it('muestra la posición, recorre con las flechas salvo en la descripción y devuelve el foco', async () => {
			render(FotosAlcance, {
				fotos: varias(12),
				posicionAlcance: 1,
				tituloAlcance: 'Inspección visual'
			});
			await page.getByRole('button', { name: 'Ampliar la Ilustración 2.1.3' }).click();
			const vista = page.getByRole('dialog');
			await expect.element(vista).toHaveTextContent('2.1 Inspección visual');
			await expect.element(vista).toHaveTextContent('3 de 12');
			await userEvent.keyboard('{ArrowRight}');
			await expect.element(vista).toHaveTextContent('Ilustración 2.1.4');
			await expect.element(vista).toHaveTextContent('4 de 12');

			const descripcion = page.getByLabelText('Descripción de la Ilustración 2.1.4').last();
			await descripcion.click();
			await userEvent.keyboard('{ArrowLeft}');
			await expect.element(vista).toHaveTextContent('4 de 12');

			await userEvent.keyboard('{Escape}');
			await expect.element(vista).not.toBeInTheDocument();
			await expect
				.element(page.getByRole('button', { name: 'Ampliar la Ilustración 2.1.4' }))
				.toHaveFocus();
		});

		it('en solo lectura no ofrece acciones', async () => {
			render(FotosAlcance, { fotos: varias(2), soloLectura: true });
			await page.getByRole('button', { name: 'Ampliar la Ilustración 2.1.1' }).click();
			const vista = page.getByRole('dialog');
			await expect.element(vista).toHaveTextContent('1 de 2');
			expect(vista.element().querySelectorAll('.acciones')).toHaveLength(0);
			expect(vista.element().querySelector('input')?.disabled).toBe(true);
		});
	});
});
