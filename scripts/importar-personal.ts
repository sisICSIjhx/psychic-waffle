// Carga una lista de personal en la base configurada (Supabase o PGlite local).
//
// Uso:
//   npm run importar:personal -- <archivo> [--aplicar]
// El archivo es de texto, con una persona por línea: nombre completo, sede y correo, separados por
// tabulador, punto y coma o coma (lo que se obtiene al copiar tres columnas de Excel).
// Por omisión hace un ensayo: muestra cómo divide cada nombre y qué haría, sin guardar nada. Con
// --aplicar da de alta, en una transacción, a quienes no están registrados por su correo: como
// reporteadores activos, sin proyectos y sin cuenta. A quien ya existe no lo modifica. El rol, los
// proyectos y la contraseña de cada persona se asignan después en /personal.
// Con PGlite, detenga antes el servidor de la aplicación: la base no admite dos procesos.
// El archivo contiene datos personales: guárdelo en insumos/, que no se versiona.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { dividirNombre, leerListaPersonal } from '../src/lib/dominio/personal.ts';
import { repositoriosDesdeEntorno } from '../src/lib/server/datos-entorno.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVO_ENTORNO = join(RAIZ, '.env');
if (existsSync(ARCHIVO_ENTORNO)) process.loadEnvFile(ARCHIVO_ENTORNO);

const { values: opciones, positionals } = parseArgs({
	allowPositionals: true,
	options: { aplicar: { type: 'boolean', default: false } }
});

function fallar(mensaje: string): never {
	console.error(mensaje);
	process.exit(1);
}

const archivo = positionals[0];
if (!archivo) fallar('Uso: npm run importar:personal -- <archivo> [--aplicar]');
if (!existsSync(archivo)) fallar(`No existe el archivo ${archivo}`);

const lineas = leerListaPersonal(readFileSync(archivo, 'utf8'));
if (lineas.length === 0) fallar('El archivo no tiene personas.');

const personas = lineas.map(({ linea, completo, sede, correo }) => {
	const dividido = dividirNombre(completo);
	return {
		linea,
		// Sin nombre y apellido, la base informa la línea como no válida.
		nombre: dividido?.nombre ?? completo,
		apellidoPaterno: dividido?.apellidoPaterno ?? '',
		apellidoMaterno: dividido?.apellidoMaterno ?? null,
		sede,
		correo
	};
});

const repos = await repositoriosDesdeEntorno({
	PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
	STORAGE_DIR: process.env.STORAGE_DIR
});
try {
	const resultado = await repos.personal.importar(personas, !opciones.aplicar);
	const estados = new Map(resultado.filas.map((f) => [f.linea, f]));
	console.table(
		personas.map((p) => {
			const fila = estados.get(p.linea);
			return {
				línea: p.linea,
				nombre: p.nombre,
				paterno: p.apellidoPaterno,
				materno: p.apellidoMaterno ?? '',
				sede: p.sede ?? '',
				correo: p.correo ?? '',
				resultado: fila?.motivo ?? fila?.estado ?? ''
			};
		})
	);
	const { nuevas, existentes, invalidas } = resultado.resumen;
	console.log(
		`${resultado.ensayo ? 'Ensayo' : 'Aplicado'}: ${nuevas} nuevas, ${existentes} ya registradas y ${invalidas} no válidas.`
	);
	if (resultado.ensayo) {
		console.log('No se guardó nada. Revise la división de los nombres y repita con --aplicar.');
	} else if (nuevas > 0) {
		console.log('Asigne el rol y los proyectos de cada persona en /personal.');
	}
} finally {
	await repos.cerrar();
}
