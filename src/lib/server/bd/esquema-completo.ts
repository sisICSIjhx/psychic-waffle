// Script único para crear la base desde cero en Supabase (SQL Editor o psql): todas las migraciones
// en orden, en una transacción, con su registro en interno.migraciones (el mismo que usa PGlite) y la
// seguridad por filas reaplicada al final a todas las tablas (cambio alcances-personal-esquema-bd, D5).
import type { Migracion } from './migraciones.ts';

export const ARCHIVO_ESQUEMA_COMPLETO = 'supabase/esquema_completo.sql';

const ENCABEZADO = `-- esquema_completo.sql: GENERADO con «npm run bd:script» a partir de supabase/migrations/.
-- No editar a mano: cambie o agregue una migración y vuelva a generarlo.
--
-- Crea en una base VACÍA de Supabase todo el esquema de ICSI Reportes: catálogo (clientes =
-- proyectos, contratos, centros de costo (sitios) con su plantilla de seguimiento, partidas,
-- alcances predeterminados, equipos y firmantes), programa anual con ajustes, reportes con fotos y
-- documentos, bitácora del catálogo, personal con rol y centros de costo, cuentas y sesiones,
-- y seguimiento operativo con entregas de carpetas. La aplicación solo usa las funciones
-- public.api_* con la clave de servicio.
--
-- Fotos: se guardarán en SharePoint; la base conserva solo sus URL (reporte_fotos.almacenamiento =
-- 'sharepoint', url_original y url_optimizada). Los archivos no se suben a Supabase Storage.
--
-- Uso: pegar en Supabase > SQL Editor y ejecutar, o
--   psql "<cadena de conexión>" -f ${ARCHIVO_ESQUEMA_COMPLETO}
-- Si falla, la transacción se revierte completa. Para una base que ya tiene migraciones aplicadas,
-- use la CLI de Supabase con la carpeta supabase/migrations.
`;

const SEGURIDAD_FINAL = `-- ---------------------------------------------------------------------------------------------
-- Seguridad final: RLS en todas las tablas públicas, solo el rol de servicio accede y las claves
-- públicas (anon, authenticated) no leen tablas ni ejecutan funciones. Idempotente.
-- ---------------------------------------------------------------------------------------------
do $$
declare
	tabla text;
	hay_roles_supabase boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
	for tabla in select tablename from pg_tables where schemaname = 'public' loop
		execute format('alter table public.%I enable row level security', tabla);
		if hay_roles_supabase and not exists (select 1 from pg_policies
			where schemaname = 'public' and tablename = tabla and policyname = 'servicio_acceso_total') then
			execute format(
				'create policy servicio_acceso_total on public.%I for all to service_role using (true) with check (true)',
				tabla
			);
		end if;
	end loop;
	if hay_roles_supabase then
		revoke all on all tables in schema public from anon, authenticated;
		revoke all on all sequences in schema public from anon, authenticated;
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
		alter default privileges in schema public revoke all on tables from anon, authenticated;
		alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
		revoke all on schema interno from anon, authenticated;
	end if;
end
$$;
`;

const literal = (texto: string) => `'${texto.replaceAll("'", "''")}'`;
const SEPARADOR = `-- ${'='.repeat(93)}`;

export function generarEsquemaCompleto(migraciones: Migracion[]): string {
	const partes = [
		ENCABEZADO,
		'begin;\n',
		'create schema if not exists interno;',
		'create table if not exists interno.migraciones (nombre text primary key, aplicada_en timestamptz not null default now());\n'
	];
	for (const { nombre, sql } of migraciones) {
		partes.push(
			SEPARADOR,
			`-- ${nombre}`,
			SEPARADOR,
			sql.replace(/\r\n/g, '\n').trimEnd(),
			'',
			`insert into interno.migraciones (nombre) values (${literal(nombre)}) on conflict do nothing;\n`
		);
	}
	partes.push(SEGURIDAD_FINAL, 'commit;');
	return `${partes.join('\n')}\n`;
}
