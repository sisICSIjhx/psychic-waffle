// Ventana «Capturar actividad» con `/actividades` simulado. Solo datos ficticios.
import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DialogoActividad from './DialogoActividad.svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn(async () => undefined) }));

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OPCIONES = {
	hoy: '2026-11-21',
	centros: [
		{
			id: ID(1),
			clave: 'EM-1',
			nombre: 'CERRITOS',
			programa: { id: ID(10), periodoInicio: '2026-05-01', periodoFin: '2027-04-30' }
		},
		{ id: ID(2), clave: 'EM-2', nombre: 'OTRO', programa: null }
	],
	personal: [
		{ id: ID(31), nombre: 'Ana Prueba', centroIds: [ID(1)] },
		{ id: ID(32), nombre: 'Beto Prueba', centroIds: [] }
	]
};
const PARTIDAS = {
	partidas: [
		{
			id: ID(7),
			numero: '7',
			actividad: 'Toma de potenciales',
			periodicidad: 'mensual',
			faltan: { '2026-11-01': 1 }
		},
		{ id: ID(8), numero: '8', actividad: 'Rótulos', periodicidad: 'anual', faltan: {} }
	]
};

const respuesta = (cuerpo: object, status = 200) =>
	new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

function simularServidor(alRegistrar: () => Response = () => respuesta({ tipo: 'realizada' })) {
	const envios: unknown[] = [];
	vi.spyOn(window, 'fetch').mockImplementation(async (entrada, opciones) => {
		const url = String(entrada);
		if (opciones?.method === 'POST') {
			envios.push(JSON.parse(String(opciones.body)));
			return alRegistrar();
		}
		return respuesta(url.includes('centro=') ? PARTIDAS : OPCIONES);
	});
	return envios;
}

async function abrir() {
	const target = document.body.appendChild(document.createElement('div'));
	const { rerender } = render(DialogoActividad, { target });
	await rerender({ abierto: true });
	await expect.element(page.getByLabelText('Centro de costo')).toBeVisible();
}

afterEach(() => vi.restoreAllMocks());

describe('DialogoActividad', () => {
	it('un centro sin programa anual enlaza a su seguimiento', async () => {
		simularServidor();
		await abrir();
		await page.getByLabelText('Centro de costo').selectOptions(ID(2));
		await expect
			.element(page.getByRole('link', { name: 'Ir al seguimiento de EM-2' }))
			.toHaveAttribute('href', `/seguimiento?centro=${ID(2)}&mes=2026-11-01`);
		expect(page.getByRole('button', { name: 'Registrar' }).elements()).toHaveLength(0);
	});

	it('registra la actividad realizada con sus personas y sin fecha', async () => {
		const envios = simularServidor();
		await abrir();
		await page.getByLabelText('Centro de costo').selectOptions(ID(1));
		const registrarBoton = page.getByRole('button', { name: 'Registrar' });
		await expect.element(registrarBoton).toBeDisabled();
		await page.getByRole('combobox', { name: 'Actividad' }).fill('potenciales');
		await page.getByRole('option', { name: /Toma de potenciales/ }).click();
		await expect
			.element(page.getByText('Si la deja vacía, se registra con la fecha de hoy.'))
			.toBeVisible();
		await page.getByRole('radio', { name: 'Sí' }).click();
		await page.getByRole('checkbox', { name: 'Ana Prueba' }).click();
		await expect.element(registrarBoton).toBeEnabled();
		await registrarBoton.click();
		await expect.poll(() => envios).toHaveLength(1);
		expect(envios[0]).toEqual({
			programaId: ID(10),
			partidaId: ID(7),
			realizada: true,
			fecha: null,
			personalIds: [ID(31)]
		});
		// Al registrar, la ventana se cierra.
		await expect
			.poll(() => page.getByRole('dialog', { name: 'Capturar actividad' }).elements())
			.toHaveLength(0);
	});

	it('con «No» no pide personas, avisa si no hay pendiente y muestra el error sin cerrar', async () => {
		simularServidor(() => respuesta({ error: 'No falta nada por ejecutar en el mes' }, 400));
		await abrir();
		await page.getByLabelText('Centro de costo').selectOptions(ID(1));
		await page.getByRole('combobox', { name: 'Actividad' }).fill('rótulos');
		await page.getByRole('option', { name: /Rótulos/ }).click();
		await page.getByRole('radio', { name: 'No' }).click();
		expect(page.getByRole('group', { name: /Personas/ }).elements()).toHaveLength(0);
		await expect
			.element(page.getByText('En noviembre 2026 no falta nada por ejecutar de la partida 8.'))
			.toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Registrar' })).toBeDisabled();

		// Con una fecha futura tampoco se puede registrar.
		await page.getByRole('combobox', { name: 'Actividad' }).fill('potenciales');
		await page.getByRole('option', { name: /Toma de potenciales/ }).click();
		await page.getByLabelText('Fecha (opcional)').fill('2026-11-25');
		await expect.element(page.getByText('La fecha no puede ser posterior a hoy.')).toBeVisible();
		await page.getByLabelText('Fecha (opcional)').fill('2026-11-02');
		await page.getByRole('button', { name: 'Registrar' }).click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('No falta nada por ejecutar en el mes');
		await expect.element(page.getByRole('dialog', { name: 'Capturar actividad' })).toBeVisible();
		await userEvent.keyboard('{Escape}');
	});
});
