// Repositorio del catálogo: clientes, contratos, sitios, partidas, equipos y firmantes.
import { z } from 'zod';
import {
	esquemaCliente,
	esquemaContrato,
	esquemaEquipo,
	esquemaFirmante,
	esquemaFirmantesVigentes,
	esquemaPartida,
	esquemaPartidaEntrada,
	esquemaPaginaCambios,
	esquemaPartidaResumen,
	esquemaResultadoEdicion,
	esquemaResumenSitio,
	esquemaSitio,
	type Cliente,
	type Contrato,
	type Equipo,
	type Firmante,
	type FirmantesVigentes,
	type PaginaCambios,
	type Partida,
	type PartidaEntrada,
	type PartidaResumen,
	type ResultadoEdicion,
	type ResumenSitio,
	type Sitio
} from '../../dominio/esquemas.ts';
import type { ClienteSql } from '../bd/cliente.ts';

export type ClienteEntrada = Omit<Cliente, 'id'> & { id?: string };
// Las entradas de contrato, sitio y firmante son solo para altas: las correcciones van por las
// funciones de edición, con motivo y bitácora.
export type ContratoEntrada = Omit<Contrato, 'id' | 'cliente' | 'vigente' | 'actualizadoEn'>;
export type SitioEntrada = Omit<Sitio, 'id' | 'actualizadoEn'>;
export type EquipoEntrada = Omit<
	Equipo,
	'id' | 'tipo' | 'marca' | 'modelo' | 'rango' | 'numeroSerie'
> &
	Partial<Pick<Equipo, 'id' | 'tipo' | 'marca' | 'modelo' | 'rango' | 'numeroSerie'>>;
export type FirmanteEntrada = Omit<Firmante, 'id' | 'vigenteHasta' | 'actualizadoEn'> &
	Partial<Pick<Firmante, 'vigenteHasta'>>;

/** Quién y desde dónde se hace un cambio; el usuario sale de la sesión, nunca del formulario. */
export interface ContextoBitacora {
	usuarioId?: string | null;
	usuarioTexto?: string | null;
	origen?: 'interfaz' | 'script';
}

/** Opciones de una edición: ensayo (sin aplicar), motivo y propagación a los borradores. */
export interface OpcionesEdicion extends ContextoBitacora {
	ensayo: boolean;
	motivo?: string;
	actualizarBorradores?: boolean;
}

export interface EdicionContrato {
	id: string;
	actualizadoEn: string;
	numero: string;
	descripcion: string | null;
	vigenciaInicio: string;
	vigenciaFin: string;
}

export interface EdicionSitio {
	id: string;
	contratoId: string;
	actualizadoEn: string;
	clave: string;
	nombre: string;
}

export interface CorreccionFirmante {
	id: string;
	contratoId: string;
	actualizadoEn: string;
	nombre: string;
	cargo: string;
	empresa: string;
	vigenteDesde: string;
	vigenteHasta: string | null;
}

export interface CambioFirmante {
	id: string;
	contratoId: string;
	actualizadoEn: string;
	desde: string;
	nombre: string;
	cargo: string;
	empresa: string;
}

export const esquemaResultadoImportacion = z.object({
	ensayo: z.boolean(),
	programa: z.object({
		accion: z.enum(['crear', 'actualizar', 'existente', 'ninguno']),
		id: z.uuid().nullable()
	}),
	resumen: z.object({
		crear: z.number().int(),
		actualizar: z.number().int(),
		sinCambios: z.number().int()
	}),
	partidas: z.array(
		z.object({
			numero: z.string(),
			actividad: z.string(),
			accion: z.enum(['crear', 'actualizar', 'sin_cambios']),
			alcances: z.number().int(),
			mesesProgramados: z.number().int(),
			cambiaPrograma: z.boolean(),
			estabaPorConfirmar: z.boolean()
		})
	)
});
export type ResultadoImportacion = z.infer<typeof esquemaResultadoImportacion>;

/** Partidas del catálogo de Excel ya analizadas (véase importacion/catalogo.ts). */
export interface CargaImportacion {
	contratoId: string;
	sitioId: string;
	programa: { periodoInicio: string; periodoFin: string; nombre?: string | null } | null;
	partidas: unknown[];
}

export class RepositorioCatalogo {
	private readonly sql: ClienteSql;

	constructor(sql: ClienteSql) {
		this.sql = sql;
	}

	async guardarCliente(cliente: ClienteEntrada): Promise<Cliente> {
		return esquemaCliente.parse(await this.sql.llamar('api_guardar_cliente', cliente));
	}

	async listarClientes(): Promise<Cliente[]> {
		return z.array(esquemaCliente).parse(await this.sql.llamar('api_listar_clientes'));
	}

	/** Alta de un contrato, registrada en la bitácora. */
	async guardarContrato(
		contrato: ContratoEntrada,
		contexto: ContextoBitacora = {}
	): Promise<Contrato> {
		return esquemaContrato.parse(
			await this.sql.llamar('api_guardar_contrato', { ...contrato, ...contexto })
		);
	}

	/** Contratos de un cliente; con `vigentesEn`, solo los vigentes en esa fecha. */
	async listarContratos(
		filtro: { clienteClave?: string; vigentesEn?: string } = {}
	): Promise<Contrato[]> {
		return z.array(esquemaContrato).parse(await this.sql.llamar('api_listar_contratos', filtro));
	}

	/** Alta de un sitio; `contratoId` indica en la bitácora desde qué contrato se dio de alta. */
	async guardarSitio(
		sitio: SitioEntrada,
		contexto: ContextoBitacora & { contratoId?: string } = {}
	): Promise<Sitio> {
		return esquemaSitio.parse(
			await this.sql.llamar('api_guardar_sitio', { ...sitio, ...contexto })
		);
	}

