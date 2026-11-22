-- 0029_personal_marca_ejecucion.sql
-- Cambio capturar-actividad: las personas que realizaron una actividad marcada como ejecutada.
-- Una marca (programa_realizados_manuales con origen «marca») puede llevar cero o más personas del
-- personal activo. Al quitar la marca («Desmarcar ejecutado») se quitan sus personas.

create table if not exists public.programa_marca_personal (
	marca_id uuid not null references public.programa_realizados_manuales (id) on delete cascade,
	personal_id uuid not null references public.personal (id),
	primary key (marca_id, personal_id)
);
create index if not exists programa_marca_personal_personal_idx
	on public.programa_marca_personal (personal_id);

-- Igual que en 0027, con `personalIds` opcional: ids de personas activas, sin repetir.
create or replace function public.api_marcar_ejecutado(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	programa_p uuid := (p ->> 'programaId')::uuid;
	partida_p uuid := (p ->> 'partidaId')::uuid;
	mes_p date := public.primer_dia_mes((p ->> 'mes')::date);
	cantidad_p integer := coalesce((p ->> 'cantidad')::integer, 1);
	fecha_p date := nullif(p ->> 'fecha', '')::date;
	nota_p text := coalesce(nullif(btrim(p ->> 'nota'), ''), 'Marcado como ejecutado en el programa');
	personas uuid[] := coalesce((select array_agg(distinct x::uuid)
		from jsonb_array_elements_text(coalesce(p -> 'personalIds', '[]'::jsonb)) as x), '{}');
	falta integer;
	reportes_mes integer;
	marcas_mes numeric;
	fila public.programa_realizados_manuales;
begin
	if cantidad_p < 1 then
		perform public.error_api('IC422', 'La cantidad debe ser al menos 1', jsonb_build_object('cantidad', cantidad_p));
	end if;
	if fecha_p is null then
		perform public.error_api('IC422', 'Indique la fecha de ejecución', jsonb_build_object('campo', 'fecha'));
	end if;
	if date_trunc('month', fecha_p)::date <> mes_p then
		perform public.error_api('IC422', 'La fecha de ejecución debe caer en el mes marcado',
			jsonb_build_object('fecha', fecha_p, 'mes', mes_p));
	end if;
	if cardinality(personas) > 0 and (select count(*) from public.personal
		where id = any (personas) and activo) <> cardinality(personas) then
		perform public.error_api('IC422', 'Alguna de las personas no existe o no está activa',
			jsonb_build_object('campo', 'personalIds'));
	end if;
	falta := greatest(public.falta_en_celda(programa_p, partida_p, mes_p), 0);
	if cantidad_p > falta then
		perform public.error_api('IC422',
			case when falta = 0 then 'No falta nada por ejecutar en el mes'
				else format('Solo falta%s %s por ejecutar en el mes', case when falta = 1 then '' else 'n' end, falta) end,
			jsonb_build_object('falta', falta));
	end if;
	reportes_mes := coalesce((select e.ejecuciones from public.v_ejecuciones_reportes e
		where e.partida_id = partida_p and e.mes = mes_p), 0);
	marcas_mes := coalesce((select sum(x.cantidad) from public.programa_realizados_manuales x
		where x.programa_id = programa_p and x.partida_id = partida_p and x.mes = mes_p
			and x.origen = 'marca'), 0);
	insert into public.programa_realizados_manuales
		(programa_id, partida_id, mes, cantidad, nota, origen, fecha_ejecucion)
	values (programa_p, partida_p, mes_p, cantidad_p + greatest(reportes_mes - marcas_mes, 0), nota_p,
		'marca', fecha_p)
	returning * into fila;
	insert into public.programa_marca_personal (marca_id, personal_id)
	select fila.id, unnest(personas);
	return jsonb_build_object('id', fila.id, 'programaId', fila.programa_id, 'partidaId', fila.partida_id,
		'mes', fila.mes, 'cantidad', cantidad_p, 'fechaEjecucion', fila.fecha_ejecucion, 'nota', fila.nota,
		'registradoEn', fila.registrado_en, 'personalIds', to_jsonb(personas));
end
$$;

-- Misma política que 0004 y 0024: RLS y solo el rol de servicio lee y escribe.
do $$
begin
	alter table public.programa_marca_personal enable row level security;
	revoke execute on function public.api_marcar_ejecutado(jsonb) from public;
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke all on public.programa_marca_personal from public, anon, authenticated;
		grant select, insert, update, delete on public.programa_marca_personal to service_role;
		create policy servicio_acceso_total on public.programa_marca_personal for all to service_role
			using (true) with check (true);
		revoke execute on all functions in schema public from anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
