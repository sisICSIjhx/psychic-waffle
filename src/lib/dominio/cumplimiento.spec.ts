import { describe, expect, it } from 'vitest';
import { ocurrenciasDelMes, rangoDelPeriodo } from './captura';
import {
	anotacionesCelda,
	desglosePorPartida,
	partidasDelMes,
	reportesQueFaltan,
	diasDePartida,
	semanasDePartida,
	tablaCumplimiento,
	tendencia,
	type EjecucionDelMes,
	type ProgramaCumplimiento,
	detalleCelda,
	estadoDocumental,
	estadoEjecucion,
	indicadores,
	porcentajes,
	semaforo,
	textoDocumental,
	textoPorcentaje,
	UMBRALES,
	type CeldaEvaluable
} from './cumplimiento';

const HOY = '2026-10-21';

const celda = (mes: string, cambios: Partial<CeldaEvaluable> = {}): CeldaEvaluable => ({
	mes,
	programado: 1,
	ejecucionesReportes: 0,
	realizadoSinReporte: 0,
	...cambios
});

const reprogramacion = (origen: string, destino: string, cantidad = 1) => ({
	id: `${origen}-${destino}`,
	tipo: 'reprogramado' as const,
	mesOrigen: origen,
	mesDestino: destino,
	cantidad,
	motivo: 'clima',
	nota: null
});

describe('estado de ejecución por partida y mes', () => {
	it('distingue vencido, pendiente y programado según el mes', () => {
		expect(estadoEjecucion(celda('2026-06-01'), HOY)).toBe('vencido');
		expect(estadoEjecucion(celda('2026-10-01'), HOY)).toBe('pendiente');
		expect(estadoEjecucion(celda('2026-11-01'), HOY)).toBe('programado');
	});

	it('marca reprogramado cuando todo salió, sin contarlo como vencido', () => {
		const junio = celda('2026-06-01', {
			salida: 1,
			ajustes: [reprogramacion('2026-06-01', '2026-10-01')]
		});
		expect(estadoEjecucion(junio, HOY)).toBe('reprogramado');
		expect(anotacionesCelda(junio)).toEqual(['→ oct']);
		expect(estadoDocumental(junio)).toBe('ninguno');
		const octubre = celda('2026-10-01', {
			programado: 1,
			entrada: 1,
			ajustes: [reprogramacion('2026-06-01', '2026-10-01')]
		});
		expect(anotacionesCelda(octubre)).toEqual(['+1 desde jun']);
	});

	it('ejecución parcial con no ejecutado, realizado sin reporte, extra y de más', () => {
		const semanal = celda('2026-06-01', { programado: 4, ejecucionesReportes: 3, noEjecutado: 1 });
		expect(estadoEjecucion(semanal, HOY)).toBe('no_ejecutado');
		expect(detalleCelda(semanal, HOY)).toBe('3 de 4 ejecutadas');
		const manual = celda('2026-05-01', { realizadoSinReporte: 1 });
		expect(estadoEjecucion(manual, HOY)).toBe('ejecutado');
		expect(estadoDocumental(manual)).toBe('sin_reporte');
		expect(
			estadoEjecucion(celda('2026-05-01', { programado: null, ejecucionesReportes: 1 }), HOY)
		).toBe('extra');
		expect(estadoEjecucion(celda('2026-05-01', { programado: 0 }), HOY)).toBe('sin_programa');
		expect(detalleCelda(celda('2026-05-01', { realizadoSinReporte: 2 }), HOY)).toBe('1 de más');
	});
});

describe('estado documental', () => {
	it('con reporte, en revisión y en borrador', () => {
		expect(estadoDocumental(celda('2026-10-01', { ejecucionesReportes: 1 }))).toBe('con_reporte');
		const enRevision = celda('2026-10-01', {
			reportesAbiertos: [{ id: 'a', estado: 'en_revision' }]
		});
		expect(textoDocumental(enRevision)).toBe('Reporte en borrador (en revisión)');
		expect(
			textoDocumental(celda('2026-10-01', { reportesAbiertos: [{ id: 'b', estado: 'borrador' }] }))
		).toBe('Reporte en borrador');
		expect(textoDocumental(celda('2026-10-01'))).toBe('Sin reporte');
	});
});

