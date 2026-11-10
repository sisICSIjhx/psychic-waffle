// Contraseñas (cambio inicio-sesion-roles, D3 y D10): resumen con scrypt, regla de aceptación y
// contraseña temporal. La contraseña nunca se guarda ni se registra; solo su resumen con sal.
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

// Costo de scrypt recomendado por OWASP (N = 2^15, r = 8, p = 3). Van dentro del resumen para poder
// endurecerlos después sin invalidar las contraseñas existentes.
const COSTO = 32768;
const BLOQUE = 8;
const PARALELO = 3;
const BYTES_SAL = 16;
const BYTES_RESUMEN = 64;
/** Tope de costo aceptado al verificar: un resumen manipulado no puede agotar la memoria. */
const COSTO_MAXIMO = 2 ** 17;

export const LARGO_MINIMO = 10;
export const LARGO_MAXIMO = 128;

function derivar(
	contrasena: string,
	sal: Buffer,
	costo: number,
	bloque: number,
	paralelo: number,
	bytes: number
): Promise<Buffer> {
	return new Promise((resolver, rechazar) => {
		scrypt(
			// NFKC: la misma contraseña escrita con otra composición de acentos da el mismo resumen.
			contrasena.normalize('NFKC'),
			sal,
			bytes,
			{ N: costo, r: bloque, p: paralelo, maxmem: 256 * costo * bloque },
			(error, clave) => (error ? rechazar(error) : resolver(clave))
		);
	});
}

/** Resumen para guardar: «scrypt$N$r$p$sal$resumen», con la sal y el resumen en base64. */
export async function resumirContrasena(contrasena: string): Promise<string> {
	const sal = randomBytes(BYTES_SAL);
	const clave = await derivar(contrasena, sal, COSTO, BLOQUE, PARALELO, BYTES_RESUMEN);
	return ['scrypt', COSTO, BLOQUE, PARALELO, sal.toString('base64'), clave.toString('base64')].join(
		'$'
	);
}

export async function verificarContrasena(contrasena: string, resumen: string): Promise<boolean> {
	const [algoritmo, costo, bloque, paralelo, sal, clave] = resumen.split('$');
	const numeros = [costo, bloque, paralelo].map(Number);
	if (algoritmo !== 'scrypt' || !sal || !clave) return false;
	if (!numeros.every((n) => Number.isInteger(n) && n > 0) || numeros[0] > COSTO_MAXIMO)
		return false;
	const esperada = Buffer.from(clave, 'base64');
	if (esperada.length === 0) return false;
	try {
		const calculada = await derivar(
			contrasena,
			Buffer.from(sal, 'base64'),
			numeros[0],
			numeros[1],
			numeros[2],
			esperada.length
		);
		return timingSafeEqual(calculada, esperada);
	} catch {
		return false;
	}
}

let resumenFicticio: Promise<string> | null = null;

/**
 * Gasta el tiempo de una verificación cuando el correo no tiene cuenta, para que la respuesta no
 * delate por su duración si el correo existe.
 */
export async function simularVerificacion(contrasena: string): Promise<void> {
	resumenFicticio ??= resumirContrasena(randomBytes(16).toString('hex'));
	await verificarContrasena(contrasena, await resumenFicticio);
}

/** Motivo por el que una contraseña nueva no se acepta, o null si vale (NIST 800-63B: solo largo). */
export function validarContrasena(
	contrasena: string,
	datos: { correo?: string | null } = {}
): string | null {
	if (contrasena.length < LARGO_MINIMO) {
		return `La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`;
	}
	if (contrasena.length > LARGO_MAXIMO) {
		return `La contraseña no puede pasar de ${LARGO_MAXIMO} caracteres.`;
	}
	const correo = datos.correo?.trim().toLowerCase();
	if (correo && contrasena.trim().toLowerCase() === correo) {
		return 'La contraseña no puede ser el correo.';
	}
	return null;
}

// Sin 0, O, 1, l ni I: se dicta y se copia a mano sin confusiones.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Contraseña temporal de 12 caracteres en tres grupos («Xk4m-P9wR-t2Hq»). */
export function generarContrasenaTemporal(): string {
	const grupo = () =>
		Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
	return [grupo(), grupo(), grupo()].join('-');
}
