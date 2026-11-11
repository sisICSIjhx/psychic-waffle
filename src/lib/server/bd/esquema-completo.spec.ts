import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { crearClientePglite } from './pglite';
import { ARCHIVO_ESQUEMA_COMPLETO, generarEsquemaCompleto } from './esquema-completo';
import { leerMigraciones } from './migraciones';

const ruta = fileURLToPath(new URL(`../../../../${ARCHIVO_ESQUEMA_COMPLETO}`, import.meta.url));

async function tablasYFunciones(bd: PGlite) {
	const tablas = await bd.query<{ nombre: string; rls: boolean }>(
		`select c.relname as nombre, c.relrowsecurity as rls from pg_class c
		where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1`
	);
	const funciones = await bd.query<{ nombre: string }>(
		`select proname as nombre from pg_proc where pronamespace = 'public'::regnamespace
		and proname like 'api\\_%' order by 1`
	);
	return { tablas: tablas.rows, funciones: funciones.rows.map((f) => f.nombre) };
}

describe('script único de la base', () => {
	it('está al día con las migraciones (si falla, ejecute npm run bd:script)', async () => {
		const actual = (await readFile(ruta, 'utf8')).replace(/\r\n/g, '\n');
		expect(actual === generarEsquemaCompleto(await leerMigraciones())).toBe(true);
	});

	it('crea en una base vacía lo mismo que las migraciones, con RLS en todas las tablas', async () => {
		const vacia = new PGlite();
		await vacia.exec(await readFile(ruta, 'utf8'));
		const desdeScript = await tablasYFunciones(vacia);
		const registradas = await vacia.query<{ nombre: string }>(
			'select nombre from interno.migraciones order by 1'
		);
		const migraciones = await leerMigraciones();
		expect(registradas.rows.map((r) => r.nombre)).toEqual(migraciones.map((m) => m.nombre));

		const referencia = await crearClientePglite();
		const desdeMigraciones = await tablasYFunciones(referencia.bd);
		expect(desdeScript.funciones).toEqual(desdeMigraciones.funciones);
		expect(desdeScript.tablas.map((t) => t.nombre)).toEqual(
			desdeMigraciones.tablas.map((t) => t.nombre)
		);
		expect(desdeScript.tablas.every((t) => t.rls)).toBe(true);
		expect(desdeScript.tablas.map((t) => t.nombre)).toEqual(
			expect.arrayContaining([
				'alcances_predeterminados',
				'personal',
				'personal_centros_costo',
				'plantillas_seguimiento',
				'plantilla_conceptos'
			])
		);
		await Promise.all([vacia.close(), referencia.cerrar()]);
		// Crea dos bases completas: sola tarda segundos, con toda la suite en paralelo bastante más.
	}, 60_000);
});
