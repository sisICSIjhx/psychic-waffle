// Casos de uso de la captura de reportes: alta prellenada desde el catálogo, guardado, carga de
// fotos, cambios de estado con validaciones, aplicación explícita del catálogo y generación del DOCX.
// Las rutas /captura y /reportes/[id] solo traducen formularios y respuestas.
import { randomUUID } from 'node:crypto';
import {
	aplicarCatalogo,
	huellaCatalogo,
	mesesDeVigencia,
	periodoDeReporte,
	prellenarReporte,
	validarParaRevision,
	type Observacion
} from '../dominio/captura.ts';
import type { Ocurrencia } from '../dominio/documento.ts';
import type {
	DocumentoGenerado,
	EstadoContratoReporte,
	Foto,
	MOMENTOS_FOTO,
	Partida,
	Reporte,
	ReporteGuardado
} from '../dominio/esquemas.ts';
import type { Almacenamiento } from './almacenamiento.ts';
import { ErrorDatos } from './bd/cliente.ts';
import {
	generarDocx,
	VERSION_PLANTILLA,
	type FirmanteDocumento,
	type ReporteDocumento
} from './documentos/generar.ts';
import { prepararImagen } from './documentos/imagenes.ts';
import { ErrorFoto, procesarFoto } from './fotos.ts';
import type { RutasFoto } from './repositorios/reportes.ts';
import type { Repositorios } from './repositorios/index.ts';

/** El reporte no cumple las validaciones para la acción pedida; lleva las observaciones. */
export class ErrorValidacion extends Error {
	readonly observaciones: Observacion[];

	constructor(observaciones: Observacion[]) {
		super(observaciones.map((o) => o.mensaje).join(' '));
		this.name = 'ErrorValidacion';
		this.observaciones = observaciones;
	}
}

export interface ArchivoCargado {
	nombre: string;
	datos: Uint8Array;
}

export interface ResultadoCargaFotos {
	fotos: Foto[];
	rechazadas: { nombre: string; motivo: string }[];
	version: number;
}

export interface DocumentoDescargable {
	datos: Buffer;
	nombreArchivo: string;
	documento: DocumentoGenerado;
}

type MomentoFoto = (typeof MOMENTOS_FOTO)[number];

const SIN_FIRMA: FirmanteDocumento = { nombre: '', cargo: '', empresa: '' };

/** Miniatura del editor: 480 px de lado mayor (≈20 KB frente a ≈180 KB de la optimizada). */
const MINIATURA = { ladoMayor: 480, calidad: 70 };

/** «fotos/<reporte>/<uuid>.jpg» → «fotos/<reporte>/<uuid>-mini.jpg»; la ruta se deriva, no se guarda. */
export function rutaMiniatura(rutaOptimizada: string): string {
	return `${rutaOptimizada.replace(/\.jpe?g$/i, '')}-mini.jpg`;
}

export class ServicioCaptura {
	private readonly repos: Repositorios;
	private readonly archivos: Almacenamiento;
	private readonly plantilla: () => Promise<Uint8Array | undefined>;

	/** `plantilla` entrega la plantilla DOCX vigente; sin ella el generador usa la del repositorio. */
	constructor(
		repos: Repositorios,
		archivos: Almacenamiento,
		plantilla: () => Promise<Uint8Array | undefined> = async () => undefined
	) {
		this.repos = repos;
		this.archivos = archivos;
		this.plantilla = plantilla;
	}

