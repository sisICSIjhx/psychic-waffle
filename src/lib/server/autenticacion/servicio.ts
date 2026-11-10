// Casos de uso del acceso (cambio inicio-sesion-roles): entrar, salir, cambiar la contraseña, generar
// una temporal, quitar el acceso y activar el inicio de sesión. Las contraseñas no se registran ni se
// devuelven, salvo la temporal recién generada, que se muestra una sola vez.
import type { Personal, UsuarioSesion } from '../../dominio/esquemas.ts';
import { ErrorDatos } from '../bd/cliente.ts';
import type { Repositorios } from '../repositorios/index.ts';
import { olvidarContextos } from './contexto.ts';
import {
	generarContrasenaTemporal,
	LARGO_MAXIMO,
	resumirContrasena,
	simularVerificacion,
	validarContrasena,
	verificarContrasena
} from './contrasenas.ts';
import {
	DURACION_SESION_MINUTOS,
	INACTIVIDAD_MINUTOS,
	nuevoToken,
	resumenDeToken
} from './sesiones.ts';

/** Contraseñas incorrectas seguidas que bloquean la cuenta, y por cuánto tiempo. */
export const MAX_INTENTOS = 5;
export const MINUTOS_BLOQUEO = 15;

// El mismo mensaje para correo desconocido, contraseña incorrecta, baja y persona sin cuenta.
export const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.';
export const MENSAJE_BLOQUEO = `La cuenta está bloqueada por intentos fallidos. Espere ${MINUTOS_BLOQUEO} minutos e intente de nuevo.`;
export const MENSAJE_LIMITE = 'Demasiados intentos. Espere unos minutos.';

/** Tope de intentos de entrada por dirección de red en una ventana de tiempo, en memoria. */
export class LimiteIntentos {
	private readonly maximo: number;
	private readonly ventanaMs: number;
	private readonly intentos = new Map<string, number[]>();

	constructor(maximo = 20, ventanaMs = 10 * 60_000) {
		this.maximo = maximo;
		this.ventanaMs = ventanaMs;
	}

	/** Registra un intento y dice si cabe en la ventana. */
	permitir(clave: string, ahora = Date.now()): boolean {
		const recientes = (this.intentos.get(clave) ?? []).filter((t) => t > ahora - this.ventanaMs);
		if (recientes.length >= this.maximo) {
			this.intentos.set(clave, recientes);
			return false;
		}
		recientes.push(ahora);
		// Sin crecer sin fin: al pasar del tope se descartan las direcciones sin intentos recientes.
		if (this.intentos.size > 5000) {
			for (const [otra, tiempos] of this.intentos) {
				if (tiempos.every((t) => t <= ahora - this.ventanaMs)) this.intentos.delete(otra);
			}
		}
		this.intentos.set(clave, recientes);
		return true;
	}
}

const limiteDelProceso = new LimiteIntentos();

export type ResultadoEntrada =
	| { ok: true; token: string; usuario: UsuarioSesion }
	| { ok: false; motivo: 'credenciales' | 'bloqueada' | 'limite'; mensaje: string };

const rechazo = (
	motivo: 'credenciales' | 'bloqueada' | 'limite',
	mensaje: string
): ResultadoEntrada => ({ ok: false, motivo, mensaje });

export async function iniciarSesion(
	repos: Repositorios,
	entrada: {
		correo: string;
		contrasena: string;
		agente?: string | null;
		direccion?: string | null;
	},
	limite: LimiteIntentos = limiteDelProceso
): Promise<ResultadoEntrada> {
	if (!limite.permitir(entrada.direccion?.trim() || 'desconocida')) {
		return rechazo('limite', MENSAJE_LIMITE);
	}
	const correo = entrada.correo.trim();
	// Una contraseña desmesurada no se resume: sería trabajo regalado a quien ataca.
	if (!correo || !entrada.contrasena || entrada.contrasena.length > LARGO_MAXIMO * 8) {
		return rechazo('credenciales', MENSAJE_CREDENCIALES);
	}
	const credencial = await repos.autenticacion.credencialDeCorreo(correo);
	if (!credencial) {
		await simularVerificacion(entrada.contrasena);
		return rechazo('credenciales', MENSAJE_CREDENCIALES);
	}
	if (credencial.bloqueadaHasta) return rechazo('bloqueada', MENSAJE_BLOQUEO);
	if (!(await verificarContrasena(entrada.contrasena, credencial.hash))) {
		const estado = await repos.autenticacion.registrarAccesoFallido(
			credencial.personalId,
			MAX_INTENTOS,
			MINUTOS_BLOQUEO
		);
		return estado.bloqueadaHasta
			? rechazo('bloqueada', MENSAJE_BLOQUEO)
			: rechazo('credenciales', MENSAJE_CREDENCIALES);
	}
	if (!credencial.activo) return rechazo('credenciales', MENSAJE_CREDENCIALES);
	const token = nuevoToken();
	const usuario = await repos.autenticacion.abrirSesion({
		personalId: credencial.personalId,
		tokenHash: resumenDeToken(token),
		duracionMinutos: DURACION_SESION_MINUTOS,
		agente: entrada.agente ?? null
	});
	olvidarContextos();
	return { ok: true, token, usuario };
}

