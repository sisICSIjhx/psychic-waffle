import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Foto, Reporte } from '$lib/dominio/esquemas';
import Notificaciones from '$lib/components/ui/Notificaciones.svelte';
import type { EnviarAccion } from './acciones';
import EditorReporte from './EditorReporte.svelte';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const SIN_DIAS: Partial<Reporte> = {
	fechaEjecucion: null,
	fechaEjecucionFin: null,
	diasEjecucion: []
};

function reporte(cambios: Partial<Reporte> = {}): Reporte {
	return {
		id: ID(1),
		contratoId: ID(2),
		sitioId: ID(3),
		partidaId: ID(4),
		periodoMes: '2026-05-01',
		ocurrencia: null,
		fechaEjecucion: '2026-05-18',
		fechaEjecucionFin: '2026-05-18',
		diasEjecucion: [{ desde: '2026-05-18', hasta: '2026-05-18' }],
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
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte(),
			espera: 60_000,
			enviar: sinRespuesta
		});
		const casilla = page.getByRole('checkbox', { name: 'Incluir tabla de verificación' });

		await casilla.click();
		await expect.element(page.getByRole('alertdialog')).toBeInTheDocument();
		await expect.element(casilla).toBeChecked();

		await page.getByRole('button', { name: 'Omitir la tabla' }).click();
		await expect.element(casilla).not.toBeChecked();
		const verificacion = page.getByRole('radiogroup', { name: 'Verificación del alcance 2.1' });
		await expect.element(verificacion).not.toBeInTheDocument();

		// Al volver a activarla, el estado capturado sigue ahí.
		await casilla.click();
		await expect
			.element(verificacion.getByRole('radio', { name: 'OK' }))
			.toHaveAttribute('aria-checked', 'true');
	});

	it('al enviar con datos faltantes muestra el resumen enlazado y no cambia el estado', async () => {
		const enviar = vi.fn<EnviarAccion>(sinRespuesta);
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({
				...SIN_DIAS,
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
		await page.getByRole('link', { name: 'Capture los días de ejecución.' }).click();
		await expect.element(page.getByLabelText(/Días de ejecución/)).toHaveFocus();
	});

	it('analiza los días escritos, muestra la vista previa y normaliza al salir', async () => {
		const enviar = vi.fn<EnviarAccion>(sinRespuesta);
		render(EditorReporte, { conImagenes: false, reporte: reporte(), espera: 60_000, enviar });
		const dias = page.getByLabelText('Días de ejecución (mayo 2026)');
		await expect.element(dias).toHaveValue('18');
		await expect.element(dias).toHaveAttribute('aria-invalid', 'false');

		await dias.fill('15 y 16, 20 al 25');
		await expect
			.element(page.getByText('En el documento: 15, 16, 20-25 / MAYO / 2026'))
			.toBeInTheDocument();
		await page.getByLabelText('Tipo de mantenimiento').click();
		await expect.element(dias).toHaveValue('15, 16, 20-25');

		await dias.fill('05-08/ MAYO /2026');
		await expect
			.element(page.getByText('En el documento: 05-08 / MAYO / 2026'))
			.toBeInTheDocument();
	});

	it('con un texto inválido conserva los días guardados, marca el campo y cuenta el pendiente', async () => {
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte(),
			espera: 60_000,
			enviar: sinRespuesta
		});
		const dias = page.getByLabelText('Días de ejecución (mayo 2026)');
		await dias.fill('05-08, 07');
		await expect.element(page.getByText('El día 07 se repite.')).toBeInTheDocument();
		await expect.element(dias).toHaveAttribute('aria-invalid', 'true');
		await dias.fill('18, 2O');
		await page.getByLabelText('Tipo de mantenimiento').click();
		await expect.element(dias).toHaveValue('18, 2O');
		await expect
			.element(page.getByRole('button', { name: 'Faltan 1', exact: true }))
			.toBeInTheDocument();
		const boton = page.getByRole('button', { name: 'Descargar DOCX' });
		await expect.element(boton).toHaveAccessibleDescription('Corrija los días de ejecución');
		await dias.fill('18, 20');
		await expect.element(page.getByRole('link', { name: 'Descargar DOCX' })).toBeInTheDocument();
	});

	it('señala los días fuera del periodo al salir del campo', async () => {
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({
				ocurrencia: { tipo: 'semana', numero: 2 },
				diasEjecucion: [{ desde: '2026-05-04', hasta: '2026-05-04' }]
			}),
			espera: 60_000,
			enviar: sinRespuesta
		});
		const dias = page.getByLabelText(/Días de ejecución/);
		await dias.fill('04-06, 11, 12');
		await page.getByLabelText('Tipo de mantenimiento').click();
		await expect
			.element(
				page.getByText('Días fuera del periodo del reporte (del 4 al 10 de mayo de 2026): 11, 12.')
			)
			.toBeInTheDocument();
		await expect
			.element(dias)
			.toHaveAttribute('aria-describedby', expect.stringContaining('error-fecha'));
	});

	it('ofrece «Agregar hoy» dentro del periodo y «Todo el periodo» con «Deshacer»', async () => {
		render(Notificaciones);
		const { unmount } = render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({
				diasEjecucion: [
					{ desde: '2026-05-15', hasta: '2026-05-15' },
					{ desde: '2026-05-16', hasta: '2026-05-16' }
				]
			}),
			hoy: '2026-05-21',
			espera: 60_000,
			enviar: sinRespuesta
		});
		const dias = page.getByLabelText(/Días de ejecución/);
		await page.getByRole('button', { name: 'Agregar hoy' }).click();
		await expect.element(dias).toHaveValue('15, 16, 21');
		expect(page.getByRole('button', { name: 'Agregar hoy' }).elements()).toHaveLength(0);
		await page.getByRole('button', { name: 'Todo el periodo' }).click();
		await expect.element(dias).toHaveValue('01-31');
		await page.getByRole('button', { name: 'Deshacer' }).click();
		await expect.element(dias).toHaveValue('15, 16, 21');
		unmount();

		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte(SIN_DIAS),
			hoy: '2026-10-21',
			espera: 60_000,
			enviar: sinRespuesta
		});
		expect(page.getByRole('button', { name: 'Agregar hoy' }).elements()).toHaveLength(0);
		await expect
			.element(page.getByText(/Periodo: del 1 al 31 de mayo de 2026/))
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
		render(EditorReporte, { conImagenes: false, reporte: reporte(), espera: 10, enviar });

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
			conImagenes: false,
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
		const { unmount } = render(EditorReporte, {
			conImagenes: false,
			reporte: reporte(),
			espera: 10,
			enviar
		});
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
			conImagenes: false,
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
		render(EditorReporte, { conImagenes: false, reporte: reporte(), espera: 10, enviar });

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
			conImagenes: false,
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
			conImagenes: false,
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
		await expect.element(page.getByLabelText('Días de ejecución (mayo 2026)')).toBeDisabled();
	});
});

