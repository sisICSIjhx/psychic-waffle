import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from '../repositorios/index';
import { ErrorImportacion, rangosDeMeses } from './catalogo';
import {
	crearLibroSintetico,
	crearProgramaSintetico,
	PARTIDAS_EJEMPLO,
	semanasDelMes,
	type PartidaProgramaSintetica
} from './libro-sintetico';
import {
	actividadSinPeriodicidad,
	advertenciasDelEnsayo,
	analizarAjustes,
	analizarProgramaAnual,
	aplicarAjustes,
	cargaDePrograma,
	tipoDeLibro,
	validarAjusteVigencia
} from './programa';
import { guardarImportacionPendiente, tomarImportacionPendiente } from './temporal';
import { leerLibro, type Hoja } from './xlsx';

const doce = Array.from({ length: 12 }, (_, m) => m * 4);
const semanal = Array.from({ length: 48 }, (_, c) => c);

const mensual = (
	numero: number,
	cambios: Partial<PartidaProgramaSintetica> = {}
): PartidaProgramaSintetica => ({
	numero,
	actividad: `ACTIVIDAD FICTICIA ${numero} (MENSUAL)`,
	cantidad: 12,
	periodicidad: 'MENSUAL',
	marcas: doce,
	...cambios
});

const BLOQUES = [
	{
		clave: '11111',
		partidas: [
			{
				numero: 1,
				actividad: 'RECORRIDO FICTICIO (SEMANAL).',
				cantidad: 48,
				periodicidad: 'SEMANAL',
				marcas: semanal
			},
			mensual(2, { realizados: [4] }),
			{
				numero: 3,
				actividad: 'REVISIÓN FICTICIA, TRIMESTRAL',
				cantidad: 4,
				periodicidad: 'TRIMESTRAL',
				marcas: semanasDelMes(0).concat(semanasDelMes(3), semanasDelMes(6), semanasDelMes(9))
			}
		]
	},
	{
		clave: '22222',
		partidas: [
			mensual(1, { marcas: doce.filter((c) => c !== 36), cantidad: 12 }),
			{
				numero: 2,
				actividad: 'DISPOSICION FICTICIA MENSUAL',
				cantidad: 3,
				periodicidad: 'MENSUAL',
				marcas: [4, 20, 36],
				roja: true
			}
		]
	}
];

async function hojasDe(opciones: Parameters<typeof crearProgramaSintetico>[0]): Promise<Hoja[]> {
	return leerLibro(await crearProgramaSintetico(opciones));
}

describe('lectura del libro', () => {
	it('lee las columnas y las filas ocultas', async () => {
		const [hoja] = await hojasDe({
			bloques: [{ clave: '11111', partidas: [mensual(1, { oculta: true })] }]
		});
		expect([...hoja.columnasOcultas]).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
		expect([...hoja.filasOcultas]).toEqual([10]);
	});

	it('distingue el tipo de libro', async () => {
		expect(
			tipoDeLibro(await leerLibro(await crearLibroSintetico({ partidas: PARTIDAS_EJEMPLO })))
		).toBe('catalogo');
		expect(tipoDeLibro(await hojasDe({ bloques: BLOQUES }))).toBe('programa');
		const otro: Hoja = {
			nombre: 'Hoja1',
			filas: [['Nada']],
			combinadas: [],
			rellenos: [],
			columnasOcultas: new Set(),
			filasOcultas: new Set()
		};
		expect(() => tipoDeLibro([otro])).toThrow(/dos formatos/);
	});
});

describe('meses y periodo', () => {
	it('toma el año del título, cambia de año en enero e ignora los meses ocultos', async () => {
		const analisis = analizarProgramaAnual(await hojasDe({ bloques: BLOQUES }), {
			claveSitio: 'EM-11111'
		});
		expect(analisis.programa).toEqual({
			periodoInicio: '2026-03-01',
			periodoFin: '2027-02-28',
			nombre: null
		});
		expect(analisis.partidas[1].meses.at(-1)).toEqual({ mes: '2027-02-01', cantidad: 1 });
	});

	it('cuenta la marca en la última columna del último mes, combinado o no', async () => {
		for (const ultimoMesSinCombinar of [false, true]) {
			const analisis = analizarProgramaAnual(
				await hojasDe({
					bloques: [
						{ clave: '11111', partidas: [mensual(1, { marcas: doce.slice(0, 11).concat(47) })] }
					],
					ultimoMesSinCombinar
				}),
				{ claveSitio: 'EM-11111' }
			);
			expect(analisis.partidas[0].meses).toHaveLength(12);
		}
	});

	it('usa el año indicado si el libro no lo trae y lo exige si falta', async () => {
		const hojas = await hojasDe({ bloques: BLOQUES, titulo: null });
		expect(() => analizarProgramaAnual(hojas, { claveSitio: 'EM-11111' })).toThrow(/año/);
		expect(
			analizarProgramaAnual(hojas, { claveSitio: 'EM-11111', anio: 2030 }).programa.periodoInicio
		).toBe('2030-03-01');
	});

	it('da a un último mes sin combinar el ancho del anterior', () => {
		const hoja = {
			combinadas: [{ filaInicio: 0, columnaInicio: 2, filaFin: 0, columnaFin: 5 }]
		} as unknown as Hoja;
		expect(rangosDeMeses(hoja, 0, [{ columna: 2 }, { columna: 6 }])).toEqual([
			{ columna: 2, hasta: 5 },
			{ columna: 6, hasta: 9 }
		]);
	});
});

