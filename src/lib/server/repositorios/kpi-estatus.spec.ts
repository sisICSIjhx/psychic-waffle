// Cambio kpi-estatus-centros sobre PGlite: migración 0028 con datos previos, conceptos con indicador,
// documentos por partida, partidas escritas a mano, atenciones de emergencia, carpetas con acuse,
// adicionales, complemento de plantillas y resumen de estatus. Solo datos ficticios.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OrigenActividades } from '../../dominio/constantes';
import { resumirCentro } from '../../dominio/estatus';
import type { PlantillaSeguimientoEntrada } from '../../dominio/esquemas';
import { aplicarMigraciones, leerMigraciones } from '../bd/migraciones';
import { crearClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from './index';

let repos: Repositorios;
let n = 0;
const MES = '2026-11';
const HOY = '2026-11-20';
const ENLACE = 'https://ejemplo.sharepoint.com/sites/prueba/acuse';

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
}, 60_000);
afterAll(() => repos.cerrar());

const CONCEPTOS: PlantillaSeguimientoEntrada['conceptos'] = [
	{ etiqueta: 'Número de contrato', bloque: 'contrato', tipo: 'texto' },
	{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto', indicador: 'monto_contrato' },
	{ etiqueta: 'Monto cobrado', bloque: 'contrato', tipo: 'monto', indicador: 'monto_cobrado' },
	{
		etiqueta: 'EM programadas',
		bloque: 'programa',
		tipo: 'cantidad',
		nivel: 'periodo',
		indicador: 'em_programadas'
	},
	{
		etiqueta: 'EM realizadas',
		bloque: 'programa',
		tipo: 'cantidad',
		nivel: 'periodo',
		indicador: 'em_realizadas'
	},
	{
		etiqueta: 'Cobrada',
		bloque: 'programa',
		tipo: 'casilla',
		nivel: 'actividad',
		indicador: 'actividad_cobrada'
	},
	{ etiqueta: 'Reporte', bloque: 'documentos', tipo: 'casilla', nivel: 'partida' },
	{ etiqueta: 'ODT', bloque: 'documentos', tipo: 'casilla', carpeta: 'Seguridad' },
	{ etiqueta: 'Planos', bloque: 'documentos', tipo: 'casilla', porDefinir: true },
	{ etiqueta: 'Seguridad', bloque: 'carpetas', tipo: 'carpeta' },
	{ etiqueta: 'Archivo', bloque: 'carpetas', tipo: 'carpeta', porDefinir: true }
];

async function base(
	origenActividades: OrigenActividades,
	conceptos = CONCEPTOS,
	modoContrato: 'obligatorio' | 'opcional' = 'obligatorio'
) {
	const clave = `kpi-${++n}`;
	const plantilla = await repos.centrosCosto.guardarPlantilla({
		nombre: clave,
		modoContrato,
		origenActividades,
		conceptos
	});
	const centro = await repos.centrosCosto.guardar({
		clave,
		nombre: clave,
		plantillaId: plantilla.id
	});
	const concepto = (etiqueta: string) =>
		plantilla.conceptos.find((c) => c.etiqueta === etiqueta)!.id;
	return {
		clave,
		centro,
		plantilla,
		concepto,
		guardar: (accion: object, mes = MES) =>
			repos.seguimiento.guardar(centro.id, mes, plantilla.id, accion),
		obtener: (mes = MES) => repos.seguimiento.obtener(centro.id, mes, true),
		contrato: (accion: object) => repos.contratoCobranza.guardar(centro.id, accion),
		estatus: async (verContrato = false, hoy = HOY) =>
			(await repos.estatus.deCentro(centro.id, { mes: MES, hoy, verContrato }))!
	};
}

/** Contrato, partida y programa anual del centro, con `cantidad` ejecuciones en el mes. */
async function conPrograma(
	r: Repositorios,
	sitioId: string,
	clave: string,
	cantidad: number,
	vigenciaFin = '2026-12-31'
) {
	const cliente = await r.catalogo.guardarCliente({
		clave,
		nombre: 'Ficticio',
		razonSocial: 'Ficticio'
	});
	const contrato = await r.catalogo.guardarContrato({
		clienteId: cliente.id,
		numero: `C-${clave}`,
		descripcion: null,
		vigenciaInicio: '2026-01-01',
		vigenciaFin
	});
	await r.catalogo.asociarSitio(contrato.id, sitioId);
	if (cantidad === 0) return { contrato, grupo: '' };
	const partida = await r.catalogo.guardarPartida({
		contratoId: contrato.id,
		sitioId,
		numero: '1',
		actividad: 'Inspección de prueba',
		periodicidad: 'mensual'
	});
	const programa = await r.programa.guardarPrograma({
		contratoId: contrato.id,
		sitioId,
		periodoInicio: '2026-01-01',
		periodoFin: vigenciaFin
	});
	await r.programa.guardarMeses(programa.id, [
		{ partidaId: partida.id, mes: `${MES}-01`, cantidad }
	]);
	return { contrato, grupo: `a:${programa.id}:${partida.id}` };
}

async function persona(nombre: string, activo = true) {
	return repos.personal.guardar({
		nombre,
		apellidoPaterno: 'Ficticia',
		apellidoMaterno: null,
		fechaNacimiento: null,
		correo: null,
		rol: 'reporteador',
		activo,
		centroCostoIds: []
	});
}

describe('migración 0028 sobre datos anteriores', () => {
	it('asigna indicadores, convierte el reporte a nivel partida y fusiona lo ya marcado', async () => {
		const todas = await leerMigraciones();
		const cliente = await crearClientePglite(
			undefined,
			todas.filter((m) => m.nombre < '0028')
		);
		const viejo = crearRepositorios(cliente);
		try {
			const plantilla = (origenActividades: string) =>
				cliente.llamar<{
					id: string;
					conceptos: { id: string; bloque: string; etiqueta: string }[];
				}>('api_guardar_plantilla_seguimiento', {
					nombre: `anterior-${origenActividades}`,
					modoContrato: 'obligatorio',
					origenActividades,
					conceptos: [
						{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto' },
						{ etiqueta: 'Monto cobrado', bloque: 'contrato', tipo: 'monto' },
						{ etiqueta: 'Periodicidad', bloque: 'contrato', tipo: 'texto' },
						{ etiqueta: 'Monto', bloque: 'ordenes_compra', tipo: 'monto' },
						{ etiqueta: 'EM programadas', bloque: 'programa', tipo: 'cantidad', nivel: 'periodo' },
						{ etiqueta: 'EM ejecutadas', bloque: 'programa', tipo: 'cantidad', nivel: 'periodo' },
						{ etiqueta: 'Cobrada', bloque: 'programa', tipo: 'casilla', nivel: 'actividad' },
						{ etiqueta: 'Reporte', bloque: 'documentos', tipo: 'casilla' },
						{ etiqueta: 'Reporte fotográfico', bloque: 'documentos', tipo: 'estado' },
						{ etiqueta: 'ODT', bloque: 'documentos', tipo: 'casilla' },
						{ etiqueta: 'Seguridad', bloque: 'carpetas', tipo: 'carpeta' }
					]
				});
			const anual = await plantilla('programa_anual');
			const mensual = await plantilla('mensual');
			const id = (p: typeof anual, etiqueta: string, bloque = 'documentos') =>
				p.conceptos.find((c) => c.etiqueta === etiqueta && c.bloque === bloque)!.id;
			const centro = await viejo.centrosCosto.guardar({
				clave: 'anterior-1',
				nombre: '',
				plantillaId: anual.id
			});
			const otro = await viejo.centrosCosto.guardar({
				clave: 'anterior-2',
				nombre: '',
				plantillaId: mensual.id
			});
			const { grupo } = await conPrograma(viejo, centro.id, 'anterior', 3);
			const guardar = (sitioId: string, cambios: object) =>
				cliente.llamar('api_guardar_seguimiento_operativo', {
					sitioId,
					mes: `${MES}-01`,
					...cambios
				});
			const valor = (sitioId: string, actividad: string, conceptoId: string, v: unknown) =>
				guardar(sitioId, { accion: 'valor', actividad, conceptoId, valor: v });
			// El reporte, marcado en la segunda y la tercera ejecución de la misma partida.
			await valor(centro.id, `${grupo}:2`, id(anual, 'Reporte'), true);
			await valor(centro.id, `${grupo}:3`, id(anual, 'Reporte'), true);
			await valor(centro.id, `${grupo}:1`, id(anual, 'Reporte fotográfico'), 'en_proceso');
			await valor(centro.id, `${grupo}:3`, id(anual, 'Reporte fotográfico'), 'hecho');
			await valor(centro.id, `${grupo}:2`, id(anual, 'ODT'), true);
			await valor(centro.id, `${grupo}:3`, id(anual, 'ODT'), true);
			await guardar(centro.id, { accion: 'ejecucion', actividad: `${grupo}:2`, valor: true });
			const manuales = [randomUUID(), randomUUID()];
			for (const m of manuales) {
				await guardar(otro.id, { accion: 'nuevaActividad', id: m, nombre: 'Visita', fecha: null });
				await valor(otro.id, `m:${m}`, id(mensual, 'Reporte'), true);
			}
			const entrega = await viejo.personal.guardar({
				nombre: 'Persona',
				apellidoPaterno: 'Ficticia',
				apellidoMaterno: null,
				fechaNacimiento: null,
				correo: null,
				rol: 'reporteador',
				activo: true,
				centroCostoIds: []
			});
			await guardar(centro.id, {
				accion: 'carpeta',
				conceptoId: id(anual, 'Seguridad', 'carpetas'),
				estado: 'entregada',
				entregaId: entrega.id,
				recibe: 'Recepción ficticia',
				fecha: '2026-11-05',
				enlace: ENLACE,
				version: 0
			});
			await cliente.llamar('api_guardar_contrato_cobranza', {
				sitioId: centro.id,
				accion: 'contrato',
				valores: [{ conceptoId: id(anual, 'Monto cobrado', 'contrato'), valor: 500 }]
			});

			// Después de la 0028 pueden seguir otras migraciones (0029 en adelante).
			expect((await aplicarMigraciones(cliente.bd, todas))[0]).toBe('0028_kpi_estatus_centros.sql');

			const despues = await viejo.centrosCosto.obtenerPlantilla(anual.id);
			const de = (etiqueta: string, bloque = 'documentos') =>
				despues.conceptos.find((c) => c.etiqueta === etiqueta && c.bloque === bloque)!;
			expect(de('Reporte').nivel).toBe('partida');
			expect(de('Reporte fotográfico').nivel).toBe('partida');
			expect(de('ODT').nivel).toBe('actividad');
			expect(
				Object.fromEntries(despues.conceptos.map((c) => [`${c.bloque}/${c.etiqueta}`, c.indicador]))
			).toMatchObject({
				'contrato/Monto': 'monto_contrato',
				'contrato/Monto cobrado': 'monto_cobrado',
				'contrato/Periodicidad': 'periodicidad',
				'ordenes_compra/Monto': null,
				'programa/EM programadas': 'em_programadas',
				'programa/EM ejecutadas': 'em_realizadas',
				'programa/Cobrada': 'actividad_cobrada',
				'documentos/ODT': null
			});
			expect(despues.conceptos.every((c) => !c.porDefinir && c.carpetaId === null)).toBe(true);

			// Un solo valor por partida, en su primera actividad; lo de cada ejecución no cambia.
			const guardados = await cliente.bd.query<{
				actividad: string;
				etiqueta: string;
				valor: unknown;
			}>(
				`select v.actividad, c.etiqueta, v.valor from public.seguimiento_valores v
				 join public.plantilla_conceptos c on c.id = v.concepto_id
				 where c.plantilla_id = $1 order by c.etiqueta, v.actividad`,
				[anual.id]
			);
			expect(guardados.rows).toEqual([
				{ actividad: `${grupo}:2`, etiqueta: 'ODT', valor: true },
				{ actividad: `${grupo}:3`, etiqueta: 'ODT', valor: true },
				{ actividad: `${grupo}:1`, etiqueta: 'Reporte', valor: true },
				{ actividad: `${grupo}:1`, etiqueta: 'Reporte fotográfico', valor: 'hecho' }
			]);
			const mes = await viejo.seguimiento.obtener(centro.id, MES);
			expect(mes.actividades).toMatchObject([
				{ clave: `${grupo}:1`, grupo, manual: false, programada: true, ejecutada: false },
				{ clave: `${grupo}:2`, grupo, manual: false, programada: true, ejecutada: true },
				{ clave: `${grupo}:3`, grupo, manual: false, programada: true, ejecutada: false }
			]);
			expect(mes.valores).toContainEqual({
				actividad: `${grupo}:1`,
				conceptoId: id(anual, 'Reporte'),
				valor: true
			});
			// La entrega ya guardada sigue siendo válida.
			expect(mes.carpetas).toMatchObject([
				{ estado: 'entregada', enlace: ENLACE, fechaRecepcion: null, acuseEnlace: null }
			]);

			// Cada actividad escrita a mano es su propia partida y conserva su reporte.
			const delOtro = await viejo.seguimiento.obtener(otro.id, MES);
			expect(delOtro.actividades.map((a) => [a.manual, a.grupo === a.clave])).toEqual([
				[true, true],
				[true, true]
			]);
			expect(delOtro.valores).toHaveLength(2);

			// El monto cobrado capturado antes se conserva aunque el contrato se vuelva a guardar.
			await viejo.contratoCobranza.guardar(centro.id, {
				accion: 'contrato',
				valores: [
					{ conceptoId: id(anual, 'Monto', 'contrato'), valor: 9000 },
					{ conceptoId: id(anual, 'Monto cobrado', 'contrato'), valor: 1 }
				]
			});
			const contrato = (
				await viejo.contratoCobranza.obtener(centro.id, 2026, HOY, {
					contrato: true,
					programa: false
				})
			).contrato!;
			expect(contrato.valores).toEqual(
				expect.arrayContaining([
					{ conceptoId: id(anual, 'Monto cobrado', 'contrato'), valor: 500 },
					{ conceptoId: id(anual, 'Monto', 'contrato'), valor: 9000 }
				])
			);
			expect(contrato.cobradoTotal).toBe(0);
		} finally {
			await viejo.cerrar();
		}
	}, 120_000);
});

describe('conceptos con indicador, por definir y carpeta', () => {
	it('guarda y devuelve el significado de cada concepto, y lo conserva si no se envía', async () => {
		const b = await base('mensual');
		const de = (etiqueta: string, p = b.plantilla) =>
			p.conceptos.find((c) => c.etiqueta === etiqueta)!;
		expect(de('Monto').indicador).toBe('monto_contrato');
		expect(de('Planos').porDefinir).toBe(true);
		expect(de('ODT').carpetaId).toBe(b.concepto('Seguridad'));
		expect(de('Reporte')).toMatchObject({ nivel: 'partida', indicador: null, carpetaId: null });

		// Un cliente que no conoce las llaves nuevas no las borra.
		const sinLlaves = await repos.centrosCosto.guardarPlantilla({
			...b.plantilla,
			conceptos: b.plantilla.conceptos.map(({ id, bloque, etiqueta, tipo, nivel }) => ({
				id,
				bloque,
				etiqueta,
				tipo,
				nivel
			}))
		});
		expect(sinLlaves.conceptos).toEqual(b.plantilla.conceptos);

		// La carpeta también se puede dar por id, y quitar con null.
		const cambiada = await repos.centrosCosto.guardarPlantilla({
			...b.plantilla,
			conceptos: b.plantilla.conceptos.map((c) =>
				c.etiqueta === 'ODT'
					? { ...c, carpetaId: null }
					: c.etiqueta === 'Reporte'
						? { ...c, carpetaId: b.concepto('Archivo'), porDefinir: true }
						: c
			)
		});
		expect(de('ODT', cambiada).carpetaId).toBeNull();
		expect(de('Reporte', cambiada)).toMatchObject({
			carpetaId: b.concepto('Archivo'),
			porDefinir: true
		});

		const copia = await repos.centrosCosto.duplicarPlantilla(b.plantilla.id, `${b.clave}-copia`);
		expect(de('Monto cobrado', copia).indicador).toBe('monto_cobrado');
		expect(de('Reporte', copia).carpetaId).toBe(de('Archivo', copia).id);
		expect(de('Archivo', copia).id).not.toBe(b.concepto('Archivo'));
	});

	it('rechaza un indicador que no corresponde, repetido, o una carpeta que no lo es', async () => {
		const guardar = (conceptos: PlantillaSeguimientoEntrada['conceptos']) =>
			repos.centrosCosto.guardarPlantilla({
				nombre: `kpi-invalida-${++n}`,
				modoContrato: 'opcional',
				origenActividades: 'ninguno',
				conceptos
			});
		await expect(
			guardar([
				{ etiqueta: 'Firmado', bloque: 'contrato', tipo: 'casilla', indicador: 'monto_contrato' }
			])
		).rejects.toMatchObject({ tipo: 'invalido', message: expect.stringContaining('«Firmado»') });
		await expect(
			guardar([
				{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto', indicador: 'monto_contrato' },
				{ etiqueta: 'Monto total', bloque: 'contrato', tipo: 'monto', indicador: 'monto_contrato' }
			])
		).rejects.toMatchObject({
			tipo: 'invalido',
			message: '«Monto» y «Monto total» tienen el mismo indicador.'
		});
		await expect(
			guardar([{ etiqueta: 'ODT', bloque: 'documentos', tipo: 'casilla', carpeta: 'No existe' }])
		).rejects.toMatchObject({ tipo: 'invalido', message: expect.stringContaining('«ODT»') });
		await expect(
			guardar([
				{ etiqueta: 'Seguridad', bloque: 'carpetas', tipo: 'carpeta' },
				{
					etiqueta: 'Avance',
					bloque: 'programa',
					tipo: 'casilla',
					nivel: 'periodo',
					carpeta: 'Seguridad'
				}
			])
		).rejects.toMatchObject({ tipo: 'invalido' });
		// «partida» solo existe donde hay actividades: documentos y programa.
		await expect(
			guardar([{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto', nivel: 'partida' }])
		).rejects.toMatchObject({ tipo: 'invalido' });
	});

	it('complementa una plantilla existente sin cambiar tipo ni nivel, y el ensayo no escribe', async () => {
		const b = await base('mensual', [
			{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto' },
			{ etiqueta: 'EM ejecutadas', bloque: 'programa', tipo: 'cantidad', nivel: 'periodo' },
			{ etiqueta: 'Reporte', bloque: 'documentos', tipo: 'casilla' },
			{ etiqueta: 'ODT', bloque: 'documentos', tipo: 'casilla' }
		]);
		await b.guardar({
			accion: 'valor',
			actividad: null,
			conceptoId: b.concepto('EM ejecutadas'),
			valor: 4
		});
		const carga = {
			plantillas: [
				{
					nombre: b.clave.toUpperCase(),
					modoContrato: 'obligatorio' as const,
					origenActividades: 'mensual' as const,
					conceptos: [
						{
							etiqueta: 'monto',
							bloque: 'contrato',
							tipo: 'monto',
							indicador: 'monto_contrato'
						},
						{
							etiqueta: 'EM programadas',
							bloque: 'programa',
							tipo: 'cantidad',
							nivel: 'periodo',
							indicador: 'em_programadas'
						},
						{
							etiqueta: 'EM ejecutadas',
							bloque: 'programa',
							tipo: 'cantidad',
							nivel: 'periodo',
							indicador: 'em_realizadas'
						},
						// La base lo tiene por actividad: se avisa y no se cambia.
						{ etiqueta: 'Reporte', bloque: 'documentos', tipo: 'casilla', nivel: 'partida' },
						{ etiqueta: 'ODT', bloque: 'documentos', tipo: 'casilla', carpeta: 'Carpeta' },
						{ etiqueta: 'Carpeta', bloque: 'carpetas', tipo: 'carpeta', porDefinir: true }
					]
				},
				{
					nombre: 'kpi-no-existe',
					modoContrato: 'obligatorio' as const,
					origenActividades: 'ninguno' as const,
					conceptos: []
				}
			]
		} satisfies Parameters<Repositorios['centrosCosto']['complementar']>[0];

		const ensayo = await repos.centrosCosto.complementar(carga);
		expect(ensayo).toMatchObject({
			ensayo: true,
			aplicado: false,
			resumen: { agregados: 2, actualizados: 3, ausentes: 1, invalidas: 0 }
		});
		expect(ensayo.plantillas).toMatchObject([
			{ nombre: b.clave, estado: 'complementada', agregados: 2, actualizados: 3 },
			{ nombre: 'kpi-no-existe', estado: 'ausente' }
		]);
		expect(ensayo.plantillas[0].avisos).toHaveLength(1);
		expect((await repos.centrosCosto.obtenerPlantilla(b.plantilla.id)).conceptos).toEqual(
			b.plantilla.conceptos
		);

		expect((await repos.centrosCosto.complementar(carga, false)).aplicado).toBe(true);
		const despues = await repos.centrosCosto.obtenerPlantilla(b.plantilla.id);
		const de = (etiqueta: string) => despues.conceptos.find((c) => c.etiqueta === etiqueta)!;
		expect(despues.conceptos).toHaveLength(6);
		expect(de('Monto')).toMatchObject({ id: b.concepto('Monto'), indicador: 'monto_contrato' });
		expect(de('EM ejecutadas').indicador).toBe('em_realizadas');
		expect(de('EM programadas')).toMatchObject({ indicador: 'em_programadas', orden: 2 });
		expect(de('Reporte').nivel).toBe('actividad');
		expect(de('ODT').carpetaId).toBe(de('Carpeta').id);
		expect(de('Carpeta').porDefinir).toBe(true);
		// Lo capturado sigue ahí, y repetir el complemento ya no cambia nada.
		expect((await b.obtener()).valores).toEqual([
			{ actividad: null, conceptoId: b.concepto('EM ejecutadas'), valor: 4 }
		]);
		expect((await repos.centrosCosto.complementar(carga, false)).resumen).toMatchObject({
			agregados: 0,
			actualizados: 0
		});
	});
});

describe('documentos por partida y partidas escritas a mano', () => {
	it('captura el reporte una vez por partida, en su primera actividad', async () => {
		const b = await base('programa_anual');
		const { grupo } = await conPrograma(repos, b.centro.id, b.clave, 3);
		const reporte = b.concepto('Reporte');
		const [primera, segunda, tercera] = (await b.obtener()).actividades.map((a) => a.clave);
		expect([primera, segunda, tercera]).toEqual([`${grupo}:1`, `${grupo}:2`, `${grupo}:3`]);
		expect((await b.obtener()).actividades[0]).toMatchObject({
			grupo,
			partida: '1 · Inspección de prueba',
			ordinal: 1,
			manual: false
		});

		await expect(
			b.guardar({ accion: 'valor', actividad: segunda, conceptoId: reporte, valor: true })
		).rejects.toMatchObject({ tipo: 'invalido', message: expect.stringContaining('«Reporte»') });
		expect((await b.obtener()).valores).toEqual([]);

		// Marcar una fila que no es la primera no marca el reporte ni la casilla «Cobrada».
		await b.guardar({ accion: 'marcarFila', actividad: segunda });
		expect((await b.obtener()).valores.map((v) => [v.actividad, v.conceptoId]).sort()).toEqual(
			[
				[segunda, b.concepto('ODT')],
				[segunda, b.concepto('Planos')]
			].sort()
		);
		let estatus = await b.estatus();
		expect(estatus.actividades).toEqual({ programadas: 3, ejecutadas: 1, cobradas: 0 });
		// Una ejecución: su ODT (hecha) y el reporte de la partida (falta). «Planos» está por definir.
		expect(estatus.documentos).toEqual({
			esperados: 2,
			hechos: 1,
			faltantes: [{ conceptoId: reporte, etiqueta: 'Reporte', nivel: 'partida', faltan: 1 }]
		});

		await b.guardar({ accion: 'valor', actividad: primera, conceptoId: reporte, valor: true });
		await b.guardar({ accion: 'ejecucion', actividad: tercera, valor: true });
		estatus = await b.estatus();
		// Tres actividades de una partida: el reporte cuenta una vez; falta la ODT de la tercera.
		expect(estatus.documentos).toMatchObject({
			esperados: 3,
			hechos: 2,
			faltantes: [{ etiqueta: 'ODT', nivel: 'actividad', faltan: 1 }]
		});

		await b.guardar({ accion: 'marcarMes' });
		const marcado = await b.obtener();
		expect(marcado.valores.filter((v) => v.conceptoId === reporte)).toEqual([
			{ actividad: primera, conceptoId: reporte, valor: true }
		]);
		expect(marcado.valores.filter((v) => v.conceptoId === b.concepto('ODT'))).toHaveLength(3);
		expect(marcado.valores.some((v) => v.conceptoId === b.concepto('Cobrada'))).toBe(false);
		await b.guardar({
			accion: 'valor',
			actividad: tercera,
			conceptoId: b.concepto('Cobrada'),
			valor: true
		});
		estatus = await b.estatus();
		expect(estatus.actividades).toEqual({ programadas: 3, ejecutadas: 3, cobradas: 1 });
		expect(estatus.documentos).toEqual({ esperados: 4, hechos: 4, faltantes: [] });
	});

	it('admite una partida fuera del programa anual con varias ejecuciones', async () => {
		const b = await base('programa_anual');
		await conPrograma(repos, b.centro.id, b.clave, 1);
		const id = randomUUID();
		const nueva = {
			accion: 'nuevaActividad',
			id,
			nombre: ' Limpieza extra ',
			fecha: null,
			veces: 2
		};
		await b.guardar(nueva);
		// Repetir el envío (o cambiar las veces) no duplica la partida.
		await b.guardar({ ...nueva, veces: 3 });
		const manuales = (await b.obtener()).actividades.filter((a) => a.manual);
		expect(manuales).toMatchObject([
			{
				clave: `m:${id}:1`,
				grupo: `m:${id}`,
				partida: 'Limpieza extra',
				ordinal: 1,
				programada: true
			},
			{
				clave: `m:${id}:2`,
				grupo: `m:${id}`,
				partida: 'Limpieza extra',
				ordinal: 2,
				programada: true
			}
		]);
		expect((await b.estatus()).actividades).toMatchObject({ programadas: 3, ejecutadas: 0 });

		// El reporte de la partida escrita a mano también va en su primera actividad.
		await expect(
			b.guardar({
				accion: 'valor',
				actividad: `m:${id}:2`,
				conceptoId: b.concepto('Reporte'),
				valor: true
			})
		).rejects.toMatchObject({ tipo: 'invalido' });
		await b.guardar({
			accion: 'editarActividad',
			actividad: `m:${id}:2`,
			nombre: 'Limpieza general',
			fecha: '2026-11-12'
		});
		expect((await b.obtener()).actividades.filter((a) => a.manual)).toMatchObject([
			{ nombre: 'Limpieza general', fecha: null },
			{ nombre: 'Limpieza general', fecha: '2026-11-12' }
		]);

		await b.guardar({ accion: 'ejecucion', actividad: `m:${id}:2`, valor: true });
		expect((await b.estatus()).actividades).toMatchObject({ programadas: 3, ejecutadas: 1 });
		await expect(
			b.guardar({ accion: 'quitarActividad', actividad: `m:${id}:1` })
		).rejects.toMatchObject({ tipo: 'conflicto' });
		await b.guardar({ accion: 'ejecucion', actividad: `m:${id}:2`, valor: false });
		await b.guardar({ accion: 'quitarActividad', actividad: `m:${id}:1` });
		expect((await b.obtener()).actividades.filter((a) => a.manual)).toEqual([]);

		// Una actividad del programa no se edita ni se quita como si fuera escrita a mano.
		const delPrograma = (await b.obtener()).actividades[0].clave;
		await expect(
			b.guardar({ accion: 'quitarActividad', actividad: delPrograma })
		).rejects.toMatchObject({ tipo: 'conflicto' });
		await expect(
			b.guardar({ accion: 'nuevaActividad', id: randomUUID(), nombre: 'X', fecha: null, veces: 32 })
		).rejects.toThrow();
	});

	it('rechaza la partida escrita a mano donde la plantilla no programa actividades', async () => {
		const b = await base('ninguno');
		await expect(
			b.guardar({ accion: 'nuevaActividad', id: randomUUID(), nombre: 'No aplica', fecha: null })
		).rejects.toMatchObject({ tipo: 'invalido' });
	});
});

describe('atenciones de emergencia', () => {
	it('registra fecha, horario, asistentes y descripción; solo la fecha es obligatoria', async () => {
		const b = await base('mensual');
		const [ana, luis, inactiva] = [
			await persona('Ana'),
			await persona('Luis'),
			await persona('Baja', false)
		];
		const id = randomUUID();
		const atencion = {
			accion: 'nuevaNocturna',
			id,
			fecha: '2026-11-09',
			horaInicio: '22:30',
			horaFin: '01:15',
			asistentes: [luis.id, ana.id],
			descripcion: 'Fuga ficticia'
		};
		await b.guardar(atencion);
		await b.guardar({ ...atencion, asistentes: [ana.id] });
		const sola = randomUUID();
		await b.guardar({ accion: 'nuevaNocturna', id: sola, fecha: '2026-11-02' });
		const mes = await b.obtener();
		expect(mes.nocturnas).toEqual([
			{
				id: sola,
				fecha: '2026-11-02',
				horaInicio: null,
				horaFin: null,
				descripcion: null,
				asistentes: []
			},
			{
				id,
				fecha: '2026-11-09',
				horaInicio: '22:30',
				horaFin: '01:15',
				descripcion: 'Fuga ficticia',
				asistentes: [
					{ id: ana.id, nombre: 'Ana Ficticia' },
					{ id: luis.id, nombre: 'Luis Ficticia' }
				]
			}
		]);
		// El directorio llega a quien edita aunque el centro no tuviera carpetas.
		expect(mes.personal.map((p) => p.id)).toEqual(expect.arrayContaining([ana.id, luis.id]));
		expect(mes.personal.map((p) => p.id)).not.toContain(inactiva.id);
		expect((await repos.seguimiento.obtener(b.centro.id, MES)).personal).toEqual([]);
		expect((await b.estatus()).emergencias).toBe(2);

		await expect(
			b.guardar({ ...atencion, id: randomUUID(), fecha: '2026-12-01' })
		).rejects.toMatchObject({ tipo: 'invalido' });
		await expect(
			b.guardar({ ...atencion, id: randomUUID(), asistentes: [inactiva.id] })
		).rejects.toMatchObject({ tipo: 'invalido' });
		await expect(
			b.guardar({ ...atencion, id: randomUUID(), horaInicio: '25:00' })
		).rejects.toThrow();
		await b.guardar({ accion: 'quitarNocturna', id });
		expect((await b.obtener()).nocturnas.map((a) => a.id)).toEqual([sola]);
	});
});

describe('entrega y recepción de carpetas', () => {
	it('exige en cada estado sus datos y conserva lo que un paso no envía', async () => {
		const b = await base('ninguno');
		const otro = await base('ninguno');
		const quien = await persona('Entrega');
		const conceptoId = b.concepto('Seguridad');
		let version = 0;
		const paso = async (datos: object) => {
			await b.guardar({ accion: 'carpeta', conceptoId, version, ...datos });
			version++;
		};
		const carpeta = async () => (await b.obtener()).carpetas[0];

		await paso({ estado: 'en_proceso' });
		await expect(paso({ estado: 'entregada', entregaId: quien.id })).rejects.toMatchObject({
			tipo: 'invalido',
			message: expect.stringContaining('fecha de entrega')
		});
		// Entregar ya no exige enlace ni archivo.
		await paso({ estado: 'entregada', entregaId: quien.id, fecha: '2026-11-10' });
		expect(await carpeta()).toMatchObject({
			estado: 'entregada',
			entregaNombre: 'Entrega Ficticia',
			fecha: '2026-11-10',
			enlace: null,
			archivoNombre: null,
			version: 2
		});

		await expect(
			paso({
				estado: 'recibida_comentarios',
				recibe: 'Cliente ficticio',
				fechaRecepcion: '2026-11-12'
			})
		).rejects.toMatchObject({ tipo: 'invalido', message: expect.stringContaining('comentarios') });
		await expect(
			paso({
				estado: 'recibida_comentarios',
				recibe: 'Cliente ficticio',
				fechaRecepcion: '2026-11-09',
				comentarios: 'Falta una firma'
			})
		).rejects.toMatchObject({ tipo: 'invalido' });
		// El paso de recepción no reenvía quién entregó ni cuándo.
		await paso({
			estado: 'recibida_comentarios',
			recibe: 'Cliente ficticio',
			fechaRecepcion: '2026-11-12',
			comentarios: 'Falta una firma'
		});
		expect(await carpeta()).toMatchObject({
			estado: 'recibida_comentarios',
			entregaId: quien.id,
			fecha: '2026-11-10',
			recibe: 'Cliente ficticio',
			fechaRecepcion: '2026-11-12',
			comentarios: 'Falta una firma'
		});
		expect((await b.estatus()).carpetas).toEqual([
			{ conceptoId, etiqueta: 'Seguridad', estado: 'recibida_comentarios', porDefinir: false },
			{
				conceptoId: b.concepto('Archivo'),
				etiqueta: 'Archivo',
				estado: 'pendiente',
				porDefinir: true
			}
		]);

		// Se entrega de nuevo: los comentarios anteriores siguen a la vista.
		await paso({ estado: 'entregada', fecha: '2026-11-14' });
		expect(await carpeta()).toMatchObject({
			estado: 'entregada',
			fecha: '2026-11-14',
			comentarios: 'Falta una firma'
		});

		await expect(paso({ estado: 'recibida', fechaRecepcion: '2026-11-15' })).rejects.toMatchObject({
			tipo: 'invalido',
			message: expect.stringContaining('acuse')
		});
		await expect(
			paso({
				estado: 'recibida',
				fechaRecepcion: '2026-11-15',
				acuseEnlace: 'https://ejemplo.com/a'
			})
		).rejects.toThrow();
		const acuse = Buffer.from('acuse de prueba').toString('base64');
		await paso({
			estado: 'recibida',
			fechaRecepcion: '2026-11-15',
			acuseArchivo: acuse,
			acuseArchivoNombre: 'acuse.pdf'
		});
		expect(await carpeta()).toMatchObject({
			estado: 'recibida',
			fechaRecepcion: '2026-11-15',
			acuseEnlace: null,
			acuseArchivoNombre: 'acuse.pdf',
			archivoNombre: null,
			// Recibida correctamente: los comentarios de la entrega anterior ya no aplican.
			comentarios: null
		});
		const descargado = await repos.seguimiento.archivo(b.centro.id, MES, conceptoId, 'acuse');
		expect(descargado?.nombre).toBe('acuse.pdf');
		expect(Buffer.from(descargado!.datos, 'base64').toString()).toBe('acuse de prueba');
		// El acuse no es el archivo de la carpeta, ni existe para otro centro u otro mes.
		expect(await repos.seguimiento.archivo(b.centro.id, MES, conceptoId)).toBeNull();
		expect(await repos.seguimiento.archivo(otro.centro.id, MES, conceptoId, 'acuse')).toBeNull();
		expect(await repos.seguimiento.archivo(b.centro.id, '2026-12', conceptoId, 'acuse')).toBeNull();

		// Un enlace sustituye al archivo del acuse.
		await paso({ estado: 'recibida', acuseEnlace: ENLACE });
		expect(await carpeta()).toMatchObject({ acuseEnlace: ENLACE, acuseArchivoNombre: null });
		expect(await repos.seguimiento.archivo(b.centro.id, MES, conceptoId, 'acuse')).toBeNull();
		await expect(
			b.guardar({ accion: 'carpeta', conceptoId, version: 0, estado: 'pendiente' })
		).rejects.toMatchObject({ tipo: 'conflicto' });
	});
});

describe('adicionales y monto cobrado', () => {
	it('separa lo que llena administración de lo que cobra contabilidad', async () => {
		const b = await base('ninguno');
		const otro = await base('ninguno');
		const ver = (contrato: boolean, centro = b.centro.id) =>
			repos.contratoCobranza.obtener(centro, 2026, HOY, { contrato, programa: false });
		const id = randomUUID();
		const alta = {
			accion: 'nuevoAdicional',
			id,
			ordenCompra: ' OC-FICTICIA-9 ',
			descripcion: 'Trabajo extra',
			fechaSolicitud: '2026-10-20',
			periodoInicio: '2026-11-01',
			periodoFin: '2026-11-30',
			montoPactado: 1200.5
		};
		await b.contrato(alta);
		await b.contrato(alta);
		const esperado = {
			id,
			ordenCompra: 'OC-FICTICIA-9',
			descripcion: 'Trabajo extra',
			fechaSolicitud: '2026-10-20',
			periodoInicio: '2026-11-01',
			periodoFin: '2026-11-30',
			montoPactado: 1200.5,
			montoCobrado: null
		};
		expect((await ver(true)).contrato?.adicionales).toEqual([esperado]);

		await b.contrato({ accion: 'cobroAdicional', id, montoCobrado: 700 });
		expect((await ver(true)).contrato?.adicionales).toEqual([{ ...esperado, montoCobrado: 700 }]);
		// Editar no toca lo cobrado, aunque lo envíen.
		await b.contrato({
			...alta,
			accion: 'editarAdicional',
			descripcion: null,
			montoPactado: 1500,
			montoCobrado: 1
		});
		expect((await ver(true)).contrato?.adicionales).toEqual([
			{ ...esperado, descripcion: null, montoPactado: 1500, montoCobrado: 700 }
		]);

		await expect(b.contrato({ ...alta, id: randomUUID(), ordenCompra: ' ' })).rejects.toThrow();
		await expect(
			b.contrato({ ...alta, id: randomUUID(), periodoFin: '2026-10-01' })
		).rejects.toMatchObject({ tipo: 'invalido' });
		await expect(b.contrato({ accion: 'cobroAdicional', id, montoCobrado: -1 })).rejects.toThrow();
		// El adicional de un centro no existe para otro.
		for (const accion of [
			{ accion: 'cobroAdicional', id, montoCobrado: 5 },
			{ ...alta, accion: 'editarAdicional' },
			{ accion: 'quitarAdicional', id }
		]) {
			await expect(otro.contrato(accion)).rejects.toMatchObject({ tipo: 'no_encontrado' });
		}
		await expect(otro.contrato(alta)).rejects.toMatchObject({ tipo: 'no_encontrado' });
		expect((await ver(true, otro.centro.id)).contrato?.adicionales).toEqual([]);
		// Sin la capacidad de ver el contrato no sale ningún adicional ni monto.
		expect(await ver(false)).toEqual({ plantillaId: b.plantilla.id });

		expect((await b.estatus(true)).finanzas?.adicionales).toEqual({
			cantidad: 1,
			pactado: 1500,
			cobrado: 700
		});
		await expect(b.contrato({ accion: 'quitarAdicional', id })).rejects.toMatchObject({
			tipo: 'conflicto'
		});
		await b.contrato({ accion: 'cobroAdicional', id, montoCobrado: null });
		await b.contrato({ accion: 'quitarAdicional', id });
		expect((await ver(true)).contrato?.adicionales).toEqual([]);
	});

	it('el monto cobrado del contrato es la suma de la cobranza mensual', async () => {
		const b = await base('ninguno');
		const mes = (fecha: string, montoCobrado: number | null) => ({
			mes: fecha,
			estimacion: true,
			prefactura: false,
			factura: false,
			cobrado: montoCobrado !== null,
			montoCobrado
		});
		await b.contrato({
			accion: 'contrato',
			valores: [
				{ conceptoId: b.concepto('Monto'), valor: 10_000 },
				{ conceptoId: b.concepto('Monto cobrado'), valor: 123 }
			]
		});
		await b.contrato({ accion: 'cobranza', meses: [mes('2025-12-01', 1000.25)] });
		await b.contrato({
			accion: 'cobranza',
			meses: [mes('2026-10-01', 2000.5), mes('2026-11-01', null)]
		});
		const contrato = (
			await repos.contratoCobranza.obtener(b.centro.id, 2026, HOY, {
				contrato: true,
				programa: false
			})
		).contrato!;
		expect(contrato.cobradoTotal).toBe(3000.75);
		expect(contrato.cobranza).toHaveLength(2);
		// El concepto «Monto cobrado» ya no se captura: no se guardó el 123.
		expect(contrato.valores).toEqual([{ conceptoId: b.concepto('Monto'), valor: 10_000 }]);
		expect(contrato.conceptos.find((c) => c.etiqueta === 'Monto cobrado')).toMatchObject({
			indicador: 'monto_cobrado',
			porDefinir: false
		});
		expect((await b.estatus(true)).finanzas).toMatchObject({
			montoContrato: 10_000,
			cobrado: 3000.75,
			facturado: null,
			mes: { estimacion: true, prefactura: false, factura: false, cobrado: false }
		});
	});
});

describe('resumen de estatus por centro', () => {
	it('entrega una fila por centro visible y lo financiero solo con verContrato', async () => {
		const b = await base('mensual');
		const ajeno = await base('mensual');
		const filtro = { mes: MES, hoy: HOY };
		const operativo = await repos.estatus.obtener({
			...filtro,
			sitioIds: [b.centro.id],
			verContrato: false
		});
		expect(operativo.map((r) => r.sitioId)).toEqual([b.centro.id]);
		expect(operativo[0]).not.toHaveProperty('finanzas');
		expect(JSON.stringify(operativo)).not.toMatch(/monto|cobrado|contrato/i);
		expect(await repos.estatus.obtener({ ...filtro, sitioIds: [], verContrato: true })).toEqual([]);
		const todos = await repos.estatus.obtener({ ...filtro, sitioIds: null, verContrato: true });
		expect(todos.map((r) => r.sitioId)).toEqual(
			expect.arrayContaining([b.centro.id, ajeno.centro.id])
		);
		expect(todos.every((r) => r.finanzas)).toBe(true);
		expect(await repos.estatus.deCentro(randomUUID(), { ...filtro, verContrato: true })).toBeNull();
	});

	it('pasa de sin datos a con pendientes y a al corriente conforme se captura el mes', async () => {
		const b = await base('mensual');
		const quien = await persona('Estatus');
		let resumen = await b.estatus();
		expect(resumen).toMatchObject({
			sitioId: b.centro.id,
			plantillaId: b.plantilla.id,
			origen: 'mensual',
			mesTerminado: false,
			actividades: { programadas: 0, ejecutadas: 0, cobradas: 0 },
			em: { programadas: null, realizadas: null, cobradas: null },
			documentos: { esperados: 0, hechos: 0, faltantes: [] },
			emergencias: 0
		});
		expect((await b.estatus(false, '2026-12-01')).mesTerminado).toBe(true);
		// Nada capturado todavía: faltan los datos del mes y hay una carpeta por entregar.
		expect(resumirCentro(resumen)).toMatchObject({
			estatus: 'con_pendientes',
			falta: [
				{ texto: 'Faltan las EM programadas del mes', destino: 'seguimiento' },
				{
					texto: 'Carpeta de seguridad sin entregar',
					destino: 'seguimiento',
					ancla: 'carpetas',
					conceptoId: b.concepto('Seguridad')
				}
			]
		});

		const id = randomUUID();
		await b.guardar({
			accion: 'nuevaActividad',
			id,
			nombre: 'Mantenimiento',
			fecha: null,
			veces: 2
		});
		for (const [etiqueta, valor] of [
			['EM programadas', 4],
			['EM realizadas', 3]
		] as const) {
			await b.guardar({
				accion: 'valor',
				actividad: null,
				conceptoId: b.concepto(etiqueta),
				valor
			});
		}
		await b.guardar({ accion: 'ejecucion', actividad: `m:${id}:1`, valor: true });
		resumen = await b.estatus();
		expect(resumen.em).toEqual({ programadas: 4, realizadas: 3, cobradas: null });
		expect(resumirCentro(resumen)).toMatchObject({
			estatus: 'con_pendientes',
			falta: [
				{ texto: 'Falta 1 actividad por ejecutar' },
				{ texto: 'Falta 1 EM por realizar' },
				{ texto: 'Falta 1 reporte' },
				{ texto: 'Falta 1 ODT' },
				{ texto: 'Carpeta de seguridad sin entregar' }
			]
		});

		await b.guardar({ accion: 'marcarMes' });
		await b.guardar({
			accion: 'valor',
			actividad: null,
			conceptoId: b.concepto('EM realizadas'),
			valor: 4
		});
		await b.guardar({
			accion: 'carpeta',
			conceptoId: b.concepto('Seguridad'),
			version: 0,
			estado: 'recibida',
			entregaId: quien.id,
			fecha: '2026-11-18',
			recibe: 'Cliente ficticio',
			fechaRecepcion: '2026-11-19',
			acuseEnlace: ENLACE
		});
		resumen = await b.estatus();
		expect(resumen.documentos).toMatchObject({ esperados: 3, hechos: 3, faltantes: [] });
		const completo = resumirCentro(resumen);
		expect(completo).toMatchObject({ estatus: 'al_corriente', falta: [] });
		expect(completo.kpis.map((k) => [k.clave, k.valor, k.total, k.semaforo])).toEqual([
			['ejecucion', 2, 2, 'verde'],
			['em', 4, 4, 'verde'],
			['documentos', 3, 3, 'verde'],
			['carpetas', 1, 1, 'verde'],
			['cobro', 0, 2, null]
		]);
	});

	it('con verContrato suma contrato y carta: vencido y sin carta está atrasado', async () => {
		const b = await base('ninguno', [
			{ etiqueta: 'Número de contrato', bloque: 'contrato', tipo: 'texto' },
			{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto', indicador: 'monto_contrato' },
			{ etiqueta: 'Monto cobrado', bloque: 'contrato', tipo: 'monto', indicador: 'monto_cobrado' },
			{ etiqueta: 'Fianza', bloque: 'contrato', tipo: 'texto', porDefinir: true }
		]);
		await conPrograma(repos, b.centro.id, b.clave, 0, '2026-10-31');
		let finanzas = (await b.estatus(true)).finanzas!;
		expect(finanzas).toEqual({
			montoContrato: null,
			cobrado: 0,
			facturado: null,
			mes: { estimacion: false, prefactura: false, factura: false, cobrado: false },
			adicionales: { cantidad: 0, pactado: 0, cobrado: 0 },
			contratoVencido: true,
			cartaFaltante: true,
			// Número y monto; lo cobrado se deriva y la fianza está por definir.
			datosContrato: { esperados: 2, capturados: 0 }
		});
		expect(resumirCentro(await b.estatus(true))).toMatchObject({
			estatus: 'atrasado',
			falta: [
				{ texto: 'Falta la carta de finalización', destino: 'cobranza', ancla: 'carta' },
				{ texto: 'Faltan 2 datos del contrato', destino: 'cobranza', ancla: 'contrato' }
			]
		});
		// Quien no ve el contrato no recibe la carta ni el atraso que provoca.
		expect(resumirCentro(await b.estatus(false))).toMatchObject({
			estatus: 'sin_datos',
			falta: []
		});
		// Antes de vencer no falta la carta.
		expect((await b.estatus(true, '2026-10-31')).finanzas).toMatchObject({
			contratoVencido: false,
			cartaFaltante: false
		});

		await b.contrato({ accion: 'carta', fecha: '2026-11-05', enlace: null });
		await b.contrato({
			accion: 'contrato',
			valores: [
				{ conceptoId: b.concepto('Número de contrato'), valor: 'C-FICTICIO' },
				{ conceptoId: b.concepto('Monto'), valor: 5000 }
			]
		});
		finanzas = (await b.estatus(true)).finanzas!;
		expect(finanzas).toMatchObject({
			montoContrato: 5000,
			contratoVencido: true,
			cartaFaltante: false,
			datosContrato: { esperados: 2, capturados: 2 }
		});
	});
});
