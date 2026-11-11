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

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	const plantilla = await repos.centrosCosto.guardarPlantilla({
		nombre: 'ruta-cobranza',
		modoContrato: 'obligatorio',
		origenActividades: 'ninguno',
		conceptos: [{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto' }]
	});
	monto = plantilla.conceptos[0].id;
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

		const contabilidad = await cargar('contabilidad');
		expect(contabilidad.detalle).not.toHaveProperty('programaEnlace');
		expect(contabilidad.detalle?.contrato?.valores).toEqual([{ conceptoId: monto, valor: 5000 }]);
		expect(contabilidad).toMatchObject({ puedeEditarContrato: false, puedeEditarCobranza: true });

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

		expect(await guardar('contabilidad', { campos: cobranza })).toEqual({ mensaje: 'Guardado.' });
		expect(
			await guardar('lider_administrativo', {
				centros: [centro],
				campos: { ...contrato, [`valor:${monto}`]: '7500.25' }
			})
		).toEqual({ mensaje: 'Guardado.' });
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
		).toMatchObject({ status: 400 });
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
