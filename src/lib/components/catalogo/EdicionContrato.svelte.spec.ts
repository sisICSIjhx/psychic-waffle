// Pantalla del contrato: datos con «Editar», confirmación con motivo, sitios, firmantes, historial y
// permisos. Solo nombres ficticios.
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type {
	Contrato,
	Firmante,
	PaginaCambios,
	ResultadoEdicion,
	Sitio
} from '$lib/dominio/esquemas';
import ContratoView from './ContratoView.svelte';
import DatosContrato from './DatosContrato.svelte';
import DialogoCambioCatalogo from './DialogoCambioCatalogo.svelte';
import FirmantesContrato from './FirmantesContrato.svelte';
import HistorialCambios from './HistorialCambios.svelte';
import SitiosContrato from './SitiosContrato.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const VERSION = '2026-10-01T12:00:00.000000+00:00';

const contrato: Contrato = {
	id: ID(1),
	clienteId: ID(2),
	numero: 'OC-PROVISIONAL',
	descripcion: null,
	vigenciaInicio: '2026-03-01',
	vigenciaFin: '2027-02-28',
	cliente: { id: ID(2), clave: 'ficticio', nombre: 'Ficticio', razonSocial: 'CLIENTE FICTICIO' },
	vigente: true,
	actualizadoEn: VERSION
};
const sitio = (n: number, clave: string): Sitio => ({
	id: ID(10 + n),
	clave,
	nombre: 'AREA IV',
	actualizadoEn: VERSION
});
const firmante = (n: number, funcion: Firmante['funcion'], desde: string): Firmante => ({
	id: ID(20 + n),
	contratoId: contrato.id,
	funcion,
	nombre: `Persona Ficticia ${n}`,
	cargo: 'Cargo',
	empresa: 'Empresa',
	vigenteDesde: desde,
	vigenteHasta: null,
	actualizadoEn: VERSION
});
const impacto = (cambios: Partial<ResultadoEdicion['impacto']> = {}) => ({
	borradores: 0,
	borradoresIds: [],
	borradoresActualizados: [],
	borradoresConAviso: [],
	enRevision: 0,
	emitidos: 0,
	sustituidos: 0,
	otrosContratos: [],
	...cambios
});
const destino = () => document.body.appendChild(document.createElement('div'));

describe('DatosContrato', () => {
	it('muestra el cliente fijo con la nota de renovación y avisa si no hay cambios', async () => {
		render(DatosContrato, { contrato });
		await page.getByRole('button', { name: 'Editar datos del contrato' }).click();
		await expect
			.element(page.getByText(/El cliente no cambia: una renovación/))
			.toBeInTheDocument();
		await expect.element(page.getByLabelText('Número')).toHaveValue('OC-PROVISIONAL');
		await page.getByRole('button', { name: 'Revisar cambios' }).click();
		await expect.element(page.getByText('No hay cambios que guardar.')).toBeInTheDocument();
	});

	it('muestra los errores del ensayo junto a sus campos', async () => {
		const { rerender } = render(DatosContrato, { contrato });
		await page.getByRole('button', { name: 'Editar datos del contrato' }).click();
		await rerender({
			error: {
				motivo: 'contrato_duplicado',
				error: 'Ya existe un contrato con ese número para el cliente'
			}
		});
		await expect
			.element(page.getByLabelText('Número'))
			.toHaveAccessibleDescription(/Ya existe un contrato con ese número/);
		await rerender({
			error: {
				motivo: 'vigencia_con_datos_fuera',
				error: 'La vigencia deja fuera meses con reportes o programas',
				detalle: {
					fuera: [{ tipo: 'programa', sitio: 'EM-30184', meses: ['2026-03-01', '2026-04-01'] }]
				}
			}
		});
		await expect
			.element(page.getByText('Programa de EM-30184: marzo de 2026, abril de 2026'))
			.toBeInTheDocument();
	});
});

