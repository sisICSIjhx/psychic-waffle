import { describe, expect, it } from 'vitest';
import {
	estatusDeCentro,
	fraseDocumentoFaltante,
	kpisDeCentro,
	nombreDeCarpeta,
	pasoDeCobranza,
	siguientePasoDeCobranza,
	pendientesDeCentro,
	queFalta,
	resumirCentro,
	type NivelDocumento,
	type ResumenCentro
} from './estatus';
import { partidasDelMes, textoHorario } from './seguimiento-operativo';

type Finanzas = NonNullable<ResumenCentro['finanzas']>;

function resumen(cambios: Partial<ResumenCentro> = {}): ResumenCentro {
	return {
		sitioId: '00000000-0000-4000-8000-000000000001',
		plantillaId: '00000000-0000-4000-8000-000000000002',
		origen: 'mensual',
		mesTerminado: false,
		actividades: { programadas: 0, ejecutadas: 0, cobradas: null },
		em: null,
		documentos: { esperados: 0, hechos: 0, faltantes: [] },
		carpetas: [],
		emergencias: 0,
		...cambios
	};
}

function finanzas(cambios: Partial<Finanzas> = {}): Finanzas {
	return {
		montoContrato: 10_000,
		cobrado: 2_500,
		facturado: null,
		mes: { estimacion: false, prefactura: false, factura: false, cobrado: false },
		adicionales: { cantidad: 0, pactado: 0, cobrado: 0 },
		contratoVencido: false,
		cartaFaltante: false,
		datosContrato: { esperados: 3, capturados: 3 },
		...cambios
	};
}

const falta = (etiqueta: string, faltan: number, nivel: NivelDocumento = 'actividad') => ({
	conceptoId: `concepto-${etiqueta}`,
	etiqueta,
	nivel,
	faltan
});
const carpeta = (
	etiqueta: string,
	estado: ResumenCentro['carpetas'][number]['estado'],
	porDefinir = false
) => ({ conceptoId: `carpeta-${etiqueta}`, etiqueta, estado, porDefinir });
const estatus = (r: ResumenCentro) => resumirCentro(r).estatus;
const textos = (r: ResumenCentro) => queFalta(r).map((p) => p.texto);

describe('frases de lo que falta', () => {
	it('cuenta en singular y en plural, con el adjetivo concordado', () => {
		const frase = (etiqueta: string, n: number, nivel?: NivelDocumento) =>
			fraseDocumentoFaltante(falta(etiqueta, n, nivel));
		expect(frase('Reporte', 1)).toBe('Falta 1 reporte');
		expect(frase('Reporte', 3)).toBe('Faltan 3 reportes');
		expect(frase('Reporte de mantenimiento', 2)).toBe('Faltan 2 reportes de mantenimiento');
		expect(frase('Reporte fotográfico', 2)).toBe('Faltan 2 reportes fotográficos');
		expect(frase('Dictamen técnico', 2)).toBe('Faltan 2 dictámenes técnicos');
		expect(frase('Dictamen técnico', 1)).toBe('Falta 1 dictamen técnico');
		expect(frase('Lista de asistencia', 4)).toBe('Faltan 4 listas de asistencia');
		expect(frase('Gráfica de la prueba', 2)).toBe('Faltan 2 gráficas de la prueba');
		expect(frase('Orden de trabajo', 2)).toBe('Faltan 2 órdenes de trabajo');
		expect(frase('Estimación', 2)).toBe('Faltan 2 estimaciones');
		expect(frase('Informe mensual', 2)).toBe('Faltan 2 informes mensuales');
	});

	it('no altera las siglas ni cuenta por piezas una etiqueta que ya está en plural', () => {
		const frase = (etiqueta: string, n: number, nivel?: NivelDocumento) =>
			fraseDocumentoFaltante(falta(etiqueta, n, nivel));
		expect(frase('ODT', 1)).toBe('Falta 1 ODT');
		expect(frase('AST', 5)).toBe('Faltan 5 AST');
		expect(frase('Bitácoras', 1)).toBe('Faltan bitácoras en 1 actividad');
		expect(frase('Hojas de verificación', 3)).toBe('Faltan hojas de verificación en 3 actividades');
		expect(frase('Generadores de obra', 2, 'partida')).toBe(
			'Faltan generadores de obra en 2 partidas'
		);
		expect(frase('Permisos', 1, 'periodo')).toBe('Faltan permisos del mes');
	});

	it('nombra la carpeta como se dice en campo', () => {
		expect(nombreDeCarpeta('Seguridad')).toBe('Carpeta de seguridad');
		expect(nombreDeCarpeta('Reportes')).toBe('Carpeta de reportes');
		expect(nombreDeCarpeta('Carpeta')).toBe('Carpeta');
		expect(nombreDeCarpeta('carpeta de producción')).toBe('Carpeta de producción');
		expect(nombreDeCarpeta('SSPA')).toBe('Carpeta de SSPA');
	});
});

