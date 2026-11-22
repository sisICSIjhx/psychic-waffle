// Quién ve y quién llena el contrato y la cobranza, comprobado en la carga y en la acción sobre
// PGlite. Solo datos ficticios.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RolPersonal } from '$lib/dominio/esquemas';
import { decidirAcceso } from '$lib/server/autenticacion/acceso';
import { crearClientePglite } from '$lib/server/bd/pglite';
import { crearRepositorios, type Repositorios } from '$lib/server/repositorios/index';

let repos: Repositorios;
vi.mock('$lib/server/datos', () => ({ datos: async () => repos }));

const { load, actions } = await import('./+page.server');

const ENLACE = 'https://ejemplo.sharepoint.com/sites/prueba/programa';
let centro: string;
let ajeno: string;
let monto: string;
let cobrado: string;

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	const plantilla = await repos.centrosCosto.guardarPlantilla({
		nombre: 'ruta-cobranza',
		modoContrato: 'obligatorio',
		origenActividades: 'ninguno',
		conceptos: [
			{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto', indicador: 'monto_contrato' },
			{ etiqueta: 'Monto cobrado', bloque: 'contrato', tipo: 'monto', indicador: 'monto_cobrado' }
		]
	});
	const idDe = (indicador: string) =>
		plantilla.conceptos.find((c) => c.indicador === indicador)!.id;
	monto = idDe('monto_contrato');
	cobrado = idDe('monto_cobrado');
	const alta = (clave: string) =>
		repos.centrosCosto.guardar({ clave, nombre: clave, plantillaId: plantilla.id });
	centro = (await alta('ruta-cobranza-1')).id;
	ajeno = (await alta('ruta-cobranza-2')).id;
	await repos.contratoCobranza.guardar(centro, {
		accion: 'contrato',
		valores: [{ conceptoId: monto, valor: 5000 }]
	});
	await repos.contratoCobranza.guardar(centro, { accion: 'programa', enlace: ENLACE });
}, 60_000);
afterAll(() => repos.cerrar());

function locales(rol: RolPersonal | null, centrosCosto: string[] | null = null) {
	return rol
		? { autenticacion: true, usuario: { id: 'x', nombre: 'Ficticio', rol, centrosCosto } }
		: { autenticacion: false, usuario: null };
}

function evento(
	rol: RolPersonal | null,
	{ id = centro, centros = null as string[] | null, campos = null as object | null } = {}
) {
	const url = new URL(`http://localhost/cobranza?centro=${id}&anio=2026`);
	const cuerpo = new URLSearchParams(campos as Record<string, string>);
	return {
		locals: locales(rol, centros),
		url,
		request: new Request(url, { method: 'POST', body: cuerpo })
	} as never;
}

type Carga = Exclude<Awaited<ReturnType<typeof load>>, void>;
const cargar = async (...args: Parameters<typeof evento>) => (await load(evento(...args))) as Carga;
const guardar = (...args: Parameters<typeof evento>) => actions.guardar(evento(...args));

