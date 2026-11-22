// Muestra del reporte fotográfico en Excel con datos ficticios y fotos de relleno, para revisar el
// formato sin pasar por la interfaz (el generador todavía no está conectado a ninguna pantalla).
//
// Uso: node scripts/prueba-fotografico.ts [salida.xlsx]
//
// Por omisión escribe en STORAGE_DIR/prueba-documental (./storage, ignorado).
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
	generarReporteFotografico,
	type FotoFotografico,
	type ReporteFotografico
} from '../src/lib/server/documentos/fotografico.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVO_ENTORNO = join(RAIZ, '.env');
if (existsSync(ARCHIVO_ENTORNO)) process.loadEnvFile(ARCHIVO_ENTORNO);

const COLORES = ['#7a8b99', '#5b7f6a', '#a0825c', '#6d6f9c', '#9c6d7a', '#4f8a8b'];

/** Foto de relleno con su número, para distinguirlas en la hoja. */
async function relleno(numero: number, ancho: number, alto: number): Promise<Uint8Array> {
	const etiqueta = Buffer.from(
		`<svg width="${ancho}" height="${alto}" xmlns="http://www.w3.org/2000/svg">` +
			`<text x="50%" y="54%" font-family="Arial" font-size="${Math.round(alto / 4)}" fill="#ffffff" text-anchor="middle">Foto ${numero}</text></svg>`
	);
	return sharp({
		create: {
			width: ancho,
			height: alto,
			channels: 3,
			background: COLORES[numero % COLORES.length]
		}
	})
		.composite([{ input: etiqueta }])
		.jpeg({ quality: 80 })
		.toBuffer();
}

async function fotos(cantidad: number, actividades: number): Promise<FotoFotografico[]> {
	return Promise.all(
		Array.from({ length: cantidad }, async (_, i) => ({
			// Una de cada cuatro es vertical, para ver el ajuste a la caja.
			datos: i % 4 === 3 ? await relleno(i + 1, 900, 1200) : await relleno(i + 1, 1200, 900),
			descripcion: `Foto de relleno ${i + 1}`,
			actividad: (i % actividades) + 1
		}))
	);
}

const reportes: ReporteFotografico[] = [
	{
		numeroPartida: 1,
		actividad: 'Orden, limpieza y actividades de conservación del derecho de vía',
		sitio: 'EM-00000',
		dias: [
			{ desde: '2026-09-01', hasta: '2026-09-01' },
			{ desde: '2026-09-07', hasta: '2026-09-07' }
		],
		actividades: [
			'Inspección visual a través de recorrido a derecho de vía, para evaluar áreas con abundante hierba.',
			'Limpieza y chapeo de áreas verdes del derecho de vía con herramienta manual o desbrozadora.',
			'Control de flora mediante la fumigación con herbicidas orgánicos.'
		],
		fotos: await fotos(8, 3)
	},
	{
		numeroPartida: 13,
		actividad: 'Mantenimiento y verificación de indicadores de presión (manómetros)',
		sitio: 'EM-00000',
		dias: [{ desde: '2026-09-03', hasta: '2026-09-03' }],
		actividades: [
			'Inspección visual.',
			'Desmontaje de indicadores de presión.',
			'Verificación con equipo patrón y registro de lecturas en el formato de campo correspondiente a cada instrumento, comparando contra el patrón en cinco puntos de la escala.',
			'Limpieza física.',
			'Montaje y normalización.',
			'Detección de emisiones fugitivas con solución jabonosa.',
			'Retiro de materiales y limpieza del área de trabajo.'
		],
		fotos: await fotos(11, 7)
	},
	{
		numeroPartida: 23,
		actividad: 'Drenado de condensados y aceite a sistema de separación y filtrado de gas natural',
		sitio: 'EM-00000',
		dias: [{ desde: '2026-09-15', hasta: '2026-09-20' }],
		actividades: ['Apertura de válvulas de drenado.', 'Almacenamiento de los líquidos drenados.'],
		fotos: await fotos(3, 2)
	},
	{
		numeroPartida: 29,
		actividad: 'Administración de la documentación de la operación y mantenimiento',
		sitio: 'EM-00000',
		dias: [{ desde: '2026-09-16', hasta: '2026-09-16' }],
		actividades: ['Reporte descriptivo.', 'Permiso de trabajo.'],
		fotos: []
	}
];

const resultado = await generarReporteFotografico({
	estimacion: {
		numero: '07 (PARCIAL)',
		fechaEntrega: '2026-10-02',
		periodo: { desde: '2026-09-01', hasta: '2026-09-30' }
	},
	contrato: {
		cliente: 'CLIENTE DE PRUEBA, S.A. DE C.V.',
		numero: 'CONTRATO-PRUEBA-001',
		ordenCompra: 'OC00000',
		descripcion:
			'SERVICIO DE PRESERVACIÓN, OPERACIÓN, MANTENIMIENTO PREDICTIVO Y PREVENTIVO DE LA ESTACIÓN DE REGULACIÓN Y MEDICIÓN DE GAS NATURAL DE PRUEBA (EM-00000).',
		vigencia: { desde: '2026-03-01', hasta: '2027-02-28' },
		importe: 123456.78,
		contratista: 'CONTRATISTA DE PRUEBA, S.A. DE C.V.'
	},
	firmas: {
		contratista: {
			nombre: 'ING. PERSONA FICTICIA UNO',
			cargo: 'ADMINISTRADOR DEL CONTRATO',
			empresa: 'CONTRATISTA DE PRUEBA, S.A. DE C.V.'
		},
		autoriza: {
			nombre: 'ING. PERSONA FICTICIA DOS',
			cargo: 'ADMINISTRADOR DEL CONTRATO',
			empresa: 'CLIENTE DE PRUEBA, S.A. DE C.V.'
		}
	},
	logoCliente: await sharp({
		create: { width: 480, height: 260, channels: 4, background: '#2f6f9f' }
	})
		.png()
		.toBuffer(),
	reportes
});

const salida = resolve(
	process.argv[2] ??
		join(RAIZ, process.env.STORAGE_DIR ?? 'storage', 'prueba-documental', resultado.nombreArchivo)
);
await mkdir(dirname(salida), { recursive: true });
await writeFile(salida, resultado.xlsx);
console.log(
	`${salida}: ${resultado.hojas.length} hojas, ${resultado.fotos} fotos, ${(resultado.bytes / 1024).toFixed(0)} KB`
);
for (const hoja of resultado.hojas) {
	console.log(`  ${hoja.pagina}. «${hoja.nombre}» (${hoja.fotos} fotos)`);
}
