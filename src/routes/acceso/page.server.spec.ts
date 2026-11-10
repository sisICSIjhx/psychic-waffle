// Entrar, salir y activar sobre PGlite, y la guardia de hooks.server.ts con sesiones reales. Solo
// nombres y correos ficticios.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearClientePglite } from '$lib/server/bd/pglite';
import { olvidarContextos } from '$lib/server/autenticacion/contexto';
import { COOKIE_SESION } from '$lib/server/autenticacion/sesiones';
import { generarContrasenaDe } from '$lib/server/autenticacion/servicio';
import { crearRepositorios, type Repositorios } from '$lib/server/repositorios/index';
import type { Personal, RolPersonal } from '$lib/dominio/esquemas';

let repos: Repositorios;
vi.mock('$lib/server/datos', () => ({ datos: async () => repos }));

const acceso = await import('./+page.server');
const configurar = await import('./configurar/+page.server');
const perfil = await import('../perfil/+page.server');
const fichaPersonal = await import('../personal/[id]/+page.server');
const { handle } = await import('../../hooks.server');

const CONTRASENA = 'contraseña del administrador';
let administrador: Personal;
let numero = 0;

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	administrador = await alta('administrador');
}, 60_000);

afterAll(() => repos.cerrar());
beforeEach(() => olvidarContextos());

function alta(rol: RolPersonal) {
	numero++;
	return repos.personal.guardar({
		nombre: `Persona${numero}`,
		apellidoPaterno: 'Ficticia',
		apellidoMaterno: null,
		fechaNacimiento: null,
		correo: `persona${numero}@ficticio.test`,
		rol,
		activo: true,
		clienteIds: []
	});
}

/** Cookies de una petición, como las de SvelteKit: guarda también las opciones con que se ponen. */
function galletas(iniciales: Record<string, string> = {}) {
	const valores = new Map(Object.entries(iniciales));
	const opciones = new Map<string, Record<string, unknown>>();
	return {
		valores,
		opciones,
		get: (nombre: string) => valores.get(nombre),
		set: (nombre: string, valor: string, o: Record<string, unknown>) => {
			valores.set(nombre, valor);
			opciones.set(nombre, o);
		},
		delete: (nombre: string) => void valores.delete(nombre)
	};
}

function evento(
	ruta: string,
	opciones: {
		metodo?: string;
		campos?: Record<string, string>;
		cookies?: ReturnType<typeof galletas>;
		locals?: App.Locals;
		encabezados?: Record<string, string>;
		params?: Record<string, string>;
	} = {}
) {
	const url = new URL(`http://localhost${ruta}`);
	const cuerpo = new FormData();
	for (const [campo, valor] of Object.entries(opciones.campos ?? {})) cuerpo.set(campo, valor);
	const metodo = opciones.metodo ?? (opciones.campos ? 'POST' : 'GET');
	return {
		url,
		request: new Request(url, {
			method: metodo,
			body: metodo === 'GET' ? undefined : cuerpo,
			headers: opciones.encabezados
		}),
		cookies: opciones.cookies ?? galletas(),
		locals: opciones.locals ?? {},
		params: opciones.params ?? {},
		isDataRequest: false,
		getClientAddress: () => '10.0.0.9'
	};
}

/** Lo que lanzan `redirect()` y `error()` de SvelteKit. */
async function lanzado(promesa: unknown): Promise<{ status: number; location?: string }> {
	try {
		await promesa;
	} catch (e) {
		return e as { status: number; location?: string };
	}
	throw new Error('Se esperaba una redirección o un error');
}

const entrar = (campos: Record<string, string>, cookies = galletas()) =>
	acceso.actions.entrar(evento('/acceso?/entrar', { campos, cookies }) as never);

describe('sin cuentas', () => {
	it('la guardia deja pasar todo y /acceso lleva a activar', async () => {
		const peticion = evento('/catalogo', { campos: { x: '1' } });
		const respuesta = await handle({
			event: peticion as never,
			resolve: async () => new Response('hecho')
		});
		expect(await respuesta.text()).toBe('hecho');
		expect(peticion.locals).toEqual({ autenticacion: false, usuario: null });
		expect(respuesta.headers.get('X-Frame-Options')).toBe('DENY');

		// La carga de /acceso no es asíncrona: la redirección se lanza al llamarla.
		const cargar = Promise.resolve().then(() => acceso.load(evento('/acceso') as never));
		expect(await lanzado(cargar)).toMatchObject({
			status: 303,
			location: '/acceso/configurar'
		});
	});

	it('la activación lista a los administradores con correo y crea la cuenta con sesión', async () => {
		await alta('reporteador');
		const datos = (await configurar.load(evento('/acceso/configurar') as never)) as {
			candidatos: { id: string; correo: string }[];
		};
		expect(datos.candidatos).toEqual([
			expect.objectContaining({ id: administrador.id, correo: administrador.correo })
		]);

		const corta = await configurar.actions.activar(
			evento('/acceso/configurar?/activar', {
				campos: { personalId: administrador.id, contrasena: 'corta', confirmacion: 'corta' }
			}) as never
		);
		expect(corta).toMatchObject({ status: 400, data: { personalId: administrador.id } });

		const cookies = galletas();
		const redireccion = await lanzado(
			configurar.actions.activar(
				evento('/acceso/configurar?/activar', {
					campos: {
						personalId: administrador.id,
						contrasena: CONTRASENA,
						confirmacion: CONTRASENA
					},
					cookies
				}) as never
			)
		);
		expect(redireccion).toMatchObject({ status: 303, location: '/' });
		expect(cookies.valores.get(COOKIE_SESION)).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(cookies.opciones.get(COOKIE_SESION)).toMatchObject({
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			path: '/'
		});
	});
});