	async crearReporte(entrada: {
		partidaId: string;
		periodoMes: string;
		ocurrencia: Ocurrencia | null;
		equipoIds: string[];
		/** Reprogramación que se reporta en este mes; la base valida partida y mes destino. */
		reprogramacionId?: string | null;
	}): Promise<Reporte> {
		const partida = await this.repos.catalogo.obtenerPartida(entrada.partidaId);
		const contrato = (await this.repos.catalogo.listarContratos()).find(
			(c) => c.id === partida.contratoId
		);
		const sitio = (await this.repos.catalogo.listarSitios(partida.contratoId)).find(
			(s) => s.id === partida.sitioId
		);
		if (!contrato || !sitio) {
			throw new ErrorDatos('no_encontrado', 'El contrato o el sitio de la partida no existen');
		}
		if (
			!mesesDeVigencia(contrato.vigenciaInicio, contrato.vigenciaFin).includes(entrada.periodoMes)
		) {
			throw new ErrorValidacion([
				{ campo: 'periodoMes', mensaje: 'El mes elegido está fuera de la vigencia del contrato.' }
			]);
		}
		let nuevo;
		try {
			nuevo = prellenarReporte({
				partida,
				contrato,
				sitio,
				firmantes: await this.repos.catalogo.firmantesVigentes(contrato.id, entrada.periodoMes),
				periodoMes: entrada.periodoMes,
				ocurrencia: entrada.ocurrencia,
				equipoIds: entrada.equipoIds
			});
		} catch (error) {
			if (error instanceof RangeError) {
				throw new ErrorValidacion([{ campo: 'seleccion', mensaje: error.message }]);
			}
			throw error;
		}
		return this.repos.reportes.insertar({
			...nuevo,
			reprogramacionId: entrada.reprogramacionId ?? null
		});
	}

	obtener(id: string): Promise<Reporte> {
		return this.repos.reportes.obtener(id);
	}

	/** Partida del reporte y si su contenido cambió desde que se copió o aplicó al borrador. */
	async estadoCatalogo(reporte: Reporte): Promise<{ partida: Partida; cambiado: boolean }> {
		const partida = await this.repos.catalogo.obtenerPartida(reporte.partidaId);
		return {
			partida,
			cambiado: reporte.estado === 'borrador' && huellaCatalogo(partida) !== reporte.catalogoHuella
		};
	}

	async guardar(guardado: ReporteGuardado): Promise<Reporte> {
		const { reporte, fotosEliminadas } = await this.repos.reportes.guardar(guardado);
		await this.limpiar(fotosEliminadas);
		return reporte;
	}

	/** Datos del contrato (usuario, número, sitio, firmantes) que cambiaron desde que el reporte los recibió. */
	estadoContrato(reporte: Reporte): Promise<EstadoContratoReporte> {
		return this.repos.reportes.estadoContrato(reporte.id);
	}

	/** Lleva al borrador los datos vigentes del contrato; `version` es la que conoce quien lo pide. */
	actualizarContrato(id: string, version: number): Promise<Reporte> {
		return this.repos.reportes.actualizarContrato(id, version);
	}

	/** Aplica el contenido vigente de la partida; `version` es la que conoce quien lo pide. */
	async aplicarCatalogo(id: string, version: number): Promise<Reporte> {
		const reporte = await this.repos.reportes.obtener(id);
		const partida = await this.repos.catalogo.obtenerPartida(reporte.partidaId);
		const guardado = { ...aplicarCatalogo(reporte, partida), version };
		const resultado = await this.repos.reportes.aplicarCatalogo(guardado, huellaCatalogo(partida));
		await this.limpiar(resultado.fotosEliminadas);
		return resultado.reporte;
	}

	/**
	 * Carga las fotos al final del alcance, una por una. Los archivos no válidos se informan y no
	 * detienen a los demás; un conflicto de versión sí detiene la carga.
	 */
	async cargarFotos(entrada: {
		reporteId: string;
		alcanceId: string;
		version: number;
		momento: MomentoFoto | null;
		archivos: ArchivoCargado[];
	}): Promise<ResultadoCargaFotos> {
		const resultado: ResultadoCargaFotos = { fotos: [], rechazadas: [], version: entrada.version };
		for (const archivo of entrada.archivos) {
			let procesada;
			try {
				procesada = await procesarFoto(archivo.datos);
			} catch (error) {
				if (!(error instanceof ErrorFoto)) throw error;
				resultado.rechazadas.push({ nombre: archivo.nombre, motivo: error.message });
				continue;
			}
			const base = `fotos/${entrada.reporteId}/${randomUUID()}`;
			const rutas: RutasFoto = {
				rutaOriginal: `${base}-original.${procesada.extension}`,
				rutaOptimizada: `${base}.jpg`
			};
			await this.archivos.guardar(rutas.rutaOriginal, archivo.datos);
			await this.archivos.guardar(rutas.rutaOptimizada, procesada.optimizada.datos);
			// Sin miniatura la foto se registra igual: se genera la primera vez que se pide.
			await this.guardarMiniatura(rutas.rutaOptimizada, procesada.optimizada.datos).catch(
				() => undefined
			);
			try {
				const { foto, version } = await this.repos.reportes.agregarFoto({
					reporteId: entrada.reporteId,
					alcanceId: entrada.alcanceId,
					version: resultado.version,
					...rutas,
					ancho: procesada.optimizada.ancho,
					alto: procesada.optimizada.alto,
					bytes: archivo.datos.length,
					tipoMime: procesada.tipoMime,
					descripcion: '',
					momento: entrada.momento
				});
				resultado.fotos.push(foto);
				resultado.version = version;
			} catch (error) {
				await this.limpiar([rutas]);
				throw error;
			}
		}
		return resultado;
	}

