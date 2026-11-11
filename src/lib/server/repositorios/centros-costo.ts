// Repositorio de centros de costo, plantillas de seguimiento y datos de alcance (cambio
// centros-costo-plantillas).
import { z } from 'zod';
import {
	esquemaCargaCentrosCosto,
	esquemaCentroCosto,
	esquemaCentroCostoEntrada,
	esquemaContratoCentros,
	esquemaPlantillaSeguimiento,
	esquemaPlantillaSeguimientoEntrada,
	esquemaResultadoCargaCentros,
	type CargaCentrosCosto,
	type CentroCosto,
	type CentroCostoEntrada,
	type ContratoCentros,
	type PlantillaSeguimiento,
	type PlantillaSeguimientoEntrada,
	type ResultadoCargaCentros
} from '../../dominio/esquemas.ts';
import type { ClienteSql } from '../bd/cliente.ts';

/** Recursos cuyo centro de costo se comprueba antes de atender una petición que los nombra. */
export type TipoRecurso = 'reporte' | 'partida' | 'contrato' | 'equipo' | 'programa' | 'ajuste';

export class RepositorioCentrosCosto {
	private readonly sql: ClienteSql;

	constructor(sql: ClienteSql) {
		this.sql = sql;
	}

	/** Centros de costo con contrato, plantilla y personas; `sitioIds` limita al alcance. */
	async listar(sitioIds?: string[] | null): Promise<CentroCosto[]> {
		return z
			.array(esquemaCentroCosto)
			.parse(await this.sql.llamar('api_listar_centros_costo', sitioIds ? { sitioIds } : {}));
	}

	async guardar(centro: CentroCostoEntrada): Promise<CentroCosto> {
		const entrada = esquemaCentroCostoEntrada.parse(centro);
		return esquemaCentroCosto.parse(await this.sql.llamar('api_guardar_centro_costo', entrada));
	}

	async listarPlantillas(): Promise<PlantillaSeguimiento[]> {
		return z
			.array(esquemaPlantillaSeguimiento)
			.parse(await this.sql.llamar('api_listar_plantillas_seguimiento'));
	}

	async obtenerPlantilla(id: string): Promise<PlantillaSeguimiento> {
		return esquemaPlantillaSeguimiento.parse(
			await this.sql.llamar('api_obtener_plantilla_seguimiento', { id })
		);
	}

	async guardarPlantilla(plantilla: PlantillaSeguimientoEntrada): Promise<PlantillaSeguimiento> {
		const entrada = esquemaPlantillaSeguimientoEntrada.parse(plantilla);
		return esquemaPlantillaSeguimiento.parse(
			await this.sql.llamar('api_guardar_plantilla_seguimiento', entrada)
		);
	}

	async duplicarPlantilla(id: string, nombre: string): Promise<PlantillaSeguimiento> {
		return esquemaPlantillaSeguimiento.parse(
			await this.sql.llamar('api_duplicar_plantilla_seguimiento', { id, nombre })
		);
	}

	async eliminarPlantilla(id: string): Promise<void> {
		await this.sql.llamar('api_eliminar_plantilla_seguimiento', { id });
	}

	/**
	 * Carga en bloque de plantillas y centros de costo (D9). Con `ensayo` (por omisión) solo informa;
	 * sin él guarda todo, o nada si alguna fila no es válida.
	 */
	async importar(carga: CargaCentrosCosto, ensayo = true): Promise<ResultadoCargaCentros> {
		const entrada = esquemaCargaCentrosCosto.parse(carga);
		return esquemaResultadoCargaCentros.parse(
			await this.sql.llamar('api_importar_centros_costo', { ...entrada, ensayo })
		);
	}

	/** Cada contrato con su cliente y sus centros de costo. */
	async contratosCentros(): Promise<ContratoCentros[]> {
		return z.array(esquemaContratoCentros).parse(await this.sql.llamar('api_contratos_centros'));
	}

	/** Centros de costo de un recurso; vacío si no existe. */
	async centrosDeRecurso(tipo: TipoRecurso, id: string): Promise<string[]> {
		return z.array(z.uuid()).parse(await this.sql.llamar('api_centros_de_recurso', { tipo, id }));
	}
}