describe('/cobranza', () => {
	it('no muestra nada sin sesión ni a un rol sin acceso', async () => {
		await expect(cargar(null)).rejects.toMatchObject({ status: 403 });
		await expect(cargar('reporteador', { centros: [centro] })).rejects.toMatchObject({
			status: 403
		});
	});

	it('entrega a cada rol solo lo que puede ver', async () => {
		const operativo = await cargar('lider_operativo', { centros: [centro] });
		expect(operativo.detalle).toEqual({ plantillaId: expect.any(String), programaEnlace: ENLACE });
		expect(operativo).toMatchObject({ puedeEditarContrato: false, puedeEditarCobranza: false });
		// Sin el contrato a la vista tampoco viaja el resumen financiero ni su estatus.
		expect(operativo).toMatchObject({ estatus: null, idOrden: '', idAdicional: '' });

		const contabilidad = await cargar('contabilidad');
		expect(contabilidad.detalle).not.toHaveProperty('programaEnlace');
		expect(contabilidad.detalle?.contrato?.valores).toEqual([{ conceptoId: monto, valor: 5000 }]);
		expect(contabilidad).toMatchObject({ puedeEditarContrato: false, puedeEditarCobranza: true });
		// El resumen lleva el estatus del mes y la cobranza contra el monto del contrato.
		expect(contabilidad.estatus).toMatchObject({
			estatus: expect.any(String),
			cobranza: { clave: 'cobranza', valor: 0, total: 5000, esMonto: true },
			pasos: { estimacion: false, prefactura: false, factura: false, cobrado: false }
		});
		expect(contabilidad.idAdicional).toBe('');

		const mesa = await cargar('mesa_directiva');
		expect(mesa.detalle?.contrato).toBeDefined();
		expect(mesa.detalle?.programaEnlace).toBe(ENLACE);
		expect(mesa).toMatchObject({ puedeEditarContrato: false, puedeEditarCobranza: false });

		expect(await cargar('lider_administrativo', { centros: [centro] })).toMatchObject({
			puedeEditarContrato: true,
			puedeEditarCobranza: false
		});
	});

	it('responde 404 a un centro de costo ajeno, al consultar y al guardar', async () => {
		const ajena = { id: ajeno, centros: [centro] };
		await expect(cargar('lider_administrativo', ajena)).rejects.toMatchObject({ status: 404 });
		await expect(
			guardar('lider_administrativo', { ...ajena, campos: { accion: 'programa', enlace: ENLACE } })
		).rejects.toMatchObject({ status: 404 });
		expect((await cargar('administrador', { id: ajeno })).detalle?.programaEnlace).toBeNull();
	});

	it('solo contabilidad y el administrador llenan la cobranza; el contrato, quien lo administra', async () => {
		const cobranza = { accion: 'cobranza', 'estimacion-11': 'on', 'monto-11': '1200.50' };
		const contrato = { accion: 'contrato', [`tipo:${monto}`]: 'monto', [`valor:${monto}`]: '1' };
		for (const rol of ['mesa_directiva', 'lider_administrativo', 'lider_operativo'] as const) {
			expect(await guardar(rol, { centros: [centro], campos: cobranza })).toMatchObject({
				status: 403
			});
		}
		for (const rol of ['contabilidad', 'mesa_directiva', 'lider_operativo'] as const) {
			expect(await guardar(rol, { centros: [centro], campos: contrato })).toMatchObject({
				status: 403
			});
		}
		expect(await guardar(null, { campos: cobranza })).toMatchObject({ status: 403 });
		expect(await guardar('administrador', { campos: { accion: 'otra' } })).toMatchObject({
			status: 403
		});

		expect(await guardar('contabilidad', { campos: cobranza })).toEqual({
			mensaje: 'Cobranza guardada.'
		});
		expect(
			await guardar('lider_administrativo', {
				centros: [centro],
				campos: { ...contrato, [`valor:${monto}`]: '7500.25' }
			})
		).toEqual({ mensaje: 'Contrato guardado.' });
		const detalle = (await cargar('administrador')).detalle?.contrato;
		expect(detalle?.valores).toEqual([{ conceptoId: monto, valor: 7500.25 }]);
		expect(detalle?.cobranza).toEqual([
			{
				mes: '2026-11-01',
				estimacion: true,
				prefactura: false,
				factura: false,
				cobrado: false,
				montoCobrado: 1200.5
			}
		]);
		expect(
			await guardar('contabilidad', { campos: { accion: 'cobranza', 'monto-11': 'mucho' } })
		).toMatchObject({
			status: 400,
			data: {
				error:
					'Escriba el monto de noviembre con números, sin signos ni comas (por ejemplo, 15000.50).'
			}
		});
	});

	it('el monto cobrado del contrato sale de la cobranza mensual y no se captura a mano', async () => {
		// Lo que guardó contabilidad en la cobranza mensual es el cobrado del contrato y del resumen.
		const antes = await cargar('contabilidad');
		expect(antes.detalle?.contrato?.cobradoTotal).toBe(1200.5);
		expect(antes.estatus?.cobranza).toMatchObject({ valor: 1200.5, total: 7500.25 });

		// Quien administra el contrato no puede fijar lo cobrado: el valor enviado se ignora.
		expect(
			await guardar('lider_administrativo', {
				centros: [centro],
				campos: {
					accion: 'contrato',
					ancla: 'r-contrato',
					[`tipo:${monto}`]: 'monto',
					[`valor:${monto}`]: '7500.25',
					[`tipo:${cobrado}`]: 'monto',
					[`valor:${cobrado}`]: '999999'
				}
			})
		).toEqual({ mensaje: 'Contrato guardado.', ancla: 'r-contrato' });
		const despues = (await cargar('administrador')).detalle?.contrato;
		expect(despues?.valores).toEqual([{ conceptoId: monto, valor: 7500.25 }]);
		expect(despues?.cobradoTotal).toBe(1200.5);

		// Otro mes de cobranza cambia el cobrado; se suman todos los años.
		expect(
			await guardar('contabilidad', {
				campos: {
					accion: 'cobranza',
					ancla: 'r-cobranza',
					'estimacion-11': 'on',
					'monto-11': '1200.50',
					'monto-12': '300'
				}
			})
		).toEqual({ mensaje: 'Cobranza guardada.', ancla: 'r-cobranza' });
		const final = await cargar('mesa_directiva');
		expect(final.detalle?.contrato?.cobradoTotal).toBe(1500.5);
		expect(final.estatus?.cobranza).toMatchObject({ valor: 1500.5, total: 7500.25 });
	});

	it('administración registra los adicionales y solo contabilidad llena lo cobrado', async () => {
		const id = '00000000-0000-4000-8000-0000000000ad';
		const alta = {
			accion: 'nuevoAdicional',
			id,
			ordenCompra: 'OC-FICTICIA-1',
			descripcion: 'Trabajo extra',
			fechaSolicitud: '2026-11-03',
			periodoInicio: '',
			periodoFin: '',
			montoPactado: '800.50'
		};
		const cobro = { accion: 'cobroAdicional', id, montoCobrado: '300' };
		const adicionales = async () => (await cargar('administrador')).detalle?.contrato?.adicionales;

		// Contabilidad no da de alta, no edita lo pactado ni quita; los demás roles, nada.
		for (const rol of [
			'contabilidad',
			'mesa_directiva',
			'lider_operativo',
			'reporteador'
		] as const) {
			for (const accion of ['nuevoAdicional', 'editarAdicional', 'quitarAdicional']) {
				expect(
					await guardar(rol, { centros: [centro], campos: { ...alta, accion } })
				).toMatchObject({ status: 403 });
			}
		}
		expect(await adicionales()).toEqual([]);
		// El alta explica qué falta y devuelve lo escrito, para no perderlo sin JavaScript.
		const fallida = (campos: object) =>
			guardar('lider_administrativo', {
				centros: [centro],
				campos: { ...alta, ancla: 'r-adicionales', ...campos }
			});
		expect(await fallida({ ordenCompra: ' ' })).toMatchObject({
			status: 400,
			data: {
				error: 'Escriba la orden de compra.',
				ancla: 'r-adicionales',
				enviado: { ordenCompra: ' ', descripcion: 'Trabajo extra', montoPactado: '800.50' }
			}
		});
		expect(await fallida({ periodoInicio: '2026-11-10', periodoFin: '2026-11-01' })).toMatchObject({
			status: 400,
			data: { error: 'El fin de la ejecución no puede ser anterior al inicio.' }
		});
		expect(await fallida({ montoPactado: '1,500' })).toMatchObject({
			status: 400,
			data: {
				error: 'Escriba el monto con números, sin signos ni comas (por ejemplo, 15000.50).'
			}
		});
		expect(await adicionales()).toEqual([]);
		expect(await guardar('lider_administrativo', { centros: [centro], campos: alta })).toEqual({
			mensaje: 'Adicional registrado.'
		});
		expect(await adicionales()).toEqual([
			{
				id,
				ordenCompra: 'OC-FICTICIA-1',
				descripcion: 'Trabajo extra',
				fechaSolicitud: '2026-11-03',
				periodoInicio: null,
				periodoFin: null,
				montoPactado: 800.5,
				montoCobrado: null
			}
		]);

		// Quien registra el adicional no puede decir cuánto se cobró.
		for (const rol of ['lider_administrativo', 'mesa_directiva', 'lider_operativo'] as const) {
			expect(await guardar(rol, { centros: [centro], campos: cobro })).toMatchObject({
				status: 403
			});
		}
		// El resultado vuelve al lugar que envió el formulario; un ancla que no es de la página se descarta.
		const ancla = `r-cobro-${id}`;
		expect(await guardar('mesa_directiva', { campos: { ...cobro, ancla } })).toMatchObject({
			status: 403,
			data: { ancla }
		});
		expect(await guardar('contabilidad', { campos: { ...cobro, ancla } })).toEqual({
			mensaje: 'Cobro guardado.',
			ancla
		});
		expect(await guardar('contabilidad', { campos: { ...cobro, ancla: '"><script>' } })).toEqual({
			mensaje: 'Cobro guardado.'
		});
		expect(
			await guardar('contabilidad', { campos: { ...cobro, montoCobrado: '-5' } })
		).toMatchObject({ status: 400 });
		expect(await adicionales()).toMatchObject([{ montoPactado: 800.5, montoCobrado: 300 }]);
		// El adicional de un centro no se toca desde otro.
		await expect(guardar('contabilidad', { id: ajeno, campos: cobro })).rejects.toMatchObject({
			status: 404
		});
		// Con un cobro registrado ya no se puede quitar.
		expect(
			await guardar('lider_administrativo', {
				centros: [centro],
				campos: { accion: 'quitarAdicional', id }
			})
		).toMatchObject({ status: 409 });

		// Quien solo ve el enlace del programa no recibe adicionales ni montos.
		const operativo = await cargar('lider_operativo', { centros: [centro] });
		expect(operativo.detalle).not.toHaveProperty('contrato');
		expect(JSON.stringify(operativo.detalle)).not.toContain('OC-FICTICIA-1');
	});

	it('la guardia deja pasar a la acción a cualquier sesión y rechaza a quien no la tiene', () => {
		const peticion = { ruta: '/cobranza', busqueda: '', metodo: 'POST', navegacion: false };
		const con = (rol: RolPersonal | null) => ({
			activada: true,
			usuario: rol && {
				id: 'x',
				nombre: 'Ficticio',
				correo: 'x@ficticio.test',
				rol,
				debeCambiar: false,
				centrosCosto: null
			}
		});
		expect(decidirAcceso(con('contabilidad') as never, peticion)).toEqual({ tipo: 'permitir' });
		expect(decidirAcceso(con(null) as never, peticion)).toMatchObject({ estado: 401 });
	});
});