describe('indicadores al mes de corte', () => {
	// PR 10 hasta octubre: 6 ejecutadas en su mes, 2 reprogramadas (una ejecutada en un mes evaluado y
	// otra a diciembre, después del corte), 1 no ejecutada y 1 vencida sin ajuste.
	const sitio: CeldaEvaluable[] = [
		...Array.from({ length: 6 }, (_, i) => celda(`2026-0${i + 1}-01`, { ejecucionesReportes: 1 })),
		celda('2026-07-01', { salida: 1, ajustes: [reprogramacion('2026-07-01', '2026-09-01')] }),
		celda('2026-08-01', { salida: 1, ajustes: [reprogramacion('2026-08-01', '2026-12-01')] }),
		celda('2026-09-01', {
			programado: 1,
			entrada: 1,
			noEjecutado: 1,
			ejecucionesReportes: 1,
			ajustes: [reprogramacion('2026-07-01', '2026-09-01')]
		}),
		celda('2026-10-01', { programado: 1 }),
		celda('2026-12-01', { programado: 0, entrada: 1 })
	];

	it('cumple el ejemplo de la spec y la identidad PR = E + N + P', () => {
		// Con hoy en noviembre, octubre ya terminó: su faltante es vencido (N).
		const i = indicadores(sitio, '2026-10-01', '2026-11-05');
		expect(i).toMatchObject({ PR: 10, E: 7, R: 2, N: 2, P: 1, extras: 0 });
		expect(i.PR).toBe(i.E + i.N + i.P);
	});

	it('el mes en curso es P y el corte anterior limita los meses', () => {
		const i = indicadores(sitio, '2026-10-01', HOY);
		expect(i).toMatchObject({ E: 7, N: 1, P: 2 });
		expect(indicadores(sitio, '2026-08-01', HOY)).toMatchObject({ PR: 8, E: 6, R: 2, P: 2 });
	});

	it('las ejecuciones de más van a extras y no a los porcentajes', () => {
		const i = indicadores([celda('2026-05-01', { realizadoSinReporte: 2 })], '2026-10-01', HOY);
		expect(i).toMatchObject({ E: 1, extras: 1 });
		expect(porcentajes(i).cumplimiento).toBe(100);
	});

	it('mantiene la identidad con reprogramaciones dentro y fuera del corte', () => {
		const casos: CeldaEvaluable[][] = [
			[
				celda('2026-03-01', { salida: 1, ajustes: [reprogramacion('2026-03-01', '2026-05-01')] }),
				celda('2026-05-01', { programado: 0, entrada: 1 })
			],
			[
				celda('2026-03-01', {
					programado: 2,
					salida: 2,
					ajustes: [reprogramacion('2026-03-01', '2027-01-01', 2)]
				})
			],
			[celda('2026-09-01', { programado: 3, noEjecutado: 1, ejecucionesReportes: 1 })]
		];
		for (const caso of casos) {
			const i = indicadores(caso, '2026-10-01', HOY);
			expect(i.PR, JSON.stringify(caso)).toBe(i.E + i.N + i.P);
		}
	});
});

describe('porcentajes y semáforos', () => {
	it('trunca y clasifica con el valor sin redondear', () => {
		const p = porcentajes({ PR: 10, E: 7, R: 2, N: 2, P: 1, extras: 0, conReporte: 5 });
		expect([p.cumplimiento, p.efectividad, p.conReporte].map(textoPorcentaje)).toEqual([
			'77 %',
			'77 %',
			'71 %'
		]);
		const vacio = porcentajes({ PR: 1, E: 0, R: 0, N: 0, P: 1, extras: 0, conReporte: 0 });
		expect(textoPorcentaje(vacio.cumplimiento)).toBe('—');
		expect(semaforo(vacio.cumplimiento, UMBRALES.cumplimiento)).toBeNull();
		expect([textoPorcentaje(89.9), semaforo(89.9, UMBRALES.cumplimiento)]).toEqual([
			'89 %',
			'amarillo'
		]);
		expect([textoPorcentaje(90), semaforo(90, UMBRALES.cumplimiento)]).toEqual(['90 %', 'verde']);
		expect([textoPorcentaje(59.5), semaforo(59.5, UMBRALES.efectividad)]).toEqual(['59 %', 'rojo']);
	});
});

