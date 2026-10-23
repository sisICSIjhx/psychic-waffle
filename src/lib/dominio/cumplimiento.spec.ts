import { describe, expect, it } from 'vitest';
import { rangoDelPeriodo } from './captura';
import {
	anotacionesCelda,
	desglosePorPartida,
	partidasDelMes,
	reportesQueFaltan,
	semanaDePartida,
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

	it('arma cada partida en la semana según su periodicidad', () => {
		// Mayo de 2026 empieza en viernes: la semana 1 va del 1 al 3.
		const semana1 = rangoDelPeriodo('2026-05-01', { tipo: 'semana', numero: 1 })!;
		expect(semana1).toEqual({ desde: '2026-05-01', hasta: '2026-05-03' });
		const semana2 = rangoDelPeriodo('2026-05-01', { tipo: 'semana', numero: 2 })!;
		const semanal = semanaDePartida(
			'semanal',
			celda('2026-05-01', { programado: 4 }),
			[ejecucion({ ocurrencia: { tipo: 'semana', numero: 2 } })],
			2,
			semana2
		);
		expect(semanal.texto).toBe('Con reporte');
		const quincenal = semanaDePartida(
			'quincenal',
			celda('2026-05-01', { programado: 2 }),
			[ejecucion({ estado: 'borrador', ocurrencia: { tipo: 'quincena', numero: 1 } })],
			2,
			semana2
		);
		expect(quincenal.texto).toBe('Reporte en borrador');
		const diaria = semanaDePartida(
			'diaria',
			celda('2026-05-01', { programado: 31 }),
			[ejecucion({ diasEjecucion: [{ desde: '2026-05-04', hasta: '2026-05-08' }] })],
			2,
			semana2
		);
		expect(diaria.texto).toBe('5 de 7 días');
		expect(semanaDePartida('mensual', celda('2026-05-01'), [], 2, semana2).texto).toBe(
			'Pendiente en el mes'
		);
	});
});