describe('queFalta', () => {
	it('ordena por urgencia y dice dónde se resuelve cada pendiente', () => {
		const r = resumen({
			actividades: { programadas: 5, ejecutadas: 2, cobradas: null },
			em: { programadas: 4, realizadas: 3, cobradas: null },
			documentos: {
				esperados: 6,
				hechos: 2,
				faltantes: [falta('ODT', 1), falta('Reporte', 3, 'partida')]
			},
			carpetas: [
				carpeta('Seguridad', 'pendiente'),
				carpeta('Reportes', 'entregada'),
				carpeta('Producción', 'recibida_comentarios'),
				carpeta('Mantenimiento', 'recibida'),
				carpeta('Archivo', 'pendiente', true)
			],
			finanzas: finanzas({ cartaFaltante: true, datosContrato: { esperados: 3, capturados: 1 } })
		});
		expect(pendientesDeCentro(r)).toEqual([
			{ texto: 'Falta la carta de finalización', destino: 'cobranza', ancla: 'carta' },
			{ texto: 'Faltan 3 actividades por ejecutar', destino: 'seguimiento', ancla: 'actividades' },
			{ texto: 'Falta 1 EM por realizar', destino: 'seguimiento', ancla: 'actividades' },
			{
				texto: 'Carpeta de producción con comentarios: falta corregirla y entregarla de nuevo',
				destino: 'seguimiento',
				ancla: 'carpetas',
				conceptoId: 'carpeta-Producción'
			},
			{
				texto: 'Faltan 3 reportes',
				destino: 'seguimiento',
				ancla: 'actividades',
				conceptoId: 'concepto-Reporte'
			},
			{
				texto: 'Falta 1 ODT',
				destino: 'seguimiento',
				ancla: 'actividades',
				conceptoId: 'concepto-ODT'
			},
			{
				texto: 'Carpeta de seguridad sin entregar',
				destino: 'seguimiento',
				ancla: 'carpetas',
				conceptoId: 'carpeta-Seguridad'
			},
			{
				texto: 'Carpeta de reportes entregada: falta que la reciban',
				destino: 'seguimiento',
				ancla: 'carpetas',
				conceptoId: 'carpeta-Reportes'
			},
			{ texto: 'Faltan 2 datos del contrato', destino: 'cobranza', ancla: 'contrato' }
		]);
		// Cinco como máximo y un «y N más» al final.
		expect(textos(r)).toEqual([
			'Falta la carta de finalización',
			'Faltan 3 actividades por ejecutar',
			'Falta 1 EM por realizar',
			'Carpeta de producción con comentarios: falta corregirla y entregarla de nuevo',
			'Faltan 3 reportes',
			'y 4 más'
		]);
		expect(queFalta(r).at(-1)).toEqual({ texto: 'y 4 más', destino: 'seguimiento' });
	});

	it('no cuenta lo que está por definir ni lo que ya está hecho', () => {
		expect(
			queFalta(
				resumen({
					actividades: { programadas: 2, ejecutadas: 2, cobradas: 0 },
					em: { programadas: 2, realizadas: 3, cobradas: 0 },
					carpetas: [carpeta('Seguridad', 'recibida'), carpeta('Carpeta', 'pendiente', true)],
					finanzas: finanzas()
				})
			)
		).toEqual([]);
	});
});

