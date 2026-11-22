// Editor de plantillas: opciones de cada concepto (indicador, por definir y carpeta del documento) y
// lo que viaja al guardar. Solo nombres ficticios.
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ConceptoSeguimiento, PlantillaSeguimiento } from '$lib/dominio/esquemas';
import PlantillaEditor from './PlantillaEditor.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const concepto = (
	n: number,
	etiqueta: string,
	bloque: ConceptoSeguimiento['bloque'],
	tipo: ConceptoSeguimiento['tipo'],
	nivel: ConceptoSeguimiento['nivel'],
	extra: Partial<ConceptoSeguimiento> = {}
): ConceptoSeguimiento => ({
	id: ID(n),
	bloque,
	etiqueta,
	tipo,
	nivel,
	orden: n,
	indicador: null,
	porDefinir: false,
	carpetaId: null,
	...extra
});

const plantilla = (conceptos: ConceptoSeguimiento[]): PlantillaSeguimiento => ({
	id: ID(100),
	nombre: 'Plantilla ficticia',
	descripcion: null,
	modoContrato: 'obligatorio',
	origenActividades: 'mensual',
	actualizadoEn: '2026-11-20T12:00:00.000000+00:00',
	conceptos,
	centros: []
});

const base = () =>
	plantilla([
		concepto(1, 'Notas', 'contrato', 'texto', 'contrato'),
		concepto(2, 'Periodicidad', 'contrato', 'texto', 'contrato', { indicador: 'periodicidad' }),
		concepto(3, 'EM del mes', 'programa', 'cantidad', 'periodo', { indicador: 'em_programadas' }),
		concepto(4, 'Reporte', 'documentos', 'casilla', 'partida', { carpetaId: ID(6) }),
		concepto(5, 'ODT', 'documentos', 'casilla', 'actividad', { porDefinir: true }),
		concepto(6, 'Seguridad', 'carpetas', 'carpeta', 'periodo')
	]);

/** Lo que el formulario enviará en el campo oculto `conceptos`. */
const enviados = (contenedor: Element) =>
	JSON.parse(
		contenedor.querySelector<HTMLInputElement>('input[name="conceptos"]')!.value
	) as Record<string, unknown>[];
const fila = (contenedor: Element, etiqueta: string) =>
	[...contenedor.querySelectorAll<HTMLElement>('li.concepto')].find(
		(li) => li.querySelector<HTMLInputElement>('input[id^="etiqueta-"]')!.value === etiqueta
	)!;
