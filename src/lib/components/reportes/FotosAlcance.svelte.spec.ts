import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Foto } from '$lib/dominio/esquemas';
import FotosAlcance from './FotosAlcance.svelte';

const ALCANCE = '00000000-0000-4000-8000-000000000100';

function foto(n: number, descripcion: string, momento: Foto['momento'] = null): Foto {
	return {
		id: `00000000-0000-4000-8000-00000000000${n}`,
		alcanceId: ALCANCE,
		orden: n,
		descripcion,
		momento,
		rutaOriginal: '',
		rutaOptimizada: '',
		ancho: 640,
		alto: 480,
		bytes: 1000,
		tipoMime: 'image/jpeg'
	};
}

/** Descripción y pie de cada foto, en el orden en que se muestran. */
function fotosMostradas(contenedor: HTMLElement) {
	return [...contenedor.querySelectorAll('.foto')].map((elemento) => ({
		pie: elemento.querySelector('.pie')?.textContent?.trim(),
		descripcion: (elemento.querySelector('input') as HTMLInputElement).value
	}));
}

describe('FotosAlcance', () => {
	it('renumera los pies al mover la tercera foto del alcance 2 al primer lugar', async () => {
		const { container } = render(FotosAlcance, {
			fotos: [foto(1, 'Uno'), foto(2, 'Dos'), foto(3, 'Tres')],
			posicionAlcance: 2
		});
		await page.getByRole('button', { name: 'Subir la Ilustración 2.2.3' }).click();
		await page.getByRole('button', { name: 'Subir la Ilustración 2.2.2' }).click();

		expect(fotosMostradas(container)).toEqual([
			{ pie: 'Ilustración 2.2.1', descripcion: 'Tres' },
			{ pie: 'Ilustración 2.2.2', descripcion: 'Uno' },
			{ pie: 'Ilustración 2.2.3', descripcion: 'Dos' }
		]);
	});

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

	it('en solo lectura no permite cargar ni mover fotos', async () => {
		const { container } = render(FotosAlcance, {
			fotos: [foto(1, 'Uno')],
			soloLectura: true
		});
		expect(container.querySelectorAll('button')).toHaveLength(0);
		expect(container.querySelector('input[type=file]')).toBeNull();
		expect((container.querySelector('.foto input') as HTMLInputElement).disabled).toBe(true);
	});
});
