// Generación del «reporte fotográfico» de estimación: un libro de Excel horizontal con la «HOJA
// MAESTRA» y una hoja por reporte (más las de continuación cuando las fotos no caben), a partir de la
// plantilla versionada. Complementa al DOCX FOR-ICSI-RMT-01 y todavía no está conectado a la
// interfaz: lo usan las pruebas y scripts/prueba-fotografico.ts.
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ajustarACaja, ordenDeAparicion } from '../../dominio/documento.ts';
import {
	CAJA_FOTO_FOTOGRAFICO,
	cuadriculaFotos,
	descripcionPartida,
	FOTOS_POR_HOJA,
	nombreArchivoFotografico,
	periodoContrato,
	periodoEstimado,
	RENGLONES_ACTIVIDADES,
	repartirHojas,
	textoActividad,
	textoPagina,
	type HojaReparto,
	type Segmento
} from '../../dominio/reporte-fotografico.ts';
import { formatoDeDocumento, type TipoDocumento } from '../../dominio/tipos-documento.ts';
import {
	LIMITE_BYTES_PREDETERMINADO,
	limpiarTexto,
	type FirmanteDocumento,
	type FotoDocumento,
	type ReporteDocumento
} from './generar.ts';
import { enParalelo, prepararImagen, type ImagenPreparada } from './imagenes.ts';
import {
	anclaEn,
	anclasDe,
	combinadasDe,
	EMU_POR_CM,
	indiceColumna,
	nombreHojaEnFormula,
	ponerAltoFila,
	ponerCelda,
	ponerCombinadas,
	rejillaDe,
	relacionesLibro,
	serieExcel,
	suma,
	xmlCirculo,
	xmlDibujo,
	xmlImagen,
	xmlLibro,
	xmlRelaciones,
	xmlTiposContenido,
	type Rejilla,
	type Relacion,
	type Tamano
} from './libro-xlsx.ts';
import { FUENTES, renglones } from './paginacion.ts';

export const TIPO_FOTOGRAFICO = 'reporte-fotografico' satisfies TipoDocumento;
export const VERSION_PLANTILLA_FOTOGRAFICO = 'REPORTE-FOTOGRAFICO.v1';
const RUTA_PLANTILLA = fileURLToPath(
	new URL('../plantillas/REPORTE-FOTOGRAFICO.v1.xlsx', import.meta.url)
);

// --- Contrato de la plantilla: hojas, celdas y zonas ---------------------------------------------

const HOJA_MAESTRA = 'HOJA MAESTRA';
const PARTE_MAESTRA = 'xl/worksheets/sheet1.xml';
const PARTE_MODELO = 'xl/worksheets/sheet2.xml';
const PARTE_DIBUJO_MODELO = 'xl/drawings/drawing1.xml';
const AREA_IMPRESION = '$B$1:$Q$53';
const COLUMNAS = 17;
const FILAS = 53;

