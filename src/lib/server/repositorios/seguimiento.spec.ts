import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OrigenActividades } from '../../dominio/constantes';
import { crearClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from './index';

let repos: Repositorios;
let n = 0;
const mes = '2026-11';

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
});
afterAll(() => repos.cerrar());

async function base(origenActividades: OrigenActividades) {
	const clave = `prueba-${++n}`;
	const plantilla = await repos.centrosCosto.guardarPlantilla({
		nombre: clave,
		modoContrato: 'opcional',
		origenActividades,
		conceptos: [
			{ etiqueta: 'ODT', bloque: 'documentos', tipo: 'casilla' },
			{ etiqueta: 'Reporte', bloque: 'programa', nivel: 'periodo', tipo: 'estado' },
			{ etiqueta: 'Cantidad', bloque: 'programa', nivel: 'periodo', tipo: 'cantidad' },
			{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto' },
			{ etiqueta: 'Seguridad', bloque: 'carpetas', tipo: 'carpeta' }
		]
	});
	const centro = await repos.centrosCosto.guardar({
		clave,
		nombre: clave,
		plantillaId: plantilla.id
	});
	const concepto = (etiqueta: string) =>
		plantilla.conceptos.find((c) => c.etiqueta === etiqueta)!.id;
	return {
		centro,
		plantilla,
		concepto,
		guardar: (accion: object, periodo = mes) =>
			repos.seguimiento.guardar(centro.id, periodo, plantilla.id, accion),
		obtener: (periodo = mes) => repos.seguimiento.obtener(centro.id, periodo)
	};
}

describe('seguimiento operativo en PGlite', () => {
	it('captura actividades mensuales y marca casillas, filas y meses sin cambiar otros valores', async () => {
		const b = await base('mensual');
		const id = randomUUID();
		const actividad = `m:${id}`;
		const nueva = { accion: 'nuevaActividad', id, nombre: 'Inspección', fecha: '2026-11-05' };
		await b.guardar(nueva);
		await b.guardar(nueva);
		await b.guardar({
			accion: 'editarActividad',
			actividad,
			nombre: 'Inspección técnica',
			fecha: null
		});
		await b.guardar({
			accion: 'nuevaActividad',
			id: randomUUID(),
			nombre: 'Revisión',
			fecha: null
		});
		await b.guardar({
			accion: 'valor',
			actividad: null,
			conceptoId: b.concepto('Cantidad'),
			valor: 2
		});
		await b.guardar({ accion: 'valor', actividad, conceptoId: b.concepto('ODT'), valor: true });
		expect((await b.obtener()).actividades).toMatchObject([
			{ clave: actividad, nombre: 'Inspección técnica', ejecutada: false },
			{ nombre: 'Revisión', ejecutada: false }
		]);
		await b.guardar({ accion: 'marcarFila', actividad });
		expect((await b.obtener()).actividades.map((a) => a.ejecutada)).toEqual([true, false]);
		await b.guardar({ accion: 'marcarMes' });
		await b.guardar({ accion: 'marcarMes' });
		const marcado = await b.obtener();
		expect(marcado.actividades.every((a) => a.ejecutada)).toBe(true);
		expect(marcado.valores).toHaveLength(4);
		expect(marcado.valores).toEqual(
			expect.arrayContaining([
				{ actividad: null, conceptoId: b.concepto('Cantidad'), valor: 2 },
				{ actividad: null, conceptoId: b.concepto('Reporte'), valor: 'hecho' }
			])
		);
		expect(marcado.conceptos.map((c) => c.etiqueta)).not.toContain('Monto');
		expect((await b.obtener('2026-12')).actividades).toEqual([]);
		await b.guardar({ accion: 'valor', actividad, conceptoId: b.concepto('ODT'), valor: false });
		expect((await b.obtener()).valores).not.toContainEqual({
			actividad,
			conceptoId: b.concepto('ODT'),
			valor: true
		});
	});

	it('aísla centros, meses y conceptos y rechaza cambios incompatibles con los datos guardados', async () => {
		const b = await base('ninguno');
		const otro = await base('mensual');
		const registro = {
			accion: 'valor',
			actividad: null,
			conceptoId: b.concepto('Reporte'),
			valor: 'en_proceso'
		};
		await b.guardar(registro);
		expect((await b.obtener()).valores).toEqual([
			{ actividad: null, conceptoId: b.concepto('Reporte'), valor: 'en_proceso' }
		]);
		await expect(otro.guardar(registro)).rejects.toMatchObject({ tipo: 'no_encontrado' });
		await expect(b.guardar({ ...registro, actividad: `m:${randomUUID()}` })).rejects.toMatchObject({
			tipo: 'no_encontrado'
		});
		await expect(
			b.guardar({ ...registro, conceptoId: b.concepto('Monto'), valor: 100 })
		).rejects.toMatchObject({ tipo: 'no_encontrado' });
		await expect(b.guardar({ ...registro, valor: 'inventado' })).rejects.toMatchObject({
			tipo: 'invalido'
		});
		await expect(
			b.guardar({ accion: 'nuevaActividad', id: randomUUID(), nombre: 'No aplica', fecha: null })
		).rejects.toMatchObject({ tipo: 'invalido' });
		await expect(
			repos.centrosCosto.guardarPlantilla({
				...b.plantilla,
				conceptos: b.plantilla.conceptos.map((c) =>
					c.id === registro.conceptoId ? { ...c, tipo: 'casilla' } : c
				)
			})
		).rejects.toMatchObject({ tipo: 'conflicto' });
		expect((await otro.obtener()).valores).toEqual([]);
	});

	it('desglosa el programa anual y conserva una fila ya capturada al quitarla del programa', async () => {
		const b = await base('programa_anual');
		const cliente = await repos.catalogo.guardarCliente({
			clave: 'anual',
			nombre: 'Ficticio',
			razonSocial: 'Ficticio'
		});
		const contrato = await repos.catalogo.guardarContrato({
			clienteId: cliente.id,
			numero: 'PRUEBA',
			descripcion: null,
			vigenciaInicio: '2026-01-01',
			vigenciaFin: '2026-12-31'
		});
		await repos.catalogo.asociarSitio(contrato.id, b.centro.id);
		const partida = await repos.catalogo.guardarPartida({
			contratoId: contrato.id,
			sitioId: b.centro.id,
			numero: '1',
			actividad: 'Inspección de prueba',
			periodicidad: 'mensual'
		});
		const programa = await repos.programa.guardarPrograma({
			contratoId: contrato.id,
			sitioId: b.centro.id,
			periodoInicio: '2026-01-01',
			periodoFin: '2026-12-31'
		});
		const celda = { partidaId: partida.id, mes: `${mes}-01` };
		await repos.programa.guardarMeses(programa.id, [{ ...celda, cantidad: 2 }]);
		const { actividades } = await b.obtener();
		expect(actividades.map((a) => [a.ordinal, a.ejecutada])).toEqual([
			[1, false],
			[2, false]
		]);
		await b.guardar({ accion: 'marcarFila', actividad: actividades[1].clave });
		await repos.programa.guardarMeses(programa.id, [{ ...celda, cantidad: 1 }]);
		expect((await b.obtener()).actividades).toMatchObject([
			{ ordinal: 1, programada: true, ejecutada: false },
			{ ordinal: 2, programada: false, ejecutada: true }
		]);
		expect(
			(await repos.programa.obtenerAvance(programa.id)).partidas[0].celdas.find(
				(c) => c.mes === celda.mes
			)?.realizado
		).toBe(0);
	});

	it('valida las carpetas, descarga sus bytes y rechaza un reemplazo con versión obsoleta', async () => {
		const b = await base('ninguno');
		const persona = await repos.personal.guardar({
			nombre: 'Persona',
			apellidoPaterno: 'Ficticia',
			apellidoMaterno: null,
			fechaNacimiento: null,
			correo: null,
			rol: 'reporteador',
			activo: true,
			centroCostoIds: [b.centro.id]
		});
		const carpeta = {
			accion: 'carpeta',
			conceptoId: b.concepto('Seguridad'),
			estado: 'entregada',
			entregaId: persona.id,
			recibe: 'Recepción ficticia',
			fecha: '2026-11-05',
			version: 0,
			enlace: null,
			archivo: null,
			archivoNombre: null,
			quitarArchivo: false
		};
		await expect(b.guardar(carpeta)).rejects.toMatchObject({ tipo: 'invalido' });
		const archivo = Buffer.from('archivo de prueba').toString('base64');
		await b.guardar({ ...carpeta, archivo, archivoNombre: 'prueba.txt' });
		expect((await b.obtener()).carpetas).toMatchObject([
			{ estado: 'entregada', archivoNombre: 'prueba.txt', version: 1 }
		]);
		expect(await repos.seguimiento.archivo(b.centro.id, mes, carpeta.conceptoId)).toMatchObject({
			nombre: 'prueba.txt'
		});
		const descargado = await repos.seguimiento.archivo(b.centro.id, mes, carpeta.conceptoId);
		expect(Buffer.from(descargado!.datos, 'base64').toString()).toBe('archivo de prueba');
		expect(await repos.seguimiento.archivo(b.centro.id, '2026-12', carpeta.conceptoId)).toBeNull();
		await expect(b.guardar({ ...carpeta, estado: 'pendiente' })).rejects.toMatchObject({
			tipo: 'conflicto'
		});
		await b.guardar({
			...carpeta,
			version: 1,
			enlace: 'https://ejemplo.sharepoint.com/sites/prueba'
		});
		expect(await repos.seguimiento.archivo(b.centro.id, mes, carpeta.conceptoId)).toBeNull();
	});

	it('registra atenciones sin plantilla y permite asignar una plantilla al mismo mes después', async () => {
		const b = await base('mensual');
		const centro = await repos.centrosCosto.guardar({
			clave: 'sin-plantilla',
			nombre: '',
			plantillaId: null
		});
		const id = randomUUID();
		const atencion = {
			accion: 'nuevaNocturna',
			id,
			fecha: '2026-11-09',
			descripcion: 'Emergencia ficticia'
		};
		await expect(
			repos.seguimiento.guardar(centro.id, mes, null, { ...atencion, fecha: '2026-12-01' })
		).rejects.toMatchObject({ tipo: 'invalido' });
		await repos.seguimiento.guardar(centro.id, mes, null, atencion);
		await repos.seguimiento.guardar(centro.id, mes, null, atencion);
		await repos.centrosCosto.guardar({
			id: centro.id,
			nombre: 'Con plantilla',
			plantillaId: b.plantilla.id
		});
		const consulta = await repos.seguimiento.obtener(centro.id, mes);
		expect(consulta).toMatchObject({
			origen: 'mensual',
			nocturnas: [{ id, fecha: atencion.fecha, descripcion: atencion.descripcion }]
		});
		await repos.seguimiento.guardar(centro.id, mes, b.plantilla.id, {
			accion: 'quitarNocturna',
			id
		});
		expect((await repos.seguimiento.obtener(centro.id, mes)).nocturnas).toEqual([]);
	});
});