describe('bloques por sitio', () => {
	it('toma el primer bloque por el encabezado y el segundo por su separadora', async () => {
		const hojas = await hojasDe({ bloques: BLOQUES });
		const primero = analizarProgramaAnual(hojas, { claveSitio: 'EM-11111' });
		const segundo = analizarProgramaAnual(hojas, { claveSitio: 'ERM 22222' });
		expect(primero.bloques).toEqual(['11111', '22222']);
		expect(primero.partidas.map((p) => p.numero)).toEqual(['1', '2', '3']);
		expect(segundo.partidas.map((p) => p.numero)).toEqual(['1', '2']);
		expect(segundo.sitio).toBe('ERM 22222');
	});

	it('rechaza un sitio que el libro no trae, nombrando sus bloques', async () => {
		const hojas = await hojasDe({ bloques: BLOQUES });
		expect(() => analizarProgramaAnual(hojas, { claveSitio: 'EM-33333' })).toThrow(
			'Sitios del libro: ERM 11111, ERM 22222'
		);
	});

	it('rechaza un número repetido dentro del bloque', async () => {
		const hojas = await hojasDe({
			bloques: [{ clave: '11111', partidas: [mensual(1), mensual(1)] }]
		});
		expect(() => analizarProgramaAnual(hojas, { claveSitio: 'EM-11111' })).toThrow(
			/se repite en las filas 11 y 13/
		);
	});
});

describe('columnas, marcas y actividad', () => {
	it('rechaza una periodicidad no reconocida y una cantidad que no es número', async () => {
		const rara = await hojasDe({
			bloques: [{ clave: '11111', partidas: [mensual(1, { periodicidad: 'CADA RATO' })] }]
		});
		expect(() => analizarProgramaAnual(rara, { claveSitio: 'EM-11111' })).toThrow(
			/periodicidad no reconocida en la columna E: «CADA RATO»/
		);
	});

	it('cuenta semanales por marcas, mensuales por mes y la fila R', async () => {
		const analisis = analizarProgramaAnual(await hojasDe({ bloques: BLOQUES }), {
			claveSitio: 'EM-11111'
		});
		const [semanalP, mensualP, trimestral] = analisis.partidas;
		expect(semanalP.periodicidad).toBe('semanal');
		expect(semanalP.meses.reduce((s, m) => s + m.cantidad, 0)).toBe(48);
		expect(semanalP.meses[0]).toEqual({ mes: '2026-03-01', cantidad: 4 });
		expect(mensualP.realizados).toEqual([{ mes: '2026-04-01', cantidad: 1 }]);
		expect(trimestral.meses.map((m) => m.mes)).toEqual([
			'2026-03-01',
			'2026-06-01',
			'2026-09-01',
			'2026-12-01'
		]);
	});

	it('cuenta la diaria por días del mes y deja sin meses «cuando aplique»', async () => {
		const analisis = analizarProgramaAnual(
			await hojasDe({
				bloques: [
					{
						clave: '11111',
						partidas: [
							mensual(1, { periodicidad: 'DIARIA', cantidad: 365 }),
							mensual(2, { periodicidad: 'CUANDO APLIQUE', cantidad: null })
						]
					}
				]
			}),
			{ claveSitio: 'EM-11111' }
		);
		expect(analisis.partidas[0].meses[0]).toEqual({ mes: '2026-03-01', cantidad: 31 });
		expect(analisis.partidas[1].meses).toEqual([]);
		expect(analisis.partidas[1].cantidadAnual).toBeNull();
	});

	it('no cuenta el relleno blanco y avisa de dos marcas en un mes de una mensual', async () => {
		const analisis = analizarProgramaAnual(
			await hojasDe({
				bloques: [
					{
						clave: '11111',
						partidas: [mensual(1, { marcas: [...doce, 1], marcasBlancas: [5] })]
					}
				]
			}),
			{ claveSitio: 'EM-11111' }
		);
		expect(analisis.partidas[0].meses).toHaveLength(12);
		expect(analisis.advertencias.map((a) => a.texto)).toContain(
			'ERM 11111, partida 1: tiene 2 marcas en 2026-03; cuenta 1.'
		);
	});

	it('ignora con advertencia un texto que no es marca en la fila R', async () => {
		const analisis = analizarProgramaAnual(
			await hojasDe({
				bloques: [
					{ clave: '11111', partidas: [mensual(1, { textosR: [{ columna: 24, valor: '.' }] })] }
				]
			}),
			{ claveSitio: 'EM-11111' }
		);
		expect(analisis.partidas[0].realizados).toEqual([]);
		expect(analisis.advertencias[0].texto).toMatch(/se ignora el valor «\.» de .*\(2026-09\)/);
	});

	it('quita la periodicidad final de la actividad y conserva los paréntesis internos', () => {
		expect(actividadSinPeriodicidad('RECORRIDO (SEMANAL).')).toBe('RECORRIDO');
		expect(actividadSinPeriodicidad('LIMPIEZA (MENSUAL)')).toBe('LIMPIEZA');
		expect(actividadSinPeriodicidad('REVISIÓN, MENSUAL')).toBe('REVISIÓN');
		expect(actividadSinPeriodicidad('INSPECCIÓN MENSUAL.')).toBe('INSPECCIÓN');
		expect(
			actividadSinPeriodicidad('MANTENIMIENTO A POSTES TIPO "R" (PROTECCION CATODICA) MENSUAL.')
		).toBe('MANTENIMIENTO A POSTES TIPO "R" (PROTECCION CATODICA)');
	});
});

