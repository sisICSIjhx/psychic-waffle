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
	esquemaPartidaResumen,
	esquemaSitio,
	type Cliente,
	type Contrato,
	type Equipo,
	type Firmante,
	type FirmantesVigentes,
	type Partida,
	type PartidaEntrada,
	type PartidaResumen,
	type Sitio
} from '../../dominio/esquemas.ts';
import type { ClienteSql } from '../bd/cliente.ts';

export type ClienteEntrada = Omit<Cliente, 'id'> & { id?: string };
export type ContratoEntrada = Omit<Contrato, 'id' | 'cliente' | 'vigente'> & { id?: string };
export type SitioEntrada = Omit<Sitio, 'id'> & { id?: string };
export type EquipoEntrada = Omit<
	Equipo,
	'id' | 'tipo' | 'marca' | 'modelo' | 'rango' | 'numeroSerie'
> &
	Partial<Pick<Equipo, 'id' | 'tipo' | 'marca' | 'modelo' | 'rango' | 'numeroSerie'>>;
export type FirmanteEntrada = Omit<Firmante, 'id' | 'vigenteHasta'> &
	Partial<Pick<Firmante, 'id' | 'vigenteHasta'>>;

export class RepositorioCatalogo {
	constructor(private readonly sql: ClienteSql) {}

	async guardarCliente(cliente: ClienteEntrada): Promise<Cliente> {
		return esquemaCliente.parse(await this.sql.llamar('api_guardar_cliente', cliente));
	}

	async listarClientes(): Promise<Cliente[]> {
		return z.array(esquemaCliente).parse(await this.sql.llamar('api_listar_clientes'));
	}

	async guardarContrato(contrato: ContratoEntrada): Promise<Contrato> {
		return esquemaContrato.parse(await this.sql.llamar('api_guardar_contrato', contrato));
	}

	/** Contratos de un cliente; con `vigentesEn`, solo los vigentes en esa fecha. */
	async listarContratos(
		filtro: { clienteClave?: string; vigentesEn?: string } = {}
	): Promise<Contrato[]> {
		return z.array(esquemaContrato).parse(await this.sql.llamar('api_listar_contratos', filtro));
	}

	async guardarSitio(sitio: SitioEntrada): Promise<Sitio> {
		return esquemaSitio.parse(await this.sql.llamar('api_guardar_sitio', sitio));
	}

	async asociarSitio(contratoId: string, sitioId: string): Promise<void> {
		await this.sql.llamar('api_asociar_sitio', { contratoId, sitioId });
	}

	async listarSitios(contratoId?: string): Promise<Sitio[]> {
		return z.array(esquemaSitio).parse(await this.sql.llamar('api_listar_sitios', { contratoId }));
	}

	async guardarPartida(partida: PartidaEntrada): Promise<Partida> {
		const entrada = esquemaPartidaEntrada.parse(partida);
		return esquemaPartida.parse(await this.sql.llamar('api_guardar_partida', entrada));
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

	async guardarFirmante(firmante: FirmanteEntrada): Promise<Firmante> {
		return esquemaFirmante.parse(await this.sql.llamar('api_guardar_firmante', firmante));
	}

	async listarFirmantes(contratoId: string): Promise<Firmante[]> {
		return z
			.array(esquemaFirmante)
			.parse(await this.sql.llamar('api_listar_firmantes', { contratoId }));
	}

	/** Firmante vigente de cada función en la fecha indicada (hoy por omisión). */
	async firmantesVigentes(contratoId: string, fecha?: string): Promise<FirmantesVigentes> {
		return esquemaFirmantesVigentes.parse(
			await this.sql.llamar('api_firmantes_vigentes', { contratoId, fecha })
		);
	}
}