const alcanceBase = () => reporte().alcances[0];

function foto(n: number, alcanceId = ID(10)): Foto {
	return {
		id: ID(100 + n),
		alcanceId,
		orden: n,
		descripcion: `Foto ${n}`,
		momento: null,
		rutaOriginal: '',
		rutaOptimizada: '',
		ancho: 640,
		alto: 480,
		bytes: 1000,
		tipoMime: 'image/jpeg',
		rotacion: 0
	};
}

/** Respuesta correcta de «guardar»; las demás acciones no se esperan en estas pruebas. */
const guardadoCorrecto = () =>
	vi.fn<EnviarAccion>(async () => ({
		ok: true as const,
		datos: { reporte: { ...reporte(), version: 4 } }
	}));

const enviado = (enviar: ReturnType<typeof guardadoCorrecto>, llamada = -1) =>
	JSON.parse(String(enviar.mock.calls.at(llamada)?.[1].get('reporte')));

describe('EditorReporte: verificación, fotos y acciones', () => {
	it('la verificación se elige con un clic y las observaciones aparecen cuando hacen falta', async () => {
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({
				alcances: [
					{ ...alcanceBase(), estadoVerificacion: 'pendiente' },
					{
						...alcanceBase(),
						id: ID(11),
						orden: 2,
						titulo: 'Dos',
						estadoVerificacion: 'ok',
						observaciones: 'Nota previa'
					}
				]
			}),
			espera: 60_000,
			enviar: sinRespuesta
		});
		// Solo el alcance con texto previo muestra el campo, aunque esté en OK.
		await expect
			.element(page.getByLabelText('Observaciones', { exact: true }))
			.toHaveValue('Nota previa');
		expect(page.getByLabelText(/^Observaciones/).elements()).toHaveLength(1);

		const primero = page.getByRole('radiogroup', { name: 'Verificación del alcance 2.1' });
		await primero.getByRole('radio', { name: 'Con observación' }).click();
		await expect
			.element(primero.getByRole('radio', { name: 'Con observación' }))
			.toHaveAttribute('aria-checked', 'true');
		await expect.element(page.getByLabelText('Observaciones (obligatorias)')).toBeRequired();
	});

	it('quitar una foto ofrece deshacer y la conserva en el guardado hasta decidir', async () => {
		render(Notificaciones);
		const enviar = guardadoCorrecto();
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({ alcances: [{ ...alcanceBase(), fotos: [foto(1), foto(2)] }] }),
			espera: 10,
			enviar,
			plazoDeshacer: 60_000
		});

		await page.getByRole('button', { name: 'Quitar la Ilustración 2.1.1' }).click();
		await expect.element(page.getByText('Se quitó la Ilustración 2.1.1.')).toBeInTheDocument();
		// La que queda se renumera mientras tanto.
		await expect
			.element(page.getByLabelText('Descripción de la Ilustración 2.1.1'))
			.toHaveValue('Foto 2');

		// Un autoguardado en ese tiempo todavía la incluye.
		await page.getByLabelText('Conclusiones', { exact: true }).fill('Otra conclusión');
		await vi.waitFor(() => expect(enviar).toHaveBeenCalled());
		expect(enviado(enviar).alcances[0].fotos.map((f: Foto) => f.id)).toEqual([ID(101), ID(102)]);

		await page.getByRole('button', { name: 'Deshacer' }).click();
		await expect
			.element(page.getByLabelText('Descripción de la Ilustración 2.1.1'))
			.toHaveValue('Foto 1');
		await expect
			.element(page.getByLabelText('Descripción de la Ilustración 2.1.2'))
			.toHaveValue('Foto 2');
	});

	it('al vencer el plazo la foto se quita y se guarda sin ella', async () => {
		const enviar = guardadoCorrecto();
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({ alcances: [{ ...alcanceBase(), fotos: [foto(1), foto(2)] }] }),
			espera: 10,
			enviar,
			plazoDeshacer: 50
		});
		await page.getByRole('button', { name: 'Quitar la Ilustración 2.1.2' }).click();
		await vi.waitFor(() =>
			expect(enviado(enviar).alcances[0].fotos.map((f: Foto) => f.id)).toEqual([ID(101)])
		);
	});

	it('enviar a revisión y salir aplican antes lo quitado', async () => {
		const enviar = guardadoCorrecto();
		const dosAlcances = () =>
			reporte({
				alcances: [alcanceBase(), { ...alcanceBase(), id: ID(11), orden: 2, titulo: 'Dos' }]
			});
		const { component, unmount } = render(EditorReporte, {
			conImagenes: false,
			reporte: dosAlcances(),
			espera: 60_000,
			enviar,
			plazoDeshacer: 60_000
		});
		await page.getByRole('button', { name: 'Quitar el alcance 2.2' }).click();
		expect(component.hayCambiosPendientes()).toBe(true);
		expect(await component.guardarAhora()).toBe(true);
		expect(enviado(enviar).alcances.map((a: { id: string }) => a.id)).toEqual([ID(10)]);
		unmount();

		const enviar2 = guardadoCorrecto();
		render(EditorReporte, {
			conImagenes: false,
			reporte: dosAlcances(),
			espera: 60_000,
			enviar: enviar2,
			plazoDeshacer: 60_000
		});
		await page.getByRole('button', { name: 'Quitar el alcance 2.2' }).click();
		await page.getByRole('button', { name: 'Enviar a revisión' }).click();
		await vi.waitFor(() => expect(enviar2).toHaveBeenCalledTimes(2));
		expect(enviar2.mock.calls[0][0]).toBe('guardar');
		expect(enviado(enviar2, 0).alcances.map((a: { id: string }) => a.id)).toEqual([ID(10)]);
		expect(enviar2.mock.calls[1][0]).toBe('estado');
	});

	it('muestra el avance de la carga por archivo e informa el rechazo sin detener las demás', async () => {
		let liberar: () => void = () => {};
		let siguiente = 1;
		const enviar = vi.fn<EnviarAccion>(async (accion, datos) => {
			if (accion !== 'fotos') {
				return { ok: true as const, datos: { reporte: { ...reporte(), version: 4 } } };
			}
			await new Promise<void>((r) => (liberar = r));
			const archivo = datos.get('archivo') as File;
			if (archivo.name.endsWith('.pdf')) {
				return {
					ok: false as const,
					estado: 400,
					datos: { error: 'El archivo no es una foto JPEG, PNG o HEIC.' }
				};
			}
			return {
				ok: true as const,
				datos: { fotos: [foto(siguiente++)], rechazadas: [], version: 5 }
			};
		});
		render(EditorReporte, { conImagenes: false, reporte: reporte(), espera: 60_000, enviar });

		const datos = new DataTransfer();
		for (const nombre of ['a.jpg', 'b.pdf', 'c.jpg']) {
			datos.items.add(
				new File(['x'], nombre, {
					type: nombre.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
				})
			);
		}
		const zona = page.getByRole('group', { name: 'Fotos del alcance 2.1' }).element();
		zona.dispatchEvent(
			new DragEvent('drop', { dataTransfer: datos, bubbles: true, cancelable: true })
		);

		const llamadasFotos = () => enviar.mock.calls.filter(([accion]) => accion === 'fotos').length;
		for (const paso of [1, 2, 3]) {
			await vi.waitFor(() => expect(llamadasFotos()).toBe(paso));
			await expect.element(page.getByText(`Cargando ${paso} de 3…`)).toBeInTheDocument();
			liberar();
		}
		await expect.element(page.getByText(/Cargando/)).not.toBeInTheDocument();
		await expect
			.element(page.getByText('b.pdf: El archivo no es una foto JPEG, PNG o HEIC.'))
			.toBeInTheDocument();
		await expect.element(page.getByText('Ilustración 2.1.2', { exact: true })).toBeInTheDocument();
	});

	it('emite con un diálogo propio; Esc no emite y devuelve el foco a «Emitir»', async () => {
		const enviar = vi.fn<EnviarAccion>(async () => ({
			ok: true as const,
			datos: { reporte: { ...reporte(), estado: 'emitido', version: 5 } }
		}));
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({
				estado: 'en_revision',
				alcances: [{ ...alcanceBase(), fotos: [foto(1)] }]
			}),
			espera: 60_000,
			enviar
		});
		const emitir = page.getByRole('button', { name: 'Emitir', exact: true });
		await emitir.click();
		const dialogo = page.getByRole('dialog', { name: '¿Emitir el reporte?' });
		await expect.element(dialogo).toHaveTextContent('Revisión 0 · 1 foto');
		await expect.element(dialogo.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

		await userEvent.keyboard('{Escape}');
		await expect.element(dialogo).not.toBeInTheDocument();
		expect(enviar).not.toHaveBeenCalled();
		await expect.element(emitir).toHaveFocus();

		await emitir.click();
		await dialogo.getByRole('button', { name: 'Emitir' }).click();
		await vi.waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
		expect(enviar.mock.calls[0][0]).toBe('estado');
		expect(enviar.mock.calls[0][1].get('estado')).toBe('emitido');
	});

	it('al cerrar la pestaña dentro del plazo aplica lo quitado y lo guarda igual', async () => {
		const alCerrar = vi.fn();
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({ alcances: [{ ...alcanceBase(), fotos: [foto(1), foto(2)] }] }),
			espera: 60_000,
			enviar: sinRespuesta,
			plazoDeshacer: 60_000,
			alCerrar
		});
		window.dispatchEvent(new PageTransitionEvent('pagehide'));
		expect(alCerrar).not.toHaveBeenCalled();

		await page.getByRole('button', { name: 'Quitar la Ilustración 2.1.1' }).click();
		window.dispatchEvent(new PageTransitionEvent('pagehide'));
		expect(alCerrar).toHaveBeenCalledTimes(1);
		const [accion, datos, ruta] = alCerrar.mock.calls[0];
		expect([accion, ruta]).toEqual(['guardar', RUTA]);
		expect(
			JSON.parse(String(datos.get('reporte'))).alcances[0].fotos.map((f: Foto) => f.id)
		).toEqual([ID(102)]);
	});

	it('una sección abierta por un pendiente no se cierra mientras se escribe', async () => {
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({ objetivo: '' }),
			espera: 60_000,
			enviar: sinRespuesta
		});
		const objetivo = page.getByLabelText('Objetivo', { exact: true });
		await objetivo.fill('Nuevo objetivo');
		await expect.element(objetivo).toHaveFocus();
		await page
			.getByRole('region', { name: '1. Objetivo' })
			.getByRole('button', { name: 'Listo' })
			.click();
		await expect
			.element(page.getByRole('region', { name: '1. Objetivo' }))
			.toHaveTextContent('Nuevo objetivo');
	});

	it('si el reporte no se pudo guardar antes de subir una foto, la informa como no cargada', async () => {
		const enviar = vi.fn<EnviarAccion>(async () => ({
			ok: false as const,
			estado: 0,
			datos: { error: 'Sin conexión con el servidor; se reintentará al seguir editando.' }
		}));
		render(EditorReporte, { conImagenes: false, reporte: reporte(), espera: 60_000, enviar });
		await page.getByLabelText('Conclusiones', { exact: true }).fill('Cambio sin guardar');
		const datos = new DataTransfer();
		datos.items.add(new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
		page
			.getByRole('group', { name: 'Fotos del alcance 2.1' })
			.element()
			.dispatchEvent(
				new DragEvent('drop', { dataTransfer: datos, bubbles: true, cancelable: true })
			);
		await expect
			.element(page.getByText(/a\.jpg: No se subió porque el reporte no se pudo guardar/))
			.toBeInTheDocument();
		expect(enviar.mock.calls.some(([accion]) => accion === 'fotos')).toBe(false);
	});

	it('reintenta solo el guardado fallido cuando vuelve la red', async () => {
		const enviar = vi
			.fn<EnviarAccion>()
			.mockResolvedValueOnce({ ok: false, estado: 0, datos: { error: 'Sin conexión' } })
			.mockResolvedValue({ ok: true, datos: { reporte: { ...reporte(), version: 4 } } });
		render(EditorReporte, { conImagenes: false, reporte: reporte(), espera: 10, enviar });
		await page.getByLabelText('Conclusiones', { exact: true }).fill('Escrito sin red');
		await expect.element(page.getByText('No se guardó', { exact: true })).toBeInTheDocument();

		window.dispatchEvent(new Event('online'));
		await expect.element(page.getByText('hace un momento')).toBeInTheDocument();
		expect(enviar).toHaveBeenCalledTimes(2);
	});

	it('soltar archivos fuera de una zona de fotos no abre el archivo', async () => {
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte(),
			espera: 60_000,
			enviar: sinRespuesta
		});
		const datos = new DataTransfer();
		datos.items.add(new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
		const evento = new DragEvent('drop', { dataTransfer: datos, bubbles: true, cancelable: true });
		document.body.dispatchEvent(evento);
		expect(evento.defaultPrevented).toBe(true);
	});

	it('«Descargar DOCX» siempre está a la vista y sin días dice por qué no se puede', async () => {
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte(SIN_DIAS),
			espera: 60_000,
			enviar: sinRespuesta
		});
		const boton = page.getByRole('button', { name: 'Descargar DOCX' });
		await expect.element(boton).toBeDisabled();
		await expect.element(boton).toHaveAccessibleDescription('Indique los días de ejecución');
		expect(page.getByRole('link', { name: 'Descargar DOCX' }).elements()).toHaveLength(0);
	});
});

