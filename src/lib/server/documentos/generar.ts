// Generación del DOCX FOR-ICSI-RMT-01 desde datos estructurados con la plantilla versionada.
import { createReport } from 'docx-templates';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
	agruparAntesDuranteDespues,
	agruparCuadricula,
	ajustarACaja,
	CAJA_FOTO,
	fechaEncabezado,
	nombreArchivo,
	numeracionSecciones,
	ordenDeAparicion,
	pieIlustracion,
	TEXTO_ESTADO_VERIFICACION,
	textoTags,
	tituloPortada,
	type DisposicionFotos,
	type EstadoVerificacion,
	type IdentidadReporte,
	type MomentoFoto
} from '../../dominio/documento.ts';
import { enParalelo, prepararImagen, type ImagenPreparada } from './imagenes.ts';

export const VERSION_PLANTILLA = 'FOR-ICSI-RMT-01.v1';
const RUTA_PLANTILLA = fileURLToPath(
	new URL('../plantillas/FOR-ICSI-RMT-01.v1.docx', import.meta.url)
);

/** Límite de tamaño del DOCX generado; las fotos optimizadas lo mantienen por debajo. */
export const LIMITE_BYTES_PREDETERMINADO = 50 * 1024 * 1024;

/** Delimitador de XML literal de docx-templates; usa un carácter de control que se elimina de los textos. */
const DELIMITADOR_XML_LITERAL = '\u001e\u001e';

export interface FirmanteDocumento {
	nombre: string;
	cargo: string;
	empresa: string;
}

export interface FotoDocumento {
	datos: Uint8Array;
	descripcion?: string;
	momento?: MomentoFoto | null;
	/** Medidas de la versión optimizada (JPEG) si ya se preparó; evita reprocesarla. */
	optimizada?: { ancho: number; alto: number } | null;
}

export interface AlcanceDocumento {
	titulo: string;
	descripcion: string;
	fotos: FotoDocumento[];
	estado?: EstadoVerificacion;
	observaciones?: string;
}

export interface HerramientaDocumento {
	cantidad?: string | null;
	descripcion: string;
}

export interface ReporteDocumento extends IdentidadReporte {
	encabezado: {
		usuario: string;
		contrato: string;
		sitio: string;
		periodicidad: string;
		/** AAAA-MM-DD */
		fecha: string;
		tipoMantenimiento: string;
	};
	firmantes: { elaboro: FirmanteDocumento; aprobo: FirmanteDocumento; recibio: FirmanteDocumento };
	objetivo: string;
	introduccion: string;
	disposicionFotos: DisposicionFotos;
	alcances: AlcanceDocumento[];
	herramientas: HerramientaDocumento[];
	incluyeVerificacion: boolean;
	conclusiones: string;
}

export interface OpcionesGeneracion {
	plantilla?: Uint8Array;
	limiteBytes?: number;
	/** Fotos procesadas en paralelo. */
	paralelo?: number;
}

export interface ResultadoDocumento {
	docx: Buffer;
	nombreArchivo: string;
	versionPlantilla: string;
	bytes: number;
	fotos: number;
}

let plantillaEnCache: Uint8Array | null = null;

async function plantillaPredeterminada(): Promise<Uint8Array> {
	plantillaEnCache ??= await readFile(RUTA_PLANTILLA);
	return plantillaEnCache;
}

/** Quita caracteres no válidos en XML 1.0 (y con ellos el delimitador de XML literal). */
export function limpiarTexto(valor: unknown): string {
	return (
		String(valor ?? '')
			.replace(/\r\n?/g, '\n')
			// eslint-disable-next-line no-control-regex -- se eliminan justamente los caracteres de control
			.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
			.trim()
	);
}

/** Un párrafo por renglón no vacío. */
export function parrafos(valor: unknown): string[] {
	return limpiarTexto(valor)
		.split('\n')
		.map((linea) => linea.trim())
		.filter(Boolean);
}

interface CeldaFoto {
	imagen: { width: number; height: number; data: Buffer; extension: '.jpg' };
	pie: string;
	momento: MomentoFoto | null;
}

