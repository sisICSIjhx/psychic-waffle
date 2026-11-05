// Lector del Excel «Catálogo de equipos» sobre un libro sintético con datos ficticios.
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { escaparXml } from '../documentos/ooxml';
import { leerExcelEquipos } from './equipos';

type Valor = string | number | null;

const letra = (columna: number) => String.fromCharCode(65 + columna);

async function libro(filas: Valor[][], combinadas: string[] = []): Promise<Uint8Array> {
	const cuerpo = filas
		.map((fila, i) => {
			const celdas = fila
				.map((valor, j) => {
					const ref = `${letra(j)}${i + 1}`;
					if (valor === null) return '';
					if (typeof valor === 'number') return `<c r="${ref}"><v>${valor}</v></c>`;
					return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
				})
				.join('');
			return `<row r="${i + 1}">${celdas}</row>`;
		})
		.join('');
	const merges = combinadas.length
		? `<mergeCells count="${combinadas.length}">${combinadas.map((r) => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>`
		: '';
	const zip = new JSZip();
	zip.file(
		'xl/workbook.xml',
		'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Catálogo de Equipos" sheetId="1" r:id="rId1"/></sheets></workbook>'
	);
	zip.file(
		'xl/_rels/workbook.xml.rels',
		'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
	);
	zip.file(
		'xl/worksheets/sheet1.xml',
		`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cuerpo}</sheetData>${merges}</worksheet>`
	);
	return zip.generateAsync({ type: 'uint8array' });
}

const ENCABEZADOS = [
	'Equipo ID',
	'Nombre',
	'Marca/Modelo',
	'No. de serie',
	'Rango',
	'Resolución',
	'Clase/Tolerancia',
	'Ubicación',
	'Propietario',
	'Responsable',
	'Crítico',
	'Estado',
	'Intervalo (meses)',
	'Última calibración/verificación',
	'Próxima calibración/verificación',
	'Proveedor',
	'Notas'
];

// 46259 = 2026-08-25 y 46351 = 2026-11-25 en el sistema de fechas de 1900.
const fila = (tag: string | null, nombre: string, cambios: Record<number, Valor> = {}): Valor[] => {
	const base: Valor[] = [
		tag,
		nombre,
		'MARCA / MODELO-1',
		12345,
		'0 - 100   kg/cm²',
		'—',
		null,
		'Separador',
		'CLIENTE FICTICIO',
		'Persona Ficticia',
		null,
		'En servicio',
		'Trimestral',
		46259,
		46351,
		'PROVEEDOR FICTICIO',
		null
	];
	for (const [columna, valor] of Object.entries(cambios)) base[Number(columna)] = valor;
	return base;
};

describe('leerExcelEquipos', () => {
	it('lee las columnas por encabezado, separa marca y modelo y omite filas vacías', async () => {
		const datos = await libro([
			ENCABEZADOS,
			Array(17).fill(null),
			fila('PI-1', 'Indicador de presión'),
			fila('LIT-1', 'Transmisor indicador de nivel', {
				2: 'SOLO MARCA',
				10: 'si',
				11: 'Fuera de operación',
				12: 'C/5 AÑOS',
				13: '13/09/2024',
				14: '---'
			}),
			Array(17).fill(null),
			fila(null, 'Tanque ficticio')
		]);
		const lectura = await leerExcelEquipos(datos);
		expect(lectura.hoja).toBe('Catálogo de Equipos');
		expect(lectura.avisos).toEqual(['Fila 6: sin «Equipo ID» (Tanque ficticio); se omitió.']);
		expect(lectura.equipos).toHaveLength(2);
		expect(lectura.equipos[0]).toMatchObject({
			fila: 3,
			tag: 'PI-1',
			tipo: 'Indicador de presión',
			marca: 'MARCA',
			modelo: 'MODELO-1',
			numeroSerie: '12345',
			rango: '0 - 100 kg/cm²',
			resolucion: null,
			critico: false,
			estado: 'en_servicio',
			intervaloMeses: 3,
			ultimaCalibracion: '2026-08-25',
			proximaCalibracion: '2026-11-25'
		});
		expect(lectura.equipos[1]).toMatchObject({
			marca: 'SOLO MARCA',
			modelo: null,
			critico: true,
			estado: 'fuera_de_operacion',
			intervaloMeses: 60,
			ultimaCalibracion: '2024-09-13',
			proximaCalibracion: null
		});
	});

	it('repite las celdas combinadas (notas de varios equipos) en cada fila', async () => {
		const datos = await libro(
			[
				ENCABEZADOS,
				fila('PIT-1', 'Transmisor', { 16: 'Requiere casa certificadora' }),
				fila('PIT-2', 'Transmisor'),
				fila('PIT-3', 'Transmisor')
			],
			['Q2:Q4']
		);
		const { equipos } = await leerExcelEquipos(datos);
		expect(equipos.map((e) => e.notas)).toEqual(Array(3).fill('Requiere casa certificadora'));
	});

	it('avisa de datos no reconocidos y rechaza un libro sin encabezados', async () => {
		const datos = await libro([
			ENCABEZADOS,
			fila('PI-2', 'Indicador', { 11: 'Prestado', 12: 'Cuando se requiera', 13: 'ayer' })
		]);
		const { equipos, avisos } = await leerExcelEquipos(datos);
		expect(equipos[0]).toMatchObject({ estado: 'en_servicio', intervaloMeses: null });
		expect(avisos).toHaveLength(3);
		await expect(leerExcelEquipos(await libro([['Hola', 'Mundo']]))).rejects.toThrow(/Equipo ID/);
	});
});