describe('tablero: tabla, tendencia y reportes que faltan', () => {
	const programa = (
		contrato: string,
		sitio: string,
		partidas: { numero: string; periodicidad: string; celdas: CeldaEvaluable[] }[]
	): ProgramaCumplimiento => ({
		contrato: { id: contrato, numero: `OC-${contrato}` },
		sitio: { id: sitio, clave: `EM-${sitio}`, nombre: '' },
		avance: {
			programa: {
				id: `${contrato}-${sitio}`,
				periodoInicio: '2026-05-01',
				periodoFin: '2027-04-30'
			},
			partidas: partidas.map((p) => ({
				id: `${sitio}-${p.numero}`,
				actividad: `Partida ${p.numero}`,
				...p
			}))
		}
	});
	const proagro = [
		programa('p', '30184', [
			{
				numero: '1',
				periodicidad: 'mensual',
				celdas: [celda('2026-05-01', { ejecucionesReportes: 1 })]
			},
			{
				numero: '2',
				periodicidad: 'semanal',
				celdas: [celda('2026-06-01', { programado: 4, ejecucionesReportes: 2 })]
			}
		]),
		programa('p', '30185', [
			{
				numero: '3',
				periodicidad: 'mensual',
				celdas: [
					celda('2026-06-01', { salida: 1, ajustes: [reprogramacion('2026-06-01', '2026-10-01')] }),
					celda('2026-10-01', {
						programado: 0,
						entrada: 1,
						reportesAbiertos: [{ id: 'b1', estado: 'borrador' }]
					})
				]
			},
			{
				numero: '4',
				periodicidad: 'mensual',
				celdas: [celda('2026-07-01', { realizadoSinReporte: 1 })]
			}
		])
	];

	it('suma los sitios en el subtotal del contrato y filtra por periodicidad', () => {
		const { contratos, total } = tablaCumplimiento(proagro, '2026-10-01', HOY);
		expect(contratos).toHaveLength(1);
		expect(contratos[0].sitios.map((s) => s.programa.sitio.clave)).toEqual([
			'EM-30184',
			'EM-30185'
		]);
		expect(contratos[0].subtotal).toEqual(total);
		expect(total).toMatchObject({ PR: 7, E: 4, R: 1, N: 2, P: 1 });
		const semanal = tablaCumplimiento(proagro, '2026-10-01', HOY, 'semanal');
		expect(semanal.total).toMatchObject({ PR: 4, E: 2, N: 2 });
		expect(desglosePorPartida(proagro[0], '2026-10-01', HOY).map((d) => d.partida.numero)).toEqual([
			'1',
			'2'
		]);
	});

	it('la tendencia evalúa cada mes con sus celdas y deja «—» el mes sin datos', () => {
		const t = tendencia(proagro, '2026-08-01', HOY);
		expect(t.map((x) => x.mes)).toEqual(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01']);
		expect(textoPorcentaje(t[0].cumplimiento)).toBe('100 %');
		expect(t[3]).toEqual({ mes: '2026-08-01', cumplimiento: null, efectividad: null });
	});

	it('agrupa los reportes que faltan por precedencia sin el mes de origen de lo reprogramado', () => {
		const grupos = reportesQueFaltan(proagro, '2026-10-01', HOY);
		expect(grupos.abiertos.map((r) => [r.numero, r.mes, r.reporteId])).toEqual([
			['3', '2026-10-01', 'b1']
		]);
		expect(grupos.vencidos.map((r) => [r.numero, r.mes, r.cantidad])).toEqual([
			['2', '2026-06-01', 2]
		]);
		expect(grupos.ejecutadosSinReporte.map((r) => [r.numero, r.mes])).toEqual([
			['4', '2026-07-01']
		]);
		expect(
			[...grupos.abiertos, ...grupos.vencidos, ...grupos.ejecutadosSinReporte].some(
				(r) => r.numero === '3' && r.mes === '2026-06-01'
			)
		).toBe(false);
	});
});

describe('vista mensual y semanal', () => {
	it('ordena el mes por urgencia', () => {
		const partidas = [
			{ numero: '1', celdas: [celda('2026-10-01', { ejecucionesReportes: 1 })] },
			{ numero: '2', celdas: [celda('2026-10-01')] },
			{ numero: '3', celdas: [celda('2026-10-01', { noEjecutado: 1 })] },
			{ numero: '4', celdas: [celda('2026-10-01', { programado: 0 })] }
		];
		expect(
			partidasDelMes(partidas, '2026-10-01', HOY).map((p) => [p.partida.numero, p.estado])
		).toEqual([
			['2', 'pendiente'],
			['3', 'no_ejecutado'],
			['1', 'ejecutado']
		]);
	});

	const ejecucion = (cambios: Partial<EjecucionDelMes>): EjecucionDelMes => ({
		id: 'r',
		partidaId: 'x',
		estado: 'emitido',
		ocurrencia: null,
		reprogramacionId: null,
		diasEjecucion: [],
		...cambios
	});

	/** Semanas de lunes a domingo del mes, recortadas al mes. */
	const semanasDe = (mes: string) =>
		ocurrenciasDelMes('semana', mes).map((numero) => ({
			numero,
			...rangoDelPeriodo(mes, { tipo: 'semana', numero })!
		}));
	const resumen = (celdas: ReturnType<typeof semanasDePartida>) =>
		celdas.map((c) => (c ? `${c.estado} · ${c.documento}` : null));

	// Octubre de 2026 empieza en jueves: semanas 1-4, 5-11, 12-18, 19-25 (la de HOY) y 26-31.
	const OCTUBRE = semanasDe('2026-10-01');

	it('marca cada semana de una partida semanal según su reporte y su fecha', () => {
		expect(OCTUBRE.map((s) => `${s.desde.slice(8)}-${s.hasta.slice(8)}`)).toEqual([
			'01-04',
			'05-11',
			'12-18',
			'19-25',
			'26-31'
		]);
		const semanal = semanasDePartida(
			'semanal',
			celda('2026-10-01', { programado: 5, ejecucionesReportes: 1 }),
			[
				ejecucion({ ocurrencia: { tipo: 'semana', numero: 2 } }),
				ejecucion({ id: 'b', estado: 'borrador', ocurrencia: { tipo: 'semana', numero: 4 } })
			],
			OCTUBRE,
			HOY
		);
		expect(resumen(semanal)).toEqual([
			'vencido · Sin reporte',
			'ejecutado · Con reporte',
			'vencido · Sin reporte',
			'pendiente · Borrador',
			'programado · Sin reporte'
		]);
		// Con el mes cumplido, las semanas sin reporte quedan vacías.
		const cumplida = semanasDePartida(
			'semanal',
			celda('2026-10-01', { programado: 1, ejecucionesReportes: 1 }),
			[ejecucion({ ocurrencia: { tipo: 'semana', numero: 2 } })],
			OCTUBRE,
			HOY
		);
		expect(resumen(cumplida)).toEqual([null, 'ejecutado · Con reporte', null, null, null]);
	});

	it('sigue la quincena del último día de la semana y cuenta los días de las diarias', () => {
		const quincenal = semanasDePartida(
			'quincenal',
			celda('2026-10-01', { programado: 2, ejecucionesReportes: 1 }),
			[ejecucion({ ocurrencia: { tipo: 'quincena', numero: 1 } })],
			OCTUBRE,
			HOY
		);
		expect(resumen(quincenal)).toEqual([
			'ejecutado · Con reporte',
			'ejecutado · Con reporte',
			'pendiente · Sin reporte',
			'pendiente · Sin reporte',
			'pendiente · Sin reporte'
		]);
		const diaria = semanasDePartida(
			'diaria',
			celda('2026-10-01', { programado: 31, ejecucionesReportes: 8 }),
			[ejecucion({ diasEjecucion: [{ desde: '2026-10-01', hasta: '2026-10-08' }] })],
			OCTUBRE,
			HOY
		);
		expect(resumen(diaria)).toEqual([
			'ejecutado · Con reporte',
			'vencido · 4 de 7 días',
			'vencido · Sin reporte',
			'pendiente · Sin reporte',
			'programado · Sin reporte'
		]);
	});

	it('no planea semanas de una mensual: lo que falta va en la semana en curso y las siguientes', () => {
		expect(resumen(semanasDePartida('mensual', celda('2026-10-01'), [], OCTUBRE, HOY))).toEqual([
			null,
			null,
			null,
			'pendiente · Sin reporte',
			'programado · Sin reporte'
		]);
		// Mes terminado: solo la última semana, vencida.
		expect(
			resumen(semanasDePartida('mensual', celda('2026-09-01'), [], semanasDe('2026-09-01'), HOY))
		).toEqual([null, null, null, null, 'vencido · Sin reporte']);
		const conReporte = semanasDePartida(
			'trimestral',
			celda('2026-10-01', { ejecucionesReportes: 1 }),
			[ejecucion({ diasEjecucion: [{ desde: '2026-10-13', hasta: '2026-10-13' }] })],
			OCTUBRE,
			HOY
		);
		expect(resumen(conReporte)).toEqual([null, null, 'ejecutado · Con reporte', null, null]);
		const sinReporte = semanasDePartida(
			'mensual',
			celda('2026-10-01', { realizadoSinReporte: 1 }),
			[],
			OCTUBRE,
			HOY
		);
		expect(resumen(sinReporte)).toEqual([
			null,
			null,
			null,
			null,
			'ejecutado · Realizado sin reporte'
		]);
		// Un borrador en curso ya cubre lo que falta: no se repite en la última semana.
		const conBorrador = semanasDePartida(
			'mensual',
			celda('2026-09-01'),
			[
				ejecucion({
					estado: 'borrador',
					diasEjecucion: [{ desde: '2026-09-08', hasta: '2026-09-08' }]
				})
			],
			semanasDe('2026-09-01'),
			HOY
		);
		expect(resumen(conBorrador)).toEqual([null, 'vencido · Borrador', null, null, null]);
	});

	const SEMANA = (n: number) => OCTUBRE.find((s) => s.numero === n)!;

	it('marca cada día de una diaria según sus reportes y su fecha', () => {
		// Semana 4 de octubre: lunes 19 a domingo 25; HOY es el miércoles 21.
		const diaria = diasDePartida(
			'diaria',
			celda('2026-10-01', { programado: 31, ejecucionesReportes: 2 }),
			[
				ejecucion({ diasEjecucion: [{ desde: '2026-10-19', hasta: '2026-10-20' }] }),
				ejecucion({
					id: 'b',
					estado: 'borrador',
					diasEjecucion: [{ desde: '2026-10-21', hasta: '2026-10-21' }]
				})
			],
			SEMANA(4),
			HOY
		);
		expect(resumen(diaria)).toEqual([
			'ejecutado · Con reporte',
			'ejecutado · Con reporte',
			'pendiente · Borrador',
			'programado · Sin reporte',
			'programado · Sin reporte',
			'programado · Sin reporte',
			'programado · Sin reporte'
		]);
	});

	it('ofrece lo que falta de la ocurrencia en un solo día de la semana', () => {
		const semanal = (n: number, ejecuciones: EjecucionDelMes[] = []) =>
			resumen(
				diasDePartida(
					'semanal',
					celda('2026-10-01', { programado: 5 }),
					ejecuciones,
					SEMANA(n),
					HOY
				)
			);
		// En curso: hoy; pasada: su último día; futura: su primer día.
		expect(semanal(4)).toEqual([null, null, 'pendiente · Sin reporte', null, null, null, null]);
		expect(semanal(2)).toEqual([null, null, null, null, null, null, 'vencido · Sin reporte']);
		expect(semanal(5)).toEqual(['programado · Sin reporte', null, null, null, null, null]);
		// Con el reporte de la semana, solo el día que cubre.
		expect(
			semanal(4, [
				ejecucion({
					ocurrencia: { tipo: 'semana', numero: 4 },
					diasEjecucion: [{ desde: '2026-10-20', hasta: '2026-10-20' }]
				})
			])
		).toEqual([null, 'ejecutado · Con reporte', null, null, null, null, null]);
		// Quincenal el martes 13: la semana 12-18 sigue a la quincena 2, que empieza el 16.
		expect(
			resumen(
				diasDePartida(
					'quincenal',
					celda('2026-10-01', { programado: 2 }),
					[],
					SEMANA(3),
					'2026-10-13'
				)
			)
		).toEqual([null, null, null, null, 'programado · Sin reporte', null, null]);
		// Mensual: semana pasada del mes en curso vacía; mes terminado, vencida en su último día.
		expect(resumen(diasDePartida('mensual', celda('2026-10-01'), [], SEMANA(2), HOY))).toEqual(
			Array(7).fill(null)
		);
		const septiembre = semanasDe('2026-09-01');
		expect(
			resumen(
				diasDePartida('mensual', celda('2026-09-01'), [], septiembre[septiembre.length - 1], HOY)
			)
		).toEqual([null, null, 'vencido · Sin reporte']);
	});
});
