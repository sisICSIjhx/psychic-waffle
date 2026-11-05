// Catálogo de equipos por proyecto (0021). Solo datos ficticios.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EquipoCatalogoEntrada, EquipoImportado, Sitio } from '../../dominio/esquemas';
import { ErrorDatos } from '../bd/cliente';
import { crearClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from './index';

let repos: Repositorios;
let proyectoA: string;
let proyectoB: string;
let contratoA: string;
let sitioA: Sitio;
let sitioA2: Sitio;
let sitioB: Sitio;

async function proyecto(sufijo: string) {
	const cliente = await repos.catalogo.guardarCliente({
		clave: `equipos-${sufijo}`,
		nombre: `Proyecto ${sufijo}`,
		razonSocial: `CLIENTE FICTICIO ${sufijo.toUpperCase()}`
	});
	const contrato = await repos.catalogo.guardarContrato({
		clienteId: cliente.id,
		numero: `OC-EQ-${sufijo}`,
		descripcion: null,
		vigenciaInicio: '2026-05-01',
		vigenciaFin: '2027-04-30'
	});
	return { clienteId: cliente.id, contratoId: contrato.id };
}

async function sitio(contratoId: string, clave: string) {
	const s = await repos.catalogo.guardarSitio({ clave, nombre: '' });
	await repos.catalogo.asociarSitio(contratoId, s.id);
	return s;
}

const base = (sitioId: string, tag: string, tipo: string | null = null): EquipoCatalogoEntrada => ({
	sitioId,
	tag,
	tipo,
	marca: null,
	modelo: null,
	numeroSerie: null,
	rango: null,
	resolucion: null,
	clase: null,
	ubicacion: null,
	propietario: null,
	responsable: null,
	critico: false,
	estado: 'en_servicio',
	intervaloMeses: null,
	ultimaCalibracion: null,
	proximaCalibracion: null,
	proveedor: null,
	notas: null
});

async function errorDe(promesa: Promise<unknown>): Promise<ErrorDatos> {
	try {
		await promesa;
	} catch (error) {
		expect(error).toBeInstanceOf(ErrorDatos);
		return error as ErrorDatos;
	}
	throw new Error('Se esperaba un error');
}

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	const a = await proyecto('a');
	const b = await proyecto('b');
	proyectoA = a.clienteId;
	proyectoB = b.clienteId;
	contratoA = a.contratoId;
	sitioA = await sitio(a.contratoId, 'EM-EQ-A1');
	sitioA2 = await sitio(a.contratoId, 'EM-EQ-A2');
	sitioB = await sitio(b.contratoId, 'EM-EQ-B1');
});

afterAll(async () => {
	await repos.cerrar();
});

