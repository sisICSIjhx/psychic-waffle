import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ResumenPrograma from './ResumenPrograma.svelte';

const fila = (numero: string, cambios: Record<string, unknown> = {}) => ({
	numero,
	actividad: `Actividad ficticia ${numero}`,
	accion: 'actualizar' as const,
	periodicidadAntes: 'mensual',
	periodicidad: 'trimestral',
	cantidadAntes: null,
	cantidadAnual: 4,
	meses: [
		{ mes: '2026-03-01', cantidad: 1 },
		{ mes: '2026-06-01', cantidad: 1 }
	],
	totalProgramado: 2,
	realizados: [{ mes: '2026-06-01', cantidad: 1 }],
	cambiaPrograma: true,
	estabaPorConfirmar: true,
	quedaPorConfirmar: true,
	tieneReportes: false,
	...cambios
});

const resultado = (
	partidas = [fila('14')],
	resumen = { crear: 0, actualizar: 1, sinCambios: 0 }
) => ({
	programa: {
		accion: 'crear' as const,
		periodoInicio: '2026-03-01',
		periodoFin: '2027-02-28'
	},
	resumen,
	partidas,
	noIncluidas: [{ numero: '9', actividad: 'Partida fuera del libro' }]
});

describe('ResumenPrograma', () => {
	it('muestra periodo, cambios «antes → después», acción en texto y advertencias', async () => {
		render(ResumenPrograma, {
			resultado: resultado(),
			token: 'tok',
			nombreArchivo: 'programa.xlsx',
			sitio: 'ERM 11111',
			advertencias: [
				{ partida: null, mes: null, fila: null, texto: 'ERM 11111: aviso general ficticio.' },
				{
					partida: '14',
					mes: null,
					fila: 11,
					texto: 'ERM 11111, partida 14: la cantidad anual es 4 y las marcas suman 2.'
				}
			]
		});
		await expect
			.element(page.getByText(/Sitio ERM 11111 · Periodo marzo 2026 a febrero 2027/))
			.toBeInTheDocument();
		await expect.element(page.getByText('ERM 11111: aviso general ficticio.')).toBeInTheDocument();
		const celdas = [...document.querySelectorAll('tbody tr td')].map((c) =>
			(c as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
		);
		expect(celdas).toEqual([
			'14',
			'Actividad ficticia 14',
			'Actualizar por confirmar',
			'Mensual → Trimestral',
			'— → 4',
			'2 en 2 meses',
			'junio 2026',
			'la cantidad anual es 4 y las marcas suman 2.'
		]);
		await expect.element(page.getByText(/Partida fuera del libro/)).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Confirmar importación del programa' }))
			.toBeInTheDocument();
	});

	it('sin cambios no ofrece aplicar', async () => {
		render(ResumenPrograma, {
			resultado: {
				...resultado(
					[fila('1', { accion: 'sin_cambios', periodicidadAntes: 'trimestral', cantidadAntes: 4 })],
					{ crear: 0, actualizar: 0, sinCambios: 1 }
				),
				programa: { accion: 'existente', periodoInicio: '2026-03-01', periodoFin: '2027-02-28' }
			},
			token: 'tok',
			nombreArchivo: 'programa.xlsx',
			sitio: 'ERM 11111'
		});
		await expect
			.element(page.getByText('No hay cambios respecto a lo registrado.'))
			.toBeInTheDocument();
		expect(page.getByRole('button', { name: /Confirmar/ }).elements()).toHaveLength(0);
	});
});
