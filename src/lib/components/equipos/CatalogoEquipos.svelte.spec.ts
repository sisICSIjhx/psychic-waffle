import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { EquipoCatalogo } from '$lib/dominio/esquemas';
import CatalogoEquipos from './CatalogoEquipos.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sitio = { id: ID(900), clave: 'EM-99999', nombre: 'SITIO FICTICIO', actualizadoEn: '' };
const proyecto = { id: ID(800), clave: 'ficticio', nombre: 'Ficticio', razonSocial: 'FICTICIO' };

function equipo(n: number, cambios: Partial<EquipoCatalogo> = {}): EquipoCatalogo {
	return {
		id: ID(n),
		sitioId: sitio.id,
		sitio: { id: sitio.id, clave: sitio.clave, nombre: sitio.nombre },
		tag: `PI-${n}`,
		tipo: 'Indicador de presión',
		marca: 'MARCA',
		modelo: 'M-1',
		numeroSerie: 'S/N',
		rango: '0 - 100 kg/cm²',
		resolucion: null,
		clase: null,
		ubicacion: 'Separador',
		propietario: 'CLIENTE FICTICIO',
		responsable: null,
		critico: false,
		estado: 'en_servicio',
		intervaloMeses: 3,
		ultimaCalibracion: null,
		proximaCalibracion: null,
		proveedor: null,
		notas: null,
		orden: n,
		enUso: false,
		actualizadoEn: '2026-11-05T00:00:00Z',
		...cambios
	};
}

describe('CatalogoEquipos', () => {
	it('muestra indicadores y filtra por calibración vencida y por búsqueda', async () => {
		render(CatalogoEquipos, {
			clientes: [proyecto],
			proyecto,
			sitios: [sitio],
			hoy: '2026-11-05',
			equipos: [
				equipo(1, { tag: 'PIT-1701', proximaCalibracion: '2026-10-01', critico: true }),
				equipo(2, { tag: 'PIT-1703', ultimaCalibracion: '2026-08-28' }),
				equipo(3, { tag: 'TI-1700', tipo: 'Indicador de temperatura' }),
				equipo(4, { tag: 'PI-1999', estado: 'baja', proximaCalibracion: '2026-01-01' })
			]
		});

		await expect.element(page.getByRole('heading', { name: '4 equipos' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /Calibración vencida\s*1/ }))
			.toBeVisible();
		// La próxima de PIT-1703 se calcula (28/11/2026) y queda por vencer.
		await expect.element(page.getByText('28/11/2026*')).toBeVisible();

		await page.getByRole('button', { name: /Calibración vencida/ }).click();
		await expect.element(page.getByRole('heading', { name: '1 de 4 equipos' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'PIT-1701' })).toBeVisible();
		expect(page.getByRole('link', { name: 'PI-1999' }).elements()).toHaveLength(0);

		await page.getByRole('button', { name: 'Quitar filtros' }).click();
		await page.getByLabelText('Buscar').fill('temperatura');
		await expect.element(page.getByRole('link', { name: 'TI-1700' })).toBeVisible();
		expect(page.getByRole('link', { name: 'PIT-1701' }).elements()).toHaveLength(0);
	});

	it('pide sitios cuando el proyecto no tiene', async () => {
		render(CatalogoEquipos, {
			clientes: [proyecto],
			proyecto,
			sitios: [],
			hoy: '2026-11-05',
			equipos: []
		});
		await expect.element(page.getByText(/aún no tiene sitios/)).toBeVisible();
	});
});
