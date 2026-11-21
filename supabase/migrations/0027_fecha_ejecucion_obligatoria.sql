-- 0027_fecha_ejecucion_obligatoria.sql
-- Cambio marcar-ejecutado (ajuste del 2026-11-19): la fecha de ejecución de una marca es obligatoria.
-- La restricción se crea NOT VALID para no rechazar las marcas registradas antes sin fecha; sí se
-- comprueba en cada marca nueva o modificada. api_marcar_ejecutado responde con un mensaje claro
-- antes de llegar a la restricción.

alter table public.programa_realizados_manuales
	drop constraint if exists programa_realizados_manuales_marca_con_fecha;
alter table public.programa_realizados_manuales
	add constraint programa_realizados_manuales_marca_con_fecha
	check (origen <> 'marca' or fecha_ejecucion is not null) not valid;

-- Igual que en 0026, pero la fecha es obligatoria.
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
	return jsonb_build_object('id', fila.id, 'programaId', fila.programa_id, 'partidaId', fila.partida_id,
		'mes', fila.mes, 'cantidad', cantidad_p, 'fechaEjecucion', fila.fecha_ejecucion, 'nota', fila.nota,
		'registradoEn', fila.registrado_en);
end
$$;

-- Misma política que 0004 y 0026: solo el rol de servicio ejecuta las funciones.
do $$
begin
	revoke execute on function public.api_marcar_ejecutado(jsonb) from public;
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