/** Celdas de la hoja maestra: de ellas toman su valor las fórmulas de cada hoja. */
const MAESTRA = { fechaEntrega: 'E3', periodoEstimado: 'E6', estimacion: 'E9' } as const;
const CELDAS = {
	cliente: 'G1',
	contrato: 'F5',
	fechaEntrega: 'M5',
	ordenCompra: 'F6',
	descripcionServicio: 'F7',
	periodoContrato: 'M7',
	periodoEstimado: 'M9',
	importe: 'F11',
	estimacion: 'M11',
	contratista: 'F12',
	pagina: 'M12',
	partida: 'C16',
	descripcion: 'D16'
} as const;
const FIRMAS = {
	contratista: { nombre: 'D48', cargo: 'D49', empresa: 'D50' },
	autoriza: { nombre: 'L48', cargo: 'L49', empresa: 'L50' }
} as const;
/** Zona de fotos: columnas C a P, filas 19 a 37 (en base 0 y con el final excluido). */
const ZONA_FOTOS = {
	columnaInicial: indiceColumna('C'),
	columnaFinal: indiceColumna('P') + 1,
	filaInicial: 18,
	filaFinal: 37
};
/** Lista de actividades: desde la fila 38, en una columna (D a O) o en dos (D a J y K a O). */
const ACTIVIDADES = {
	primeraFila: 38,
	unaColumna: [['D', 'O']],
	dosColumnas: [
		['D', 'J'],
		['K', 'O']
	],
	puntos: 14,
	/** Alto (pt) de cada renglón de texto y holgura de la fila, según las filas de un renglón del formato. */
	altoRenglon: 18,
	holgura: 6.9
} as const;
/** Caja del logotipo del cliente, a la izquierda del encabezado (el de ICSI viene en la plantilla). */
const LOGO_CLIENTE = {
	ancla: { columna: 2, desplazamientoColumna: 1014295, fila: 0, desplazamientoFila: 121227 },
	caja: { ancho: 1548794, alto: 844087 }
};
/** Separación máxima entre fotos (cm) y diámetro del círculo con el número de actividad. */
const SEPARACION = { horizontal: 1.2, vertical: 1, minima: 0.3 };
const DIAMETRO_CIRCULO = 1.6 * EMU_POR_CM;

/** Perfiles de las fotos, del preferido al más ligero: la caja de 11 cm no necesita más de 1024 px. */
export const PERFILES_FOTOGRAFICO = [
	{ ladoMayor: 1024, calidad: 75 },
	{ ladoMayor: 800, calidad: 70 },
	{ ladoMayor: 640, calidad: 65 }
] as const;
const RESERVA_BYTES = 1024 * 1024;

// --- Datos de entrada ----------------------------------------------------------------------------

export interface EstimacionFotografico {
	/** Número de estimación tal como se escribe: «07 (PARCIAL)». */
	numero: string;
	/** Fecha de entrega de la estimación (AAAA-MM-DD). */
	fechaEntrega: string;
	/** Periodo estimado (AAAA-MM-DD). */
	periodo: Segmento;
}

export interface ContratoFotografico {
	/** Razón social del cliente; encabeza cada hoja. */
	cliente: string;
	numero: string;
	ordenCompra: string;
	/** Descripción de la obra o servicio. */
	descripcion: string;
	/** Periodo de contrato (AAAA-MM-DD). */
	vigencia: Segmento;
	/** Importe contratado; null lo deja en blanco. */
	importe: number | null;
	/** Razón social del contratista. */
	contratista: string;
}

export interface FotoFotografico extends FotoDocumento {
	/** Número (desde 1) de la actividad que ilustra; sale en el círculo de la foto. */
	actividad?: number | null;
}

/** Un reporte de la plataforma tal como entra al libro: ocupa una hoja o varias. */
export interface ReporteFotografico {
	numeroPartida: string | number;
	actividad: string;
	sitio?: string | null;
	/** Días de ejecución: segmentos {desde, hasta}. */
	dias: Segmento[];
	/** Actividades realizadas, en orden; el libro las numera. */
	actividades: string[];
	fotos: FotoFotografico[];
}

export interface LibroFotografico {
	estimacion: EstimacionFotografico;
	contrato: ContratoFotografico;
	firmas: { contratista: FirmanteDocumento; autoriza: FirmanteDocumento };
	/** Logotipo del cliente (PNG o JPEG); sin él su lugar queda vacío. */
	logoCliente?: Uint8Array | null;
	reportes: ReporteFotografico[];
}

export interface OpcionesFotografico {
	plantilla?: Uint8Array;
	limiteBytes?: number;
	/** Fotos por hoja, de 1 a 8. */
	fotosPorHoja?: number;
	/** Fotos procesadas en paralelo. */
	paralelo?: number;
}

export interface ResultadoFotografico {
	xlsx: Buffer;
	nombreArchivo: string;
	tipo: typeof TIPO_FOTOGRAFICO;
	/** Tipo MIME del formato de descarga declarado por el tipo de documento. */
	mime: string;
	versionPlantilla: string;
	bytes: number;
	fotos: number;
	hojas: { nombre: string; pagina: number; reporte: number; fotos: number }[];
}

