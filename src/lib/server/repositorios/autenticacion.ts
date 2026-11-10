// Repositorio de cuentas y sesiones (0022). Las contraseñas llegan ya resumidas y los
// identificadores de sesión, como su SHA-256.
import { z } from 'zod';
import {
	esquemaContextoAcceso,
	esquemaCredencial,
	esquemaPersonal,
	esquemaUsuarioSesion,
	type ContextoAcceso,
	type Credencial,
	type Personal,
	type UsuarioSesion
} from '../../dominio/esquemas.ts';
import type { ClienteSql } from '../bd/cliente.ts';

const esquemaAccesoFallido = z.object({
	intentosFallidos: z.number().int(),
	bloqueadaHasta: z.string().nullable()
});

export class RepositorioAutenticacion {
	private readonly sql: ClienteSql;

	constructor(sql: ClienteSql) {
		this.sql = sql;
	}

	/** Si el inicio de sesión está activado y el usuario de la sesión, o null si no vale. */
	async contexto(tokenHash: string | null, inactividadMinutos: number): Promise<ContextoAcceso> {
		return esquemaContextoAcceso.parse(
			await this.sql.llamar('api_contexto_acceso', { tokenHash, inactividadMinutos })
		);
	}

	/** Datos para comprobar la contraseña de un correo; null si no tiene cuenta. */
	async credencialDeCorreo(correo: string): Promise<Credencial | null> {
		return esquemaCredencial
			.nullable()
			.parse((await this.sql.llamar('api_credencial_de_correo', { correo })) ?? null);
	}

	async registrarAccesoFallido(
		personalId: string,
		maxIntentos: number,
		minutosBloqueo: number
	): Promise<{ intentosFallidos: number; bloqueadaHasta: string | null }> {
		return esquemaAccesoFallido.parse(
			await this.sql.llamar('api_registrar_acceso_fallido', {
				personalId,
				maxIntentos,
				minutosBloqueo
			})
		);
	}

	async abrirSesion(sesion: {
		personalId: string;
		tokenHash: string;
		duracionMinutos: number;
		agente?: string | null;
	}): Promise<UsuarioSesion> {
		return esquemaUsuarioSesion.parse(await this.sql.llamar('api_abrir_sesion', sesion));
	}

	async cerrarSesion(tokenHash: string): Promise<boolean> {
		return z
			.object({ cerrada: z.boolean() })
			.parse(await this.sql.llamar('api_cerrar_sesion', { tokenHash })).cerrada;
	}

	/**
	 * Crea o sustituye la contraseña y cierra las demás sesiones de la persona (se conserva la de
	 * `conservarTokenHash`). La primera cuenta del sistema debe ser de un administrador.
	 */
	async establecerContrasena(cuenta: {
		personalId: string;
		hash: string;
		debeCambiar: boolean;
		conservarTokenHash?: string | null;
	}): Promise<Personal> {
		return esquemaPersonal.parse(await this.sql.llamar('api_establecer_contrasena', cuenta));
	}

	async quitarAcceso(personalId: string): Promise<Personal> {
		return esquemaPersonal.parse(await this.sql.llamar('api_quitar_acceso', { personalId }));
	}
}
