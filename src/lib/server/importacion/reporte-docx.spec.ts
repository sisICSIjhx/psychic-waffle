import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { generarDocx, type ReporteDocumento } from '../documentos/generar';
import { leerReporteExistente, separarTitulo, tagDeReporte } from './reporte-docx';

const foto = () =>
	sharp({ create: { width: 160, height: 120, channels: 3, background: '#7a8b99' } })
		.jpeg()
		.toBuffer();

async function reporte(cambios: Partial<ReporteDocumento> = {}): Promise<ReporteDocumento> {
	return {
		numeroPartida: 7,
		actividad: 'Mantenimiento de válvulas de prueba',
		actividadCorta: 'Válvulas',
		periodo: { anio: 2026, mes: 7 },
		tags: ['PSV-0001'],
		encabezado: {
			usuario: 'CLIENTE FICTICIO',
			contrato: 'OC-FICTICIA',
			sitio: 'EM-99999 SITIO FICTICIO',
			periodicidad: 'Mensual',
			dias: [{ desde: '2026-07-01', hasta: '2026-07-01' }],
			tipoMantenimiento: 'Preventivo'
		},
		firmantes: {
			elaboro: { nombre: 'Persona Ficticia Uno', cargo: 'Cargo', empresa: 'Empresa A' },
			aprobo: { nombre: 'Persona Ficticia Dos', cargo: 'Cargo', empresa: 'Empresa A' },
			recibio: { nombre: 'Persona Ficticia Tres', cargo: 'Cargo', empresa: 'Empresa B' }
		},
		objetivo: 'Conservar las válvulas en operación.\nSegundo párrafo del objetivo.',
		introduccion: 'Actividades realizadas en la estación.',
		disposicionFotos: 'cuadricula',
		alcances: [
			{
				titulo: 'Inspección visual',
				descripcion: 'Revisión general del cuerpo.',
				fotos: [{ datos: await foto(), descripcion: 'Vista general' }],
				estado: 'ok'
			},
			{ titulo: 'Limpieza física', descripcion: 'Retiro de polvo.', fotos: [] }
		],
		herramientas: [
			{ cantidad: '1', descripcion: 'Llave ajustable' },
			{ cantidad: null, descripcion: 'Franela' }
		],
		incluyeVerificacion: true,
		conclusiones: 'Válvulas operando.',
		...cambios
	};
}

describe('lectura de un reporte FOR-ICSI-RMT-01 existente', () => {
	it('recupera encabezado, título, secciones y herramientas de un DOCX generado', async () => {
		const { docx } = await generarDocx(await reporte());
		const leido = await leerReporteExistente(docx);

		expect(leido).toMatchObject({
			numero: '07',
			actividad: 'MANTENIMIENTO DE VÁLVULAS DE PRUEBA',
			encabezado: {
				usuario: 'CLIENTE FICTICIO',
				contrato: 'OC-FICTICIA',
				sitio: 'EM-99999 SITIO FICTICIO',
				tag: 'PSV-0001',
				periodicidad: 'Mensual',
				tipoMantenimiento: 'Preventivo'
			},
			objetivo: ['Conservar las válvulas en operación.', 'Segundo párrafo del objetivo.'],
			introduccion: ['Actividades realizadas en la estación.'],
			tieneVerificacion: true,
			antesDuranteDespues: false,
			conclusiones: ['Válvulas operando.']
		});
		expect(leido.alcances).toEqual([
			{ titulo: 'Inspección visual', descripcion: ['Revisión general del cuerpo.'] },
			{ titulo: 'Limpieza física', descripcion: ['Retiro de polvo.'] }
		]);
		expect(leido.herramientas).toEqual([
			{ cantidad: '1', descripcion: 'Llave ajustable' },
			{ cantidad: null, descripcion: 'Franela' }
		]);
		// Los firmantes son datos personales: el lector no los devuelve.
		expect(JSON.stringify(leido)).not.toContain('Persona Ficticia');
	});

	it('detecta la disposición antes/durante/después y la ausencia de verificación', async () => {
		const fotos = await Promise.all(
			(['antes', 'durante', 'despues'] as const).map(async (momento) => ({
				datos: await foto(),
				momento
			}))
		);
		const { docx } = await generarDocx(
			await reporte({
				disposicionFotos: 'antes_durante_despues',
				incluyeVerificacion: false,
				alcances: [{ titulo: 'Cambio de empaque', descripcion: 'Sustitución.', fotos }]
			})
		);
		const leido = await leerReporteExistente(docx);
		expect(leido.tieneVerificacion).toBe(false);
		expect(leido.antesDuranteDespues).toBe(true);
		expect(leido.alcances).toEqual([
			{ titulo: 'Cambio de empaque', descripcion: ['Sustitución.'] }
		]);
	});

	it('separa número y actividad del título y prefiere el TAG del nombre del archivo', () => {
		expect(separarTitulo('Partida 13.- Mantenimiento de manómetros.')).toEqual({
			numero: '13',
			actividad: 'Mantenimiento de manómetros'
		});
		expect(separarTitulo('16.- VERIFICACIÓN A PSV 1801')).toEqual({
			numero: '16',
			actividad: 'VERIFICACIÓN A PSV 1801'
		});
		expect(separarTitulo('Sin número')).toEqual({ numero: null, actividad: 'Sin número' });
		expect(tagDeReporte('PI-0002', 'P13 PI 0005 JUNIO.docx')).toBe('PI-0005');
		expect(tagDeReporte('psv 1801', 'reporte.docx')).toBe('PSV-1801');
		expect(tagDeReporte('', 'reporte.docx')).toBeNull();
	});
});
