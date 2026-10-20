import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from '../repositorios/index';
import { analizarLibroCatalogo, clasificarLinea, ErrorImportacion } from './catalogo';
import { crearLibroSintetico, PARTIDAS_EJEMPLO } from './libro-sintetico';

const FIXTURE = new URL('./fixtures/catalogo-sintetico.xlsx', import.meta.url);

async function esperarErrorImportacion(promesa: Promise<unknown>): Promise<ErrorImportacion> {
	try {
		await promesa;
	} catch (error) {
		expect(error).toBeInstanceOf(ErrorImportacion);
		return error as ErrorImportacion;
	}
	throw new Error('Se esperaba un error de importación');
}

describe('análisis del libro de catálogo', () => {
	it('lee cabeceras por texto, clasifica viñetas y toma el programa de los rellenos', async () => {
		const catalogo = await analizarLibroCatalogo(await readFile(FIXTURE));
		expect(catalogo.usuario).toBe('CLIENTE FICTICIO');
		expect(catalogo.programa).toEqual({ periodoInicio: '2026-05-01', periodoFin: '2027-04-30' });
		expect(catalogo.partidas.map((p) => [p.numero, p.periodicidad])).toEqual([
			['1', 'mensual'],
			['2', 'diaria'],
			['3', 'cuando_aplique']
		]);
		const [mensual, diaria, eventual] = catalogo.partidas;
		expect(mensual.alcances).toEqual([
			{ tipo: 'alcance', texto: 'Inspección visual' },
			{ tipo: 'alcance', texto: 'Limpieza general' },
			{ tipo: 'nota', texto: 'Nota: No incluye materiales.' }
		]);
		expect(mensual).toMatchObject({
			distribucion: 'produccion',
			materialesPor: 'icsi',
			requiereOdm: true,
			requierePt: false
		});
		expect(mensual.meses).toHaveLength(12);
		expect(diaria.meses.reduce((suma, m) => suma + m.cantidad, 0)).toBe(365);
		expect(diaria.meses[0]).toEqual({ mes: '2026-05-01', cantidad: 31 });
		// El mes realizado de una partida diaria cuenta todos sus días, como lo programado.
		expect(diaria.realizados).toEqual([{ mes: '2026-05-01', cantidad: 31 }]);
		expect(diaria.alcances[1].tipo).toBe('norma');
		expect(diaria).toMatchObject({ materialesPor: 'cliente', requierePt: true });
		expect(eventual).toMatchObject({ cantidadAnual: null, meses: [] });
	});

	it('solo propone los firmantes de la hoja, sin importarlos', async () => {
		const catalogo = await analizarLibroCatalogo(await readFile(FIXTURE));
		expect(catalogo.firmantesPropuestos.map((f) => f.funcion)).toEqual(['operador', 'autoriza']);
		expect(catalogo.firmantesPropuestos[0]).toMatchObject({
			cargo: 'Dirección Ficticia',
			empresa: 'EMPRESA FICTICIA'
		});
	});

	it('coincide con un libro generado al momento (el fixture está al día)', async () => {
		const generado = await analizarLibroCatalogo(
			await crearLibroSintetico({ partidas: PARTIDAS_EJEMPLO })
		);
		expect(await analizarLibroCatalogo(await readFile(FIXTURE))).toEqual(generado);
	});

	it('rechaza la estructura distinta e indica la hoja y la columna faltantes', async () => {
		const sinFrecuencia = await esperarErrorImportacion(
			analizarLibroCatalogo(
				await crearLibroSintetico({ partidas: PARTIDAS_EJEMPLO, omitirColumna: 'FRECUENCIA' })
			)
		);
		expect(sinFrecuencia).toMatchObject({
			hoja: 'Catálogo de Conceptos-ALCANCES',
			columna: 'FRECUENCIA'
		});
		const sinPR = await esperarErrorImportacion(
			analizarLibroCatalogo(
				await crearLibroSintetico({ partidas: PARTIDAS_EJEMPLO, omitirColumna: 'P/R' })
			)
		);
		expect(sinPR).toMatchObject({ hoja: 'PROGRAMA ANUAL 2026', columna: 'P/R' });
		expect(sinPR.message).toContain('P/R');
		await esperarErrorImportacion(analizarLibroCatalogo(new Uint8Array([1, 2, 3])));
	});

	it('clasifica alcances, notas y normas', () => {
		expect(clasificarLinea('·    Inspección visual')).toEqual({
			tipo: 'alcance',
			texto: 'Inspección visual'
		});
		expect(clasificarLinea('Nota: No incluye materiales')?.tipo).toBe('nota');
		expect(clasificarLinea('CONTROL DE LA CORROSIÓN EXTERNA')?.tipo).toBe('norma');
		expect(clasificarLinea('Brida WNRF De 8"')?.tipo).toBe('nota');
		expect(clasificarLinea('   ')).toBeNull();
	});
});

