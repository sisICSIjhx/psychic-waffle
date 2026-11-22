// Carga del tablero sobre PGlite: filtro por cliente, mes de corte limitado al en curso, sin
// programas, y el estatus de los centros de costo con su alcance y la capacidad verContrato. La
// fecha de hoy se fija con la zona del negocio.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TarjetaTablero } from '$lib/components/cumplimiento/tablero';
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
// Los espías sobre los repositorios duran una prueba.
afterEach(() => vi.restoreAllMocks());

type Tablero = {
	tarjetas: TarjetaTablero[];
	estatus: string | null;
	busqueda: string;
};

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

	it('el tablero trae el estatus de todos los centros visibles con una sola consulta', async () => {
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

		const estatus = vi.spyOn(repos.estatus, 'obtener');
		const porCentro = vi.spyOn(repos.seguimiento, 'obtener');
		const todo = (await cargar('')).concentrado as Tablero;
		// Una consulta para todos los centros, no una por centro.
		expect(estatus).toHaveBeenCalledTimes(1);
		// Sin inicio de sesión activado la aplicación está abierta, pero el contrato exige sesión.
		expect(estatus).toHaveBeenCalledWith({
			sitioIds: null,
			mes: '2026-10',
			hoy: '2026-10-21',
			verContrato: false
		});
		expect(porCentro).not.toHaveBeenCalled();

		// Primero el que tiene pendientes; después los que no tienen qué medir, por clave.
		expect(todo.tarjetas.map((t) => [t.centro.clave, t.estatus])).toEqual([
			['OMA-FICTICIO', 'con_pendientes'],
			['EM-cerritos', 'sin_datos'],
			['EM-proagro', 'sin_datos']
		]);
		const [tarjeta] = todo.tarjetas;
		expect(tarjeta.kpis.find((k) => k.clave === 'ejecucion')).toMatchObject({
			valor: 1,
			total: 2,
			alcance: 'mes'
		});
		expect(tarjeta.falta.map((f) => [f.texto, f.destino, f.ancla])).toEqual([
			['Falta 1 actividad por ejecutar', 'seguimiento', 'actividades'],
			['Falta 1 ODM', 'seguimiento', 'actividades']
		]);
		expect(tarjeta.pendientes).toBe(2);
		expect(todo.tarjetas[1].centro.sinPlantilla).toBe(true);

		// En un mes sin capturas el centro queda «Sin datos».
		const septiembre = (await cargar('corte=2026-09')).concentrado as Tablero;
		expect(septiembre.tarjetas.map((t) => t.estatus)).toEqual([
			'sin_datos',
			'sin_datos',
			'sin_datos'
		]);
		// Con un contrato o cliente elegido la página es el detalle: no carga el tablero.
		expect((await cargar('cliente=proagro')).concentrado).toBeNull();
	});

	it('el filtro por estatus y la búsqueda salen de la dirección, ya validados', async () => {
		const elegido = (await cargar('estatus=atrasado&q=%20EM-pro%20')).concentrado as Tablero;
		expect([elegido.estatus, elegido.busqueda]).toEqual(['atrasado', 'EM-pro']);
		// La página recibe todas las tarjetas: el filtro lo aplica la vista (también sin JavaScript).
		expect(elegido.tarjetas).toHaveLength(3);
		const raro = (await cargar('estatus=otro')).concentrado as Tablero;
		expect([raro.estatus, raro.busqueda]).toEqual([null, '']);
	});

	it('lo financiero solo viaja con la capacidad verContrato', async () => {
		const conRol = async (rol: string, centrosCosto: string[] | null = null) => {
			const estatus = vi.spyOn(repos.estatus, 'obtener');
			const datos = (await load({
				url: new URL('http://localhost/cumplimiento'),
				locals: {
					autenticacion: true,
					usuario: { id: 'x', nombre: 'Ficticio', rol, centrosCosto }
				}
			} as never)) as unknown as { concentrado: Tablero; verCobranza: boolean };
			const [consulta] = estatus.mock.calls.at(-1)!;
			return { ...datos, consulta };
		};
		const financiero = (tablero: Tablero) =>
			tablero.tarjetas.some(
				(t) =>
					t.kpis.some((k) => k.clave === 'cobranza' || k.clave === 'contrato') ||
					t.falta.some((f) => f.destino === 'cobranza')
			);

		// Mesa directiva y contabilidad ven el contrato; el resumen trae la cobranza de cada centro.
		for (const rol of ['mesa_directiva', 'contabilidad']) {
			const datos = await conRol(rol);
			expect(datos.consulta.verContrato).toBe(true);
			expect(datos.verCobranza).toBe(true);
			expect(datos.concentrado.tarjetas).toHaveLength(3);
			expect(
				datos.concentrado.tarjetas.every((t) => t.kpis.some((k) => k.clave === 'cobranza'))
			).toBe(true);
		}

		// El líder operativo y el reporteador no: ni indicadores, ni pendientes, ni el acceso.
		for (const rol of ['lider_operativo', 'reporteador']) {
			const datos = await conRol(rol);
			expect(datos.consulta.verContrato).toBe(false);
			expect(datos.verCobranza).toBe(false);
			expect(financiero(datos.concentrado)).toBe(false);
			expect(JSON.stringify(datos.concentrado)).not.toMatch(/cobranza|finanzas|monto/i);
		}
	});

	it('quien tiene centros asignados solo ve el estatus de los suyos', async () => {
		const centros = await repos.centrosCosto.listar();
		const suyo = centros.find((c) => c.clave === 'OMA-FICTICIO')!;
		const estatus = vi.spyOn(repos.estatus, 'obtener');
		const cargarCon = async (centrosCosto: string[]) =>
			(
				(await load({
					url: new URL('http://localhost/cumplimiento'),
					locals: {
						autenticacion: true,
						usuario: { id: 'x', nombre: 'Ficticio', rol: 'lider_operativo', centrosCosto }
					}
				} as never)) as unknown as { concentrado: Tablero }
			).concentrado;

		const limitado = await cargarCon([suyo.id]);
		expect(limitado.tarjetas.map((t) => t.centro.id)).toEqual([suyo.id]);
		expect(estatus.mock.calls[0][0].sitioIds).toEqual([suyo.id]);
		// Sin centros asignados no ve ninguno (y no se consulta «todos»).
		const ninguno = await cargarCon([]);
		expect(ninguno.tarjetas).toEqual([]);
		expect(estatus.mock.calls[1][0].sitioIds).toEqual([]);
	});
});