describe('con el inicio de sesión activado', () => {
	it('la activación ya no está disponible', async () => {
		expect(
			await lanzado(
				configurar.load(evento('/acceso/configurar', { locals: { autenticacion: true } }) as never)
			)
		).toMatchObject({ status: 303, location: '/acceso' });
	});

	it('entra, pone la cookie y vuelve al destino pedido; uno externo se ignora', async () => {
		const cookies = galletas();
		expect(
			await lanzado(
				entrar(
					{
						correo: administrador.correo!,
						contrasena: CONTRASENA,
						destino: '/historial?estado=emitido'
					},
					cookies
				)
			)
		).toMatchObject({ status: 303, location: '/historial?estado=emitido' });
		expect(cookies.valores.has(COOKIE_SESION)).toBe(true);

		expect(
			await lanzado(
				entrar({
					correo: administrador.correo!,
					contrasena: CONTRASENA,
					destino: '//sitio.ficticio.test'
				})
			)
		).toMatchObject({ location: '/' });
	});

	it('rechaza credenciales incorrectas sin devolver la contraseña ni poner cookie', async () => {
		const cookies = galletas();
		const resultado = await entrar(
			{ correo: administrador.correo!, contrasena: 'equivocada 123', destino: '/planeacion' },
			cookies
		);
		expect(resultado).toMatchObject({
			status: 400,
			data: {
				correo: administrador.correo,
				destino: '/planeacion',
				error: 'Correo o contraseña incorrectos.'
			}
		});
		expect(JSON.stringify(resultado)).not.toContain('equivocada');
		expect(cookies.valores.size).toBe(0);
	});

	it('con contraseña temporal lleva a cambiarla, y al cambiarla sigue al inicio', async () => {
		const persona = await alta('reporteador');
		const { temporal } = await generarContrasenaDe(repos, persona.id);
		const cookies = galletas();
		expect(
			await lanzado(
				entrar({ correo: persona.correo!, contrasena: temporal, destino: '/' }, cookies)
			)
		).toMatchObject({ location: '/perfil' });

		const usuario = (await repos.autenticacion.contexto(null, 720)).activada
			? (await sesionDe(cookies)).usuario!
			: null;
		expect(usuario).toMatchObject({ debeCambiar: true });
		const cambio = (campos: Record<string, string>) =>
			perfil.actions.cambiarContrasena(
				evento('/perfil?/cambiarContrasena', { campos, cookies, locals: { usuario } }) as never
			);
		expect(await cambio({ actual: temporal, nueva: 'corta', confirmacion: 'corta' })).toMatchObject(
			{ status: 400 }
		);
		expect(
			await lanzado(
				cambio({
					actual: temporal,
					nueva: 'mi contraseña propia',
					confirmacion: 'mi contraseña propia'
				})
			)
		).toMatchObject({ status: 303, location: '/' });
		olvidarContextos();
		expect((await sesionDe(cookies)).usuario).toMatchObject({ debeCambiar: false });
	});

	it('salir invalida la sesión en el servidor y borra la cookie', async () => {
		const cookies = galletas();
		await lanzado(
			entrar({ correo: administrador.correo!, contrasena: CONTRASENA, destino: '/' }, cookies)
		);
		const token = cookies.valores.get(COOKIE_SESION)!;
		expect(
			await lanzado(
				acceso.actions.salir(evento('/acceso?/salir', { campos: {}, cookies }) as never)
			)
		).toMatchObject({ status: 303, location: '/acceso' });
		expect(cookies.valores.has(COOKIE_SESION)).toBe(false);
		// Quien conserve la cookie ya no entra con ella.
		expect((await sesionDe(galletas({ [COOKIE_SESION]: token }))).usuario).toBeNull();
	});

	it('las cuentas del personal solo las genera quien administra, ya activado', async () => {
		const persona = await alta('lider_operativo');
		const generar = (locals: App.Locals) =>
			fichaPersonal.actions.generarContrasena(
				evento(`/personal/${persona.id}?/generarContrasena`, {
					campos: {},
					locals,
					params: { id: persona.id }
				}) as never
			);
		const usuario = (rol: RolPersonal) => ({
			id: administrador.id,
			nombre: 'Persona Ficticia',
			correo: 'persona@ficticio.test',
			rol,
			debeCambiar: false
		});
		expect(
			await generar({ autenticacion: true, usuario: usuario('mesa_directiva') })
		).toMatchObject({
			status: 403
		});
		expect(await generar({})).toMatchObject({
			status: 400,
			data: { errorAcceso: 'Active primero el inicio de sesión.' }
		});
		const generada = (await generar({
			autenticacion: true,
			usuario: usuario('administrador')
		})) as { temporal: string };
		expect(generada.temporal).toMatch(/^.{4}-.{4}-.{4}$/);
		expect((await repos.personal.obtener(persona.id)).acceso).toMatchObject({ debeCambiar: true });
	});
});