describe('advertencias del libro', () => {
	it('informa suma distinta, mensual sin marca, fila roja, R sin P, ocultas y fila oculta', async () => {
		const hojas = await hojasDe({
			bloques: [
				{
					clave: '11111',
					partidas: [
						mensual(1, { marcas: doce.filter((c) => c !== 36) }),
						mensual(2, { roja: true, realizados: [1, 6], marcas: doce.filter((c) => c !== 4) }),
						mensual(3, { marcasOcultas: [0, 5], oculta: true })
					]
				}
			]
		});
		const textos = analizarProgramaAnual(hojas, { claveSitio: 'EM-11111' }).advertencias.map(
			(a) => a.texto
		);
		expect(textos).toEqual(
			expect.arrayContaining([
				'ERM 11111, partida 1: la cantidad anual es 12 y las marcas suman 11.',
				'ERM 11111, partida 1: es mensual y no tiene marca en 2026-12.',
				'ERM 11111, partida 2: la fila está resaltada en rojo en el libro.',
				'ERM 11111, partida 2: tiene realizado en 2026-04 sin programado (P) en ese mes.',
				'ERM 11111, partida 3: se ignoran 2 marcas en columnas ocultas (G, L).',
				'ERM 11111, partida 3: la fila está oculta en el libro.'
			])
		);
	});
});

describe('ajustes del CLI y vigencia', () => {
	it('cambia la periodicidad, marca la actividad y rechaza números ajenos', async () => {
		const analisis = analizarProgramaAnual(await hojasDe({ bloques: BLOQUES }), {
			claveSitio: 'EM-22222'
		});
		const ajustada = aplicarAjustes(analisis, analizarAjustes(['2=cuatrimestral'], ['2']));
		const p = ajustada.partidas[1];
		expect(p.periodicidad).toBe('cuatrimestral');
		expect(p.usarActividad).toBe(true);
		expect(p.actividad).toBe('DISPOSICION FICTICIA');
		expect(ajustada.advertencias.some((a) => a.partida === '2' && /es mensual/.test(a.texto))).toBe(
			false
		);
		expect(cargaDePrograma(ajustada, 'c', 's').partidas[1]).toMatchObject({
			usarActividad: true,
			periodicidad: 'cuatrimestral',
			cantidadAnual: 3
		});
		expect(() => analizarAjustes(['2=cada rato'], [])).toThrow(/Periodicidad inválida/);
		expect(() => aplicarAjustes(analisis, analizarAjustes(['9=mensual'], []))).toThrow(
			/La partida 9 no está en el sitio/
		);
	});

	it('valida la vigencia nueva contra el programa, los reportes y otros programas', () => {
		const programa = { periodoInicio: '2026-03-01', periodoFin: '2027-02-28' };
		const vigencia = { vigenciaInicio: '2026-03-01', vigenciaFin: '2027-02-28' };
		expect(validarAjusteVigencia(vigencia, programa, [], [])).toEqual([]);
		expect(
			validarAjusteVigencia({ ...vigencia, vigenciaFin: '2026-12-31' }, programa, [], [])[0]
		).toMatch(/no contiene el periodo/);
		expect(
			validarAjusteVigencia(vigencia, programa, [{ periodoMes: '2027-04-01' }], [])[0]
		).toMatch(/deja fuera 1 reportes del contrato \(2027-04\)/);
	});

	it('advierte los meses fuera de la vigencia del contrato', async () => {
		const analisis = analizarProgramaAnual(await hojasDe({ bloques: BLOQUES }), {
			claveSitio: 'EM-11111'
		});
		const contrato = { numero: 'OC', vigenciaInicio: '2026-05-01', vigenciaFin: '2027-04-30' };
		expect(advertenciasDelEnsayo(analisis, { partidas: [] }, contrato)[0].texto).toMatch(
			/no se podrán capturar reportes de 2026-03, 2026-04\./
		);
		const igual = { ...contrato, vigenciaInicio: '2026-03-01', vigenciaFin: '2027-02-28' };
		expect(
			advertenciasDelEnsayo(analisis, { partidas: [] }, igual).some((a) => /vigencia/.test(a.texto))
		).toBe(false);
	});
});

