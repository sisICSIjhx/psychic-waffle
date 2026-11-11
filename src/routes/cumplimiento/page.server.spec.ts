// Carga del tablero sobre PGlite: filtro por cliente, mes de corte limitado al en curso y sin
// programas. La fecha de hoy se fija con la zona del negocio.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { crearClientePglite } from '$lib/server/bd/pglite';
import { crearRepositorios, type Repositorios } from '$lib/server/repositorios/index';

let repos: Repositorios;
vi.mock('$lib/server/datos', () => ({ datos: async () => repos }));
vi.mock('$lib/dominio/fechas', async (original) => ({
	...(await original<typeof import('$lib/dominio/fechas')>()),
	fechaEnZona: () => '2026-10-21'
}));

const { load } = await import('./+page.server');

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	for (const clave of ['proagro', 'cerritos']) {
		const cliente = await repos.catalogo.guardarCliente({
			clave,
			nombre: clave,
			razonSocial: clave.toUpperCase()
		});
		const contrato = await repos.catalogo.guardarContrato({
			clienteId: cliente.id,
			numero: `OC-${clave}`,
			descripcion: null,
			vigenciaInicio: '2026-03-01',
			vigenciaFin: '2027-02-28'
		});
		const sitio = await repos.catalogo.guardarSitio({ clave: `EM-${clave}`, nombre: '' });
		await repos.catalogo.asociarSitio(contrato.id, sitio.id);
		await repos.programa.guardarPrograma({
			contratoId: contrato.id,
			sitioId: sitio.id,
			periodoInicio: '2026-03-01',
			periodoFin: '2027-02-28'
		});
	}
}, 60_000);

afterAll(() => repos.cerrar());

const cargar = (consulta: string) =>
	load({ url: new URL(`http://localhost/cumplimiento?${consulta}`) } as never) as Promise<
		Record<string, unknown> & { programas: { sitio: { clave: string } }[] }
	>;

describe('carga del tablero de cumplimiento', () => {
	it('filtra por cliente y usa el mes en curso por omisión', async () => {
		const datos = await cargar('cliente=proagro');
		expect(datos.corte).toBe('2026-10-01');
		expect(datos.programas.map((p) => p.sitio.clave)).toEqual(['EM-proagro']);
	});

	it('limita un corte futuro al mes en curso y lo indica', async () => {
		const datos = await cargar('corte=2027-01');
		expect([datos.corte, datos.corteLimitado]).toEqual(['2026-10-01', true]);
		expect(datos.programas).toHaveLength(2);
	});

	it('un mes de corte inexistente usa el mes en curso', async () => {
		for (const corte of ['2026-13', '2026-00', '0000-01']) {
			expect((await cargar(`corte=${corte}`)).corte).toBe('2026-10-01');
		}
	});

	it('sin programas en el corte devuelve la lista vacía', async () => {
		expect((await cargar('corte=2025-01')).programas).toEqual([]);
	});

	it('el concentrado trae todos los centros visibles y las actividades de los de captura mensual', async () => {
		const plantilla = await repos.centrosCosto.guardarPlantilla({
			nombre: 'concentrado-mensual',
			modoContrato: 'opcional',
			origenActividades: 'mensual',
			conceptos: [{ etiqueta: 'ODM', bloque: 'documentos', tipo: 'casilla' }]
		});
		const mensual = await repos.centrosCosto.guardar({
			clave: 'OMA-FICTICIO',
			nombre: 'Mensual',
			plantillaId: plantilla.id
		});
		const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
		for (const id of ids) {
			await repos.seguimiento.guardar(mensual.id, '2026-10', plantilla.id, {
				accion: 'nuevaActividad',
				id,
				nombre: `Actividad ${id.slice(0, 1)}`,
				fecha: null
			});
		}
		await repos.seguimiento.guardar(mensual.id, '2026-10', plantilla.id, {
			accion: 'ejecucion',
			actividad: `m:${ids[0]}`,
			valor: true
		});

		type Concentrado = {
			centros: { id: string; clave: string }[];
			actividades: Record<string, unknown>;
		};
		const todo = (await cargar('')).concentrado as Concentrado;
		expect(todo.centros.map((c) => c.clave).sort()).toEqual([
			'EM-cerritos',
			'EM-proagro',
			'OMA-FICTICIO'
		]);
		expect(todo.actividades).toEqual({ [mensual.id]: { programadas: 2, ejecutadas: 1 } });
		expect(((await cargar('corte=2026-09')).concentrado as Concentrado).actividades).toEqual({
			[mensual.id]: { programadas: 0, ejecutadas: 0 }
		});
		// Con un contrato o cliente elegido la página es el detalle: no carga el concentrado.
		expect((await cargar('cliente=proagro')).concentrado).toBeNull();

		// Quien tiene centros asignados solo ve los suyos.
		const limitado = (await load({
			url: new URL('http://localhost/cumplimiento'),
			locals: {
				autenticacion: true,
				usuario: { id: 'x', nombre: 'Ficticio', rol: 'reporteador', centrosCosto: [mensual.id] }
			}
		} as never)) as unknown as { concentrado: Concentrado; verCobranza: boolean };
		expect(limitado.concentrado.centros.map((c) => c.id)).toEqual([mensual.id]);
		expect(limitado.verCobranza).toBe(false);
	});
});