async function prepararCeldas(
	alcance: AlcanceDocumento,
	posicionAlcance: number,
	disposicion: DisposicionFotos,
	paralelo: number
): Promise<CeldaFoto[]> {
	const ordenadas = ordenDeAparicion(alcance.fotos, disposicion);
	const caja = CAJA_FOTO[disposicion];
	return enParalelo(ordenadas, paralelo, async (foto, i) => {
		const preparada: ImagenPreparada = foto.optimizada
			? { datos: Buffer.from(foto.datos), ancho: foto.optimizada.ancho, alto: foto.optimizada.alto }
			: await prepararImagen(foto.datos);
		const medida = ajustarACaja(preparada.ancho, preparada.alto, caja);
		return {
			imagen: {
				width: medida.ancho,
				height: medida.alto,
				data: preparada.datos,
				extension: '.jpg'
			},
			pie: pieIlustracion(posicionAlcance, i + 1, limpiarTexto(foto.descripcion)),
			momento: foto.momento ?? null
		};
	});
}

export async function generarDocx(
	reporte: ReporteDocumento,
	{ plantilla, limiteBytes = LIMITE_BYTES_PREDETERMINADO, paralelo = 4 }: OpcionesGeneracion = {}
): Promise<ResultadoDocumento> {
	const disposicion = reporte.disposicionFotos;
	const secciones = numeracionSecciones(reporte.incluyeVerificacion);
	const firmante = (f: FirmanteDocumento | undefined) => ({
		nombre: limpiarTexto(f?.nombre),
		cargo: limpiarTexto(f?.cargo),
		empresa: limpiarTexto(f?.empresa)
	});

	let totalFotos = 0;
	const alcances = [];
	for (const [i, alcance] of reporte.alcances.entries()) {
		const celdas = await prepararCeldas(alcance, i + 1, disposicion, paralelo);
		totalFotos += celdas.length;
		alcances.push({
			titulo: limpiarTexto(alcance.titulo),
			descripcion: parrafos(alcance.descripcion),
			cuadricula: disposicion === 'cuadricula' ? agruparCuadricula(celdas) : [],
			antesDuranteDespues:
				disposicion === 'antes_durante_despues' ? agruparAntesDuranteDespues(celdas) : []
		});
	}

	const datos = {
		portada: tituloPortada(reporte),
		encabezado: {
			usuario: limpiarTexto(reporte.encabezado.usuario),
			contrato: limpiarTexto(reporte.encabezado.contrato),
			sitio: limpiarTexto(reporte.encabezado.sitio),
			tag: textoTags(reporte.tags),
			periodicidad: limpiarTexto(reporte.encabezado.periodicidad),
			fecha: fechaEncabezado(reporte.encabezado.fecha),
			tipoMantenimiento: limpiarTexto(reporte.encabezado.tipoMantenimiento)
		},
		firmas: {
			elaboro: firmante(reporte.firmantes.elaboro),
			aprobo: firmante(reporte.firmantes.aprobo),
			recibio: firmante(reporte.firmantes.recibio)
		},
		objetivo: parrafos(reporte.objetivo),
		introduccion: parrafos(reporte.introduccion),
		indice: { alcances: alcances.map((a, i) => `2.${i + 1} ${a.titulo}`) },
		alcances,
		herramientas: reporte.herramientas.map((h, i) => ({
			numero: `${i + 1}.`,
			cantidad: limpiarTexto(h.cantidad),
			descripcion: limpiarTexto(h.descripcion)
		})),
		verificacion: {
			incluida: reporte.incluyeVerificacion,
			filas: reporte.alcances.map((a, i) => ({
				numero: `${i + 1}.`,
				alcance: limpiarTexto(a.titulo),
				estado: TEXTO_ESTADO_VERIFICACION[a.estado ?? 'pendiente'],
				observaciones: limpiarTexto(a.observaciones)
			}))
		},
		secciones: { conclusiones: String(secciones.conclusiones) },
		conclusiones: parrafos(reporte.conclusiones)
	};

	const resultado = await createReport({
		template: plantilla ?? (await plantillaPredeterminada()),
		data: datos,
		cmdDelimiter: '+++',
		literalXmlDelimiter: DELIMITADOR_XML_LITERAL,
		processLineBreaks: true,
		rejectNullish: true
	});
	const docx = Buffer.from(resultado);
	if (docx.length > limiteBytes) {
		throw new Error(
			`El documento generado pesa ${(docx.length / 1048576).toFixed(1)} MB y excede el límite de ${(limiteBytes / 1048576).toFixed(0)} MB`
		);
	}
	return {
		docx,
		nombreArchivo: nombreArchivo(reporte),
		versionPlantilla: VERSION_PLANTILLA,
		bytes: docx.length,
		fotos: totalFotos
	};
}