/**
 * Convierte un reporte FOR-ICSI-RMT-01 en la entrada del libro: sus alcances son las actividades
 * numeradas y cada foto lleva el número de su alcance.
 */
export function reporteFotograficoDe(reporte: ReporteDocumento): ReporteFotografico {
	return {
		numeroPartida: reporte.numeroPartida,
		actividad: reporte.actividad,
		sitio: reporte.encabezado.sitio,
		dias: reporte.encabezado.dias,
		actividades: reporte.alcances.map((alcance) => alcance.titulo),
		fotos: reporte.alcances.flatMap((alcance, i) =>
			ordenDeAparicion(alcance.fotos, reporte.disposicionFotos).map((foto) => ({
				...foto,
				actividad: i + 1
			}))
		)
	};
}

// --- Fotos ---------------------------------------------------------------------------------------

async function prepararSegunPerfil(foto: FotoDocumento, perfil: number): Promise<ImagenPreparada> {
	const giro = foto.rotacion ?? 0;
	const { ladoMayor } = PERFILES_FOTOGRAFICO[perfil];
	const lista = foto.optimizada;
	// La versión optimizada sirve tal cual si no hay que girarla ni reducirla.
	if (perfil === 0 && lista && !giro && Math.max(lista.ancho, lista.alto) <= ladoMayor) {
		return { datos: Buffer.from(foto.datos), ancho: lista.ancho, alto: lista.alto };
	}
	return prepararImagen(foto.datos, { ...PERFILES_FOTOGRAFICO[perfil], giro });
}

/** Prepara las fotos con el perfil preferido y baja de perfil mientras no quepan en el presupuesto. */
async function prepararFotos(
	fotos: readonly FotoDocumento[],
	presupuesto: number,
	paralelo: number
): Promise<ImagenPreparada[]> {
	let preparadas: ImagenPreparada[] = [];
	for (let perfil = 0; perfil < PERFILES_FOTOGRAFICO.length; perfil++) {
		preparadas = await enParalelo(fotos, paralelo, (foto) => prepararSegunPerfil(foto, perfil));
		if (preparadas.reduce((total, p) => total + p.datos.length, 0) <= presupuesto) break;
	}
	return preparadas;
}

// --- Disposición de la hoja ----------------------------------------------------------------------

interface Colocada {
	/** Esquina superior izquierda (EMU desde la esquina de la hoja). */
	x: number;
	y: number;
	tamano: Tamano;
}

/**
 * Sitúa las fotos de una hoja en la zona de fotos: cuadrícula centrada, cada foto ajustada a su
 * caja sin deformarse y cada fila centrada cuando no se llena.
 */