	async asociarSitio(
		contratoId: string,
		sitioId: string,
		contexto: ContextoBitacora = {}
	): Promise<void> {
		await this.sql.llamar('api_asociar_sitio', { contratoId, sitioId, ...contexto });
	}

	async listarSitios(contratoId?: string): Promise<Sitio[]> {
		return z.array(esquemaSitio).parse(await this.sql.llamar('api_listar_sitios', { contratoId }));
	}

	async guardarPartida(partida: PartidaEntrada): Promise<Partida> {
		const entrada = esquemaPartidaEntrada.parse(partida);
		return esquemaPartida.parse(await this.sql.llamar('api_guardar_partida_completa', entrada));
	}

	async obtenerPartida(id: string): Promise<Partida> {
		return esquemaPartida.parse(await this.sql.llamar('api_obtener_partida', { id }));
	}

	async listarPartidas(filtro: {
		contratoId?: string;
		sitioId?: string;
		estadoCatalogo?: 'confirmado' | 'por_confirmar';
	}): Promise<PartidaResumen[]> {
		return z
			.array(esquemaPartidaResumen)
			.parse(await this.sql.llamar('api_listar_partidas', filtro));
	}

	async confirmarPartida(id: string): Promise<Partida> {
		return esquemaPartida.parse(await this.sql.llamar('api_confirmar_partida', { id }));
	}

	async guardarEquipo(equipo: EquipoEntrada): Promise<Equipo> {
		return esquemaEquipo.parse(await this.sql.llamar('api_guardar_equipo', equipo));
	}

	async listarEquipos(sitioId: string): Promise<Equipo[]> {
		return z.array(esquemaEquipo).parse(await this.sql.llamar('api_listar_equipos', { sitioId }));
	}

	/** Alta de un firmante, registrada en la bitácora. */
	async guardarFirmante(
		firmante: FirmanteEntrada,
		contexto: ContextoBitacora = {}
	): Promise<Firmante> {
		return esquemaFirmante.parse(
			await this.sql.llamar('api_guardar_firmante', { ...firmante, ...contexto })
		);
	}

	// Ediciones con motivo y bitácora: con `ensayo` calculan el cambio y su impacto sin aplicarlo.
	async editarContrato(entrada: EdicionContrato, opciones: OpcionesEdicion) {
		const r = await this.sql.llamar<Record<string, unknown>>('api_editar_contrato', {
			...entrada,
			...opciones
		});
		return { ...esquemaResultadoEdicion.parse(r), contrato: esquemaContrato.parse(r.contrato) };
	}

	async editarSitio(entrada: EdicionSitio, opciones: OpcionesEdicion) {
		const r = await this.sql.llamar<Record<string, unknown>>('api_editar_sitio', {
			...entrada,
			...opciones
		});
		return { ...esquemaResultadoEdicion.parse(r), sitio: esquemaSitio.parse(r.sitio) };
	}

	async quitarSitio(
		entrada: { contratoId: string; sitioId: string },
		opciones: OpcionesEdicion
	): Promise<ResultadoEdicion> {
		return esquemaResultadoEdicion.parse(
			await this.sql.llamar('api_quitar_sitio', { ...entrada, ...opciones })
		);
	}

	async corregirFirmante(entrada: CorreccionFirmante, opciones: OpcionesEdicion) {
		const r = await this.sql.llamar<Record<string, unknown>>('api_corregir_firmante', {
			...entrada,
			...opciones
		});
		return { ...esquemaResultadoEdicion.parse(r), firmante: esquemaFirmante.parse(r.firmante) };
	}

	async cambiarFirmante(entrada: CambioFirmante, opciones: OpcionesEdicion) {
		const r = await this.sql.llamar<Record<string, unknown>>('api_cambiar_firmante', {
			...entrada,
			...opciones
		});
		return { ...esquemaResultadoEdicion.parse(r), firmante: esquemaFirmante.parse(r.firmante) };
	}

	/** Partidas, programas y reportes de cada sitio del contrato y los otros contratos del sitio. */
	async resumenSitios(contratoId: string): Promise<ResumenSitio[]> {
		return z
			.array(esquemaResumenSitio)
			.parse(await this.sql.llamar('api_resumen_sitios_contrato', { contratoId }));
	}

	/** Bitácora del contrato, de sus firmantes y de sus sitios, del más reciente al más antiguo. */
	async listarCambios(contratoId: string, pagina = 1, tamano = 20): Promise<PaginaCambios> {
		return esquemaPaginaCambios.parse(
			await this.sql.llamar('api_listar_cambios_catalogo', { contratoId, pagina, tamano })
		);
	}

	async listarFirmantes(contratoId: string): Promise<Firmante[]> {
		return z
			.array(esquemaFirmante)
			.parse(await this.sql.llamar('api_listar_firmantes', { contratoId }));
	}

	/**
	 * Importa el catálogo y el programa P/R. Con `ensayo` solo resume qué se crearía, actualizaría u
	 * omitiría; sin él aplica todo en una transacción (sin cambios parciales si algo falla).
	 */
	async importarCatalogo(carga: CargaImportacion, ensayo: boolean): Promise<ResultadoImportacion> {
		return esquemaResultadoImportacion.parse(
			await this.sql.llamar('api_importar_catalogo', { ...carga, ensayo })
		);
	}

	/** Firmante vigente de cada función en la fecha indicada (hoy por omisión). */
	async firmantesVigentes(contratoId: string, fecha?: string): Promise<FirmantesVigentes> {
		return esquemaFirmantesVigentes.parse(
			await this.sql.llamar('api_firmantes_vigentes', { contratoId, fecha })
		);
	}
}
