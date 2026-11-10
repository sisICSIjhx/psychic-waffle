// Estado del acceso de una petición con una caché breve (cambio inicio-sesion-roles, D7): una página
// con fotos pide decenas de miniaturas seguidas y no hace falta consultar la sesión en cada una.
import type { ContextoAcceso } from '../../dominio/esquemas.ts';
import type { RepositorioAutenticacion } from '../repositorios/autenticacion.ts';
import { INACTIVIDAD_MINUTOS, resumenDeToken } from './sesiones.ts';

/** Una sesión cerrada desde otro proceso puede valer, como mucho, este tiempo más. */
const VIGENCIA_MS = 10_000;
const TOPE = 2000;

const guardados = new Map<string, { vence: number; contexto: ContextoAcceso }>();

/** Si el inicio de sesión está activado y quién hace la petición, según la cookie recibida. */
export async function contextoDeAcceso(
	autenticacion: RepositorioAutenticacion,
	token: string | null,
	ahora = Date.now()
): Promise<ContextoAcceso> {
	const clave = token ? resumenDeToken(token) : '';
	const guardado = guardados.get(clave);
	if (guardado && guardado.vence > ahora) return guardado.contexto;
	const contexto = await autenticacion.contexto(clave || null, INACTIVIDAD_MINUTOS);
	if (guardados.size >= TOPE) guardados.clear();
	guardados.set(clave, { vence: ahora + VIGENCIA_MS, contexto });
	return contexto;
}

/** Tras cualquier cambio de cuentas, sesiones o personal: la siguiente petición vuelve a consultar. */
export function olvidarContextos(): void {
	guardados.clear();
}
