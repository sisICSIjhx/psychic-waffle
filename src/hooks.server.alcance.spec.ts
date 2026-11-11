// Guardia de recursos por centro de costo en hooks.server.ts (cambio centros-costo-plantillas, D8):
// con el inicio de sesión activado, un reporte, partida, contrato o equipo de un centro de costo
// ajeno responde 404 antes de cualquier carga o acción.
import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const CENTRO_PROPIO = '00000000-0000-4000-8000-0000000000a1';
const CENTRO_AJENO = '00000000-0000-4000-8000-0000000000b2';
const REPORTE = '00000000-0000-4000-8000-000000000123';

const estado = vi.hoisted(() => ({
	centrosUsuario: null as string[] | null,
	centrosRecurso: [] as string[],
	consultas: [] as { tipo: string; id: string }[]
}));

vi.mock('$lib/server/datos', () => ({
	datos: async () => ({
		autenticacion: {
			contexto: async () => ({
				activada: true,
				usuario: {
					id: '00000000-0000-4000-8000-000000000001',
					nombre: 'Persona Ficticia',
					correo: 'persona@ficticio.test',
					rol: 'reporteador',
					debeCambiar: false,
					centrosCosto: estado.centrosUsuario
				}
			})
		},
		centrosCosto: {
			centrosDeRecurso: async (tipo: string, id: string) => {
				estado.consultas.push({ tipo, id });
				return estado.centrosRecurso;
			}
		}
	})
}));

const { handle } = await import('./hooks.server');
const { olvidarContextos } = await import('$lib/server/autenticacion/contexto');

const evento = (url: string, init: RequestInit = {}) =>
	({
		url: new URL(url),
		request: new Request(url, init),
		cookies: { get: () => undefined, delete: () => undefined },
		locals: {},
		isDataRequest: false
	}) as unknown as RequestEvent;

const pedir = (ruta: string, init: RequestInit = {}) =>
	handle({
		event: evento(`http://localhost${ruta}`, init),
		resolve: async () => new Response('ok')
	});

async function estadoDe(promesa: Response | Promise<Response>): Promise<number> {
	try {
		return (await promesa).status;
	} catch (error) {
		return (error as { status: number }).status;
	}
}

beforeEach(() => {
	olvidarContextos();
	estado.consultas = [];
	estado.centrosUsuario = [CENTRO_PROPIO];
	estado.centrosRecurso = [];
});

describe('recursos fuera del alcance', () => {
	it('un reporte de un centro de costo ajeno responde 404, también su documento y sus fotos', async () => {
		estado.centrosRecurso = [CENTRO_AJENO];
		expect(await estadoDe(pedir(`/reportes/${REPORTE}`))).toBe(404);
		expect(await estadoDe(pedir(`/reportes/${REPORTE}/documento`))).toBe(404);
		expect(await estadoDe(pedir(`/reportes/${REPORTE}/fotos/${REPORTE}?tamano=mini`))).toBe(404);
		expect(estado.consultas[0]).toEqual({ tipo: 'reporte', id: REPORTE });
	});

	it('uno inexistente responde igual que uno ajeno', async () => {
		expect(await estadoDe(pedir(`/catalogo/partidas/${REPORTE}`))).toBe(404);
	});

	it('una acción de formulario recibe el error con la forma que espera', async () => {
		estado.centrosRecurso = [CENTRO_AJENO];
		const respuesta = await pedir(`/reportes/${REPORTE}?/guardar`, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' }
		});
		expect(respuesta.status).toBe(404);
		expect(await respuesta.json()).toMatchObject({ type: 'error', status: 404 });
	});

	it('lo de sus centros de costo pasa', async () => {
		estado.centrosRecurso = [CENTRO_AJENO, CENTRO_PROPIO];
		expect(await estadoDe(pedir(`/catalogo/contratos/${REPORTE}`))).toBe(200);
	});

	it('quien abarca todos los centros de costo no se consulta', async () => {
		estado.centrosUsuario = null;
		expect(await estadoDe(pedir(`/equipos/${REPORTE}`))).toBe(200);
		expect(estado.consultas).toEqual([]);
	});

	it('las rutas sin recurso no se consultan', async () => {
		expect(await estadoDe(pedir('/historial'))).toBe(200);
		expect(await estadoDe(pedir('/equipos/nuevo'))).toBe(200);
		expect(estado.consultas).toEqual([]);
	});
});
