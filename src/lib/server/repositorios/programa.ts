// Repositorio del programa anual: periodos, cantidades programadas, realizados manuales y avance.
import { z } from 'zod';
import {
	esquemaAvancePrograma,
	esquemaPrograma,
	esquemaRealizadoManual,
	PERIODICIDADES,
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

/** Carga de un programa anual sin catálogo (`api_importar_programa`). */
export interface CargaPrograma {
	contratoId: string;
	sitioId: string;
	confirmar?: boolean;
	programa: { periodoInicio: string; periodoFin: string; nombre?: string | null };
	partidas: {
		numero: string;
		actividad: string;
		usarActividad?: boolean;
		periodicidad: string;
		cantidadAnual: number | null;
		meses: { mes: string; cantidad: number }[];
		realizados: { mes: string; cantidad: number }[];
	}[];
}

const cantidadMes = z.object({ mes: z.iso.date(), cantidad: z.coerce.number() });

export const esquemaResultadoPrograma = z.object({
	ensayo: z.boolean(),
	programa: z.object({
		accion: z.enum(['crear', 'actualizar', 'existente']),
		id: z.uuid().nullable(),
		periodoInicio: z.iso.date(),
		periodoFin: z.iso.date()
	}),
	resumen: z.object({ crear: z.number(), actualizar: z.number(), sinCambios: z.number() }),
	partidas: z.array(
		z.object({
			numero: z.string(),
			actividad: z.string(),
			accion: z.enum(['crear', 'actualizar', 'sin_cambios']),
			periodicidadAntes: z.enum(PERIODICIDADES).nullable(),
			periodicidad: z.enum(PERIODICIDADES),
			cantidadAntes: z.coerce.number().nullable(),
			cantidadAnual: z.coerce.number().nullable(),
			meses: z.array(cantidadMes),
			totalProgramado: z.coerce.number(),
			realizados: z.array(cantidadMes),
			cambiaPrograma: z.boolean(),
			estabaPorConfirmar: z.boolean(),
			quedaPorConfirmar: z.boolean(),
			tieneReportes: z.boolean()
		})
	),
	noIncluidas: z.array(z.object({ numero: z.string(), actividad: z.string() }))
});
export type ResultadoPrograma = z.infer<typeof esquemaResultadoPrograma>;

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

	/** Importa un programa anual sin catálogo; con `ensayo` solo calcula lo que cambiaría. */
	async importarPrograma(carga: CargaPrograma, ensayo: boolean): Promise<ResultadoPrograma> {
		return esquemaResultadoPrograma.parse(
			await this.sql.llamar('api_importar_programa', { ...carga, ensayo })
		);
	}

	/** Programado y realizado por partida y mes, con totales y diferencia frente a la cantidad anual. */
	async obtenerAvance(programaId: string): Promise<AvancePrograma> {
		return esquemaAvancePrograma.parse(
			await this.sql.llamar('api_obtener_programa', { id: programaId })
		);
	}
}