describe('kpisDeCentro', () => {
	it('solo trae los indicadores que aplican', () => {
		expect(kpisDeCentro(resumen())).toEqual([]);
		expect(
			kpisDeCentro(resumen({ carpetas: [carpeta('Carpeta', 'pendiente', true)] })).map(
				(k) => k.clave
			)
		).toEqual([]);
		const claves = kpisDeCentro(
			resumen({
				actividades: { programadas: 4, ejecutadas: 1, cobradas: 1 },
				em: { programadas: 2, realizadas: 1, cobradas: 1 },
				documentos: { esperados: 2, hechos: 1, faltantes: [falta('ODT', 1)] },
				carpetas: [carpeta('Seguridad', 'entregada')],
				finanzas: finanzas()
			})
		).map((k) => k.clave);
		expect(claves).toEqual([
			'ejecucion',
			'em',
			'documentos',
			'carpetas',
			'cobranza',
			'cobro',
			'contrato'
		]);
	});

	it('la ejecución es la del mes, o la del ciclo si hay programa anual', () => {
		const r = resumen({ actividades: { programadas: 4, ejecutadas: 1, cobradas: null } });
		expect(kpisDeCentro(r)[0]).toMatchObject({
			clave: 'ejecucion',
			alcance: 'mes',
			valor: 1,
			total: 4,
			porcentaje: 25,
			// Con el mes en curso lo que falta es un pendiente, no un atraso.
			semaforo: 'amarillo',
			detalle: '1 de 4 actividades del mes ejecutadas'
		});
		expect(kpisDeCentro({ ...r, mesTerminado: true })[0].semaforo).toBe('rojo');
		expect(
			kpisDeCentro({
				...r,
				mesTerminado: true,
				actividades: { programadas: 10, ejecutadas: 8, cobradas: null }
			})[0].semaforo
		).toBe('amarillo');
		expect(kpisDeCentro(r, { planeado: 40, ejecutado: 37, avance: 92.5 })[0]).toMatchObject({
			alcance: 'ciclo',
			valor: 37,
			total: 40,
			porcentaje: 92.5,
			semaforo: 'verde',
			detalle: 'Programa anual, acumulado al corte · 1 de 4 actividades del mes'
		});
		// Un programa sin nada planeado al corte no mide: queda la ejecución del mes.
		expect(kpisDeCentro(r, { planeado: 0, ejecutado: 0, avance: null })[0].alcance).toBe('mes');
	});

	it('documentos y carpetas incompletos son pendientes, nunca atraso', () => {
		const kpis = kpisDeCentro(
			resumen({
				mesTerminado: true,
				documentos: { esperados: 10, hechos: 0, faltantes: [falta('Reporte', 10)] },
				carpetas: [
					carpeta('Seguridad', 'recibida'),
					carpeta('Reportes', 'recibida_comentarios'),
					carpeta('Producción', 'pendiente')
				]
			})
		);
		expect(kpis).toMatchObject([
			{ clave: 'documentos', valor: 0, total: 10, porcentaje: 0, semaforo: 'amarillo' },
			{
				clave: 'carpetas',
				valor: 1,
				total: 3,
				semaforo: 'amarillo',
				detalle: '1 de 3 recibida correctamente · 1 entregada'
			}
		]);
	});

	it('la cobranza y el cobro informan sin cambiar el estatus', () => {
		const r = resumen({
			actividades: { programadas: 2, ejecutadas: 2, cobradas: 1 },
			finanzas: finanzas({
				mes: { estimacion: true, prefactura: true, factura: false, cobrado: false },
				adicionales: { cantidad: 2, pactado: 1000, cobrado: 250 }
			})
		});
		const [, cobranza, cobro, contrato] = kpisDeCentro(r);
		expect(cobranza).toMatchObject({
			clave: 'cobranza',
			valor: 2500,
			total: 10_000,
			porcentaje: 25,
			semaforo: null,
			esMonto: true
		});
		expect(cobranza.detalle).toMatch(/^Mes con prefactura · adicionales: /);
		expect(cobro).toMatchObject({
			clave: 'cobro',
			etiqueta: 'Cobro de actividades',
			valor: 1,
			total: 2,
			semaforo: null
		});
		expect(contrato).toMatchObject({ clave: 'contrato', valor: 3, total: 3, semaforo: 'verde' });
		expect(estatus(r)).toBe('con_pendientes');
		expect(estatus({ ...r, finanzas: finanzas() })).toBe('al_corriente');
		// Sin monto del contrato no hay contra qué medir lo cobrado.
		expect(kpisDeCentro(resumen({ finanzas: finanzas({ montoContrato: null }) }))[0]).toMatchObject(
			{ clave: 'cobranza', total: 0, porcentaje: null }
		);
		// Una cobranza empezada y sin cobrar deja su siguiente paso como pendiente.
		expect(textos(r)).toEqual(['Falta la factura del mes']);
		expect(queFalta(r)[0]).toMatchObject({ destino: 'cobranza', ancla: 'cobranza' });
		expect(siguientePasoDeCobranza(finanzas().mes)).toBeNull();
		expect(siguientePasoDeCobranza({ ...finanzas().mes, estimacion: true })).toBe(
			'Falta la prefactura del mes'
		);
		expect(siguientePasoDeCobranza({ ...finanzas().mes, factura: true })).toBe(
			'Falta registrar el cobro del mes'
		);
		expect(
			siguientePasoDeCobranza({ ...finanzas().mes, estimacion: true, cobrado: true })
		).toBeNull();
		expect(textos(resumen({ em: { programadas: null, realizadas: 2, cobradas: null } }))).toEqual([
			'Faltan las EM programadas del mes'
		]);
		expect(pasoDeCobranza(finanzas().mes)).toBe('sin estimación');
		expect(pasoDeCobranza({ ...finanzas().mes, cobrado: true })).toBe('cobrado');
	});
});

