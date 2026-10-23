// Ajustes del programa, reportes ligados a una reprogramación, conteo de ejecuciones y lecturas para
// la matriz y el tablero (0019). Solo datos ficticios.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aGuardado } from '../../dominio/captura';
import type { Reporte } from '../../dominio/esquemas';
import { AlmacenamientoLocal } from '../almacenamiento';
import { crearClientePglite, type ClientePglite } from '../bd/pglite';
import { ServicioCaptura } from '../captura';
import { crearRepositorios, type Repositorios } from './index';

let cliente: ClientePglite;
let repos: Repositorios;
let servicio: ServicioCaptura;
let carpeta: string;
let n = 0;

beforeAll(async () => {
	cliente = await crearClientePglite();
	repos = crearRepositorios(cliente);
	carpeta = await mkdtemp(join(tmpdir(), 'cumplimiento-'));
	servicio = new ServicioCaptura(repos, new AlmacenamientoLocal(carpeta));
}, 60_000);

afterAll(async () => {
	await repos.cerrar();
	await rm(carpeta, { recursive: true, force: true });
});

/** Contrato con un sitio, un programa de mayo de 2026 a abril de 2027 y partidas mensual y diaria. */
async function base(clave = `c${++n}`) {
	const c = await repos.catalogo.guardarCliente({
		clave,
		nombre: clave,
		razonSocial: `CLIENTE ${clave}`
	});
	const contrato = await repos.catalogo.guardarContrato({
		clienteId: c.id,
		numero: `OC-${clave}`,
		descripcion: null,
		vigenciaInicio: '2026-05-01',
		vigenciaFin: '2027-04-30'
	});
	const sitio = await repos.catalogo.guardarSitio({ clave: `EM-${clave}`, nombre: 'SITIO' });
	await repos.catalogo.asociarSitio(contrato.id, sitio.id);
	const partida = (numero: string, periodicidad: 'mensual' | 'diaria') =>
		repos.catalogo.guardarPartida({
			contratoId: contrato.id,
			sitioId: sitio.id,
			numero,
			actividad: `Partida ${numero}`,
			periodicidad,
			objetivo: 'Objetivo',
			conclusionesBase: 'Conclusiones',
			alcances: [{ tipo: 'alcance', texto: 'Alcance' }]
		});
	const mensual = await partida('7', 'mensual');
	const diaria = await partida('2', 'diaria');
	const programa = await repos.programa.guardarPrograma({
		contratoId: contrato.id,
		sitioId: sitio.id,
		periodoInicio: '2026-05-01',
		periodoFin: '2027-04-30'
	});
	await repos.programa.guardarMeses(programa.id, [
		{ partidaId: mensual.id, mes: '2026-06-01', cantidad: 1 },
		{ partidaId: mensual.id, mes: '2026-10-01', cantidad: 1 },
		{ partidaId: diaria.id, mes: '2026-06-01', cantidad: 30 }
	]);
	return { cliente: c, contrato, sitio, mensual, diaria, programa };
}

const reprogramar = (b: Awaited<ReturnType<typeof base>>, cambios = {}) =>
	repos.programa.registrarAjuste({
		programaId: b.programa.id,
		partidaId: b.mensual.id,
		tipo: 'reprogramado',
		mesOrigen: '2026-06-01',
		mesDestino: '2026-10-01',
		cantidad: 1,
		motivo: 'clima',
		...cambios
	});

async function emitir(
	reporte: Reporte,
	dias = [{ desde: reporte.periodoMes, hasta: reporte.periodoMes }]
) {
	const guardado = aGuardado(reporte);
	guardado.diasEjecucion = dias;
	const firma = (nombre: string) => ({ nombre, cargo: '', empresa: '' });
	guardado.firmantes = { elaboro: firma('Uno'), aprobo: firma('Dos'), recibio: firma('Tres') };
	for (const alcance of guardado.alcances) alcance.estadoVerificacion = 'ok';
	const capturado = await servicio.guardar(guardado);
	const enRevision = await servicio.cambiarEstado(capturado.id, capturado.version, 'en_revision');
	return servicio.cambiarEstado(enRevision.id, enRevision.version, 'emitido');
}

const celda = async (b: Awaited<ReturnType<typeof base>>, partidaId: string, mes: string) =>
	(await repos.programa.obtenerAvance(b.programa.id)).partidas
		.find((p) => p.id === partidaId)!
		.celdas.find((c) => c.mes === mes)!;

