// Generación del DOCX FOR-ICSI-RMT-01 desde datos estructurados con la plantilla versionada.
import { createReport } from 'docx-templates';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
	agruparAntesDuranteDespues,
	agruparCuadricula,
	ajustarACaja,
	CAJA_FOTO,
	fechasEncabezado,
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
import { escribirIndice } from './indice.ts';
import { calcularIndice, entradaPaginacion, type CalculoIndice } from './paginacion.ts';

export const VERSION_PLANTILLA = 'FOR-ICSI-RMT-01.v2';
const RUTA_PLANTILLA = fileURLToPath(
	new URL('../plantillas/FOR-ICSI-RMT-01.v2.docx', import.meta.url)
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
	/** Giro elegido en el editor, en grados; se aplica antes de ajustar la foto a su caja. */
	rotacion?: 0 | 90 | 180 | 270;
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
		/** Días de ejecución: segmentos {desde, hasta} de un solo mes. */
		dias: { desde: string; hasta: string }[];
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
	/** Páginas calculadas del índice escrito en el documento. */
	indice: CalculoIndice;
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

/** Aplica `limpiarTexto` a todas las cadenas de una estructura; los datos binarios se conservan. */
export function sanear<T>(valor: T): T {
	if (typeof valor === 'string') return limpiarTexto(valor) as T;
	if (Array.isArray(valor)) return valor.map((elemento) => sanear(elemento)) as T;
	if (valor && typeof valor === 'object' && !(valor instanceof Uint8Array)) {
		return Object.fromEntries(Object.entries(valor).map(([clave, v]) => [clave, sanear(v)])) as T;
	}
	return valor;
}

/** Perfiles de optimización, del preferido al más ligero (la caja de 8 cm admite los cuatro). */
export const PERFILES_IMAGEN = [
	{ ladoMayor: 1600, calidad: 80 },
	{ ladoMayor: 1280, calidad: 75 },
	{ ladoMayor: 1024, calidad: 70 },
	{ ladoMayor: 800, calidad: 65 }
] as const;

/** Margen para el XML, las relaciones y la compresión del paquete. */
const RESERVA_BYTES = 1024 * 1024;

export interface CeldaFoto {
	imagen: { width: number; height: number; data: Buffer; extension: '.jpg' };
	pie: string;
	momento: MomentoFoto | null;
}

async function prepararSegunPerfil(foto: FotoDocumento, perfil: number): Promise<ImagenPreparada> {
	const giro = foto.rotacion ?? 0;
	// Los bytes de la optimizada solo sirven tal cual sin giro.
	if (perfil === 0 && foto.optimizada && !giro) {
		return {
			datos: Buffer.from(foto.datos),
			ancho: foto.optimizada.ancho,
			alto: foto.optimizada.alto
		};
	}
	return prepararImagen(foto.datos, { ...PERFILES_IMAGEN[perfil], giro });
}

/**
 * Prepara todas las fotos con el perfil preferido. Si su suma no cabe en el presupuesto del
 * documento, en cada perfil más ligero reprocesa primero las que exceden la cuota por foto y, si
 * aún no cabe, todas las demás; así se agotan los perfiles antes de rechazar el documento.
 */
export async function prepararFotos(
	fotos: readonly FotoDocumento[],
	presupuesto: number,
	paralelo: number
): Promise<ImagenPreparada[]> {
	let preparadas = await enParalelo(fotos, paralelo, (foto) => prepararSegunPerfil(foto, 0));
	const perfiles = fotos.map(() => 0);
	const total = () => preparadas.reduce((suma, p) => suma + p.datos.length, 0);
	const degradar = async (
		perfil: number,
		debeDegradar: (p: ImagenPreparada, i: number) => boolean
	) => {
		preparadas = await enParalelo(preparadas, paralelo, (preparada, i) => {
			if (perfiles[i] >= perfil || !debeDegradar(preparada, i)) return Promise.resolve(preparada);
			perfiles[i] = perfil;
			return prepararSegunPerfil(fotos[i], perfil);
		});
	};
	for (let perfil = 1; perfil < PERFILES_IMAGEN.length && total() > presupuesto; perfil++) {
		const cuota = presupuesto / preparadas.length;
		await degradar(perfil, (preparada) => preparada.datos.length > cuota);
		if (total() > presupuesto) await degradar(perfil, () => true);
	}
	return preparadas;
}

export async function prepararAlcances(
	reporte: ReporteDocumento,
	presupuesto: number,
	paralelo: number
): Promise<AlcancePreparado[]> {
	const disposicion = reporte.disposicionFotos;
	const ordenadas = reporte.alcances.map((alcance) => ordenDeAparicion(alcance.fotos, disposicion));
	const preparadas = await prepararFotos(ordenadas.flat(), presupuesto, paralelo);
	const caja = CAJA_FOTO[disposicion];
	let siguiente = 0;
	return reporte.alcances.map((alcance, i) => ({
		titulo: limpiarTexto(alcance.titulo),
		descripcion: parrafos(alcance.descripcion),
		celdas: ordenadas[i].map((foto, j) => {
			const preparada = preparadas[siguiente++];
			const medida = ajustarACaja(preparada.ancho, preparada.alto, caja);
			return {
				imagen: {
					width: medida.ancho,
					height: medida.alto,
					data: preparada.datos,
					extension: '.jpg'
				},
				pie: pieIlustracion(i + 1, j + 1, limpiarTexto(foto.descripcion)),
				momento: foto.momento ?? null
			};
		})
	}));
}

/** Alcance con sus fotos ya medidas (y giradas), listo para la plantilla. */
export interface AlcancePreparado {
	titulo: string;
	descripcion: string[];
	celdas: CeldaFoto[];
}

/** Datos que recibe la plantilla (y el modelo del índice), con todos los textos saneados. */
export function datosPlantilla(reporte: ReporteDocumento, preparados: AlcancePreparado[]) {
	const disposicion = reporte.disposicionFotos;
	const secciones = numeracionSecciones(reporte.incluyeVerificacion);
	const firmante = (f: FirmanteDocumento | undefined) => ({
		nombre: limpiarTexto(f?.nombre),
		cargo: limpiarTexto(f?.cargo),
		empresa: limpiarTexto(f?.empresa)
	});
	const alcances = preparados.map(({ celdas, ...alcance }) => ({
		...alcance,
		cuadricula: disposicion === 'cuadricula' ? agruparCuadricula(celdas) : [],
		antesDuranteDespues:
			disposicion === 'antes_durante_despues' ? agruparAntesDuranteDespues(celdas) : []
	}));
	// Todo texto, incluidos los derivados (portada y TAG), pasa por limpiarTexto.
	return sanear({
		portada: tituloPortada(reporte),
		encabezado: {
			usuario: limpiarTexto(reporte.encabezado.usuario),
			contrato: limpiarTexto(reporte.encabezado.contrato),
			sitio: limpiarTexto(reporte.encabezado.sitio),
			tag: textoTags(reporte.tags),
			periodicidad: limpiarTexto(reporte.encabezado.periodicidad),
			fecha: fechasEncabezado(reporte.encabezado.dias),
			tipoMantenimiento: limpiarTexto(reporte.encabezado.tipoMantenimiento)
		},
		firmas: {
			elaboro: firmante(reporte.firmantes.elaboro),
			aprobo: firmante(reporte.firmantes.aprobo),
			recibio: firmante(reporte.firmantes.recibio)
		},
		objetivo: parrafos(reporte.objetivo),
		introduccion: parrafos(reporte.introduccion),
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
	});
}

export async function generarDocx(
	reporte: ReporteDocumento,
	{ plantilla, limiteBytes = LIMITE_BYTES_PREDETERMINADO, paralelo = 4 }: OpcionesGeneracion = {}
): Promise<ResultadoDocumento> {
	const plantillaUsada = plantilla ?? (await plantillaPredeterminada());
	const presupuesto = limiteBytes - plantillaUsada.length - RESERVA_BYTES;
	const preparados = await prepararAlcances(reporte, presupuesto, paralelo);
	const totalFotos = preparados.reduce((suma, a) => suma + a.celdas.length, 0);
	const datos = datosPlantilla(reporte, preparados);

	// El índice se calcula con los mismos datos que recibe la plantilla y se escribe ya resuelto.
	const indice = calcularIndice(entradaPaginacion(datos));
	const resultado = await createReport({
		template: plantillaUsada,
		data: datos,
		cmdDelimiter: '+++',
		literalXmlDelimiter: DELIMITADOR_XML_LITERAL,
		processLineBreaks: true,
		rejectNullish: true
	});
	const docx = await escribirIndice(resultado, indice.titulos);
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
		fotos: totalFotos,
		indice
	};
}