describe('importación sobre la base de datos', () => {
	let repos: Repositorios;
	let contratoId: string;
	let sitioId: string;

	beforeAll(async () => {
		repos = crearRepositorios(await crearClientePglite());
		const cliente = await repos.catalogo.guardarCliente({
			clave: 'ficticio',
			nombre: 'Ficticio',
			razonSocial: 'CLIENTE FICTICIO'
		});
		const contrato = await repos.catalogo.guardarContrato({
			clienteId: cliente.id,
			numero: 'OC-FICTICIA',
			descripcion: null,
			vigenciaInicio: '2026-05-01',
			vigenciaFin: '2027-04-30'
		});
		const sitio = await repos.catalogo.guardarSitio({
			clave: 'EM-99999',
			nombre: 'SITIO FICTICIO'
		});
		await repos.catalogo.asociarSitio(contrato.id, sitio.id);
		contratoId = contrato.id;
		sitioId = sitio.id;
	}, 60_000);

	afterAll(() => repos.cerrar());

	const carga = async (partidas = PARTIDAS_EJEMPLO) => {
		const catalogo = await analizarLibroCatalogo(await crearLibroSintetico({ partidas }));
		return { contratoId, sitioId, programa: catalogo.programa, partidas: catalogo.partidas };
	};

	it('el ensayo muestra lo que se creará sin guardar; al confirmar registra partidas y programa', async () => {
		const ensayo = await repos.catalogo.importarCatalogo(await carga(), true);
		expect(ensayo.resumen).toEqual({ crear: 3, actualizar: 0, sinCambios: 0 });
		expect(ensayo.programa.accion).toBe('crear');
		expect(await repos.catalogo.listarPartidas({ contratoId })).toEqual([]);

		const aplicado = await repos.catalogo.importarCatalogo(await carga(), false);
		expect(aplicado.resumen.crear).toBe(3);
		const partidas = await repos.catalogo.listarPartidas({ contratoId });
		expect(partidas.map((p) => p.numero)).toEqual(['1', '2', '3']);
		const detalle = await repos.catalogo.obtenerPartida(partidas[0].id);
		expect(detalle.alcances.map((a) => a.tipo)).toEqual(['alcance', 'alcance', 'nota']);
		const avance = await repos.programa.obtenerAvance(aplicado.programa.id!);
		const diaria = avance.partidas.find((p) => p.numero === '2')!;
		expect(diaria.totalProgramado).toBe(365);
		expect(diaria.diferencia).toBe(0);
		expect(diaria.celdas[0].realizado).toBe(31);
	});

	it('reimportar el mismo archivo informa que no hay cambios y no duplica', async () => {
		const otraVez = await repos.catalogo.importarCatalogo(await carga(), false);
		expect(otraVez.resumen).toEqual({ crear: 0, actualizar: 0, sinCambios: 3 });
		expect(otraVez.programa.accion).toBe('existente');
		expect(await repos.catalogo.listarPartidas({ contratoId })).toHaveLength(3);
		const avance = await repos.programa.obtenerAvance(otraVez.programa.id!);
		expect(avance.partidas.find((p) => p.numero === '2')!.celdas[0].realizado).toBe(31);
	});

	it('actualiza solo lo que cambió y conserva lo capturado fuera del Excel', async () => {
		const [primera] = await repos.catalogo.listarPartidas({ contratoId });
		const detalle = await repos.catalogo.obtenerPartida(primera.id);
		await repos.catalogo.guardarPartida({
			...detalle,
			objetivo: 'Objetivo capturado a mano',
			equipoIds: []
		});
		const cambiadas = PARTIDAS_EJEMPLO.map((p, i) =>
			i === 0 ? { ...p, alcances: [...p.alcances, '· Alcance nuevo'] } : p
		);
		const resultado = await repos.catalogo.importarCatalogo(await carga(cambiadas), false);
		expect(resultado.resumen).toEqual({ crear: 0, actualizar: 1, sinCambios: 2 });
		const actualizada = await repos.catalogo.obtenerPartida(primera.id);
		expect(actualizada.alcances.at(-1)).toMatchObject({ tipo: 'alcance', texto: 'Alcance nuevo' });
		expect(actualizada.objetivo).toBe('Objetivo capturado a mano');
	});

	it('reemplaza una partida derivada «por confirmar» al importar el catálogo oficial', async () => {
		const derivada = await repos.catalogo.guardarPartida({
			contratoId,
			sitioId,
			numero: '4',
			actividad: 'Derivada de reportes',
			periodicidad: 'mensual',
			estadoCatalogo: 'por_confirmar',
			alcances: [{ tipo: 'alcance', texto: 'Tomado de un reporte' }]
		});
		const oficial = [
			...PARTIDAS_EJEMPLO,
			{
				...PARTIDAS_EJEMPLO[0],
				numero: 4,
				actividad: 'Partida oficial',
				alcances: ['· Alcance oficial']
			}
		];
		const resultado = await repos.catalogo.importarCatalogo(await carga(oficial), false);
		expect(resultado.partidas.find((p) => p.numero === '4')).toMatchObject({
			accion: 'actualizar',
			estabaPorConfirmar: true
		});
		const confirmada = await repos.catalogo.obtenerPartida(derivada.id);
		expect(confirmada).toMatchObject({
			estadoCatalogo: 'confirmado',
			actividad: 'Partida oficial'
		});
		expect(confirmada.alcances.map((a) => a.texto)).toEqual(['Alcance oficial']);
	});

	it('filtra las partidas por confirmar y las confirma sin tocar su contenido', async () => {
		const derivada = await repos.catalogo.guardarPartida({
			contratoId,
			sitioId,
			numero: '50',
			actividad: 'Derivada pendiente',
			periodicidad: 'mensual',
			estadoCatalogo: 'por_confirmar',
			entregaOma: 'Tercer día hábil',
			alcances: [{ tipo: 'alcance', texto: 'Inspección\nDescripción base' }]
		});
		const pendientes = await repos.catalogo.listarPartidas({
			contratoId,
			estadoCatalogo: 'por_confirmar'
		});
		expect(pendientes.map((p) => p.numero)).toEqual(['50']);

		const confirmada = await repos.catalogo.confirmarPartida(derivada.id);
		expect(confirmada).toMatchObject({
			estadoCatalogo: 'confirmado',
			actividad: 'Derivada pendiente',
			entregaOma: 'Tercer día hábil'
		});
		expect(confirmada.alcances.map((a) => a.texto)).toEqual(['Inspección\nDescripción base']);
		expect(
			await repos.catalogo.listarPartidas({ contratoId, estadoCatalogo: 'por_confirmar' })
		).toEqual([]);
		await expect(
			repos.catalogo.confirmarPartida('00000000-0000-4000-8000-000000000000')
		).rejects.toMatchObject({ tipo: 'no_encontrado' });
	});

	it('no deja cambios parciales si una partida es inválida', async () => {
		const antes = await repos.catalogo.listarPartidas({ contratoId });
		const { partidas, ...resto } = await carga();
		const invalida = { ...partidas[0], numero: '99', actividad: 'Nueva válida' };
		const rota = { ...partidas[1], numero: '100', periodicidad: 'quinquenal' };
		await expect(
			repos.catalogo.importarCatalogo({ ...resto, partidas: [invalida, rota] }, false)
		).rejects.toMatchObject({
			tipo: 'invalido'
		});
		expect(await repos.catalogo.listarPartidas({ contratoId })).toEqual(antes);
	});
});