describe('ajustes del programa', () => {
	it('valida destino, partida, cantidad, nota y lo que falta', async () => {
		const b = await base();
		const otro = await base();
		await expect(reprogramar(b, { mesDestino: '2027-06-01' })).rejects.toMatchObject({
			detalle: { motivo: 'mes_fuera_del_periodo' }
		});
		await expect(reprogramar(b, { mesDestino: '2026-05-01' })).rejects.toMatchObject({
			message: 'El mes destino debe ser posterior al de origen'
		});
		await expect(reprogramar(b, { partidaId: otro.mensual.id })).rejects.toMatchObject({
			detalle: { motivo: 'partida_ajena' }
		});
		await expect(reprogramar(b, { motivo: 'otro' })).rejects.toMatchObject({
			message: 'Con el motivo «Otro» la nota es obligatoria'
		});
		const sql = (repos.programa as unknown as { sql: ClientePglite }).sql;
		await expect(
			sql.llamar('api_registrar_ajuste', {
				programaId: b.programa.id,
				partidaId: b.mensual.id,
				tipo: 'no_ejecutado',
				mesOrigen: '2026-06-01',
				cantidad: 1.5,
				motivo: 'clima'
			})
		).rejects.toBeDefined();
		await expect(reprogramar(b, { cantidad: 2 })).rejects.toMatchObject({
			detalle: { motivo: 'cantidad_mayor_que_falta', falta: 1 }
		});
		const ajuste = await reprogramar(b);
		expect(ajuste).toMatchObject({ tipo: 'reprogramado', cantidad: 1, anuladoEn: null });
		// Ya no falta nada en junio.
		await expect(
			repos.programa.registrarAjuste({
				programaId: b.programa.id,
				partidaId: b.mensual.id,
				tipo: 'no_ejecutado',
				mesOrigen: '2026-06-01',
				cantidad: 1,
				motivo: 'personal'
			})
		).rejects.toMatchObject({ detalle: { falta: 0 } });
		const junio = await celda(b, b.mensual.id, '2026-06-01');
		const octubre = await celda(b, b.mensual.id, '2026-10-01');
		expect([junio.salida, octubre.entrada, octubre.ajustes.map((a) => a.id)]).toEqual([
			1,
			1,
			[ajuste.id]
		]);
	});

	it('el reporte ligado cuenta aparte en el mes destino y la revisión conserva el vínculo', async () => {
		const b = await base();
		const ajuste = await reprogramar(b);
		const propio = await servicio.crearReporte({
			partidaId: b.mensual.id,
			periodoMes: '2026-10-01',
			ocurrencia: null,
			equipoIds: []
		});
		const ligado = await servicio.crearReporte({
			partidaId: b.mensual.id,
			periodoMes: '2026-10-01',
			ocurrencia: null,
			equipoIds: [],
			reprogramacionId: ajuste.id
		});
		expect(ligado.reprogramacionId).toBe(ajuste.id);
		expect(ligado.version).toBe(1);
		await expect(
			servicio.crearReporte({
				partidaId: b.mensual.id,
				periodoMes: '2026-11-01',
				ocurrencia: null,
				equipoIds: [],
				reprogramacionId: ajuste.id
			})
		).rejects.toMatchObject({ detalle: { motivo: 'reprogramacion_invalida' } });
		await expect(
			servicio.crearReporte({
				partidaId: b.diaria.id,
				periodoMes: '2026-10-01',
				ocurrencia: null,
				equipoIds: [],
				reprogramacionId: ajuste.id
			})
		).rejects.toMatchObject({ detalle: { motivo: 'reprogramacion_invalida' } });

		// Con un borrador ligado, el ajuste aparece en la celda con el borrador.
		const abierta = await celda(b, b.mensual.id, '2026-10-01');
		expect(abierta.reportesAbiertos.map((r) => r.estado)).toEqual(['borrador', 'borrador']);
		expect(abierta.ajustes[0]).toMatchObject({ borradores: 1, bloqueantes: 0 });

		await emitir(propio);
		const emitido = await emitir(ligado);
		expect((await celda(b, b.mensual.id, '2026-10-01')).ejecucionesReportes).toBe(2);
		const revision = await servicio.crearRevision(emitido.id);
		expect(revision.reprogramacionId).toBe(ajuste.id);
		await emitir(revision);
		expect((await celda(b, b.mensual.id, '2026-10-01')).ejecucionesReportes).toBe(2);
		await expect(repos.programa.anularAjuste(ajuste.id)).rejects.toMatchObject({
			tipo: 'conflicto',
			detalle: { motivo: 'con_reportes' }
		});
	});

	it('anular desliga los borradores sin subir su versión y no se anula dos veces', async () => {
		const b = await base();
		const ajuste = await reprogramar(b);
		const borrador = await servicio.crearReporte({
			partidaId: b.mensual.id,
			periodoMes: '2026-10-01',
			ocurrencia: null,
			equipoIds: [],
			reprogramacionId: ajuste.id
		});
		const anulado = await repos.programa.anularAjuste(ajuste.id);
		expect(anulado.anuladoEn).not.toBeNull();
		const despues = await servicio.obtener(borrador.id);
		expect([despues.reprogramacionId, despues.version]).toEqual([null, borrador.version]);
		await expect(repos.programa.anularAjuste(ajuste.id)).rejects.toMatchObject({
			detalle: { motivo: 'ya_anulado' }
		});
		// Un ajuste anulado ya no se puede ligar.
		await expect(
			servicio.crearReporte({
				partidaId: b.mensual.id,
				periodoMes: '2026-10-01',
				ocurrencia: null,
				equipoIds: [],
				reprogramacionId: ajuste.id
			})
		).rejects.toMatchObject({ detalle: { motivo: 'reprogramacion_invalida' } });
	});
});