	/** Lee la versión optimizada de una foto del reporte. */
	async leerFoto(reporte: Reporte, fotoId: string): Promise<{ datos: Buffer; foto: Foto } | null> {
		const foto = reporte.alcances.flatMap((a) => a.fotos).find((f) => f.id === fotoId);
		if (!foto) return null;
		return { datos: await this.archivos.leer(foto.rutaOptimizada), foto };
	}

	/** Lee la miniatura de una foto del reporte; si falta, la genera desde la optimizada y la guarda. */
	async leerMiniatura(reporte: Reporte, fotoId: string): Promise<Buffer | null> {
		const foto = reporte.alcances.flatMap((a) => a.fotos).find((f) => f.id === fotoId);
		if (!foto) return null;
		const existente = await this.archivos
			.leer(rutaMiniatura(foto.rutaOptimizada))
			.catch(() => null);
		if (existente) return existente;
		return this.guardarMiniatura(
			foto.rutaOptimizada,
			await this.archivos.leer(foto.rutaOptimizada)
		);
	}

	private async guardarMiniatura(rutaOptimizada: string, optimizada: Uint8Array): Promise<Buffer> {
		const { datos } = await prepararImagen(optimizada, MINIATURA);
		await this.archivos.guardar(rutaMiniatura(rutaOptimizada), datos);
		return datos;
	}

	async validar(reporte: Reporte): Promise<Observacion[]> {
		const partida = await this.repos.catalogo.obtenerPartida(reporte.partidaId);
		return validarParaRevision(reporte, { requiereTag: partida.equipos.length > 0 });
	}

	/** Enviar a revisión y emitir exigen todas las validaciones; regresar a borrador, no. */
	async cambiarEstado(
		id: string,
		version: number,
		estado: 'borrador' | 'en_revision' | 'emitido'
	): Promise<Reporte> {
		if (estado !== 'borrador') {
			const reporte = await this.repos.reportes.obtener(id);
			if (reporte.version !== version) {
				throw new ErrorDatos(
					'conflicto',
					'Otra persona modificó el reporte; hay una versión más reciente',
					'IC409',
					{ motivo: 'version', versionActual: reporte.version }
				);
			}
			const observaciones = await this.validar(reporte);
			if (observaciones.length) throw new ErrorValidacion(observaciones);
		}
		return this.repos.reportes.cambiarEstado(id, version, estado);
	}

	crearRevision(id: string): Promise<Reporte> {
		return this.repos.reportes.crearRevision(id);
	}

