// Genera una contraseña temporal para una persona activa desde la consola del servidor, sin sesión
// en la aplicación. Sirve para recuperar la cuenta del único administrador y para activar el inicio
// de sesión sin pasar por la interfaz (la primera cuenta debe ser de un administrador).
//
// Uso:
//   npm run cuenta -- --correo <correo>
// Sustituye la contraseña anterior, cierra las sesiones abiertas de la persona y la obliga a elegir
// la suya al entrar. La contraseña se imprime una sola vez y no se guarda en ningún archivo.
// Con PGlite, detenga antes el servidor de la aplicación: la base no admite dos procesos.
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { generarContrasenaDe } from '../src/lib/server/autenticacion/servicio.ts';
import { ErrorDatos } from '../src/lib/server/bd/cliente.ts';
import { repositoriosDesdeEntorno } from '../src/lib/server/datos-entorno.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVO_ENTORNO = join(RAIZ, '.env');
if (existsSync(ARCHIVO_ENTORNO)) process.loadEnvFile(ARCHIVO_ENTORNO);

const { values: opciones } = parseArgs({ options: { correo: { type: 'string' } } });

function fallar(mensaje: string): never {
	console.error(mensaje);
	process.exit(1);
}

const correo = opciones.correo?.trim().toLowerCase();
if (!correo) fallar('Uso: npm run cuenta -- --correo <correo>');

const repos = await repositoriosDesdeEntorno({
	PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
	STORAGE_DIR: process.env.STORAGE_DIR
});
let salida = 0;
try {
	const persona = (await repos.personal.listar()).find(
		(p) => p.correo?.trim().toLowerCase() === correo
	);
	if (!persona) {
		console.error(`No hay ninguna persona registrada con el correo ${correo}.`);
		salida = 1;
	} else {
		const { temporal } = await generarContrasenaDe(repos, persona.id);
		console.log(`Contraseña temporal de ${correo}: ${temporal}`);
		console.log('No se vuelve a mostrar. Al entrar con ella, la persona elegirá la suya.');
	}
} catch (error) {
	// Persona dada de baja, o primera cuenta que no es de un administrador.
	if (!(error instanceof ErrorDatos) || error.tipo === 'desconocido') throw error;
	console.error(error.message);
	salida = 1;
} finally {
	await repos.cerrar();
}
process.exit(salida);
