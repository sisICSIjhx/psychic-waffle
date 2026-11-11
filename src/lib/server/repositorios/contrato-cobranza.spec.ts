// Contrato, órdenes de compra, carta, enlace del programa y cobranza sobre PGlite. Solo datos
// ficticios.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearClientePglite } from '../bd/pglite';
import { crearRepositorios, type Repositorios } from './index';

let repos: Repositorios;
let n = 0;
const HOY = '2026-11-11';
const TODO = { contrato: true, programa: true };
const ENLACE = 'https://ejemplo.sharepoint.com/sites/prueba/contrato';

beforeAll(async () => {
	repos = crearRepositorios(await crearClientePglite());
});
afterAll(() => repos.cerrar());

async function base() {
	const clave = `cobranza-${++n}`;
	const plantilla = await repos.centrosCosto.guardarPlantilla({
		nombre: clave,
		modoContrato: 'obligatorio',
		origenActividades: 'ninguno',
		conceptos: [
			{ etiqueta: 'Número de contrato', bloque: 'contrato', tipo: 'texto' },
			{ etiqueta: 'Enlace del contrato', bloque: 'contrato', tipo: 'enlace' },
			{ etiqueta: 'Monto', bloque: 'contrato', tipo: 'monto' },
			{ etiqueta: 'Número de orden', bloque: 'ordenes_compra', tipo: 'texto' },
			{ etiqueta: 'Adicional', bloque: 'ordenes_compra', tipo: 'casilla' },
			{ etiqueta: 'Fecha de solicitud', bloque: 'ordenes_compra', tipo: 'fecha' },
			{ etiqueta: 'Monto de la orden', bloque: 'ordenes_compra', tipo: 'monto' },
			{ etiqueta: 'Reporte', bloque: 'programa', nivel: 'periodo', tipo: 'estado' }
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
		guardar: (cambios: object) => repos.contratoCobranza.guardar(centro.id, cambios),
		obtener: (ver = TODO, anio = 2026, hoy = HOY) =>
			repos.contratoCobranza.obtener(centro.id, anio, hoy, ver)
	};
}

describe('contrato y cobranza en PGlite', () => {
	it('guarda los datos del contrato por concepto y solo devuelve lo que se declara visible', async () => {
		const b = await base();
		const valores = [
			{ conceptoId: b.concepto('Número de contrato'), valor: 'C-FICTICIO-1' },
			{ conceptoId: b.concepto('Enlace del contrato'), valor: ENLACE },
			{ conceptoId: b.concepto('Monto'), valor: 1500.5 }
		];
		await b.guardar({ accion: 'contrato', valores });
		await b.guardar({ accion: 'programa', enlace: ENLACE });
		const completo = await b.obtener();
		expect(completo.programaEnlace).toBe(ENLACE);
		expect(completo.contrato?.modoContrato).toBe('obligatorio');
		expect(completo.contrato?.conceptos.map((c) => c.etiqueta)).not.toContain('Reporte');
		expect(completo.contrato?.valores).toEqual(expect.arrayContaining(valores));
		expect(completo.contrato?.valores).toHaveLength(3);

		// Quien solo ve el programa no recibe contrato, montos ni cobranza, y viceversa.
		expect(await b.obtener({ contrato: false, programa: true })).toEqual({
			plantillaId: b.plantilla.id,
			programaEnlace: ENLACE
		});
		const soloContrato = await b.obtener({ contrato: true, programa: false });
		expect(soloContrato).not.toHaveProperty('programaEnlace');
		expect(await b.obtener({ contrato: false, programa: false })).toEqual({
			plantillaId: b.plantilla.id
		});

		// Un campo vacío borra el dato; los demás se conservan.
		await b.guardar({ accion: 'contrato', valores: [valores[0], { ...valores[2], valor: null }] });
		expect((await b.obtener()).contrato?.valores).toEqual([valores[0]]);
	});

	it('rechaza valores que no corresponden al concepto, a la plantilla o a SharePoint', async () => {
		const b = await base();
		const otro = await base();
		const monto = b.concepto('Monto');
		const contrato = (conceptoId: string, valor: unknown) =>
			b.guardar({ accion: 'contrato', valores: [{ conceptoId, valor }] });
		await expect(contrato(monto, 'mil')).rejects.toMatchObject({ tipo: 'invalido' });
		await expect(contrato(monto, 10.005)).rejects.toMatchObject({ tipo: 'invalido' });
		await expect(contrato(monto, -1)).rejects.toThrow();
		await expect(
			contrato(b.concepto('Enlace del contrato'), 'https://ejemplo.com/contrato')
		).rejects.toMatchObject({ tipo: 'invalido' });
		await expect(contrato(otro.concepto('Monto'), 10)).rejects.toMatchObject({
			tipo: 'no_encontrado'
		});
		await expect(contrato(b.concepto('Número de orden'), 'OC-1')).rejects.toMatchObject({
			tipo: 'no_encontrado'
		});
		await expect(contrato(b.concepto('Reporte'), 'hecho')).rejects.toMatchObject({
			tipo: 'no_encontrado'
		});
		await expect(
			b.guardar({ accion: 'programa', enlace: 'http://ejemplo.sharepoint.com/x' })
		).rejects.toThrow();
		expect((await b.obtener()).contrato?.valores).toEqual([]);

		// Un concepto con datos del contrato no se reinterpreta desde la plantilla.
		await contrato(monto, 10);
		await expect(
			repos.centrosCosto.guardarPlantilla({
				...b.plantilla,
				conceptos: b.plantilla.conceptos.map((c) => (c.id === monto ? { ...c, tipo: 'texto' } : c))
			})
		).rejects.toMatchObject({ tipo: 'conflicto' });
	});

	it('registra, edita y quita órdenes de compra, también adicionales, sin mezclar centros', async () => {
		const b = await base();
		const otro = await base();
		const id = randomUUID();
		const numero = { conceptoId: b.concepto('Número de orden'), valor: 'OC-FICTICIA-1' };
		const nueva = { accion: 'nuevaOrden', id, valores: [numero] };
		await b.guardar(nueva);
		await b.guardar(nueva);
		const adicional = randomUUID();
		await b.guardar({
			accion: 'nuevaOrden',
			id: adicional,
			valores: [
				{ conceptoId: b.concepto('Adicional'), valor: true },
				{ conceptoId: b.concepto('Fecha de solicitud'), valor: '2026-11-03' },
				{ conceptoId: b.concepto('Monto de la orden'), valor: 250 }
			]
		});
		await expect(
			b.guardar({ accion: 'nuevaOrden', id: randomUUID(), valores: [] })
		).rejects.toMatchObject({ tipo: 'invalido' });
		const ordenes = (await b.obtener()).contrato!.ordenes;
		expect(ordenes).toHaveLength(2);
		expect(ordenes.find((o) => o.id === id)?.valores).toEqual([numero]);
		expect(ordenes.find((o) => o.id === adicional)?.valores).toHaveLength(3);

		const editado = { ...numero, valor: 'OC-FICTICIA-2' };
		await b.guardar({ accion: 'editarOrden', id, valores: [editado] });
		expect((await b.obtener()).contrato?.ordenes.find((o) => o.id === id)?.valores).toEqual([
			editado
		]);
		// La orden de un centro no existe para otro.
		await expect(otro.guardar({ accion: 'quitarOrden', id })).rejects.toMatchObject({
			tipo: 'no_encontrado'
		});
		await expect(otro.guardar({ accion: 'editarOrden', id, valores: [] })).rejects.toMatchObject({
			tipo: 'no_encontrado'
		});
		expect((await otro.obtener()).contrato?.ordenes).toEqual([]);
		await b.guardar({ accion: 'quitarOrden', id });
		expect((await b.obtener()).contrato?.ordenes.map((o) => o.id)).toEqual([adicional]);
	});

	it('avisa de la carta de finalización solo cuando el contrato ya terminó y falta', async () => {
		const b = await base();
		expect((await b.obtener()).contrato?.cartaFaltante).toBe(false);
		const cliente = await repos.catalogo.guardarCliente({
			clave: 'cobranza',
			nombre: 'Ficticio',
			razonSocial: 'Ficticio'
		});
		const contrato = await repos.catalogo.guardarContrato({
			clienteId: cliente.id,
			numero: 'PRUEBA-COBRANZA',
			descripcion: null,
			vigenciaInicio: '2026-01-01',
			vigenciaFin: '2026-10-31'
		});
		await repos.catalogo.asociarSitio(contrato.id, b.centro.id);
		expect((await b.obtener(TODO, 2026, '2026-10-31')).contrato?.cartaFaltante).toBe(false);
		const terminado = await b.obtener();
		expect(terminado.contrato?.cartaFaltante).toBe(true);
		expect(terminado.contrato?.contratos).toEqual([
			{
				id: contrato.id,
				numero: 'PRUEBA-COBRANZA',
				vigenciaInicio: '2026-01-01',
				vigenciaFin: '2026-10-31'
			}
		]);
		await expect(b.guardar({ accion: 'carta', fecha: null, enlace: ENLACE })).rejects.toMatchObject(
			{
				tipo: 'invalido'
			}
		);
		await b.guardar({ accion: 'carta', fecha: '2026-11-05', enlace: ENLACE });
		await b.guardar({ accion: 'programa', enlace: null });
		expect((await b.obtener()).contrato).toMatchObject({
			cartaFaltante: false,
			carta: { fecha: '2026-11-05', enlace: ENLACE }
		});
	});

	it('guarda la cobranza por mes y año y borra el mes que queda vacío', async () => {
		const b = await base();
		const mes = (mm: string, datos: object = {}) => ({
			mes: `2026-${mm}-01`,
			estimacion: false,
			prefactura: false,
			factura: false,
			cobrado: false,
			montoCobrado: null,
			...datos
		});
		const noviembre = mes('11', { estimacion: true, prefactura: true });
		const diciembre = mes('12', { cobrado: true, montoCobrado: 1234.56 });
		await b.guardar({ accion: 'cobranza', meses: [mes('10'), noviembre, diciembre] });
		expect((await b.obtener()).contrato?.cobranza).toEqual([noviembre, diciembre]);
		expect((await b.obtener(TODO, 2027)).contrato?.cobranza).toEqual([]);
		await b.guardar({ accion: 'cobranza', meses: [mes('11'), { ...diciembre, factura: true }] });
		expect((await b.obtener()).contrato?.cobranza).toEqual([{ ...diciembre, factura: true }]);
		await expect(
			b.guardar({ accion: 'cobranza', meses: [{ ...noviembre, mes: '2026-11-15' }] })
		).rejects.toThrow();
		await expect(
			b.guardar({ accion: 'cobranza', meses: [{ ...noviembre, montoCobrado: -5 }] })
		).rejects.toThrow();
		await expect(b.guardar({ accion: 'inventada' })).rejects.toThrow();
	});
});