	/**
	 * DOCX de la versión vigente del reporte. Si ya se generó para esta versión y plantilla se
	 * reutiliza; si no, se genera, se guarda y se registra en documentos_generados.
	 */
	async generarDocumento(id: string): Promise<DocumentoDescargable> {
		// Si el reporte cambia mientras se genera (un autoguardado), se descarta y se genera de nuevo.
		for (let intento = 1; ; intento++) {
			const reporte = await this.repos.reportes.obtener(id);
			const previo = reporte.documentos.find(
				(d) => d.reporteVersion === reporte.version && d.versionPlantilla === VERSION_PLANTILLA
			);
			if (previo) {
				const datos = await this.archivos.leer(previo.ruta).catch(() => null);
				if (datos) return { datos, nombreArchivo: previo.nombreArchivo, documento: previo };
			}
			if (!reporte.diasEjecucion.length) {
				throw new ErrorValidacion([
					{
						campo: 'diasEjecucion',
						mensaje: 'Capture los días de ejecución para generar el documento.'
					}
				]);
			}
			const plantilla = await this.plantilla();
			const resultado = await generarDocx(await this.documentoDe(reporte), {
				plantilla
			});
			// Cada intento escribe en su propia ruta: dos descargas simultáneas no comparten archivo.
			const ruta = `documentos/${reporte.id}/v${reporte.version}-${randomUUID().slice(0, 8)}-${resultado.nombreArchivo}`;
			await this.archivos.guardar(ruta, resultado.docx);
			try {
				const documento = await this.repos.reportes.registrarDocumento({
					reporteId: reporte.id,
					reporteVersion: reporte.version,
					versionPlantilla: resultado.versionPlantilla,
					ruta,
					nombreArchivo: resultado.nombreArchivo,
					bytes: resultado.bytes
				});
				return { datos: resultado.docx, nombreArchivo: resultado.nombreArchivo, documento };
			} catch (error) {
				// Solo se borra si la base confirma que el archivo no quedó registrado (la respuesta
				// pudo perderse después de insertar).
				const registrado = await this.repos.reportes
					.obtener(reporte.id)
					.then((r) => r.documentos.some((d) => d.ruta === ruta))
					.catch(() => true);
				if (!registrado) await this.archivos.eliminar(ruta).catch(() => undefined);
				const cambio = error instanceof ErrorDatos && error.tipo === 'conflicto';
				if (!cambio || intento >= 3) throw error;
			}
		}
	}

	private async documentoDe(reporte: Reporte): Promise<ReporteDocumento> {
		const alcances = [];
		for (const alcance of reporte.alcances) {
			const fotos = [];
			for (const foto of alcance.fotos) {
				fotos.push({
					datos: await this.archivos.leer(foto.rutaOptimizada),
					descripcion: foto.descripcion,
					momento: foto.momento,
					optimizada: { ancho: foto.ancho, alto: foto.alto },
					rotacion: foto.rotacion
				});
			}
			alcances.push({
				titulo: alcance.titulo,
				descripcion: alcance.descripcion,
				fotos,
				estado: alcance.estadoVerificacion,
				observaciones: alcance.observaciones
			});
		}
		const { elaboro, aprobo, recibio } = reporte.firmantes;
		return {
			numeroPartida: reporte.numeroPartida,
			actividad: reporte.actividad,
			actividadCorta: reporte.nombreCorto,
			periodo: periodoDeReporte(reporte),
			tags: reporte.equipos.map((e) => e.tag),
			encabezado: {
				usuario: reporte.usuario,
				contrato: reporte.contratoTexto,
				sitio: reporte.sitioTexto,
				periodicidad: reporte.periodicidad,
				dias: reporte.diasEjecucion,
				tipoMantenimiento: reporte.tipoMantenimiento
			},
			firmantes: {
				elaboro: elaboro ?? SIN_FIRMA,
				aprobo: aprobo ?? SIN_FIRMA,
				recibio: recibio ?? SIN_FIRMA
			},
			objetivo: reporte.objetivo,
			introduccion: reporte.introduccion,
			disposicionFotos: reporte.disposicionFotos,
			alcances,
			herramientas: reporte.herramientas.map((h) => ({
				cantidad: h.cantidad,
				descripcion: h.descripcion
			})),
			incluyeVerificacion: reporte.incluyeVerificacion,
			conclusiones: reporte.conclusiones
		};
	}

	/** Borra del almacenamiento los archivos de fotos que ya no usa ningún reporte. */
	private async limpiar(rutas: RutasFoto[]): Promise<void> {
		for (const { rutaOriginal, rutaOptimizada } of rutas) {
			await this.archivos.eliminar(rutaOriginal).catch(() => undefined);
			await this.archivos.eliminar(rutaOptimizada).catch(() => undefined);
			await this.archivos.eliminar(rutaMiniatura(rutaOptimizada)).catch(() => undefined);
		}
	}
}
