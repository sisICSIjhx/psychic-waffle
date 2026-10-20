-- Fase 5: captura de reportes.
--
-- Cada reporte guarda la huella del contenido que copió del catálogo (objetivo, introducción,
-- conclusiones, alcances y herramientas de la partida). Si la partida cambia después, la huella
-- vigente deja de coincidir y el editor ofrece aplicar los cambios de forma explícita; el borrador
-- conserva su contenido mientras tanto. La huella la calcula la aplicación (dominio/captura.ts).

alter table public.reportes add column if not exists catalogo_huella text not null default '';

-- json_reporte se extiende sin reescribirlo: la definición anterior se conserva con otro nombre y
-- las funciones que lo invocan resuelven el nombre al ejecutarse. El renombrado es idempotente.
do $$
begin
	if not exists (select 1 from pg_proc where proname = 'json_reporte_base'
		and pronamespace = 'public'::regnamespace) then
		alter function public.json_reporte(uuid) rename to json_reporte_base;
	end if;
end
$$;

create or replace function public.json_reporte(id_reporte uuid)
returns jsonb
language sql
stable
as $$
	select public.json_reporte_base(r.id) || jsonb_build_object('catalogoHuella', r.catalogo_huella)
	from public.reportes r
	where r.id = id_reporte
$$;

-- Una revisión conserva la huella de su original (api_crear_revision copia el reporte sin ella).
create or replace function public.copiar_huella_revision()
returns trigger
language plpgsql
as $$
begin
	if new.sustituye_a is not null and new.catalogo_huella = '' then
		select catalogo_huella into new.catalogo_huella from public.reportes where id = new.sustituye_a;
	end if;
	return new;
end
$$;

drop trigger if exists reportes_copiar_huella on public.reportes;
create trigger reportes_copiar_huella before insert on public.reportes
	for each row execute function public.copiar_huella_revision();

-- Alta de un reporte prellenado junto con la huella del catálogo, en una sola transacción.
create or replace function public.api_crear_reporte(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_reporte uuid := (public.api_insertar_reporte(p) ->> 'id')::uuid;
begin
	update public.reportes set catalogo_huella = coalesce(p ->> 'catalogoHuella', '')
	where id = id_reporte;
	return public.json_reporte(id_reporte);
end
$$;

-- Guarda el borrador con el contenido del catálogo ya aplicado y registra la huella nueva. Usa la
-- misma concurrencia optimista que api_guardar_reporte.
create or replace function public.api_aplicar_catalogo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	resultado jsonb;
	id_reporte uuid := (p ->> 'id')::uuid;
begin
	if coalesce(p ->> 'catalogoHuella', '') = '' then
		perform public.error_api('IC422', 'Falta la huella del catálogo',
			jsonb_build_object('motivo', 'huella_requerida'));
	end if;
	resultado := public.api_guardar_reporte(p);
	update public.reportes set catalogo_huella = p ->> 'catalogoHuella' where id = id_reporte;
	return jsonb_set(resultado, '{reporte}', public.json_reporte(id_reporte));
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