describe('guardia de las peticiones', () => {
	const resolver = vi.fn(async () => new Response('hecho'));
	const pedir = (peticion: ReturnType<typeof evento>) =>
		handle({ event: peticion as never, resolve: resolver });

	beforeEach(() => resolver.mockClear());

	it('sin sesión lleva las páginas a /acceso y responde 401 a lo demás', async () => {
		const pagina = evento('/historial?estado=emitido', { encabezados: { accept: 'text/html' } });
		expect(await lanzado(pedir(pagina))).toMatchObject({
			status: 303,
			location: '/acceso?destino=%2Fhistorial%3Festado%3Demitido'
		});
		expect(await lanzado(pedir(evento('/reportes/x/fotos/y')))).toMatchObject({ status: 401 });

		const accion = await pedir(
			evento('/reportes/x?/guardar', {
				campos: { x: '1' },
				encabezados: { 'x-sveltekit-action': 'true' }
			})
		);
		expect(accion.status).toBe(401);
		expect(await accion.json()).toEqual({
			type: 'error',
			status: 401,
			error: { message: 'Su sesión terminó. Inicie sesión de nuevo.' }
		});
		expect(resolver).not.toHaveBeenCalled();
	});

	it('con sesión llena `locals`, deja consultar y comprueba la capacidad al modificar', async () => {
		const persona = await alta('mesa_directiva');
		const { temporal } = await generarContrasenaDe(repos, persona.id);
		const cookies = galletas();
		await lanzado(entrar({ correo: persona.correo!, contrasena: temporal, destino: '/' }, cookies));
		// Con la contraseña temporal solo puede ir a cambiarla.
		expect(
			await lanzado(pedir(evento('/historial', { cookies, encabezados: { accept: 'text/html' } })))
		).toMatchObject({ status: 303, location: '/perfil' });
		await repos.autenticacion.establecerContrasena({
			personalId: persona.id,
			hash: 'scrypt$ficticio',
			debeCambiar: false,
			conservarTokenHash: (await import('$lib/server/autenticacion/sesiones')).resumenDeToken(
				cookies.valores.get(COOKIE_SESION)!
			)
		});
		olvidarContextos();

		const consulta = evento('/historial', { cookies, encabezados: { accept: 'text/html' } });
		expect(await (await pedir(consulta)).text()).toBe('hecho');
		expect(consulta.locals).toMatchObject({
			autenticacion: true,
			usuario: { id: persona.id, rol: 'mesa_directiva' }
		});

		resolver.mockClear();
		expect(
			await lanzado(pedir(evento('/reportes/x?/guardar', { campos: { x: '1' }, cookies })))
		).toMatchObject({ status: 403 });
		expect(resolver).not.toHaveBeenCalled();
		// Su perfil sí lo puede modificar.
		expect(
			(await pedir(evento('/perfil?/cambiarContrasena', { campos: { x: '1' }, cookies }))).status
		).toBe(200);
	});

	it('retira una cookie que ya no corresponde a ninguna sesión', async () => {
		const cookies = galletas({ [COOKIE_SESION]: 'cookie-inventada' });
		await lanzado(pedir(evento('/', { cookies, encabezados: { accept: 'text/html' } })));
		expect(cookies.valores.has(COOKIE_SESION)).toBe(false);
	});
});

/** Estado del acceso según las cookies, como lo vería la guardia. */
async function sesionDe(cookies: ReturnType<typeof galletas>) {
	const { contextoDeAcceso } = await import('$lib/server/autenticacion/contexto');
	return contextoDeAcceso(repos.autenticacion, cookies.valores.get(COOKIE_SESION) ?? null);
}
