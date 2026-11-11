// Carga plantillas de seguimiento y centros de costo en la base configurada (Supabase o PGlite
// local). Cambio centros-costo-plantillas, D9.
//
// Uso:
//   npm run importar:centros -- <archivo.json> [--aplicar]
// El archivo es un JSON { "plantillas": [...], "centros": [...] }:
//   - plantilla: { nombre, descripcion?, modoContrato, origenActividades, conceptos: [{ bloque,
//     etiqueta, tipo, nivel? }] }, con los valores de src/lib/dominio/constantes.ts;
//   - centro: { clave, nombre, plantilla } (el nombre de una plantilla del archivo o de la base).
// Da de alta las plantillas que no existen por nombre y los centros que no existen por clave, y
// asigna la plantilla a los centros existentes que no tienen una. No modifica plantillas existentes
// ni cambia una plantilla ya asignada. Por omisión hace un ensayo; con --aplicar guarda todo, o nada
// si alguna fila no es válida.
// Con PGlite, detenga antes el servidor de la aplicación: la base no admite dos procesos.
// Los centros reales vienen del Excel de dirección: guarde el archivo en insumos/, que no se versiona.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { esquemaCargaCentrosCosto } from '../src/lib/dominio/esquemas.ts';
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
if (!archivo) fallar('Uso: npm run importar:centros -- <archivo.json> [--aplicar]');
if (!existsSync(archivo)) fallar(`No existe el archivo ${archivo}`);

let contenido: unknown;
try {
	contenido = JSON.parse(readFileSync(archivo, 'utf8'));
} catch (error) {
	fallar(`El archivo no es un JSON válido: ${(error as Error).message}`);
}
const lectura = esquemaCargaCentrosCosto.safeParse(contenido);
if (!lectura.success) {
	fallar(
		`El archivo no tiene la forma esperada:\n${lectura.error.issues
			.map((i) => `  ${i.path.join('.')}: ${i.message}`)
			.join('\n')}`
	);
}

const repos = await repositoriosDesdeEntorno({
	PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
	STORAGE_DIR: process.env.STORAGE_DIR
});
try {
	const resultado = await repos.centrosCosto.importar(lectura.data, !opciones.aplicar);
	console.log('Plantillas');
	console.table(
		resultado.plantillas.map((p) => ({
			plantilla: p.nombre ?? '',
			resultado: p.motivo ? `${p.estado}: ${p.motivo}` : p.estado
		}))
	);
	console.log('Centros de costo');
	console.table(
		resultado.centros.map((c) => ({
			clave: c.clave ?? '',
			resultado: c.motivo ? `${c.estado}: ${c.motivo}` : c.estado
		}))
	);
	const r = resultado.resumen;
	const resumen =
		`plantillas: ${r.plantillasNuevas} nuevas y ${r.plantillasExistentes} ya registradas; ` +
		`centros: ${r.centrosNuevos} nuevos, ${r.centrosAsignados} con plantilla asignada y ` +
		`${r.centrosExistentes} sin cambios; ${r.invalidas} filas no válidas.`;
	if (resultado.aplicado) {
		console.log(`Aplicado. ${resumen}`);
	} else if (resultado.ensayo) {
		console.log(`Ensayo (no se guardó nada). ${resumen}`);
		if (r.invalidas === 0) console.log('Para guardar, repita con --aplicar.');
	} else {
		console.log(`No se guardó nada: corrija las filas no válidas. ${resumen}`);
		process.exitCode = 1;
	}
} finally {
	await repos.cerrar();
}
