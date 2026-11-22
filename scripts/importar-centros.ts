// Carga plantillas de seguimiento y centros de costo en la base configurada (Supabase o PGlite
// local). Cambio centros-costo-plantillas, D9.
//
// Uso:
//   npm run importar:centros -- <archivo.json> [--aplicar]
//   npm run importar:centros -- <archivo.json> --complementar [--aplicar]
// El archivo es un JSON { "plantillas": [...], "centros": [...] }:
//   - plantilla: { nombre, descripcion?, modoContrato, origenActividades, conceptos: [{ bloque,
//     etiqueta, tipo, nivel?, indicador?, porDefinir?, carpeta? }] }, con los valores de
//     src/lib/dominio/constantes.ts; `carpeta` es la etiqueta de un concepto de carpeta de la plantilla;
//   - centro: { clave, nombre, plantilla } (el nombre de una plantilla del archivo o de la base).
// Da de alta las plantillas que no existen por nombre y los centros que no existen por clave, y
// asigna la plantilla a los centros existentes que no tienen una. No modifica plantillas existentes
// ni cambia una plantilla ya asignada. Por omisión hace un ensayo; con --aplicar guarda todo, o nada
// si alguna fila no es válida.
// Con --complementar (cambio kpi-estatus-centros, D10) no da de alta nada: a cada plantilla que ya
// existe le agrega los conceptos que le falten (por bloque y etiqueta) y actualiza el indicador,
// «por definir» y la carpeta de los existentes cuando el archivo los trae. Nunca cambia el tipo, el
// bloque ni el nivel de un concepto, ni elimina conceptos ni datos capturados.
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
	options: {
		aplicar: { type: 'boolean', default: false },
		complementar: { type: 'boolean', default: false }
	}
});

function fallar(mensaje: string): never {
	console.error(mensaje);
	process.exit(1);
}

const archivo = positionals[0];
if (!archivo) {
	fallar('Uso: npm run importar:centros -- <archivo.json> [--complementar] [--aplicar]');
}
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
async function complementar() {
	const resultado = await repos.centrosCosto.complementar(lectura.data!, !opciones.aplicar);
	console.log('Plantillas');
	console.table(
		resultado.plantillas.map((p) => ({
			plantilla: p.nombre ?? '',
			resultado: p.estado,
			agregados: p.agregados,
			actualizados: p.actualizados,
			avisos: p.avisos.length
		}))
	);
	for (const p of resultado.plantillas) {
		if (!p.cambios.length && !p.avisos.length) continue;
		console.log(`
${p.nombre}`);
		for (const cambio of p.cambios) console.log(`  + ${cambio}`);
		for (const aviso of p.avisos) console.log(`  ! ${aviso}`);
	}
	const r = resultado.resumen;
	const resumen =
		`${r.agregados} conceptos agregados y ${r.actualizados} actualizados; ` +
		`${r.ausentes} plantillas que no existen y ${r.invalidas} no válidas.`;
	if (resultado.aplicado) {
		console.log(`
Aplicado. ${resumen}`);
	} else if (resultado.ensayo) {
		console.log(`
Ensayo (no se guardó nada). ${resumen}`);
		if (r.invalidas === 0) console.log('Para guardar, repita con --aplicar.');
	} else {
		console.log(`
No se guardó nada: corrija las plantillas no válidas. ${resumen}`);
		process.exitCode = 1;
	}
}

async function cargar() {
	const resultado = await repos.centrosCosto.importar(lectura.data!, !opciones.aplicar);
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
}

try {
	await (opciones.complementar ? complementar() : cargar());
} finally {
	await repos.cerrar();
}
