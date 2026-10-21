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

	it('al enviar con datos faltantes muestra el resumen enlazado y no cambia el estado', async () => {
		const enviar = vi.fn<EnviarAccion>(sinRespuesta);
		render(EditorReporte, {
			reporte: reporte({
				fechaEjecucion: null,
				alcances: [
					{
						...reporte().alcances[0],
						estadoVerificacion: 'con_observacion',
						observaciones: ''
					}
				]
			}),
			espera: 60_000,
			enviar
		});
		await expect
			.element(page.getByRole('button', { name: 'Faltan 2', exact: true }))
			.toBeInTheDocument();

		await page.getByRole('button', { name: 'Enviar a revisión' }).click();
		const titulo = page.getByRole('heading', { name: 'Faltan 2 datos para enviar a revisión' });
		await expect.element(titulo).toHaveFocus();
		expect(enviar).not.toHaveBeenCalled();
		await expect.element(page.getByText('Borrador', { exact: true })).toBeInTheDocument();
		// Tras intentar enviar, cada campo muestra su error junto a él.
		await expect
			.element(page.getByLabelText('Observaciones'))
			.toHaveAttribute('aria-invalid', 'true');

		await page
			.getByRole('link', { name: 'El alcance 2.1 está «Con observación»: capture la observación.' })
			.click();
		await expect.element(page.getByLabelText('Observaciones')).toHaveFocus();
		await page.getByRole('link', { name: /Capture la fecha completa/ }).click();
		await expect.element(page.getByLabelText(/Fecha de ejecución/)).toHaveFocus();
	});

	it('muestra el error de la fecha al salir del campo, con el rango permitido', async () => {
		render(EditorReporte, { reporte: reporte(), espera: 60_000, enviar: sinRespuesta });
		const fecha = page.getByLabelText('Fecha de ejecución (mayo 2026)');
		await expect.element(fecha).toHaveAttribute('aria-invalid', 'false');

		await fecha.fill('2026-06-02');
		await page.getByLabelText('Tipo de mantenimiento').click();
		const error = page.getByText(/debe estar dentro del periodo del reporte \(del 1 de mayo al 31/);
		await expect.element(error).toBeInTheDocument();
		await expect.element(fecha).toHaveAttribute('aria-invalid', 'true');
		await expect
			.element(fecha)
			.toHaveAttribute('aria-describedby', expect.stringContaining('error-fecha'));
	});

	it('ofrece «Hoy» solo dentro del periodo y muestra el rango permitido', async () => {
		const { unmount } = render(EditorReporte, {
			reporte: reporte({ fechaEjecucion: null }),
			hoy: '2026-05-20',
			espera: 60_000,
			enviar: sinRespuesta
		});
		await page.getByRole('button', { name: 'Hoy' }).click();
		await expect.element(page.getByLabelText(/Fecha de ejecución/)).toHaveValue('2026-05-20');
		unmount();

		render(EditorReporte, {
			reporte: reporte({ fechaEjecucion: null }),
			hoy: '2026-10-21',
			espera: 60_000,
			enviar: sinRespuesta
		});
		expect(page.getByRole('button', { name: 'Hoy' }).elements()).toHaveLength(0);
		await expect
			.element(page.getByText('Periodo: del 1 al 31 de mayo de 2026'))
			.toBeInTheDocument();
	});

	it('muestra la hora del último guardado y, si falla, permite reintentar sin perder lo escrito', async () => {
		const enviar = vi
			.fn<EnviarAccion>()
			.mockResolvedValueOnce({
				ok: false,
				estado: 0,
				datos: { error: 'Sin conexión con el servidor; se reintentará al seguir editando.' }
			})
			.mockResolvedValue({ ok: true, datos: { reporte: { ...reporte(), version: 4 } } });
		render(EditorReporte, { reporte: reporte(), espera: 10, enviar });

		await page.getByLabelText('Conclusiones', { exact: true }).fill('Texto nuevo');
		await expect.element(page.getByText('No se guardó', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText(/Sin conexión con el servidor/)).toBeInTheDocument();
		// Tras un fallo no se reintenta solo en bucle.
		await new Promise((r) => setTimeout(r, 100));
		expect(enviar).toHaveBeenCalledTimes(1);

		await page.getByRole('button', { name: 'Reintentar' }).click();
		await expect.element(page.getByText('hace un momento')).toBeInTheDocument();
		expect(enviar).toHaveBeenCalledTimes(2);
		expect(JSON.parse(String(enviar.mock.calls[1][1].get('reporte')))).toMatchObject({
			conclusiones: 'Texto nuevo'
		});
		await expect
			.element(page.getByLabelText('Conclusiones', { exact: true }))
			.toHaveValue('Texto nuevo');
	});

	it('el índice marca la completitud y lleva al alcance elegido', async () => {
		render(EditorReporte, {
			reporte: reporte({
				objetivo: '',
				alcances: [
					reporte().alcances[0],
					{ ...reporte().alcances[0], id: ID(11), titulo: '', orden: 2 }
				]
			}),
			espera: 60_000,
			enviar: sinRespuesta
		});
		const indice = page.getByRole('navigation', { name: 'Secciones del reporte' });
		await expect.element(indice).toHaveTextContent(/1\. Objetivo.*1 pendiente/);
		await expect.element(indice).toHaveTextContent(/Encabezado, completo/);
		await expect.element(indice).toHaveTextContent(/2\.2 Sin título.*1 pendiente/);

		// En pantallas angostas el índice se despliega con su botón.
		const alternar = page.getByRole('button', { name: /^Secciones/ });
		if ((alternar.element() as HTMLElement).offsetParent) await alternar.click();
		await indice.getByRole('link', { name: /2\.2 Sin título/ }).click();
		expect(document.activeElement?.id).toBe(`alcance-${ID(11)}`);
	});

	it('las firmas se muestran como resumen con «Editar» y se abren solas si falta un dato', async () => {
		const enviar = vi.fn<EnviarAccion>(async () => ({
			ok: true as const,
			datos: { reporte: { ...reporte(), version: 4 } }
		}));
		const { unmount } = render(EditorReporte, { reporte: reporte(), espera: 10, enviar });
		const firmas = page.getByRole('region', { name: 'Firmas' });
		await expect.element(firmas).toHaveTextContent(/Elaboró\s*Uno/);
		expect(firmas.getByRole('textbox').elements()).toHaveLength(0);

		await firmas.getByRole('button', { name: 'Editar' }).click();
		await firmas.getByLabelText('Cargo').first().fill('Supervisor');
		await vi.waitFor(() => expect(enviar).toHaveBeenCalled());
		expect(
			JSON.parse(String(enviar.mock.calls.at(-1)?.[1].get('reporte'))).firmantes.elaboro
		).toMatchObject({ cargo: 'Supervisor' });
		unmount();

		render(EditorReporte, {
			reporte: reporte({
				firmantes: { ...reporte().firmantes, aprobo: { nombre: '', cargo: '', empresa: '' } }
			}),
			espera: 60_000,
			enviar: sinRespuesta
		});
		const abiertas = page.getByRole('region', { name: 'Firmas' });
		await expect.element(abiertas).toHaveTextContent('1 pendiente');
		await expect.element(abiertas.getByLabelText('Nombre').nth(1)).toBeInTheDocument();
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
		// Estado con icono y texto; el mes de la fecha en formato de oración.
		await expect.element(page.getByText('Emitido', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Fecha de ejecución (mayo 2026)')).toBeDisabled();
	});
});