/** Invalida la sesión en el servidor; la cookie la borra quien llama. */
export async function cerrarSesion(repos: Repositorios, token: string | null): Promise<void> {
	if (token) await repos.autenticacion.cerrarSesion(resumenDeToken(token));
	olvidarContextos();
}

export type ResultadoCambio = { ok: true } | { ok: false; mensaje: string };

/** Cambia la contraseña de quien tiene la sesión `token`, que se conserva; las demás se cierran. */
export async function cambiarContrasena(
	repos: Repositorios,
	usuario: UsuarioSesion,
	datos: { actual: string; nueva: string; confirmacion: string },
	token: string | null
): Promise<ResultadoCambio> {
	if (datos.nueva !== datos.confirmacion) {
		return { ok: false, mensaje: 'La contraseña nueva y su confirmación no coinciden.' };
	}
	const invalida = validarContrasena(datos.nueva, { correo: usuario.correo });
	if (invalida) return { ok: false, mensaje: invalida };
	const credencial = await repos.autenticacion.credencialDeCorreo(usuario.correo);
	if (!credencial || credencial.personalId !== usuario.id) {
		return { ok: false, mensaje: 'La cuenta ya no existe. Inicie sesión de nuevo.' };
	}
	if (credencial.bloqueadaHasta) return { ok: false, mensaje: MENSAJE_BLOQUEO };
	if (!(await verificarContrasena(datos.actual, credencial.hash))) {
		// Cuenta como intento fallido: este formulario no debe servir para adivinar la contraseña.
		await repos.autenticacion.registrarAccesoFallido(usuario.id, MAX_INTENTOS, MINUTOS_BLOQUEO);
		return { ok: false, mensaje: 'La contraseña actual no es correcta.' };
	}
	if (datos.nueva === datos.actual) {
		return { ok: false, mensaje: 'La contraseña nueva debe ser distinta de la actual.' };
	}
	await repos.autenticacion.establecerContrasena({
		personalId: usuario.id,
		hash: await resumirContrasena(datos.nueva),
		debeCambiar: false,
		conservarTokenHash: token ? resumenDeToken(token) : null
	});
	olvidarContextos();
	return { ok: true };
}

/**
 * Genera una contraseña temporal para la persona: sustituye a la anterior, cierra sus sesiones y la
 * obliga a cambiarla al entrar. Devuelve la contraseña para mostrarla una sola vez.
 */
export async function generarContrasenaDe(
	repos: Repositorios,
	personalId: string
): Promise<{ temporal: string; persona: Personal }> {
	const temporal = generarContrasenaTemporal();
	const persona = await repos.autenticacion.establecerContrasena({
		personalId,
		hash: await resumirContrasena(temporal),
		debeCambiar: true
	});
	olvidarContextos();
	return { temporal, persona };
}

export async function quitarAcceso(repos: Repositorios, personalId: string): Promise<Personal> {
	const persona = await repos.autenticacion.quitarAcceso(personalId);
	olvidarContextos();
	return persona;
}

export type ResultadoActivacion =
	| { ok: true; token: string; usuario: UsuarioSesion }
	| { ok: false; mensaje: string };

/**
 * Activa el inicio de sesión creando la primera cuenta, que debe ser de un administrador activo con
 * correo, y le abre la sesión. Deja de estar disponible en cuanto existe una cuenta.
 */
export async function activarInicioSesion(
	repos: Repositorios,
	datos: { personalId: string; contrasena: string; confirmacion: string; agente?: string | null }
): Promise<ResultadoActivacion> {
	const contexto = await repos.autenticacion.contexto(null, INACTIVIDAD_MINUTOS);
	if (contexto.activada) return { ok: false, mensaje: 'El inicio de sesión ya está activado.' };
	if (datos.contrasena !== datos.confirmacion) {
		return { ok: false, mensaje: 'La contraseña y su confirmación no coinciden.' };
	}
	try {
		const persona = await repos.personal.obtener(datos.personalId);
		const invalida = validarContrasena(datos.contrasena, { correo: persona.correo });
		if (invalida) return { ok: false, mensaje: invalida };
		await repos.autenticacion.establecerContrasena({
			personalId: persona.id,
			hash: await resumirContrasena(datos.contrasena),
			debeCambiar: false
		});
		const token = nuevoToken();
		const usuario = await repos.autenticacion.abrirSesion({
			personalId: persona.id,
			tokenHash: resumenDeToken(token),
			duracionMinutos: DURACION_SESION_MINUTOS,
			agente: datos.agente ?? null
		});
		return { ok: true, token, usuario };
	} catch (error) {
		if (error instanceof ErrorDatos && error.tipo !== 'desconocido') {
			return { ok: false, mensaje: error.message };
		}
		throw error;
	} finally {
		olvidarContextos();
	}
}
