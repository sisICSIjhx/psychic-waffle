// Repositorio del programa anual: periodos, cantidades programadas, realizados manuales y avance.
import { z } from 'zod';
import {
	esquemaAvancePrograma,
	esquemaPrograma,
	esquemaRealizadoManual,
	type AvancePrograma,
	type Programa,
	type RealizadoManual
} from '../../dominio/esquemas.ts';
import type { ClienteSql } from '../bd/cliente.ts';

export interface ProgramaEntrada {
	id?: string;
	contratoId: string;
	sitioId: string;
	nombre?: string | null;
	periodoInicio: string;
	periodoFin: string;
}

export interface MesProgramado {
	partidaId: string;
	/** Cualquier fecha del mes. */
	mes: string;
	/** null elimina la cantidad de ese mes. */
	cantidad: number | null;
}

export class RepositorioPrograma {
	private readonly sql: ClienteSql;

	constructor(sql: ClienteSql) {
		this.sql = sql;
	}

	async guardarPrograma(programa: ProgramaEntrada): Promise<Programa> {
		return esquemaPrograma.parse(await this.sql.llamar('api_guardar_programa', { ...programa }));
	}

	async listarProgramas(
		filtro: { contratoId?: string; sitioId?: string } = {}
	): Promise<Programa[]> {
		return z.array(esquemaPrograma).parse(await this.sql.llamar('api_listar_programas', filtro));
	}

	async guardarMeses(programaId: string, meses: MesProgramado[]): Promise<void> {
		await this.sql.llamar('api_guardar_meses_programa', { programaId, meses });
	}

	async registrarRealizadoManual(registro: {
		programaId: string;
		partidaId: string;
		mes: string;
		cantidad?: number;
		nota: string;
	}): Promise<RealizadoManual> {
		return esquemaRealizadoManual.parse(
			await this.sql.llamar('api_registrar_realizado_manual', registro)
		);
	}

	/** Programado y realizado por partida y mes, con totales y diferencia frente a la cantidad anual. */
	async obtenerAvance(programaId: string): Promise<AvancePrograma> {
		return esquemaAvancePrograma.parse(
			await this.sql.llamar('api_obtener_programa', { id: programaId })
		);
	}
}