describe('correcciones de la revisión de la fase 4', () => {
	let repos: Repositorios;
	let contratoId: string;
	let sitioId: string;

	beforeAll(async () => {
		repos = crearRepositorios(await crearClientePglite());
		const cliente = await repos.catalogo.guardarCliente({
			clave: 'ficticio',
			nombre: 'Ficticio',
			razonSocial: 'CLIENTE FICTICIO'
		});
		const contrato = await repos.catalogo.guardarContrato({
			clienteId: cliente.id,
			numero: 'OC-FICTICIA',
			descripcion: null,
			vigenciaInicio: '2026-05-01',
			vigenciaFin: '2027-05-31'
		});
		const sitio = await repos.catalogo.guardarSitio({
			clave: 'EM-99999',
			nombre: 'SITIO FICTICIO'
		});
		await repos.catalogo.asociarSitio(contrato.id, sitio.id);
		contratoId = contrato.id;
		sitioId = sitio.id;
	}, 60_000);

	afterAll(() => repos.cerrar());

	const carga = async (partidas = PARTIDAS_EJEMPLO) => {
		const catalogo = await analizarLibroCatalogo(await crearLibroSintetico({ partidas }));
		return { contratoId, sitioId, programa: catalogo.programa, partidas: catalogo.partidas };
	};

	it('conserva la descripción capturada, que el libro no trae', async () => {
		await repos.catalogo.importarCatalogo(await carga(), false);
		const [primera] = await repos.catalogo.listarPartidas({ contratoId });
		const detalle = await repos.catalogo.obtenerPartida(primera.id);
		await repos.catalogo.guardarPartida({
			...detalle,
			descripcion: 'Introducción capturada a mano',
			equipoIds: []
		});
		const otraVez = await repos.catalogo.importarCatalogo(await carga(), false);
		expect(otraVez.resumen).toEqual({ crear: 0, actualizar: 0, sinCambios: 3 });
		const cambiadas = PARTIDAS_EJEMPLO.map((p, i) =>
			i === 0 ? { ...p, actividad: 'Orden y limpieza ficticia corregida' } : p
		);
		await repos.catalogo.importarCatalogo(await carga(cambiadas), false);
		expect((await repos.catalogo.obtenerPartida(primera.id)).descripcion).toBe(
			'Introducción capturada a mano'
		);
	});

	it('sincroniza las marcas R y conserva los realizados capturados a mano', async () => {
		const [programa] = await repos.programa.listarProgramas({ contratoId });
		const diaria = (await repos.catalogo.listarPartidas({ contratoId })).find(
			(p) => p.numero === '2'
		)!;
		await repos.programa.registrarRealizadoManual({
			programaId: programa.id,
			partidaId: diaria.id,
			mes: '2026-06-01',
			cantidad: 5,
			nota: 'Capturado a mano'
		});
		const sinR = PARTIDAS_EJEMPLO.map((p) => (p.numero === 2 ? { ...p, realizados: [] } : p));
		const ensayo = await repos.catalogo.importarCatalogo(await carga(sinR), true);
		expect(ensayo.partidas.find((p) => p.numero === '2')).toMatchObject({
			accion: 'actualizar',
			cambiaPrograma: true
		});
		await repos.catalogo.importarCatalogo(await carga(sinR), false);
		const celdas = (await repos.programa.obtenerAvance(programa.id)).partidas.find(
			(p) => p.numero === '2'
		)!.celdas;
		expect(celdas[0].realizado).toBe(0);
		expect(celdas[1].realizado).toBe(5);
	});

	it('actualiza el fin del periodo de un programa existente', async () => {
		const base = await carga();
		const extendido = { ...base, programa: { ...base.programa!, periodoFin: '2027-05-31' } };
		const ensayo = await repos.catalogo.importarCatalogo(extendido, true);
		expect(ensayo.programa.accion).toBe('actualizar');
		await repos.catalogo.importarCatalogo(extendido, false);
		const [programa] = await repos.programa.listarProgramas({ contratoId });
		expect(programa.periodoFin).toBe('2027-05-31');
		expect(programa.meses).toHaveLength(13);
	});
});
