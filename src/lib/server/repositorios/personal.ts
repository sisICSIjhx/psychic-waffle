// Repositorio del personal: alta, edición y baja lógica con rol y proyectos (clientes).
import { z } from 'zod';
import {
	esquemaPersonal,
	esquemaPersonalEntrada,
	type Personal,
	type PersonalEntrada
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
}
