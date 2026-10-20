-- 0004_rls.sql
-- Seguridad a nivel de fila en todas las tablas. Mientras no exista autenticación, solo el servidor
-- accede a los datos con el rol de servicio; las políticas por rol llegan con el cambio de
-- autenticación (Entra ID). En PGlite no existen los roles de Supabase y el bloque los omite.

do $$
declare
	tabla text;
	hay_roles_supabase boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
	for tabla in select tablename from pg_tables where schemaname = 'public' loop
		execute format('alter table public.%I enable row level security', tabla);
		if hay_roles_supabase then
			execute format(
				'create policy servicio_acceso_total on public.%I for all to service_role using (true) with check (true)',
				tabla
			);
		end if;
	end loop;

	if hay_roles_supabase then
		-- Las claves públicas (anon/authenticated) no leen tablas ni ejecutan funciones.
		revoke all on all tables in schema public from anon, authenticated;
		revoke all on all sequences in schema public from anon, authenticated;
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
		alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
	end if;
end
$$;
