// Repositorio del catálogo de equipos por proyecto (cliente): lista, ficha, eliminación e
// importación del Excel. La tabla es la misma `equipos` que da el TAG de partidas y reportes.
import { z } from 'zod';
import {
	esquemaEquipoCatalogo,
	esquemaEquipoCatalogoEntrada,
	esquemaEquipoImportado,
	esquemaResultadoImportacionEquipos,
	esquemaSitio,
	type EquipoCatalogo,
	type EquipoCatalogoEntrada,
	type EquipoImportado,
	type ResultadoImportacionEquipos,
	type Sitio
} from '../../dominio/esquemas.ts';
import type { ClienteSql } from '../bd/cliente.ts';

export class RepositorioEquipos {
	private readonly sql: ClienteSql;

	constructor(sql: ClienteSql) {
		this.sql = sql;
	}

	async listarDeProyecto(clienteId: string): Promise<EquipoCatalogo[]> {
		return z
			.array(esquemaEquipoCatalogo)
			.parse(await this.sql.llamar('api_listar_equipos_proyecto', { clienteId }));
	}

	async sitiosDeProyecto(clienteId: string): Promise<Sitio[]> {
		return z
			.array(esquemaSitio)
			.parse(await this.sql.llamar('api_listar_sitios_proyecto', { clienteId }));
	}

	async obtener(id: string): Promise<EquipoCatalogo> {
		return esquemaEquipoCatalogo.parse(await this.sql.llamar('api_obtener_equipo', { id }));
	}

	async guardar(equipo: EquipoCatalogoEntrada): Promise<EquipoCatalogo> {
		const entrada = esquemaEquipoCatalogoEntrada.parse(equipo);
		const { id } = z
			.object({ id: z.uuid() })
			.parse(await this.sql.llamar('api_guardar_equipo', entrada));
		return this.obtener(id);
	}

	async eliminar(id: string): Promise<void> {
		await this.sql.llamar('api_eliminar_equipo', { id });
	}

	/** Con `ensayo` solo cuenta nuevos y actualizados; sin él aplica todo en una sola llamada. */
	async importar(
		sitioId: string,
		equipos: EquipoImportado[],
		ensayo: boolean
	): Promise<ResultadoImportacionEquipos> {
		const filas = z.array(esquemaEquipoImportado).parse(equipos);
		return esquemaResultadoImportacionEquipos.parse(
			await this.sql.llamar('api_importar_equipos', { sitioId, equipos: filas, ensayo })
		);
	}
}