describe('catálogo de equipos', () => {
	it('da de alta con todos los campos y lista solo los del proyecto', async () => {
		const equipo = await repos.equipos.guardar({
			...base(sitioA.id, 'PI-0001', 'Indicador de presión'),
			marca: 'MARCA',
			modelo: 'M-1',
			rango: '0 - 100 kg/cm²',
			critico: true,
			estado: 'fuera_de_servicio',
			intervaloMeses: 3,
			ultimaCalibracion: '2026-08-28',
			proveedor: 'Proveedor ficticio',
			notas: 'Nota'
		});
		expect(equipo).toMatchObject({
			sitio: { clave: 'EM-EQ-A1' },
			critico: true,
			estado: 'fuera_de_servicio',
			intervaloMeses: 3,
			ultimaCalibracion: '2026-08-28',
			proximaCalibracion: null,
			orden: 1,
			enUso: false
		});
		await repos.equipos.guardar(base(sitioA2.id, 'TI-0001'));
		await repos.equipos.guardar(base(sitioB.id, 'PI-9000'));

		expect((await repos.equipos.listarDeProyecto(proyectoA)).map((e) => e.tag)).toEqual([
			'PI-0001',
			'TI-0001'
		]);
		expect((await repos.equipos.listarDeProyecto(proyectoB)).map((e) => e.tag)).toEqual([
			'PI-9000'
		]);
		expect((await repos.equipos.sitiosDeProyecto(proyectoA)).map((s) => s.clave)).toEqual([
			'EM-EQ-A1',
			'EM-EQ-A2'
		]);
	});

	it('acepta el mismo TAG con otro nombre y rechaza el duplicado de TAG y nombre', async () => {
		await repos.equipos.guardar(base(sitioA.id, 'LIT-0001', 'Transmisor indicador de nivel'));
		await repos.equipos.guardar(base(sitioA.id, 'LIT-0001', 'Indicador magnético de nivel'));
		const error = await errorDe(
			repos.equipos.guardar(base(sitioA.id, 'lit-0001', 'INDICADOR MAGNETICO  DE NIVEL'))
		);
		expect(error.message).toBe('Ya existe un equipo con ese TAG y nombre en el sitio');
		expect(error.detalle).toMatchObject({ motivo: 'equipo_duplicado' });
	});

	it('la ficha del contrato (guardado parcial) no borra la calibración', async () => {
		const [equipo] = await repos.equipos.listarDeProyecto(proyectoA);
		await repos.catalogo.guardarEquipo({
			id: equipo.id,
			sitioId: equipo.sitioId,
			tag: 'PI-0001',
			tipo: 'Indicador de presión',
			marca: 'OTRA',
			modelo: null,
			rango: null,
			numeroSerie: 'S/N'
		});
		expect(await repos.equipos.obtener(equipo.id)).toMatchObject({
			marca: 'OTRA',
			numeroSerie: 'S/N',
			critico: true,
			estado: 'fuera_de_servicio',
			intervaloMeses: 3,
			ultimaCalibracion: '2026-08-28',
			notas: 'Nota'
		});
	});

	it('valida el intervalo y elimina solo equipos que no están en partidas', async () => {
		await expect(
			repos.equipos.guardar({ ...base(sitioA.id, 'X-1'), intervaloMeses: 121 })
		).rejects.toThrow();

		const libre = await repos.equipos.guardar(base(sitioA.id, 'LIBRE-1'));
		await repos.equipos.eliminar(libre.id);
		expect((await repos.equipos.listarDeProyecto(proyectoA)).some((e) => e.id === libre.id)).toBe(
			false
		);

		const usado = await repos.equipos.guardar(base(sitioA.id, 'USADO-1'));
		await repos.catalogo.guardarPartida({
			contratoId: contratoA,
			sitioId: sitioA.id,
			numero: '1',
			actividad: 'Calibración ficticia',
			periodicidad: 'mensual',
			alcances: [{ tipo: 'alcance', texto: 'Verificar' }],
			equipoIds: [usado.id]
		});
		expect((await repos.equipos.obtener(usado.id)).enUso).toBe(true);
		const error = await errorDe(repos.equipos.eliminar(usado.id));
		expect(error.detalle).toMatchObject({ motivo: 'en_uso' });
		const mover = await errorDe(
			repos.equipos.guardar({ ...base(sitioA2.id, 'USADO-1'), id: usado.id })
		);
		expect(mover.detalle).toMatchObject({ motivo: 'en_uso' });
	});

	it('importa en el sitio: ensayo sin escribir, alta en orden y reimportación que actualiza', async () => {
		const importado = (
			fila: number,
			tag: string,
			tipo: string | null,
			cambios: Partial<EquipoImportado> = {}
		): EquipoImportado => {
			const { sitioId, ...datos } = base(sitioB.id, tag, tipo);
			expect(sitioId).toBe(sitioB.id);
			return { ...datos, critico: false, estado: 'en_servicio', fila, ...cambios };
		};
		const filas = [
			importado(3, 'ZZ-2', 'Válvula', { notas: 'Primera' }),
			importado(4, 'AA-1', 'Válvula', { intervaloMeses: 2 }),
			importado(5, 'aa-1', 'VALVULA'),
			importado(6, 'PI-9000', null, { estado: 'baja' })
		];

		const ensayo = await repos.equipos.importar(sitioB.id, filas, true);
		expect(ensayo).toEqual({
			ensayo: true,
			nuevos: 2,
			actualizados: 1,
			repetidas: [{ fila: 5, tag: 'aa-1' }]
		});
		expect(await repos.equipos.listarDeProyecto(proyectoB)).toHaveLength(1);

		const aplicado = await repos.equipos.importar(sitioB.id, filas, false);
		expect(aplicado).toMatchObject({ ensayo: false, nuevos: 2, actualizados: 1 });
		const lista = await repos.equipos.listarDeProyecto(proyectoB);
		expect(lista.map((e) => [e.tag, e.orden, e.estado])).toEqual([
			['ZZ-2', 1, 'en_servicio'],
			['AA-1', 2, 'en_servicio'],
			['PI-9000', 4, 'baja']
		]);

		const otraVez = await repos.equipos.importar(sitioB.id, filas, false);
		expect(otraVez).toMatchObject({ nuevos: 0, actualizados: 3 });
		expect(await repos.equipos.listarDeProyecto(proyectoB)).toHaveLength(3);
	});
});
