import { describe, expect, it } from 'vitest';
import type { EquipoCatalogo } from './esquemas';
import {
	csvEquipos,
	estadoCalibracion,
	filtrarEquipos,
	indicadoresEquipos,
	intervaloDesdeTexto,
	proximaCalibracion,
	sumarMeses,
	textoIntervalo
} from './equipos';

const equipo = (cambios: Partial<EquipoCatalogo> = {}): EquipoCatalogo => ({
	id: crypto.randomUUID(),
	sitioId: 'b5b0a4f2-0000-4000-8000-000000000001',
	sitio: { id: 'b5b0a4f2-0000-4000-8000-000000000001', clave: 'EM-1', nombre: '' },
	tag: 'PI-1',
	tipo: 'Indicador de presión',
	marca: 'MARCA',
	modelo: 'M-1',
	numeroSerie: 'S/N',
	rango: null,
	resolucion: null,
	clase: null,
	ubicacion: 'Separador',
	propietario: null,
	responsable: null,
	critico: false,
	estado: 'en_servicio',
	intervaloMeses: 3,
	ultimaCalibracion: null,
	proximaCalibracion: null,
	proveedor: null,
	notas: null,
	orden: 1,
	enUso: false,
	actualizadoEn: '2026-11-05T00:00:00Z',
	...cambios
});

describe('intervalos', () => {
	it('traduce los textos del Excel a meses', () => {
		expect(intervaloDesdeTexto('Trimestral')).toBe(3);
		expect(intervaloDesdeTexto(' bimestral ')).toBe(2);
		expect(intervaloDesdeTexto('C/5 AÑOS')).toBe(60);
		expect(intervaloDesdeTexto('cada 2 años')).toBe(24);
		expect(intervaloDesdeTexto('18 meses')).toBe(18);
		expect(intervaloDesdeTexto(6)).toBe(6);
		expect(intervaloDesdeTexto('---')).toBeNull();
		expect(intervaloDesdeTexto(null)).toBeNull();
		expect(intervaloDesdeTexto('cuando se requiera')).toBeUndefined();
	});

	it('escribe el intervalo por su nombre', () => {
		expect(textoIntervalo(3)).toBe('Trimestral');
		expect(textoIntervalo(60)).toBe('Cada 5 años');
		expect(textoIntervalo(18)).toBe('Cada 18 meses');
		expect(textoIntervalo(null)).toBe('');
	});
});

describe('calibración', () => {
	it('suma meses sin pasarse del fin de mes', () => {
		expect(sumarMeses('2026-08-28', 3)).toBe('2026-11-28');
		expect(sumarMeses('2026-08-31', 6)).toBe('2027-02-28');
		expect(sumarMeses('2022-09-02', 60)).toBe('2027-09-02');
	});

	it('usa la próxima capturada o la calcula con la última y el intervalo', () => {
		expect(proximaCalibracion(equipo({ proximaCalibracion: '2026-12-01' }))).toEqual({
			fecha: '2026-12-01',
			calculada: false
		});
		expect(proximaCalibracion(equipo({ ultimaCalibracion: '2026-08-28' }))).toEqual({
			fecha: '2026-11-28',
			calculada: true
		});
		expect(
			proximaCalibracion(equipo({ intervaloMeses: null, ultimaCalibracion: '2026-08-28' }))
		).toEqual({ fecha: null, calculada: false });
	});

	it('clasifica vencida, por vencer (30 días), vigente y sin fecha', () => {
		const hoy = '2026-11-05';
		expect(estadoCalibracion(equipo({ proximaCalibracion: '2026-11-04' }), hoy)).toBe('vencida');
		expect(estadoCalibracion(equipo({ proximaCalibracion: '2026-11-05' }), hoy)).toBe('por_vencer');
		expect(estadoCalibracion(equipo({ proximaCalibracion: '2026-12-05' }), hoy)).toBe('por_vencer');
		expect(estadoCalibracion(equipo({ proximaCalibracion: '2026-12-06' }), hoy)).toBe('vigente');
		expect(estadoCalibracion(equipo(), hoy)).toBe('sin_fecha');
	});
});

describe('lista', () => {
	const hoy = '2026-11-05';
	const lista = [
		equipo({ tag: 'PIT-1715', proximaCalibracion: '2026-01-01', critico: true }),
		equipo({ tag: 'PIT-1716', proximaCalibracion: '2027-06-01' }),
		equipo({ tag: 'TI-1700', tipo: 'Indicador de temperatura', ubicacion: 'Filtro A' }),
		equipo({ tag: 'PI-1', estado: 'baja', proximaCalibracion: '2026-01-01' })
	];

	it('busca sin acentos y filtra por calibración, estado y críticos', () => {
		expect(filtrarEquipos(lista, { texto: 'pit' }, hoy).map((e) => e.tag)).toEqual([
			'PIT-1715',
			'PIT-1716'
		]);
		expect(
			filtrarEquipos(lista, { texto: 'PIT', calibracion: 'vencida' }, hoy).map((e) => e.tag)
		).toEqual(['PIT-1715']);
		expect(filtrarEquipos(lista, { texto: 'temperatura' }, hoy)).toHaveLength(1);
		expect(filtrarEquipos(lista, { calibracion: 'vencida' }, hoy).map((e) => e.tag)).toEqual([
			'PIT-1715'
		]);
		expect(filtrarEquipos(lista, { calibracion: 'vencida', estado: 'baja' }, hoy)).toHaveLength(1);
		expect(filtrarEquipos(lista, { estado: 'baja' }, hoy)).toHaveLength(1);
		expect(filtrarEquipos(lista, { soloCriticos: true }, hoy)).toHaveLength(1);
	});

	it('no cuenta los dados de baja en los indicadores', () => {
		expect(indicadoresEquipos(lista, hoy)).toEqual({
			total: 3,
			enServicio: 3,
			criticos: 1,
			vencidas: 1,
			porVencer: 0,
			bajas: 1
		});
	});

	it('exporta a CSV con las columnas del Excel y comillas escapadas', () => {
		const csv = csvEquipos([
			equipo({ clase: '8" 600', critico: true, ultimaCalibracion: '2026-08-28' })
		]);
		const [encabezados, fila] = csv.slice(1).split('\r\n');
		expect(csv.startsWith('\uFEFF')).toBe(true);
		expect(encabezados).toContain('"Equipo ID","Nombre","Marca/Modelo"');
		expect(fila).toContain('"MARCA / M-1"');
		expect(fila).toContain('"8"" 600"');
		expect(fila).toContain('"Sí","En servicio","Trimestral","28/08/2026","28/11/2026"');
	});
});