function colocarFotos(rejilla: Rejilla, medidas: readonly { ancho: number; alto: number }[]) {
	const { columnas, filas } = cuadriculaFotos(medidas.length);
	const zona = {
		x: suma(rejilla.columnas, 0, ZONA_FOTOS.columnaInicial),
		y: suma(rejilla.filas, 0, ZONA_FOTOS.filaInicial),
		ancho: suma(rejilla.columnas, ZONA_FOTOS.columnaInicial, ZONA_FOTOS.columnaFinal),
		alto: suma(rejilla.filas, ZONA_FOTOS.filaInicial, ZONA_FOTOS.filaFinal)
	};
	const minima = SEPARACION.minima * EMU_POR_CM;
	const caja = {
		ancho: CAJA_FOTO_FOTOGRAFICO.ancho * EMU_POR_CM,
		alto: CAJA_FOTO_FOTOGRAFICO.alto * EMU_POR_CM
	};
	// Si la zona fuera más chica que la cuadrícula, las cajas se reducen en proporción.
	const escala = Math.min(
		1,
		(zona.ancho - (columnas + 1) * minima) / (columnas * caja.ancho),
		(zona.alto - (filas + 1) * minima) / (filas * caja.alto)
	);
	const ancho = caja.ancho * escala;
	const alto = caja.alto * escala;
	const separacionX = Math.min(
		SEPARACION.horizontal * EMU_POR_CM,
		(zona.ancho - columnas * ancho) / (columnas + 1)
	);
	const separacionY = Math.min(
		SEPARACION.vertical * EMU_POR_CM,
		(zona.alto - filas * alto) / (filas + 1)
	);
	const inicioY = zona.y + (zona.alto - filas * alto - (filas - 1) * separacionY) / 2;
	return medidas.map((medida, i): Colocada => {
		const fila = Math.floor(i / columnas);
		const enFila = Math.min(columnas, medidas.length - fila * columnas);
		const inicioX = zona.x + (zona.ancho - enFila * ancho - (enFila - 1) * separacionX) / 2;
		const ajustada = ajustarACaja(medida.ancho, medida.alto, {
			ancho: ancho / EMU_POR_CM,
			alto: alto / EMU_POR_CM
		});
		const tamano = {
			ancho: Math.round(ajustada.ancho * EMU_POR_CM),
			alto: Math.round(ajustada.alto * EMU_POR_CM)
		};
		return {
			x: inicioX + (i % columnas) * (ancho + separacionX) + (ancho - tamano.ancho) / 2,
			y: inicioY + fila * (alto + separacionY) + (alto - tamano.alto) / 2,
			tamano
		};
	});
}

/**
 * Escribe la lista numerada de actividades: una columna hasta seis renglones y dos columnas después.
 * Cada renglón se combina a lo ancho de su columna y la fila crece si el texto ocupa varios renglones.
 */
function escribirActividades(
	xmlHoja: string,
	rejilla: Rejilla,
	actividades: HojaReparto['actividades']
): { xml: string; combinadas: string[] } {
	const enDos = actividades.length > RENGLONES_ACTIVIDADES;
	const porColumna = enDos ? Math.ceil(actividades.length / 2) : actividades.length;
	const columnas = enDos ? ACTIVIDADES.dosColumnas : ACTIVIDADES.unaColumna;
	const combinadas: string[] = [];
	let xml = xmlHoja;
	for (let renglon = 0; renglon < porColumna; renglon++) {
		const fila = ACTIVIDADES.primeraFila + renglon;
		let lineas = 1;
		columnas.forEach(([desde, hasta], c) => {
			const actividad = actividades[c * porColumna + renglon];
			if (!actividad) return;
			const texto = textoActividad(actividad.numero, limpiarTexto(actividad.texto));
			xml = ponerCelda(xml, `${desde}${fila}`, { tipo: 'texto', valor: texto });
			combinadas.push(`${desde}${fila}:${hasta}${fila}`);
			// Ancho útil en puntos, con un margen por el relleno de la celda y la escala de pantalla.
			const ancho =
				(suma(rejilla.columnas, indiceColumna(desde), indiceColumna(hasta) + 1) / 12700) * 0.94;
			lineas = Math.max(lineas, renglones(texto, ancho, FUENTES.arial, ACTIVIDADES.puntos));
		});
		if (lineas > 1) {
			xml = ponerAltoFila(xml, fila, lineas * ACTIVIDADES.altoRenglon + ACTIVIDADES.holgura);
		}
	}
	return { xml, combinadas };
}

function relacionesDe(xml: string): Relacion[] {
	return [...xml.matchAll(/<Relationship\s[^>]*>/g)].map((r) => ({
		id: /\sId="([^"]+)"/.exec(r[0])![1],
		tipo: /\sType="[^"]*\/(\w+)"/.exec(r[0])![1] as Relacion['tipo'],
		destino: /\sTarget="([^"]+)"/.exec(r[0])![1]
	}));
}

let plantillaEnCache: Uint8Array | null = null;

