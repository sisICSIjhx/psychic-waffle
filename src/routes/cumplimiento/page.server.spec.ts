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
});
