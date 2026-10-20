import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aGuardado } from '../dominio/captura';
import { AlmacenamientoLocal } from './almacenamiento';
import { crearClientePglite } from './bd/pglite';
import { ServicioCaptura } from './captura';
import { crearRepositorios, type Repositorios } from './repositorios/index';

let repos: Repositorios;
let carpeta: string;
let servicio: ServicioCaptura;
const partidas: Record<string, string> = {};

/** Dos clientes ficticios con una partida mensual cada uno. */
beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
	carpeta = await mkdtemp(join(tmpdir(), 'historial-'));
	servicio = new ServicioCaptura(repos, new AlmacenamientoLocal(carpeta));
	for (const [clave, sitioClave] of [
		['uno', 'EM-11111'],
		['dos', 'EM-22222']
	]) {
		const cliente = await repos.catalogo.guardarCliente({
			clave,
			nombre: clave,
			razonSocial: `CLIENTE ${clave.toUpperCase()}`
		});
		const contrato = await repos.catalogo.guardarContrato({
			clienteId: cliente.id,
			numero: `OC-${clave}`,
			descripcion: null,
			vigenciaInicio: '2026-05-01',
			vigenciaFin: '2027-04-30'
		});
		const sitio = await repos.catalogo.guardarSitio({ clave: sitioClave, nombre: 'SITIO' });
		await repos.catalogo.asociarSitio(contrato.id, sitio.id);
		const partida = await repos.catalogo.guardarPartida({
			contratoId: contrato.id,
			sitioId: sitio.id,
			numero: '7',
			actividad: 'Toma de potenciales',
			periodicidad: 'mensual',
			objetivo: 'Objetivo',
			conclusionesBase: 'Conclusiones',
			alcances: [{ tipo: 'alcance', texto: 'Medición' }]
		});
		partidas[clave] = partida.id;
	}
}, 60_000);

afterAll(async () => {
	await repos.cerrar();
	await rm(carpeta, { recursive: true, force: true });
});

async function reporte(clave: string, mes: string, emitir: boolean) {
	const creado = await servicio.crearReporte({
		partidaId: partidas[clave],
		periodoMes: mes,
		ocurrencia: null,
		equipoIds: []
	});
	if (!emitir) return creado;
	const guardado = aGuardado(creado);
	guardado.fechaEjecucion = mes.replace(/01$/, '15');
	guardado.firmantes = {
		elaboro: { nombre: 'Uno', cargo: '', empresa: '' },
		aprobo: { nombre: 'Dos', cargo: '', empresa: '' },
		recibio: { nombre: 'Tres', cargo: '', empresa: '' }
	};
	const listo = await servicio.guardar(guardado);
	const enRevision = await servicio.cambiarEstado(listo.id, listo.version, 'en_revision');
	return servicio.cambiarEstado(enRevision.id, enRevision.version, 'emitido');
}

describe('filtros del historial', () => {
	it('filtra por cliente, estado y periodo, del más reciente al más antiguo', async () => {
		await reporte('uno', '2026-05-01', true);
		await reporte('uno', '2026-06-01', false);
		await reporte('uno', '2026-07-01', true);
		await reporte('dos', '2026-06-01', true);

		const titulos = async (filtro: Parameters<Repositorios['reportes']['listar']>[0]) =>
			(await repos.reportes.listar(filtro)).filas.map((f) => `${f.clienteClave} ${f.periodoMes}`);

		expect(await titulos({ clienteClave: 'uno' })).toEqual([
			'uno 2026-07-01',
			'uno 2026-06-01',
			'uno 2026-05-01'
		]);
		expect(await titulos({ clienteClave: 'uno', estado: 'emitido' })).toEqual([
			'uno 2026-07-01',
			'uno 2026-05-01'
		]);
		expect(await titulos({ desde: '2026-06-01', hasta: '2026-06-01' })).toEqual([
			'dos 2026-06-01',
			'uno 2026-06-01'
		]);
		expect(await titulos({ partidaId: partidas.dos })).toEqual(['dos 2026-06-01']);
		expect((await repos.reportes.listar({ estado: 'borrador' })).total).toBe(1);
	});

	it('cuenta en el avance del programa solo los reportes emitidos', async () => {
		const [contrato] = await repos.catalogo.listarContratos({ clienteClave: 'uno' });
		const [sitio] = await repos.catalogo.listarSitios(contrato.id);
		const programa = await repos.programa.guardarPrograma({
			contratoId: contrato.id,
			sitioId: sitio.id,
			periodoInicio: '2026-05-01',
			periodoFin: '2027-04-30'
		});
		const avance = await repos.programa.obtenerAvance(programa.id);
		const celdas = avance.partidas[0].celdas.slice(0, 3).map((c) => c.realizado);
		// Mayo y julio emitidos; junio sigue en borrador.
		expect(celdas).toEqual([1, 0, 1]);

		// Un realizado manual se informa aparte de las ejecuciones con reporte.
		await repos.programa.registrarRealizadoManual({
			programaId: programa.id,
			partidaId: partidas.uno,
			mes: '2026-05-01',
			nota: 'Reporte Word anterior'
		});
		const mayo = (await repos.programa.obtenerAvance(programa.id)).partidas[0].celdas[0];
		expect(mayo).toMatchObject({ realizado: 2, ejecucionesReportes: 1, realizadoSinReporte: 1 });
		expect(mayo.reportes).toHaveLength(1);
	});
});
