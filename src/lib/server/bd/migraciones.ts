// Migraciones SQL de supabase/migrations, en orden. En Supabase las aplica su CLI; en PGlite se
// aplican aquí y se registran en interno.migraciones.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CARPETA_MIGRACIONES = fileURLToPath(
	new URL('../../../../supabase/migrations/', import.meta.url)
);

export interface Migracion {
	nombre: string;
	sql: string;
}

export async function leerMigraciones(carpeta = CARPETA_MIGRACIONES): Promise<Migracion[]> {
	const nombres = (await readdir(carpeta)).filter((n) => /^\d{4}_[\w-]+\.sql$/.test(n)).sort();
	return Promise.all(
		nombres.map(async (nombre) => ({ nombre, sql: await readFile(join(carpeta, nombre), 'utf8') }))
	);
}

interface EjecutorSql {
	exec(sql: string): Promise<unknown>;
	query<T>(sql: string, parametros?: unknown[]): Promise<{ rows: T[] }>;
}

interface EjecutorMigraciones extends EjecutorSql {
	transaction<T>(fn: (tx: EjecutorSql) => Promise<T>): Promise<T>;
}

export async function aplicarMigraciones(
	bd: EjecutorMigraciones,
	migraciones: Migracion[]
): Promise<string[]> {
	await bd.exec(
		'create schema if not exists interno; create table if not exists interno.migraciones (nombre text primary key, aplicada_en timestamptz not null default now());'
	);
	const aplicadas = new Set(
		(await bd.query<{ nombre: string }>('select nombre from interno.migraciones')).rows.map(
			(f) => f.nombre
		)
	);
	const nuevas: string[] = [];
	for (const migracion of migraciones) {
		if (aplicadas.has(migracion.nombre)) continue;
		await bd.transaction(async (tx) => {
			await tx.exec(migracion.sql);
			await tx.query('insert into interno.migraciones (nombre) values ($1)', [migracion.nombre]);
		});
		nuevas.push(migracion.nombre);
	}
	return nuevas;
}
