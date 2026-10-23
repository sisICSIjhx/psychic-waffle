import { describe, expect, it } from 'vitest';
import {
	describirCambio,
	fechaHoraLocal,
	mesDesdeCambio,
	primerDiaMesSiguiente,
	resumenEfectos,
	resumenImpacto,
	validarMotivo
} from './bitacora';
import { textoMesAnio } from './dias-ejecucion';

const impacto = (cambios = {}) => ({
	borradores: 0,
	borradoresIds: [],
	borradoresActualizados: [],
	borradoresConAviso: [],
	enRevision: 0,
	emitidos: 0,
	sustituidos: 0,
	otrosContratos: [],
	...cambios
});

describe('textos de la bitácora', () => {
	it('describe cada dato antes → después, con fechas locales y altas sin valor anterior', () => {
		expect(describirCambio({ campo: 'numero', antes: 'OC-1', despues: 'OC-2' })).toBe(
			'Número: OC-1 → OC-2'
		);
		expect(
			describirCambio({ campo: 'vigenciaFin', antes: '2027-02-28', despues: '2027-04-30' })
		).toBe('Fin de la vigencia: 28/02/2027 → 30/04/2027');
		expect(describirCambio({ campo: 'clave', antes: null, despues: 'EM-1' })).toBe('Clave: EM-1');
		expect(describirCambio({ campo: 'descripcion', antes: 'Algo', despues: null })).toBe(
			'Descripción: Algo → —'
		);
	});

	it('resume el impacto con el dato que conservan los emitidos', () => {
		expect(resumenImpacto(impacto({ borradores: 2, emitidos: 1 }), 'número')).toEqual([
			'2 borradores',
			'1 emitido conserva el número anterior'
		]);
		expect(
			resumenImpacto(
				impacto({
					enRevision: 2,
					sustituidos: 1,
					otrosContratos: [{ id: '00000000-0000-4000-8000-000000000001', numero: 'OC-2' }]
				})
			)
		).toEqual([
			'2 reportes en revisión conservan el dato anterior; regréselo a borrador para actualizarlo',
			'1 sustituido conserva el dato anterior',
			'También cambia en el contrato OC-2'
		]);
		expect(resumenImpacto(impacto({ desdeMes: '2026-12-01' }))).toEqual([
			'Los reportes desde diciembre de 2026 usarán al nuevo firmante'
		]);
		expect(
			resumenEfectos({ borradoresActualizados: ['a', 'b'], borradoresConAviso: ['c'] })
		).toEqual(['2 borradores actualizados', '1 borrador con aviso']);
	});

	it('exige un motivo de 10 a 500 caracteres sin contar los espacios de los extremos', () => {
		expect(validarMotivo('error')).toEqual({
			valido: false,
			mensaje: 'Faltan al menos 5 caracteres.'
		});
		expect(validarMotivo('   error de    ').valido).toBe(false);
		expect(validarMotivo('  Error de captura  ').valido).toBe(true);
		expect(validarMotivo('x'.repeat(501)).mensaje).toBe('Sobran 1 carácter.');
		expect(validarMotivo('x'.repeat(500)).valido).toBe(true);
	});

	it('calcula el mes desde el que aplica un cambio de firmante', () => {
		expect(textoMesAnio(mesDesdeCambio('2026-11-15'))).toBe('diciembre de 2026');
		expect(mesDesdeCambio('2026-11-01')).toBe('2026-11-01');
		expect(mesDesdeCambio('2026-12-20')).toBe('2027-01-01');
		expect(primerDiaMesSiguiente('2026-10-22')).toBe('2026-11-01');
		expect(primerDiaMesSiguiente('2026-12-01')).toBe('2027-01-01');
	});

	it('muestra la fecha y hora de la Ciudad de México', () => {
		expect(fechaHoraLocal('2026-10-23T03:05:00Z')).toBe('22/10/2026 21:05');
	});
});
