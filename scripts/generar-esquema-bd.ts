// Genera supabase/esquema_completo.sql con todas las migraciones (npm run bd:script).
import { writeFile } from 'node:fs/promises';
import { leerMigraciones } from '../src/lib/server/bd/migraciones.ts';
import {
	ARCHIVO_ESQUEMA_COMPLETO,
	generarEsquemaCompleto
} from '../src/lib/server/bd/esquema-completo.ts';

const migraciones = await leerMigraciones();
await writeFile(ARCHIVO_ESQUEMA_COMPLETO, generarEsquemaCompleto(migraciones), 'utf8');
console.log(
	`${ARCHIVO_ESQUEMA_COMPLETO}: ${migraciones.length} migraciones (${migraciones[0]?.nombre} a ${migraciones.at(-1)?.nombre}).`
);