describe('EditorReporte: vista ampliada y reemplazo de fotos', () => {
	const tresFotos = () =>
		reporte({
			alcances: [{ ...alcanceBase(), fotos: [foto(1), { ...foto(2), momento: 'antes' }, foto(3)] }]
		});

	/** Elige un archivo en el campo oculto de «Reemplazar» de la foto `n`. */
	function elegirReemplazo(n: number, nombre = 'nueva.jpg') {
		const entrada = document.querySelector(
			`[data-foto="${ID(100 + n)}"] input[type=file]`
		) as HTMLInputElement;
		const datos = new DataTransfer();
		datos.items.add(new File(['x'], nombre, { type: 'image/jpeg' }));
		entrada.files = datos.files;
		entrada.dispatchEvent(new Event('change', { bubbles: true }));
	}

	/** «guardar» correcto y «fotos» que devuelve la foto 9 (o la rechaza), cuando se libera. */
	function conCarga({ rechazar = false } = {}) {
		let liberar: () => void = () => {};
		const espera = new Promise<void>((r) => (liberar = r));
		const enviar = vi.fn<EnviarAccion>(async (accion) => {
			if (accion !== 'fotos') {
				return { ok: true as const, datos: { reporte: { ...reporte(), version: 4 } } };
			}
			await espera;
			return {
				ok: true as const,
				datos: rechazar
					? {
							fotos: [],
							rechazadas: [{ nombre: 'nueva.jpg', motivo: 'El archivo está dañado.' }],
							version: 4
						}
					: { fotos: [{ ...foto(9), descripcion: '' }], rechazadas: [], version: 5 }
			};
		});
		return { enviar, liberar: () => liberar() };
	}

	const idsGuardados = (enviar: ReturnType<typeof conCarga>['enviar']) =>
		enviado(enviar as unknown as ReturnType<typeof guardadoCorrecto>).alcances[0].fotos.map(
			(f: Foto) => f.id
		);

	it('quitar desde la vista muestra la siguiente y su propio «Deshacer»', async () => {
		render(Notificaciones);
		render(EditorReporte, {
			conImagenes: false,
			reporte: tresFotos(),
			espera: 60_000,
			enviar: sinRespuesta,
			plazoDeshacer: 60_000
		});
		await page.getByRole('button', { name: 'Ampliar la Ilustración 2.1.2' }).click();
		const vista = page.getByRole('dialog');
		await expect.element(vista).toHaveTextContent('2 de 3');
		await vista.getByRole('button', { name: 'Quitar' }).click();
		// La que ocupaba su lugar se muestra y se renumera.
		await expect.element(vista).toHaveTextContent('2 de 2');
		await expect
			.element(vista.getByLabelText('Descripción de la Ilustración 2.1.2'))
			.toHaveValue('Foto 3');
		await expect.element(vista.getByText('Se quitó la Ilustración 2.1.2.')).toBeInTheDocument();

		await vista.getByRole('button', { name: 'Deshacer' }).click();
		await expect.element(vista).toHaveTextContent('2 de 3');
		await expect
			.element(vista.getByLabelText('Descripción de la Ilustración 2.1.2'))
			.toHaveValue('Foto 2');
		await expect.element(vista.getByText('Se quitó la Ilustración 2.1.2.')).not.toBeInTheDocument();
	});

	it('girar desde la tarjeta o la vista se autoguarda con la rotación', async () => {
		const enviar = guardadoCorrecto();
		render(EditorReporte, {
			conImagenes: false,
			reporte: tresFotos(),
			espera: 10,
			enviar
		});
		await page.getByRole('button', { name: 'Girar a la derecha la Ilustración 2.1.1' }).click();
		await vi.waitFor(() =>
			expect(enviado(enviar).alcances[0].fotos.map((f: Foto) => f.rotacion)).toEqual([90, 0, 0])
		);
		await page.getByRole('button', { name: 'Ampliar la Ilustración 2.1.3' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Girar a la izquierda' }).click();
		await vi.waitFor(() =>
			expect(enviado(enviar).alcances[0].fotos.map((f: Foto) => f.rotacion)).toEqual([90, 0, 270])
		);
	});

	it('quitar la única foto cierra la vista, enfoca «Agregar fotos» y deja la notificación', async () => {
		render(Notificaciones);
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({ alcances: [{ ...alcanceBase(), fotos: [foto(1)] }] }),
			espera: 60_000,
			enviar: sinRespuesta,
			plazoDeshacer: 60_000
		});
		await page.getByRole('button', { name: 'Ampliar la Ilustración 2.1.1' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Quitar' }).click();
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(page.getByLabelText('Agregar fotos')).toHaveFocus();
		await expect.element(page.getByText('Se quitó la Ilustración 2.1.1.')).toBeInTheDocument();
	});

	it('reemplazar conserva posición, pie, descripción y espacio, y «Deshacer» lo revierte', async () => {
		render(Notificaciones);
		const { enviar, liberar } = conCarga();
		render(EditorReporte, {
			conImagenes: false,
			reporte: tresFotos(),
			espera: 10,
			enviar,
			plazoDeshacer: 60_000
		});
		elegirReemplazo(2);
		await expect.element(page.getByText('Reemplazando…')).toBeInTheDocument();
		await vi.waitFor(() => expect(enviar.mock.calls.some(([a]) => a === 'fotos')).toBe(true));
		const subida = enviar.mock.calls.find(([a]) => a === 'fotos')![1];
		expect([subida.get('alcanceId'), subida.get('momento')]).toEqual([ID(10), 'antes']);
		liberar();

		await expect.element(page.getByText('Se reemplazó la Ilustración 2.1.2.')).toBeInTheDocument();
		await expect.element(page.getByText('Reemplazando…')).not.toBeInTheDocument();
		const tarjetas = () =>
			[...document.querySelectorAll('.fotos-alcance .foto')].map((t) =>
				t.getAttribute('data-foto')
			);
		expect(tarjetas()).toEqual([ID(101), ID(109), ID(103)]);
		await expect
			.element(page.getByLabelText('Descripción de la Ilustración 2.1.2'))
			.toHaveValue('Foto 2');
		// El guardado lleva la nueva en su lugar; la anterior sigue hasta que venza el plazo.
		await vi.waitFor(() =>
			expect(idsGuardados(enviar)).toEqual([ID(101), ID(109), ID(102), ID(103)])
		);
		const nueva = enviado(enviar as never).alcances[0].fotos[1];
		expect([nueva.descripcion, nueva.momento]).toEqual(['Foto 2', 'antes']);

		await page.getByRole('button', { name: 'Deshacer' }).click();
		expect(tarjetas()).toEqual([ID(101), ID(102), ID(103)]);
		await vi.waitFor(() => expect(idsGuardados(enviar)).toEqual([ID(101), ID(102), ID(103)]));
	});

	it('un archivo rechazado deja intacta la foto anterior', async () => {
		const { enviar, liberar } = conCarga({ rechazar: true });
		render(EditorReporte, { conImagenes: false, reporte: tresFotos(), espera: 60_000, enviar });
		elegirReemplazo(2);
		liberar();
		await expect.element(page.getByText('nueva.jpg: El archivo está dañado.')).toBeInTheDocument();
		await expect
			.element(page.getByLabelText('Descripción de la Ilustración 2.1.2'))
			.toHaveValue('Foto 2');
		expect(document.querySelectorAll('.fotos-alcance .foto')).toHaveLength(3);
	});

	it('si la anterior se quitó mientras esperaba, la nueva queda al final con aviso', async () => {
		render(Notificaciones);
		const { enviar, liberar } = conCarga();
		render(EditorReporte, {
			conImagenes: false,
			reporte: tresFotos(),
			espera: 60_000,
			enviar,
			plazoDeshacer: 60_000
		});
		elegirReemplazo(1);
		await vi.waitFor(() => expect(enviar.mock.calls.some(([a]) => a === 'fotos')).toBe(true));
		await page.getByRole('button', { name: 'Quitar la Ilustración 2.1.1' }).click();
		liberar();
		await expect
			.element(page.getByText(/ya no estaba en su lugar; la foto nueva quedó al final/))
			.toBeInTheDocument();
		expect(
			[...document.querySelectorAll('.fotos-alcance .foto')].map((t) => t.getAttribute('data-foto'))
		).toEqual([ID(102), ID(103), ID(109)]);
	});
});

describe('EditorReporte: datos del contrato cambiados', () => {
	it('en un borrador ofrece actualizar y, al hacerlo, el aviso desaparece con el dato vigente', async () => {
		const enviar = vi.fn<EnviarAccion>(async (accion) => ({
			ok: true as const,
			datos: {
				reporte:
					accion === 'actualizarContrato'
						? { ...reporte(), contratoTexto: 'OC-CORREGIDA', version: 5 }
						: { ...reporte(), version: 4 }
			}
		}));
		render(EditorReporte, {
			conImagenes: false,
			reporte: reporte(),
			contratoCambiado: true,
			camposContrato: ['contrato'],
			espera: 60_000,
			enviar
		});
		await expect
			.element(page.getByText(/Los datos del contrato cambiaron \(número de contrato\)/))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Ver el contrato' }))
			.toHaveAttribute('href', `/catalogo/contratos/${ID(2)}`);
		await page.getByRole('button', { name: 'Actualizar datos del contrato' }).click();
		await vi.waitFor(() =>
			expect(enviar.mock.calls.some(([accion]) => accion === 'actualizarContrato')).toBe(true)
		);
		await expect
			.element(page.getByText(/Los datos del contrato cambiaron/))
			.not.toBeInTheDocument();
		await expect.element(page.getByText('OC-CORREGIDA').first()).toBeInTheDocument();
	});

	it('en revisión solo indica regresarlo a borrador; un emitido no muestra el aviso', async () => {
		const { rerender } = render(EditorReporte, {
			conImagenes: false,
			reporte: reporte({ estado: 'en_revision' }),
			contratoCambiado: true,
			camposContrato: ['firmantes.aprobo'],
			espera: 60_000,
			enviar: sinRespuesta
		});
		await expect
			.element(page.getByText(/firma de aprobó.*regrese el reporte a borrador/s))
			.toBeInTheDocument();
		expect(
			page.getByRole('button', { name: 'Actualizar datos del contrato' }).elements()
		).toHaveLength(0);
		await rerender({ reporte: reporte({ estado: 'emitido' }) });
		await expect
			.element(page.getByText(/Los datos del contrato cambiaron/))
			.not.toBeInTheDocument();
	});
});