async function plantillaPredeterminada(): Promise<Uint8Array> {
	plantillaEnCache ??= await readFile(RUTA_PLANTILLA);
	return plantillaEnCache;
}

export async function generarReporteFotografico(
	libro: LibroFotografico,
	{
		plantilla,
		limiteBytes = LIMITE_BYTES_PREDETERMINADO,
		fotosPorHoja = FOTOS_POR_HOJA,
		paralelo = 4
	}: OpcionesFotografico = {}
): Promise<ResultadoFotografico> {
	if (!libro.reportes.length) {
		throw new RangeError('El reporte fotográfico necesita al menos un reporte');
	}
	const plantillaUsada = plantilla ?? (await plantillaPredeterminada());
	const origen = await JSZip.loadAsync(plantillaUsada);
	const leer = async (parte: string) => {
		const archivo = origen.file(parte);
		if (!archivo) throw new Error(`La plantilla no tiene la parte ${parte}`);
		return archivo.async('string');
	};
	const modelo = await leer(PARTE_MODELO);
	const rejilla = rejillaDe(modelo, COLUMNAS, FILAS);
	const anclasPlantilla = anclasDe(await leer(PARTE_DIBUJO_MODELO));
	const relacionesPlantilla = relacionesDe(
		await leer(PARTE_DIBUJO_MODELO.replace('drawings/', 'drawings/_rels/') + '.rels')
	);

	const hojas = repartirHojas(
		libro.reportes.map((reporte) => ({
			numeroPartida: reporte.numeroPartida,
			actividades: reporte.actividades,
			fotos: reporte.fotos.map((foto) => foto.actividad)
		})),
		{ fotosPorHoja, nombresReservados: [HOJA_MAESTRA] }
	);

	// Fotos de todo el libro, en el orden de las hojas.
	const enOrden = hojas.flatMap((hoja) =>
		hoja.fotos.map((f) => libro.reportes[hoja.reporte].fotos[f])
	);
	const preparadas = await prepararFotos(
		enOrden,
		limiteBytes - plantillaUsada.length - RESERVA_BYTES,
		paralelo
	);

	const salida = new JSZip();
	for (const parte of ['_rels/.rels', 'docProps/core.xml', 'docProps/app.xml']) {
		salida.file(parte, await leer(parte));
	}
	salida.file('xl/styles.xml', await leer('xl/styles.xml'));
	salida.file('xl/theme/theme1.xml', await leer('xl/theme/theme1.xml'));
	for (const relacion of relacionesPlantilla) {
		const parte = `xl/${relacion.destino.replace(/^\.\.\//, '')}`;
		const archivo = origen.file(parte);
		if (!archivo) throw new Error(`La plantilla no tiene la parte ${parte}`);
		salida.file(parte, await archivo.async('nodebuffer'), { compression: 'STORE' });
	}

	const { estimacion, contrato, firmas } = libro;
	const fechaEntrega = serieExcel(estimacion.fechaEntrega);
	const textoPeriodo = periodoEstimado(estimacion.periodo);
	const numeroEstimacion = limpiarTexto(estimacion.numero);
	const texto = (valor: unknown) => ({ tipo: 'texto' as const, valor: limpiarTexto(valor) });

	let maestra = await leer(PARTE_MAESTRA);
	maestra = ponerCelda(maestra, MAESTRA.fechaEntrega, { tipo: 'numero', valor: fechaEntrega });
	maestra = ponerCelda(maestra, MAESTRA.periodoEstimado, texto(textoPeriodo));
	maestra = ponerCelda(maestra, MAESTRA.estimacion, texto(numeroEstimacion));
	salida.file(PARTE_MAESTRA, maestra);

	// Logotipo del cliente: una sola imagen para todas las hojas.
	let logoCliente: { relacion: Relacion; tamano: Tamano } | null = null;
	if (libro.logoCliente?.length) {
		const { data, info } = await sharp(libro.logoCliente, { failOn: 'error' })
			.rotate()
			.resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
			.png()
			.toBuffer({ resolveWithObject: true });
		salida.file('xl/media/logo_cliente.png', data, { compression: 'STORE' });
		const escala = Math.min(
			LOGO_CLIENTE.caja.ancho / info.width,
			LOGO_CLIENTE.caja.alto / info.height
		);
		logoCliente = {
			relacion: {
				id: `rId${relacionesPlantilla.length + 1}`,
				tipo: 'image',
				destino: '../media/logo_cliente.png'
			},
			tamano: { ancho: Math.round(info.width * escala), alto: Math.round(info.height * escala) }
		};
	}

	const combinadasModelo = combinadasDe(modelo);
	const referenciaMaestra = (celda: string) => `${nombreHojaEnFormula(HOJA_MAESTRA)}!${celda}`;
	let fotoGlobal = 0;
	hojas.forEach((hoja, i) => {
		const reporte = libro.reportes[hoja.reporte];
		const partida = String(reporte.numeroPartida).trim();
		let xml = modelo;
		const poner = (celda: string, contenido: Parameters<typeof ponerCelda>[2]) => {
			xml = ponerCelda(xml, celda, contenido);
		};
		if (i === 0) xml = xml.replace('<sheetView ', '<sheetView tabSelected="1" ');
		poner(CELDAS.cliente, texto(contrato.cliente));
		poner(CELDAS.contrato, texto(contrato.numero));
		poner(CELDAS.ordenCompra, texto(contrato.ordenCompra));
		poner(CELDAS.descripcionServicio, texto(contrato.descripcion));
		poner(CELDAS.periodoContrato, texto(periodoContrato(contrato.vigencia)));
		poner(
			CELDAS.importe,
			contrato.importe === null ? null : { tipo: 'numero', valor: contrato.importe }
		);
		poner(CELDAS.contratista, texto(contrato.contratista));
		poner(CELDAS.fechaEntrega, {
			tipo: 'formula',
			formula: referenciaMaestra(MAESTRA.fechaEntrega),
			resultado: fechaEntrega
		});
		poner(CELDAS.periodoEstimado, {
			tipo: 'formula',
			formula: referenciaMaestra(MAESTRA.periodoEstimado),
			resultado: textoPeriodo
		});
		poner(CELDAS.estimacion, {
			tipo: 'formula',
			formula: referenciaMaestra(MAESTRA.estimacion),
			resultado: numeroEstimacion
		});
		poner(CELDAS.pagina, texto(textoPagina(hoja.pagina, hoja.total)));
		poner(
			CELDAS.partida,
			/^\d{1,9}$/.test(partida) ? { tipo: 'numero', valor: Number(partida) } : texto(partida)
		);
		poner(
			CELDAS.descripcion,
			texto(
				descripcionPartida({
					actividad: limpiarTexto(reporte.actividad),
					sitio: limpiarTexto(reporte.sitio),
					dias: reporte.dias
				})
			)
		);
		for (const firma of ['contratista', 'autoriza'] as const) {
			poner(FIRMAS[firma].nombre, texto(firmas[firma].nombre));
			poner(FIRMAS[firma].cargo, texto(firmas[firma].cargo));
			poner(FIRMAS[firma].empresa, texto(firmas[firma].empresa));
		}
		const actividades = escribirActividades(xml, rejilla, hoja.actividades);
		xml = ponerCombinadas(actividades.xml, [...combinadasModelo, ...actividades.combinadas]);

		// Dibujo: logotipos, fotos y, encima de cada foto, el círculo con el número de su actividad.
		const relaciones: Relacion[] = [...relacionesPlantilla];
		const anclas = [...anclasPlantilla];
		let forma = 100;
		if (logoCliente) {
			relaciones.push(logoCliente.relacion);
			anclas.push(
				xmlImagen(
					forma++,
					'Logotipo del cliente',
					'Logotipo del cliente',
					logoCliente.relacion.id,
					LOGO_CLIENTE.ancla,
					logoCliente.tamano
				)
			);
		}
		const fotosHoja = hoja.fotos.map((f) => reporte.fotos[f]);
		const imagenes = fotosHoja.map(() => preparadas[fotoGlobal++]);
		const colocadas = colocarFotos(rejilla, imagenes);
		const circulos: string[] = [];
		colocadas.forEach((colocada, f) => {
			const numeroMedio = fotoGlobal - fotosHoja.length + f + 1;
			const relacion: Relacion = {
				id: `rId${relaciones.length + 1}`,
				tipo: 'image',
				destino: `../media/foto${numeroMedio}.jpg`
			};
			relaciones.push(relacion);
			salida.file(`xl/media/foto${numeroMedio}.jpg`, imagenes[f].datos, { compression: 'STORE' });
			const descripcion = limpiarTexto(fotosHoja[f].descripcion) || `Foto ${f + 1}`;
			anclas.push(
				xmlImagen(
					forma++,
					`Foto ${f + 1}`,
					descripcion,
					relacion.id,
					anclaEn(rejilla, colocada.x, colocada.y),
					colocada.tamano
				)
			);
			const actividad = fotosHoja[f].actividad ?? 0;
			// Solo si la foto ilustra una actividad de la lista.
			if (reporte.actividades[actividad - 1]?.trim()) {
				circulos.push(
					xmlCirculo(
						forma++,
						`Actividad de la foto ${f + 1}`,
						String(actividad),
						// En la esquina inferior derecha de la foto, asomando un poco, como en el formato.
						anclaEn(
							rejilla,
							colocada.x + colocada.tamano.ancho - DIAMETRO_CIRCULO * 0.82,
							colocada.y + colocada.tamano.alto - DIAMETRO_CIRCULO * 0.78
						),
						DIAMETRO_CIRCULO
					)
				);
			}
		});
		const numero = i + 1;
		salida.file(`xl/worksheets/sheet${numero + 1}.xml`, xml);
		salida.file(
			`xl/worksheets/_rels/sheet${numero + 1}.xml.rels`,
			xmlRelaciones([{ id: 'rId1', tipo: 'drawing', destino: `../drawings/drawing${numero}.xml` }])
		);
		salida.file(`xl/drawings/drawing${numero}.xml`, xmlDibujo([...anclas, ...circulos]));
		salida.file(`xl/drawings/_rels/drawing${numero}.xml.rels`, xmlRelaciones(relaciones));
	});

	const totalHojas = hojas.length + 1;
	salida.file(
		'xl/workbook.xml',
		xmlLibro(
			[
				{ nombre: HOJA_MAESTRA },
				...hojas.map((h) => ({ nombre: h.nombre, areaImpresion: AREA_IMPRESION }))
			],
			1
		)
	);
	salida.file('xl/_rels/workbook.xml.rels', xmlRelaciones(relacionesLibro(totalHojas)));
	salida.file(
		'[Content_Types].xml',
		xmlTiposContenido(
			totalHojas,
			hojas.map((_, i) => i + 1)
		)
	);

	const xlsx = await salida.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
	if (xlsx.length > limiteBytes) {
		throw new Error(
			`El libro generado pesa ${(xlsx.length / 1048576).toFixed(1)} MB y excede el límite de ${(limiteBytes / 1048576).toFixed(0)} MB`
		);
	}
	return {
		xlsx,
		nombreArchivo: nombreArchivoFotografico({
			contrato: limpiarTexto(contrato.numero),
			estimacion: numeroEstimacion
		}),
		tipo: TIPO_FOTOGRAFICO,
		mime: formatoDeDocumento(TIPO_FOTOGRAFICO).mime,
		versionPlantilla: VERSION_PLANTILLA_FOTOGRAFICO,
		bytes: xlsx.length,
		fotos: preparadas.length,
		hojas: hojas.map((h) => ({
			nombre: h.nombre,
			pagina: h.pagina,
			reporte: h.reporte,
			fotos: h.fotos.length
		}))
	};
}
