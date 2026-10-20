// Repositorio de reportes: alta prellenada, guardado con concurrencia optimista, fotos, estados,
// revisiones, historial y documentos generados.
import { z } from 'zod';
import {
	esquemaDocumentoGenerado,
	esquemaFiltroReportes,
	esquemaFoto,
	esquemaPaginaReportes,
	esquemaReporte,
	esquemaReporteGuardado,
	esquemaReporteNuevo,
	type DocumentoGenerado,
	type FiltroReportes,
	type Foto,
	type PaginaReportes,
	type Reporte,
	type ReporteGuardado,
	type ReporteNuevo
} from '../../dominio/esquemas.ts';
import type { ClienteSql } from '../bd/cliente.ts';

export interface FotoNueva {
	reporteId: string;
	alcanceId: string;
	/** Versión que conoce quien carga la foto; si no coincide hay conflicto. */
	version: number;
	rutaOriginal: string;
	rutaOptimizada: string;
	ancho: number;
	alto: number;
	bytes: number;
	tipoMime: string;
	descripcion?: string;
	momento?: 'antes' | 'durante' | 'despues' | null;
}

export interface RutasFoto {
	rutaOriginal: string;
	rutaOptimizada: string;
}

const esquemaResultadoGuardado = z.object({
	reporte: esquemaReporte,
	fotosEliminadas: z.array(z.object({ rutaOriginal: z.string(), rutaOptimizada: z.string() }))
});

export class RepositorioReportes {
	private readonly sql: ClienteSql;

	constructor(sql: ClienteSql) {
		this.sql = sql;
	}

	async insertar(reporte: ReporteNuevo): Promise<Reporte> {
		const entrada = esquemaReporteNuevo.parse(reporte);
		return esquemaReporte.parse(await this.sql.llamar('api_crear_reporte', entrada));
	}

	async obtener(id: string): Promise<Reporte> {
		return esquemaReporte.parse(await this.sql.llamar('api_obtener_reporte', { id }));
	}

	/**
	 * Guarda el estado completo de un borrador. Si `version` no es la vigente lanza un ErrorDatos de
	 * tipo «conflicto» sin modificar nada. Devuelve las rutas de las fotos que se quitaron.
	 */
	async guardar(
		reporte: ReporteGuardado
	): Promise<{ reporte: Reporte; fotosEliminadas: RutasFoto[] }> {
		const entrada = esquemaReporteGuardado.parse(reporte);
		return esquemaResultadoGuardado.parse(await this.sql.llamar('api_guardar_reporte', entrada));
	}

	/** Guarda el borrador con el contenido del catálogo aplicado y registra la huella nueva. */
	async aplicarCatalogo(
		reporte: ReporteGuardado,
		catalogoHuella: string
	): Promise<{ reporte: Reporte; fotosEliminadas: RutasFoto[] }> {
		const entrada = { ...esquemaReporteGuardado.parse(reporte), catalogoHuella };
		return esquemaResultadoGuardado.parse(await this.sql.llamar('api_aplicar_catalogo', entrada));
	}

	async agregarFoto(foto: FotoNueva): Promise<{ foto: Foto; version: number }> {
		return z
			.object({ foto: esquemaFoto, version: z.number().int().positive() })
			.parse(await this.sql.llamar('api_agregar_foto', { ...foto }));
	}

	async cambiarEstado(
		id: string,
		version: number,
		estado: 'borrador' | 'en_revision' | 'emitido'
	): Promise<Reporte> {
		return esquemaReporte.parse(
			await this.sql.llamar('api_cambiar_estado', { id, version, estado })
		);
	}

	/** Nueva revisión (borrador) de un reporte emitido; al emitirse sustituye a la anterior. */
	async crearRevision(id: string): Promise<Reporte> {
		return esquemaReporte.parse(await this.sql.llamar('api_crear_revision', { id }));
	}

	async listar(filtro: FiltroReportes = {}): Promise<PaginaReportes> {
		const entrada = esquemaFiltroReportes.parse(filtro);
		return esquemaPaginaReportes.parse(await this.sql.llamar('api_listar_reportes', entrada));
	}

	/**
	 * Registra el DOCX generado con la versión del reporte que se usó; si el reporte cambió mientras
	 * se generaba, lanza un ErrorDatos de tipo «conflicto».
	 */
	async registrarDocumento(documento: {
		reporteId: string;
		reporteVersion: number;
		versionPlantilla: string;
		ruta: string;
		nombreArchivo: string;
		bytes: number;
	}): Promise<DocumentoGenerado> {
		return esquemaDocumentoGenerado.parse(
			await this.sql.llamar('api_registrar_documento', documento)
		);
	}
}