describe('DialogoCambioCatalogo', () => {
	const resultado = (cambios: Partial<ResultadoEdicion['impacto']> = {}): ResultadoEdicion => ({
		ensayo: true,
		cambios: [{ campo: 'numero', antes: 'OC-PROVISIONAL', despues: 'OC-DEFINITIVA' }],
		impacto: impacto(cambios)
	});

	it('muestra el cambio y el impacto, y exige un motivo válido para confirmar', async () => {
		const enviados: FormData[] = [];
		const origen = document.body.appendChild(document.createElement('button'));
		origen.textContent = 'Revisar cambios';
		origen.focus();
		const { rerender } = render(DialogoCambioCatalogo, {
			target: destino(),
			props: {
				campos: { tipo: 'contrato', numero: 'OC-DEFINITIVA' },
				resultado: resultado({ borradores: 2, emitidos: 1 }),
				alAplicar: ({ formData, cancel }) => {
					enviados.push(formData);
					cancel();
				}
			}
		});
		await rerender({ abierto: true });
		const dialogo = page.getByRole('dialog');
		await expect.element(dialogo).toHaveTextContent('Número: OC-PROVISIONAL → OC-DEFINITIVA');
		await expect.element(dialogo).toHaveTextContent('2 borradores');
		await expect.element(dialogo).toHaveTextContent('1 emitido conserva el número anterior');
		await expect.element(page.getByLabelText('Actualizar también los borradores')).toBeChecked();

		const confirmar = page.getByRole('button', { name: 'Confirmar' });
		await page.getByLabelText('Motivo del cambio (obligatorio)').fill('error');
		await expect.element(confirmar).toBeDisabled();
		await expect.element(dialogo).toHaveTextContent('Faltan al menos 5 caracteres.');

		await page.getByLabelText('Motivo del cambio (obligatorio)').fill('Número provisional');
		await page.getByLabelText('Actualizar también los borradores').click();
		await confirmar.click();
		expect(enviados).toHaveLength(1);
		expect(enviados[0].get('motivo')).toBe('Número provisional');
		expect(enviados[0].get('numero')).toBe('OC-DEFINITIVA');
		expect(enviados[0].get('actualizarBorradores')).toBeNull();
		origen.remove();
	});

	it('Esc cierra sin enviar y devuelve el foco; sin borradores no hay casilla', async () => {
		const alAplicar = vi.fn();
		const origen = document.body.appendChild(document.createElement('button'));
		origen.textContent = 'Quitar del contrato';
		origen.focus();
		const { rerender } = render(DialogoCambioCatalogo, {
			target: destino(),
			props: {
				campos: { tipo: 'cambiarFirmante' },
				resultado: {
					...resultado(),
					cambios: [{ campo: 'nombre', antes: 'Persona Uno', despues: 'Persona Dos' }],
					impacto: impacto({ desdeMes: '2026-12-01' })
				},
				alAplicar
			}
		});
		await rerender({ abierto: true });
		await expect
			.element(page.getByRole('dialog'))
			.toHaveTextContent('Los reportes desde diciembre de 2026 usarán al nuevo firmante');
		expect(page.getByLabelText('Actualizar también los borradores').elements()).toHaveLength(0);
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(alAplicar).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(origen);
		origen.remove();
	});
});

describe('SitiosContrato', () => {
	it('deshabilita quitar un sitio con datos y avisa del sitio compartido al corregirlo', async () => {
		const conDatos = sitio(1, 'EM-30184');
		const vacio = sitio(2, 'EM-99999');
		render(SitiosContrato, {
			sitios: [conDatos, vacio],
			resumen: [
				{
					sitioId: conDatos.id,
					partidas: 31,
					programas: 1,
					reportes: 2,
					otrosContratos: [{ id: ID(3), numero: 'OC-OTRA' }]
				},
				{ sitioId: vacio.id, partidas: 0, programas: 0, reportes: 0, otrosContratos: [] }
			]
		});
		const quitar = page.getByRole('button', { name: 'Quitar del contrato EM-30184' });
		await expect.element(quitar).toBeDisabled();
		await expect.element(quitar).toHaveAccessibleDescription(/31 partidas, 1 programa, 2 reportes/);
		await expect
			.element(page.getByRole('button', { name: 'Quitar del contrato EM-99999' }))
			.toBeEnabled();
		await page.getByRole('button', { name: 'Corregir clave o nombre de EM-30184' }).click();
		await vi.waitFor(() =>
			expect(
				document.querySelector('.aviso-compartido')?.textContent?.replace(/\s+/g, ' ')
			).toContain('también está en 1 otro contrato (OC-OTRA)')
		);
		await expect.element(page.getByLabelText('Nombre')).toHaveValue('AREA IV');
	});
});

describe('FirmantesContrato', () => {
	it('ofrece cambiar desde una fecha solo al más reciente y propone el mes siguiente', async () => {
		const anterior = { ...firmante(1, 'recibio', '2026-03-01'), vigenteHasta: '2026-10-31' };
		const actual = firmante(2, 'recibio', '2026-11-01');
		render(FirmantesContrato, { firmantes: [anterior, actual], hoy: '2026-11-15' });
		expect(page.getByRole('button', { name: /Cambiar firmante desde/ }).elements()).toHaveLength(1);
		await page.getByRole('button', { name: /Cambiar firmante desde/ }).click();
		await expect.element(page.getByLabelText('Desde', { exact: true })).toHaveValue('2026-12-01');
		await expect.element(page.getByLabelText('Nombre', { exact: true }).first()).toHaveFocus();
		await page.getByRole('button', { name: 'Corregir datos de Recibió' }).first().click();
		await expect
			.element(page.getByLabelText('Nombre', { exact: true }).first())
			.toHaveValue('Persona Ficticia 1');
	});
});