describe('conteo de ejecuciones y lecturas', () => {
	it('dos TAG de la misma ocurrencia cuentan uno y una diaria cuenta sus días distintos', async () => {
		const b = await base();
		for (const tag of ['PI-1', 'PI-2']) {
			const equipo = await repos.catalogo.guardarEquipo({ sitioId: b.sitio.id, tag });
			void equipo;
		}
		const uno = await servicio.crearReporte({
			partidaId: b.mensual.id,
			periodoMes: '2026-06-01',
			ocurrencia: null,
			equipoIds: []
		});
		const dos = await servicio.crearReporte({
			partidaId: b.mensual.id,
			periodoMes: '2026-06-01',
			ocurrencia: null,
			equipoIds: []
		});
		await emitir(uno);
		await emitir(dos);
		expect((await celda(b, b.mensual.id, '2026-06-01')).ejecucionesReportes).toBe(1);

		const diaria = await servicio.crearReporte({
			partidaId: b.diaria.id,
			periodoMes: '2026-06-01',
			ocurrencia: null,
			equipoIds: []
		});
		await emitir(diaria, [
			{ desde: '2026-06-01', hasta: '2026-06-03' },
			{ desde: '2026-06-10', hasta: '2026-06-10' }
		]);
		expect((await celda(b, b.diaria.id, '2026-06-01')).ejecucionesReportes).toBe(4);
	});

	it('el tablero filtra por cliente y mes de corte; las ejecuciones del mes omiten los sustituidos', async () => {
		const a = await base();
		const b = await base();
		const todos = await repos.programa.obtenerCumplimiento({ corte: '2026-10-01' });
		expect(todos.map((p) => p.sitio.id)).toEqual(expect.arrayContaining([a.sitio.id, b.sitio.id]));
		const deA = await repos.programa.obtenerCumplimiento({
			corte: '2026-10-01',
			clienteClave: a.cliente.clave
		});
		expect(deA.map((p) => p.sitio.id)).toEqual([a.sitio.id]);
		expect(deA[0].avance.partidas.map((p) => p.numero)).toEqual(['2', '7']);
		expect(
			await repos.programa.obtenerCumplimiento({
				corte: '2027-06-01',
				clienteClave: a.cliente.clave
			})
		).toEqual([]);

		const reporte = await servicio.crearReporte({
			partidaId: a.mensual.id,
			periodoMes: '2026-06-01',
			ocurrencia: null,
			equipoIds: []
		});
		const emitido = await emitir(reporte);
		const revision = await servicio.crearRevision(emitido.id);
		await emitir(revision);
		const ejecuciones = await repos.programa.listarEjecucionesMes(a.programa.id, '2026-06-01');
		expect(ejecuciones.map((e) => [e.id, e.estado])).toEqual([[revision.id, 'emitido']]);
		expect(ejecuciones[0].diasEjecucion).toEqual([{ desde: '2026-06-01', hasta: '2026-06-01' }]);
	});
});