describe('carga pendiente', () => {
	it('recupera el tipo y trata como catálogo una carga sin tipo', async () => {
		const carpeta = await mkdtemp(join(tmpdir(), 'importaciones-'));
		try {
			const id = await guardarImportacionPendiente(carpeta, {
				tipo: 'programa',
				contratoId: 'c',
				sitioId: 's',
				programa: { periodoInicio: '2026-03-01', periodoFin: '2027-02-28' },
				partidas: []
			});
			expect((await tomarImportacionPendiente(carpeta, id, 'c'))?.tipo).toBe('programa');
			const antigua = '00000000-0000-4000-8000-000000000001';
			await mkdir(join(carpeta, 'importaciones'), { recursive: true });
			await writeFile(
				join(carpeta, 'importaciones', `${antigua}.json`),
				JSON.stringify({ contratoId: 'c', sitioId: 's', programa: null, partidas: [] })
			);
			expect((await tomarImportacionPendiente(carpeta, antigua, 'c'))?.tipo).toBe('catalogo');
		} finally {
			await rm(carpeta, { recursive: true, force: true });
		}
	});
});

describe('api_importar_programa sobre la base', () => {
	let repos: Repositorios;
	let contratoId: string;
	let sitioId: string;
	let otroSitioId: string;

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
			vigenciaInicio: '2026-03-01',
			vigenciaFin: '2027-02-28'
		});
		const sitio = await repos.catalogo.guardarSitio({ clave: 'EM-11111', nombre: 'UNO' });
		const otro = await repos.catalogo.guardarSitio({ clave: 'EM-22222', nombre: 'DOS' });
		await repos.catalogo.asociarSitio(contrato.id, sitio.id);
		contratoId = contrato.id;
		sitioId = sitio.id;
		otroSitioId = otro.id;
		// Partida previa con datos del catálogo que la importación de programa no debe tocar.
		await repos.catalogo.importarCatalogo(
			{
				contratoId,
				sitioId,
				programa: null,
				partidas: [
					{
						numero: '2',
						actividad: 'Actividad capturada',
						distribucion: 'produccion',
						periodicidad: 'mensual',
						cantidadAnual: null,
						entrega: 'Reporte',
						entregaOma: null,
						entregaPropuesta: null,
						requiereOdm: true,
						requierePt: true,
						requiereAst: false,
						materialesPor: 'icsi',
						reportesHomologados: null,
						alcances: [{ tipo: 'alcance', texto: 'Alcance capturado' }],
						meses: [],
						realizados: []
					}
				]
			},
			false
		);
	}, 60_000);

	afterAll(() => repos.cerrar());

	const carga = async (opciones: { confirmar?: boolean; usarActividad?: string[] } = {}) => {
		const analisis = aplicarAjustes(
			analizarProgramaAnual(await hojasDe({ bloques: BLOQUES }), { claveSitio: 'EM-11111' }),
			analizarAjustes([], opciones.usarActividad ?? [])
		);
		return cargaDePrograma(analisis, contratoId, sitioId, opciones.confirmar);
	};

	it('el ensayo no escribe; al aplicar crea el programa y solo cambia periodicidad y cantidad', async () => {
		const ensayo = await repos.programa.importarPrograma(await carga(), true);
		expect(ensayo.programa.accion).toBe('crear');
		expect(ensayo.resumen).toEqual({ crear: 2, actualizar: 1, sinCambios: 0 });
		expect(await repos.programa.listarProgramas({ contratoId })).toEqual([]);

		const aplicado = await repos.programa.importarPrograma(await carga(), false);
		const existente = aplicado.partidas.find((p) => p.numero === '2')!;
		expect(existente).toMatchObject({
			accion: 'actualizar',
			actividad: 'Actividad capturada',
			cantidadAntes: null,
			cantidadAnual: 12,
			estabaPorConfirmar: false,
			tieneReportes: false
		});
		expect(aplicado.partidas.find((p) => p.numero === '1')?.quedaPorConfirmar).toBe(true);
		const partidas = await repos.catalogo.listarPartidas({ contratoId });
		const detalle = await repos.catalogo.obtenerPartida(partidas.find((p) => p.numero === '2')!.id);
		expect(detalle).toMatchObject({
			actividad: 'Actividad capturada',
			cantidadAnual: 12,
			distribucion: 'produccion',
			requiereOdm: true,
			requierePt: true,
			estadoCatalogo: 'confirmado'
		});
		expect(detalle.alcances.map((a) => a.texto)).toEqual(['Alcance capturado']);
		const nueva = partidas.find((p) => p.numero === '3')!;
		expect(nueva).toMatchObject({ periodicidad: 'trimestral', estadoCatalogo: 'por_confirmar' });
		const avance = await repos.programa.obtenerAvance(aplicado.programa.id!);
		expect(avance.partidas.find((p) => p.numero === '2')?.celdas[1].realizado).toBe(1);
	});

	it('reimportar no cambia nada; «usarActividad» y «confirmar» se aplican si se piden', async () => {
		const otraVez = await repos.programa.importarPrograma(await carga(), false);
		expect(otraVez.programa.accion).toBe('existente');
		expect(otraVez.resumen).toEqual({ crear: 0, actualizar: 0, sinCambios: 3 });
		const conActividad = await repos.programa.importarPrograma(
			await carga({ usarActividad: ['2'], confirmar: true }),
			false
		);
		expect(conActividad.partidas.find((p) => p.numero === '2')?.actividad).toBe(
			'ACTIVIDAD FICTICIA 2'
		);
		const partidas = await repos.catalogo.listarPartidas({ contratoId });
		expect(partidas.every((p) => p.estadoCatalogo === 'confirmado')).toBe(true);
	});

	it('informa las partidas no incluidas y conserva los realizados manuales', async () => {
		const programa = (await repos.programa.listarProgramas({ contratoId }))[0];
		const partida = (await repos.catalogo.listarPartidas({ contratoId })).find(
			(p) => p.numero === '3'
		)!;
		await repos.programa.registrarRealizadoManual({
			programaId: programa.id,
			partidaId: partida.id,
			mes: '2026-03-01',
			nota: 'Registro manual ficticio'
		});
		const sinTres = await carga();
		sinTres.partidas = sinTres.partidas.filter((p) => p.numero !== '3');
		const resultado = await repos.programa.importarPrograma(sinTres, false);
		expect(resultado.noIncluidas.map((p) => p.numero)).toEqual(['3']);
		const avance = await repos.programa.obtenerAvance(programa.id);
		expect(avance.partidas.find((p) => p.numero === '3')?.celdas[0].realizado).toBe(1);
	});

	it('rechaza un programa superpuesto y un sitio de otro contrato, también en el ensayo', async () => {
		const superpuesto = await carga();
		superpuesto.programa = { periodoInicio: '2026-04-01', periodoFin: '2027-03-31' };
		await expect(repos.programa.importarPrograma(superpuesto, true)).rejects.toMatchObject({
			codigo: 'IC422'
		});
		const ajeno = { ...(await carga()), sitioId: otroSitioId };
		await expect(repos.programa.importarPrograma(ajeno, true)).rejects.toThrow(
			/no pertenece al contrato/
		);
	});

	it('no deja cambios si una partida es inválida', async () => {
		const antes = await repos.catalogo.listarPartidas({ contratoId });
		const invalida = await carga();
		invalida.partidas[0] = { ...invalida.partidas[0], numero: '99', periodicidad: 'inexistente' };
		await expect(repos.programa.importarPrograma(invalida, false)).rejects.toBeInstanceOf(Error);
		expect(await repos.catalogo.listarPartidas({ contratoId })).toEqual(antes);
	});

	it('el error de estructura conserva su tipo', () => {
		expect(new ErrorImportacion('x', 'h')).toBeInstanceOf(Error);
	});
});
