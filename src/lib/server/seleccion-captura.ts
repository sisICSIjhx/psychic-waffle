// Datos de la captura que dependen del programa y de los reportes: mes de referencia, trabajo
// pendiente de cada partida del sitio, mes sugerido y reportes vigentes de la partida elegida.
import { programaVigente } from '../dominio/planeacion.ts';
import {
	mesSugerido,
	trabajoDePartidas,
	type ReporteDePartida,
	type TrabajoDePartida
} from '../dominio/seleccion.ts';
import type { Repositorios } from './repositorios/index.ts';

export interface SeleccionCaptura {
	contratoId: string | null;
	sitioId: string | null;
	partidas: readonly { id: string }[];
	partidaId: string | null;
	/** Meses de la vigencia del contrato («AAAA-MM-01»). */
	meses: readonly string[];
	/** `?mes=` de la dirección, si llegó. */
	mesPedido: string;
	hoy: string;
}

export async function datosDeSeleccion(
	repos: Repositorios,
	{ contratoId, sitioId, partidas, partidaId, meses, mesPedido, hoy }: SeleccionCaptura
): Promise<{
	mesReferencia: string;
	mesSugerido: string | null;
	trabajo: Record<string, TrabajoDePartida>;
	reportesPartida: ReporteDePartida[];
}> {
	// El mes pedido es también el de referencia para agrupar; sin él, el mes en curso.
	const mesReferencia = meses.includes(mesPedido) ? mesPedido : `${hoy.slice(0, 7)}-01`;

	// Trabajo de cada partida según el programa vigente del sitio, con todos los borradores del sitio
	// desde el inicio del programa (ninguno se pierde por un límite).
	let trabajo: Record<string, TrabajoDePartida> = {};
	if (contratoId && sitioId) {
		const programa = programaVigente(
			await repos.programa.listarProgramas({ contratoId, sitioId }),
			hoy
		);
		const avance = programa ? await repos.programa.obtenerAvance(programa.id) : null;
		const borradores = programa
			? await repos.reportes.listarTodos({
					estado: 'borrador',
					sitioId,
					desde: programa.periodoInicio,
					hasta: mesReferencia
				})
			: [];
		trabajo = Object.fromEntries(
			trabajoDePartidas(partidas, avance, borradores, mesReferencia, hoy)
		);
	}

	// Reportes vigentes de la partida (sin sustituidos), para avisar si ya existe uno del periodo.
	const reportesPartida = partidaId
		? (await repos.reportes.listarTodos({ partidaId }))
				.filter((r) => r.estado !== 'sustituido')
				.map(({ id, titulo, estado, periodoMes, ocurrencia, tags }) => ({
					id,
					titulo,
					estado,
					periodoMes,
					ocurrencia,
					tags
				}))
		: [];

	return {
		mesReferencia,
		// El mes pedido manda; si no hay, el vencido más antiguo de la partida o el mes en curso.
		mesSugerido: meses.includes(mesPedido)
			? mesPedido
			: mesSugerido(partidaId ? trabajo[partidaId] : undefined, meses, hoy),
		trabajo,
		reportesPartida
	};
}
