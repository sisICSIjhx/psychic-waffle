// Repositorio del personal: alta, edición y baja lógica con rol y centros de costo.
import { z } from 'zod';
import {
	esquemaPersonaImportada,
	esquemaPersonal,
	esquemaPersonalEntrada,
	esquemaResultadoImportacionPersonal,
	type PersonaImportada,
	type Personal,
	type PersonalEntrada,
	type ResultadoImportacionPersonal
} from '../../dominio/esquemas.ts';
import type { ClienteSql } from '../bd/cliente.ts';

export class RepositorioPersonal {
	private readonly sql: ClienteSql;

	constructor(sql: ClienteSql) {
		this.sql = sql;
	}

	async listar(): Promise<Personal[]> {
		return z.array(esquemaPersonal).parse(await this.sql.llamar('api_listar_personal'));
	}

	async obtener(id: string): Promise<Personal> {
		return esquemaPersonal.parse(await this.sql.llamar('api_obtener_personal', { id }));
	}

	async guardar(persona: PersonalEntrada): Promise<Personal> {
		const entrada = esquemaPersonalEntrada.parse(persona);
		return esquemaPersonal.parse(await this.sql.llamar('api_guardar_personal', entrada));
	}

	/**
	 * Carga en bloque: da de alta a quienes no están registrados por su correo, como reporteadores
	 * sin centros de costo ni cuenta. Con `ensayo` (por omisión) solo informa lo que haría.
	 */
	async importar(
		personas: PersonaImportada[],
		ensayo = true
	): Promise<ResultadoImportacionPersonal> {
		const entrada = z.array(esquemaPersonaImportada).parse(personas);
		return esquemaResultadoImportacionPersonal.parse(
			await this.sql.llamar('api_importar_personal', { personas: entrada, ensayo })
		);
	}
}