describe('HistorialCambios', () => {
	const cambios = (filas: PaginaCambios['filas'], total = filas.length): PaginaCambios => ({
		total,
		pagina: 1,
		tamano: 20,
		filas
	});

	it('muestra fecha local, qué cambió, antes → después, motivo, usuario y efectos', async () => {
		render(HistorialCambios, {
			abierto: true,
			cambios: cambios(
				[
					{
						id: ID(40),
						entidad: 'contrato',
						entidadId: contrato.id,
						contratoId: contrato.id,
						accion: 'editar',
						cambios: [{ campo: 'numero', antes: 'OC-PROVISIONAL', despues: 'OC-DEFINITIVA' }],
						motivo: 'Número provisional corregido',
						efectos: { borradoresActualizados: [ID(50), ID(51)] },
						usuarioId: null,
						usuarioTexto: null,
						origen: 'interfaz',
						realizadoEn: '2026-10-23T03:05:00Z'
					}
				],
				25
			),
			enlacePagina: (n: number) => `/catalogo/contratos/x?cambios=${n}`
		});
		const fila = page.getByRole('row').nth(1);
		await expect.element(fila).toHaveTextContent('22/10/2026 21:05');
		await expect.element(fila).toHaveTextContent('Contrato · Número');
		await expect.element(fila).toHaveTextContent('Número: OC-PROVISIONAL → OC-DEFINITIVA');
		await expect.element(fila).toHaveTextContent('Número provisional corregido');
		await expect.element(fila).toHaveTextContent('—');
		await expect.element(fila).toHaveTextContent('2 borradores actualizados');
		await expect
			.element(page.getByRole('link', { name: 'Anteriores' }))
			.toHaveAttribute('href', '/catalogo/contratos/x?cambios=2');
	});

	it('indica cuando no hay cambios registrados', async () => {
		render(HistorialCambios, { abierto: true, cambios: cambios([]) });
		await expect.element(page.getByText('Sin cambios registrados.')).toBeInTheDocument();
	});
});

describe('ContratoView con permisos y resultados', () => {
	const props = (cambios: Record<string, unknown> = {}) => ({
		contrato,
		sitios: [sitio(1, 'EM-30184')],
		sitio: sitio(1, 'EM-30184'),
		firmantes: [firmante(1, 'elaboro', '2026-03-01')],
		resumenSitios: [
			{ sitioId: ID(11), partidas: 0, programas: 0, reportes: 0, otrosContratos: [] }
		],
		...cambios
	});

	it('sin permiso muestra los datos y el historial sin acciones de edición', async () => {
		render(ContratoView, props({ permisos: { editarCatalogo: false } }));
		await expect.element(page.getByText('OC-PROVISIONAL').first()).toBeInTheDocument();
		for (const nombre of [
			'Editar datos del contrato',
			/Corregir clave o nombre/,
			/Quitar del contrato/,
			/Corregir datos/,
			/Cambiar firmante desde/
		]) {
			expect(page.getByRole('button', { name: nombre }).elements()).toHaveLength(0);
		}
		expect(page.getByText('Registrar firmante').elements()).toHaveLength(0);
		expect(page.getByText('Asociar un sitio').elements()).toHaveLength(0);
		await expect.element(page.getByText(/Historial de cambios/)).toBeInTheDocument();
	});

	it('abre la confirmación con el ensayo y muestra el conflicto de versión al aplicar', async () => {
		const { rerender } = render(ContratoView, props());
		await rerender({
			form: {
				accion: 'ensayarCambio',
				tipo: 'contrato',
				campos: { tipo: 'contrato', numero: 'OC-DEFINITIVA' },
				resultado: {
					ensayo: true,
					cambios: [{ campo: 'numero', antes: 'OC-PROVISIONAL', despues: 'OC-DEFINITIVA' }],
					impacto: impacto()
				}
			}
		});
		await expect.element(page.getByRole('dialog')).toBeVisible();
		await userEvent.keyboard('{Escape}');
		await rerender({
			form: {
				accion: 'aplicarCambio',
				tipo: 'contrato',
				error: 'El contrato cambió desde que lo abrió; recargue para ver los datos actuales'
			}
		});
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('El contrato cambió desde que lo abrió');
	});
});