const elegir = (select: HTMLSelectElement, texto: string) => {
	select.value = [...select.options].find((o) => o.textContent!.trim().startsWith(texto))!.value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('PlantillaEditor', () => {
	it('muestra y envía indicador, por definir y carpeta de cada concepto', async () => {
		const { container } = render(PlantillaEditor, { plantilla: base() });
		await expect.element(page.getByRole('heading', { name: 'Documentos' })).toBeInTheDocument();

		const reporte = fila(container, 'Reporte');
		expect(reporte.querySelector<HTMLSelectElement>('select[id^="nivel-"]')!.value).toBe('partida');
		expect(reporte.textContent).toContain(
			'Una vez por partida en el mes, aunque se ejecute varias veces.'
		);
		const carpeta = reporte.querySelector<HTMLSelectElement>('select[id^="carpeta-"]')!;
		expect(carpeta.selectedOptions[0].textContent?.trim()).toBe('Seguridad');
		// La insignia «Por definir» solo en la fila marcada.
		expect(fila(container, 'ODT').querySelector('.status-badge.por-definir')).not.toBeNull();
		expect(reporte.querySelector('.status-badge.por-definir')).toBeNull();
		// «Qué mide» solo donde el bloque, tipo y nivel admiten un indicador.
		expect(reporte.querySelector('select[id^="indicador-"]')).toBeNull();
		expect(fila(container, 'Seguridad').querySelector('select[id^="carpeta-"]')).toBeNull();

		expect(enviados(container)).toEqual([
			expect.objectContaining({ etiqueta: 'Notas', indicador: null, porDefinir: false }),
			expect.objectContaining({ etiqueta: 'Periodicidad', indicador: 'periodicidad' }),
			expect.objectContaining({ etiqueta: 'EM del mes', indicador: 'em_programadas' }),
			expect.objectContaining({ etiqueta: 'Reporte', nivel: 'partida', carpetaId: ID(6) }),
			expect.objectContaining({ etiqueta: 'ODT', porDefinir: true, carpetaId: null }),
			expect.objectContaining({ etiqueta: 'Seguridad', bloque: 'carpetas' })
		]);
		// Solo los documentos llevan la llave de la carpeta.
		expect(enviados(container)[0]).not.toHaveProperty('carpetaId');
	});

	it('deshabilita el indicador que ya usa otro concepto', async () => {
		const { container } = render(PlantillaEditor, { plantilla: base() });
		await expect.element(page.getByRole('heading', { name: 'Contrato' })).toBeInTheDocument();
		const opciones = [
			...fila(container, 'Notas').querySelector<HTMLSelectElement>('select[id^="indicador-"]')!
				.options
		].map((o) => [o.textContent?.trim(), o.disabled]);
		expect(opciones).toEqual([
			['No alimenta ningún indicador', false],
			['Periodicidad (ya lo usa «Periodicidad»)', true]
		]);
		// Quien lo tiene lo ve disponible.
		expect(
			[
				...fila(container, 'Periodicidad').querySelector<HTMLSelectElement>(
					'select[id^="indicador-"]'
				)!.options
			].every((o) => !o.disabled)
		).toBe(true);
	});

	it('quita el indicador que deja de corresponder al cambiar el tipo y lo avisa', async () => {
		const { container } = render(PlantillaEditor, { plantilla: base() });
		await expect.element(page.getByRole('heading', { name: 'Contrato' })).toBeInTheDocument();
		const em = fila(container, 'EM del mes');
		elegir(em.querySelector<HTMLSelectElement>('select[id^="tipo-"]')!, 'Casilla');

		await expect
			.element(page.getByRole('status').filter({ hasText: 'Se quitó «EM programadas»' }))
			.toHaveTextContent(
				'Se quitó «EM programadas» de «EM del mes» porque ya no corresponde a este tipo y nivel.'
			);
		expect(em.querySelector('select[id^="indicador-"]')).toBeNull();
		expect(enviados(container)[2]).toMatchObject({ tipo: 'casilla', indicador: null });
	});

	it('al quitar una carpeta sus documentos vuelven a «Sin carpeta»; una carpeta nueva se envía por su nombre', async () => {
		const { container } = render(PlantillaEditor, { plantilla: base() });
		await page.getByRole('button', { name: 'Quitar Seguridad' }).click();
		await expect
			.element(page.getByRole('status').filter({ hasText: 'Sin carpeta' }))
			.toHaveTextContent(
				'«Reporte» volvió a «Sin carpeta» porque se quitó la carpeta «Seguridad».'
			);
		expect(enviados(container).find((c) => c.etiqueta === 'Reporte')).toMatchObject({
			carpetaId: null
		});
		// Sin carpetas en la plantilla, los documentos no ofrecen elegir una.
		expect(fila(container, 'Reporte').querySelector('select[id^="carpeta-"]')).toBeNull();

		// Una carpeta nueva todavía no tiene id: el documento la nombra por su etiqueta.
		const carpetas = container.querySelector('#titulo-carpetas')!.closest('section')!;
		await page.elementLocator(carpetas).getByRole('button', { name: 'Agregar concepto' }).click();
		const nueva = carpetas.querySelector<HTMLInputElement>('li.concepto input[id^="etiqueta-"]')!;
		await page.elementLocator(nueva).fill('Carpeta de reportes');
		const select = () =>
			fila(container, 'Reporte').querySelector<HTMLSelectElement>('select[id^="carpeta-"]');
		await expect.poll(() => select()).not.toBeNull();
		elegir(select()!, 'Carpeta de reportes');
		await expect
			.poll(() => enviados(container).find((c) => c.etiqueta === 'Reporte'))
			.toMatchObject({ carpeta: 'Carpeta de reportes' });
		expect(enviados(container).find((c) => c.etiqueta === 'Reporte')).not.toHaveProperty(
			'carpetaId'
		);
	});

	it('señala la fila que nombra el error del servidor', async () => {
		const { container } = render(PlantillaEditor, {
			plantilla: base(),
			form: { error: '«Notas» y «Periodicidad» tienen el mismo indicador.' }
		});
		await expect.element(page.getByRole('alert')).toHaveTextContent('tienen el mismo indicador');
		const invalidos = [...container.querySelectorAll('[aria-invalid="true"]')].map((e) => e.id);
		expect(invalidos).toHaveLength(2);
		expect(invalidos.every((id) => id.startsWith('indicador-'))).toBe(true);
	});
});
