import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Reporte } from '$lib/dominio/esquemas';
import type { EnviarAccion } from './acciones';
import EditorReporte from './EditorReporte.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function reporte(cambios: Partial<Reporte> = {}): Reporte {
	return {
		id: ID(1),
		contratoId: ID(2),
		sitioId: ID(3),
		partidaId: ID(4),
		periodoMes: '2026-05-01',
		ocurrencia: null,
		fechaEjecucion: '2026-05-18',
		titulo: '07.- TOMA DE POTENCIALES TUBO-SUELO. MAYO 2026',
		usuario: 'CLIENTE FICTICIO',
		contratoTexto: 'OC-FICTICIA',
		sitioTexto: 'EM-99999 SITIO FICTICIO',
		periodicidad: 'Mensual',
		tipoMantenimiento: 'Preventivo',
		actividad: 'Toma de potenciales tubo-suelo',
		numeroPartida: '7',
		nombreCorto: null,
		objetivo: 'Objetivo',
		introduccion: '',
		conclusiones: 'Conclusiones',
		disposicionFotos: 'cuadricula',
		incluyeVerificacion: true,
		firmantes: {
			elaboro: { nombre: 'Uno', cargo: '', empresa: '' },
			aprobo: { nombre: 'Dos', cargo: '', empresa: '' },
			recibio: { nombre: 'Tres', cargo: '', empresa: '' }
		},
		estado: 'borrador',
		version: 3,
		revision: 0,
		sustituyeA: null,
		emitidoEn: null,
		creadoEn: '2026-05-18T00:00:00Z',
		actualizadoEn: '2026-05-18T00:00:00Z',
		alcances: [
			{
				id: ID(10),
				orden: 1,
				titulo: 'Medición de potenciales',
				descripcion: '',
				estadoVerificacion: 'ok',
				observaciones: '',
				partidaAlcanceId: null,
				fotos: []
			}
		],
		herramientas: [],
		equipos: [],
		documentos: [],
		catalogoHuella: 'h',
		...cambios
	};
}

const sinRespuesta: EnviarAccion = vi.fn(async () => ({ ok: true as const, datos: {} }));
const RUTA = `/reportes/${ID(1)}`;

describe('EditorReporte', () => {
	it('pide confirmación para omitir la tabla con estados capturados y los conserva', async () => {
		render(EditorReporte, { reporte: reporte(), espera: 60_000, enviar: sinRespuesta });
		const casilla = page.getByRole('checkbox', { name: 'Incluir tabla de verificación' });

		await casilla.click();
		await expect.element(page.getByRole('alertdialog')).toBeInTheDocument();
		await expect.element(casilla).toBeChecked();

		await page.getByRole('button', { name: 'Omitir la tabla' }).click();
		await expect.element(casilla).not.toBeChecked();
		await expect
			.element(page.getByLabelText('Verificación', { exact: true }))
			.not.toBeInTheDocument();

		// Al volver a activarla, el estado capturado sigue ahí.
		await casilla.click();
		await expect.element(page.getByLabelText('Verificación', { exact: true })).toHaveValue('ok');
	});

	it('señala la observación obligatoria de un alcance «Con observación»', async () => {
		render(EditorReporte, {
			reporte: reporte({
				alcances: [
					{
						...reporte().alcances[0],
						estadoVerificacion: 'con_observacion',
						observaciones: ''
					}
				]
			}),
			espera: 60_000,
			enviar: sinRespuesta
		});
		await expect
			.element(page.getByText('El alcance 2.1 está «Con observación»: capture la observación.'))
			.toBeInTheDocument();
		await expect
			.element(page.getByLabelText('Observaciones'))
			.toHaveAttribute('aria-invalid', 'true');
	});

	it('autoguarda con la versión vigente y deja de editar ante un conflicto', async () => {
		const enviar = vi.fn<EnviarAccion>(async () => ({
			ok: false as const,
			estado: 409,
			datos: { error: 'Versión anterior', conflicto: true }
		}));
		render(EditorReporte, { reporte: reporte(), espera: 10, enviar });

		await page.getByLabelText('Conclusiones', { exact: true }).fill('Texto nuevo');
		await expect.element(page.getByText('Versión desactualizada')).toBeInTheDocument();

		expect(enviar).toHaveBeenCalledTimes(1);
		const [accion, datos, ruta] = enviar.mock.calls[0];
		expect(accion).toBe('guardar');
		// Siempre a la página del reporte, aunque el usuario ya haya navegado a otra.
		expect(ruta).toBe(RUTA);
		const enviado = JSON.parse(String(datos.get('reporte')));
		expect(enviado).toMatchObject({ id: ID(1), version: 3, conclusiones: 'Texto nuevo' });
		await expect
			.element(page.getByRole('button', { name: 'Recargar el reporte' }))
			.toBeInTheDocument();
		await expect.element(page.getByLabelText('Conclusiones', { exact: true })).toBeDisabled();
	});

	it('guarda de inmediato lo pendiente cuando la página va a navegar', async () => {
		const enviar = vi.fn<EnviarAccion>(async () => ({
			ok: true as const,
			datos: { reporte: { ...reporte(), version: 4 } }
		}));
		const { component } = render(EditorReporte, {
			reporte: reporte(),
			espera: 60_000,
			enviar
		});
		expect(component.hayCambiosPendientes()).toBe(false);
		await page.getByLabelText('Conclusiones', { exact: true }).fill('Antes de salir');
		expect(component.hayCambiosPendientes()).toBe(true);

		expect(await component.guardarAhora()).toBe(true);
		expect(enviar).toHaveBeenCalledTimes(1);
		expect(JSON.parse(String(enviar.mock.calls[0][1].get('reporte')))).toMatchObject({
			version: 3,
			conclusiones: 'Antes de salir'
		});
		expect(component.hayCambiosPendientes()).toBe(false);
	});

	it('un reporte emitido es de solo lectura y ofrece crear una revisión', async () => {
		render(EditorReporte, {
			reporte: reporte({ estado: 'emitido' }),
			espera: 60_000,
			enviar: sinRespuesta
		});
		await expect.element(page.getByLabelText('Conclusiones', { exact: true })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Crear revisión' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Descargar DOCX' }))
			.toHaveAttribute('href', `/reportes/${ID(1)}/documento`);
	});
});
