import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AlmacenamientoLocal } from './almacenamiento';
import { crearClientePglite } from './bd/pglite';
import { ServicioCaptura } from './captura';
import { crearRepositorios, type Repositorios } from './repositorios/index';

let repos: Repositorios;
let carpeta: string;
let partidaId = '';
const TOTAL = 105;

/** Una partida ficticia con más borradores que una página del historial (100). */
beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	carpeta = await mkdtemp(join(tmpdir(), 'listar-todos-'));
	const servicio = new ServicioCaptura(repos, new AlmacenamientoLocal(carpeta));
	const cliente = await repos.catalogo.guardarCliente({
		clave: 'muchos',
		nombre: 'muchos',
		razonSocial: 'CLIENTE MUCHOS'
	});
	const contrato = await repos.catalogo.guardarContrato({
		clienteId: cliente.id,
		numero: 'OC-MUCHOS',
		descripcion: null,
		vigenciaInicio: '2026-05-01',
		vigenciaFin: '2027-04-30'
	});
	const sitio = await repos.catalogo.guardarSitio({ clave: 'EM-33333', nombre: 'SITIO' });
	await repos.catalogo.asociarSitio(contrato.id, sitio.id);
	const partida = await repos.catalogo.guardarPartida({
		contratoId: contrato.id,
		sitioId: sitio.id,
		numero: '1',
		actividad: 'Limpieza',
		periodicidad: 'diaria',
		objetivo: 'Objetivo',
		conclusionesBase: 'Conclusiones',
		alcances: [{ tipo: 'alcance', texto: 'Limpieza' }]
	});
	partidaId = partida.id;
	for (let dia = 1; dia <= TOTAL; dia++) {
		await servicio.crearReporte({
			partidaId,
			periodoMes: `2026-0${5 + Math.floor((dia - 1) / 31)}-01`,
			ocurrencia: { tipo: 'dia', numero: ((dia - 1) % 28) + 1 },
			equipoIds: []
		});
	}
}, 120_000);

afterAll(async () => {
	await repos.cerrar();
	await rm(carpeta, { recursive: true, force: true });
});

describe('listarTodos', () => {
	it('recorre todas las páginas y no omite ningún borrador', async () => {
		const pagina = await repos.reportes.listar({ estado: 'borrador', partidaId });
		expect(pagina.total).toBe(TOTAL);
		expect(pagina.filas.length).toBeLessThan(TOTAL);

		const todos = await repos.reportes.listarTodos({ estado: 'borrador', partidaId });
		expect(todos).toHaveLength(TOTAL);
		expect(new Set(todos.map((f) => f.id)).size).toBe(TOTAL);
		expect(todos.every((f) => f.partidaId === partidaId)).toBe(true);
	});
});