describe('estatusDeCentro', () => {
	const completo = resumen({
		actividades: { programadas: 3, ejecutadas: 3, cobradas: null },
		documentos: { esperados: 6, hechos: 6, faltantes: [] },
		carpetas: [carpeta('Seguridad', 'recibida')]
	});

	it('al corriente: todo ejecutado, documentado y con las carpetas recibidas', () => {
		expect(resumirCentro(completo)).toMatchObject({ estatus: 'al_corriente', falta: [] });
	});

	it('con pendientes: actividades ejecutadas sin su reporte', () => {
		const r = {
			...completo,
			documentos: { esperados: 6, hechos: 3, faltantes: [falta('Reporte', 3, 'partida')] }
		};
		expect(estatus(r)).toBe('con_pendientes');
		expect(textos(r)).toEqual(['Faltan 3 reportes']);
		// También una carpeta recibida con comentarios sigue pendiente de cierre.
		expect(estatus({ ...completo, carpetas: [carpeta('Seguridad', 'recibida_comentarios')] })).toBe(
			'con_pendientes'
		);
	});

	it('atrasado: falta la carta de finalización, o la ejecución de un mes terminado va en rojo', () => {
		const sinCarta = { ...completo, finanzas: finanzas({ cartaFaltante: true }) };
		expect(estatus(sinCarta)).toBe('atrasado');
		expect(textos(sinCarta)).toContain('Falta la carta de finalización');
		const corto = { ...completo, actividades: { programadas: 4, ejecutadas: 1, cobradas: null } };
		expect(estatus(corto)).toBe('con_pendientes');
		expect(estatus({ ...corto, mesTerminado: true })).toBe('atrasado');
		expect(
			estatusDeCentro(kpisDeCentro(completo, { planeado: 10, ejecutado: 5, avance: 50 }), completo)
		).toBe('atrasado');
	});

	it('sin datos: nada operativo que medir, aunque haya datos del contrato', () => {
		expect(estatus(resumen())).toBe('sin_datos');
		expect(estatus(resumen({ carpetas: [carpeta('Carpeta', 'pendiente', true)] }))).toBe(
			'sin_datos'
		);
		expect(estatus(resumen({ finanzas: finanzas() }))).toBe('sin_datos');
		// La carta que falta pesa más que no tener datos.
		expect(estatus(resumen({ finanzas: finanzas({ cartaFaltante: true }) }))).toBe('atrasado');
	});

	it('quien no ve el contrato recibe el mismo estatus operativo, sin lo financiero', () => {
		const conFinanzas = {
			...completo,
			finanzas: finanzas({ datosContrato: { esperados: 3, capturados: 1 } })
		};
		expect(resumirCentro(conFinanzas)).toMatchObject({
			estatus: 'con_pendientes',
			falta: [{ texto: 'Faltan 2 datos del contrato', destino: 'cobranza', ancla: 'contrato' }]
		});
		const sinFinanzas = resumirCentro(completo);
		expect(sinFinanzas.estatus).toBe('al_corriente');
		expect(sinFinanzas.kpis.map((k) => k.clave)).toEqual(['ejecucion', 'documentos', 'carpetas']);
	});
});

describe('captura por partida', () => {
	it('agrupa las actividades por partida y señala la primera', () => {
		const actividad = (
			clave: string,
			grupo: string,
			ordinal: number | null,
			ejecutada = false
		) => ({
			clave,
			grupo,
			partida: grupo.toUpperCase(),
			ordinal,
			ejecutada,
			programada: true,
			manual: grupo.startsWith('m:')
		});
		const grupos = partidasDelMes([
			actividad('a:2', 'a', 2, true),
			actividad('m:x', 'm:x', null),
			actividad('a:1', 'a', 1),
			actividad('a:3', 'a', 3, true)
		]);
		expect(grupos).toMatchObject([
			{ grupo: 'a', partida: 'A', manual: false, primera: 'a:1', ejecutadas: 2 },
			{ grupo: 'm:x', manual: true, primera: 'm:x', ejecutadas: 0 }
		]);
		expect(grupos[0].actividades.map((a) => a.clave)).toEqual(['a:1', 'a:2', 'a:3']);
		expect(partidasDelMes([])).toEqual([]);
	});

	it('escribe el horario de una atención de emergencia', () => {
		expect(textoHorario('22:30', '01:15')).toBe('22:30 a 01:15');
		expect(textoHorario('22:30', null)).toBe('desde las 22:30');
		expect(textoHorario(null, '01:15')).toBe('hasta las 01:15');
		expect(textoHorario(null, null)).toBe('');
	});
});
