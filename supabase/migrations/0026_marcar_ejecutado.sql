-- 0026_marcar_ejecutado.sql
-- Cambio marcar-ejecutado: registrar en el programa que una partida ya se ejecutó aunque su reporte
-- todavía no exista. Una marca es un realizado sin reporte con origen «marca» y fecha de ejecución
-- opcional. Los reportes emitidos de la misma partida y mes la absorben: cuenta solo lo que esos
-- reportes no cubren, así ejecutar y después documentar no cuenta dos veces. Los realizados
-- importados (marcas R del Excel) y los externos registrados a mano suman como antes.

alter table public.programa_realizados_manuales
	drop constraint if exists programa_realizados_manuales_origen_check;
alter table public.programa_realizados_manuales
	add constraint programa_realizados_manuales_origen_check
	check (origen in ('manual', 'importacion', 'marca'));

-- Día en que se ejecutó, dentro del mes de la marca.
alter table public.programa_realizados_manuales
	add column if not exists fecha_ejecucion date
	check (fecha_ejecucion is null or date_trunc('month', fecha_ejecucion)::date = mes);

-- Mismas columnas que en 0003; las marcas solo suman lo que no cubren los reportes emitidos.
create or replace view public.v_realizado with (security_invoker = true) as
select g.id as programa_id, t.id as partida_id, m.mes,
	coalesce(e.ejecuciones, 0) as ejecuciones_reportes,
	coalesce(manual.otros, 0)
		+ greatest(coalesce(manual.marcas, 0) - coalesce(e.ejecuciones, 0), 0) as cantidad_manual,
	coalesce(e.ejecuciones, 0) + coalesce(manual.otros, 0)
		+ greatest(coalesce(manual.marcas, 0) - coalesce(e.ejecuciones, 0), 0) as realizado,
	coalesce(e.reportes, '[]'::jsonb) as reportes
from public.programas g
join public.partidas t on t.contrato_id = g.contrato_id and t.sitio_id = g.sitio_id
cross join lateral public.meses_del_periodo(g.periodo_inicio, g.periodo_fin) as m(mes)
left join public.v_ejecuciones_reportes e on e.partida_id = t.id and e.mes = m.mes
left join lateral (
	select sum(x.cantidad) filter (where x.origen <> 'marca') as otros,
		sum(x.cantidad) filter (where x.origen = 'marca') as marcas
	from public.programa_realizados_manuales x
	where x.programa_id = g.id and x.partida_id = t.id and x.mes = m.mes
) manual on true;

-- Marca como ejecutada una cantidad de lo que falta en la partida y mes. Las marcas guardan el total
-- ejecutado que se declara en el mes: si los reportes emitidos ya cubren más que las marcas previas,
-- la nueva suma esa diferencia, para que lo marcado se agregue a lo ya documentado.
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
	if fecha_p is not null and date_trunc('month', fecha_p)::date <> mes_p then
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

-- Quita la marca más reciente de la partida y mes.
create or replace function public.api_desmarcar_ejecutado(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	fila public.programa_realizados_manuales;
begin
	delete from public.programa_realizados_manuales
	where id = (
		select x.id from public.programa_realizados_manuales x
		where x.programa_id = (p ->> 'programaId')::uuid and x.partida_id = (p ->> 'partidaId')::uuid
			and x.mes = public.primer_dia_mes((p ->> 'mes')::date) and x.origen = 'marca'
		order by x.registrado_en desc, x.id desc
		limit 1)
	returning * into fila;
	if fila.id is null then
		perform public.error_api('IC404', 'Este mes no tiene una marca de ejecución',
			jsonb_build_object('partidaId', p ->> 'partidaId', 'mes', p ->> 'mes'));
	end if;
	return jsonb_build_object('id', fila.id, 'programaId', fila.programa_id, 'partidaId', fila.partida_id,
		'mes', fila.mes);
end
$$;

-- Partidas y meses del programa con marcas de ejecución (para ofrecer «Desmarcar»).
create or replace function public.api_listar_marcas_ejecucion(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(jsonb_build_object('partidaId', x.partida_id, 'mes', x.mes,
		'marcas', x.marcas) order by x.partida_id, x.mes), '[]'::jsonb)
	from (
		select partida_id, mes, count(*) as marcas
		from public.programa_realizados_manuales
		where programa_id = (p ->> 'programaId')::uuid and origen = 'marca'
		group by partida_id, mes
	) x
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	revoke execute on function public.api_marcar_ejecutado(jsonb),
		public.api_desmarcar_ejecutado(jsonb), public.api_listar_marcas_ejecucion(jsonb)
		from public;
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
