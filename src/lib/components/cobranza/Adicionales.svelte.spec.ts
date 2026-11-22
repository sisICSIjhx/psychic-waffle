// Sección «Adicionales» de /cobranza: qué puede hacer cada quien y dónde se ve el resultado de
// guardar. Solo datos ficticios.
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Adicionales from './Adicionales.svelte';
import type { Adicional } from './adicionales';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const adicional = (n: number, cambios: Partial<Adicional> = {}): Adicional => ({
	id: ID(n),
	ordenCompra: `OC-FICTICIA-${n}`,
	descripcion: 'Trabajo de ejemplo',
	fechaSolicitud: '2026-10-28',
	periodoInicio: '2026-11-01',
	periodoFin: '2026-11-15',
	montoPactado: 1000,
	montoCobrado: null,
	...cambios
});

const comunes = {
	urlGuardar: '/cobranza?/guardar&centro=x&anio=2026',
	enviar: () => {},
	idNuevo: ID(99)
};

describe('Adicionales', () => {
	it('en consulta muestra la lista y los totales, sin formularios ni botones', async () => {
		const { container } = render(Adicionales, {
			...comunes,
			adicionales: [adicional(1), adicional(2, { montoPactado: 500.5, montoCobrado: 200 })],
			contratos: [{ id: ID(50), numero: 'EM-00001' }]
		});
		await expect
			.element(page.getByRole('rowheader', { name: 'OC-FICTICIA-1' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Contrato: EM-00001.')).toBeInTheDocument();
		await expect.element(page.getByText('1 al 15 nov 2026').first()).toBeInTheDocument();
		await expect.element(page.getByText('Sin cobro')).toBeInTheDocument();
		const total = container.querySelector('tfoot')!.textContent!.replace(/\s+/g, ' ');
		expect(total).toContain('$1,500.50');
		expect(total).toContain('$200.00');
		expect(container.querySelectorAll('form, button, input, details')).toHaveLength(0);
	});

	it('administración registra, corrige y quita; no ve dónde escribir lo cobrado', async () => {
		const { container } = render(Adicionales, {
			...comunes,
			puedeEditarContrato: true,
			adicionales: [adicional(1), adicional(2, { montoCobrado: 200 })]
		});
		await expect.element(page.getByText('Registrar adicional').first()).toBeInTheDocument();
		expect(container.querySelector('input[name="montoCobrado"]')).toBeNull();
		const acciones = [
			...container.querySelectorAll<HTMLButtonElement>('button[name="accion"]')
		].map((b) => b.value);
		// Un adicional con cobro no ofrece quitarlo: primero contabilidad borra el cobro.
		expect(acciones).toEqual([
			'nuevoAdicional',
			'editarAdicional',
			'quitarAdicional',
			'editarAdicional'
		]);
		await expect
			.element(page.getByText(/No se puede quitar porque ya tiene un cobro registrado/))
			.toBeInTheDocument();
		// Cada formulario dice a qué lugar de la página vuelve su resultado.
		expect(
			[...container.querySelectorAll<HTMLInputElement>('input[name="ancla"]')].map((i) => i.value)
		).toEqual(['r-adicionales', `r-adicional-${ID(1)}`, `r-adicional-${ID(2)}`]);
	});

	it('contabilidad solo llena lo cobrado de cada adicional', async () => {
		const { container } = render(Adicionales, {
			...comunes,
			puedeEditarCobranza: true,
			adicionales: [adicional(1, { montoCobrado: 250.5 })]
		});
		const campo = page.getByRole('spinbutton', { name: 'Monto cobrado · orden OC-FICTICIA-1' });
		await expect.element(campo).toHaveValue(250.5);
		await expect.element(campo).toHaveAttribute('inputmode', 'decimal');
		expect(
			[...container.querySelectorAll<HTMLButtonElement>('button[name="accion"]')].map(
				(b) => b.value
			)
		).toEqual(['cobroAdicional']);
		expect(container.querySelector('input[name="montoPactado"]')).toBeNull();
		expect(container.querySelector('details')).toBeNull();
	});

	it('vacío: invita a registrar el primero solo a quien puede', async () => {
		const consulta = render(Adicionales, { ...comunes, adicionales: [] });
		await expect.element(page.getByText('Sin adicionales registrados.')).toBeInTheDocument();
		expect(consulta.container.textContent).not.toContain('Registre el primero');
		consulta.unmount();

		const edicion = render(Adicionales, {
			...comunes,
			adicionales: [],
			puedeEditarContrato: true
		});
		await expect
			.element(page.getByText(/Registre el primero con su orden de compra\./))
			.toBeInTheDocument();
		// Sin adicionales, el alta ya está abierta.
		expect(edicion.container.querySelector<HTMLDetailsElement>('details.alta')!.open).toBe(true);
	});

	it('muestra el resultado junto al formulario que lo envió', async () => {
		const { container, rerender } = render(Adicionales, {
			...comunes,
			puedeEditarContrato: true,
			puedeEditarCobranza: true,
			adicionales: [adicional(1), adicional(2)],
			resultado: { mensaje: 'Cobro guardado.', ancla: `r-cobro-${ID(2)}` }
		});
		const sitio = (ancla: string) => container.querySelector(`[id="${ancla}"]`)!;
		await expect.element(page.getByText('Guardado')).toBeInTheDocument();
		expect(sitio(`r-cobro-${ID(2)}`).textContent).toContain('Guardado');
		expect(sitio(`r-cobro-${ID(1)}`).textContent).not.toContain('Guardado');

		// Un error del alta abre su formulario, conserva lo escrito y se dice en la cabecera.
		await rerender({
			resultado: { error: 'Escriba la orden de compra.', ancla: 'r-adicionales' },
			enviado: { ordenCompra: '', descripcion: 'Trabajo pendiente', montoPactado: '80' }
		});
		await expect.element(page.getByRole('alert')).toHaveTextContent('Escriba la orden de compra.');
		expect(sitio('r-adicionales').contains(container.querySelector('[role="alert"]'))).toBe(true);
		const alta = container.querySelector<HTMLDetailsElement>('details.alta')!;
		expect(alta.open).toBe(true);
		expect(alta.querySelector<HTMLInputElement>('input[name="descripcion"]')!.value).toBe(
			'Trabajo pendiente'
		);

		// El resultado de una fila que ya no existe (adicional quitado) pasa a la cabecera.
		await rerender({
			adicionales: [adicional(1)],
			resultado: { mensaje: 'Adicional quitado.', ancla: `r-adicional-${ID(2)}` },
			enviado: null
		});
		await expect.element(page.getByText('Adicional quitado.')).toBeInTheDocument();
		expect(sitio('r-adicionales').textContent).toContain('Adicional quitado.');
	});
});
