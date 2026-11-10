import { describe, expect, it } from 'vitest';
import {
	generarContrasenaTemporal,
	resumirContrasena,
	validarContrasena,
	verificarContrasena
} from './contrasenas';
import { nuevoToken, opcionesCookie, resumenDeToken } from './sesiones';

describe('contraseñas', () => {
	it('resume con sal propia y verifica solo la contraseña correcta', async () => {
		const resumen = await resumirContrasena('contraseña ficticia 1');
		const otro = await resumirContrasena('contraseña ficticia 1');
		expect(resumen).toMatch(/^scrypt\$32768\$8\$3\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
		expect(resumen).not.toContain('ficticia');
		expect(otro).not.toBe(resumen);
		expect(await verificarContrasena('contraseña ficticia 1', resumen)).toBe(true);
		expect(await verificarContrasena('contraseña ficticia 2', resumen)).toBe(false);
		expect(await verificarContrasena('', resumen)).toBe(false);
	});

	it('acepta la misma contraseña con otra composición de acentos', async () => {
		const resumen = await resumirContrasena('cañón-ficticio-1');
		expect(await verificarContrasena('cañón-ficticio-1', resumen)).toBe(true);
	});

	it('rechaza resúmenes ajenos, incompletos o con un costo desmesurado', async () => {
		expect(await verificarContrasena('x', '')).toBe(false);
		expect(await verificarContrasena('x', 'texto plano')).toBe(false);
		expect(await verificarContrasena('x', 'bcrypt$10$abc$def$ghi$jkl')).toBe(false);
		expect(await verificarContrasena('x', 'scrypt$1048576$8$1$c2Fs$cmVz')).toBe(false);
		expect(await verificarContrasena('x', 'scrypt$1000$8$1$c2Fs$cmVz')).toBe(false);
	});

	it('exige de 10 a 128 caracteres y que no sea el correo', () => {
		expect(validarContrasena('123456789')).toMatch(/al menos 10/);
		expect(validarContrasena('x'.repeat(129))).toMatch(/128/);
		expect(validarContrasena(' Ana@Ficticio.test ', { correo: 'ana@ficticio.test' })).toMatch(
			/correo/
		);
		expect(validarContrasena('1234567890')).toBeNull();
		expect(validarContrasena('una frase larga sin símbolos')).toBeNull();
	});

	it('genera contraseñas temporales distintas, válidas y sin signos ambiguos', () => {
		const generadas = new Set(Array.from({ length: 50 }, generarContrasenaTemporal));
		expect(generadas.size).toBe(50);
		for (const temporal of generadas) {
			expect(temporal).toMatch(/^[A-HJ-NP-Za-hjkmnp-z2-9]{4}(-[A-HJ-NP-Za-hjkmnp-z2-9]{4}){2}$/);
			expect(validarContrasena(temporal)).toBeNull();
		}
	});
});

describe('sesiones', () => {
	it('el identificador es aleatorio y la base solo recibe su resumen', () => {
		const token = nuevoToken();
		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(nuevoToken()).not.toBe(token);
		expect(resumenDeToken(token)).toMatch(/^[0-9a-f]{64}$/);
		expect(resumenDeToken(token)).toBe(resumenDeToken(token));
		expect(resumenDeToken(token)).not.toContain(token);
	});

	it('la cookie es inaccesible a los scripts y exige HTTPS solo sobre HTTPS', () => {
		expect(opcionesCookie(new URL('https://reportes.ficticio.test/'))).toEqual({
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			maxAge: 7 * 24 * 60 * 60
		});
		expect(opcionesCookie(new URL('http://192.168.1.10:5173/')).secure).toBe(false);
	});
});
