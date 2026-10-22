-- 0016_dias_ejecucion.sql
-- Varios días de ejecución por reporte: `dias_ejecucion` guarda segmentos [{desde, hasta}] en orden,
-- sin traslapes y del mes del periodo (un día suelto tiene desde = hasta, así «15, 16» y «15-16» se
-- distinguen). `fecha_ejecucion` (primer día) y `fecha_ejecucion_fin` (último) se derivan siempre.
-- En las partidas diarias, cada día distinto cubierto por un emitido cuenta como una ejecución.
--
-- Reglas para las migraciones que vuelvan a envolver funciones (0017 a 0019):
-- 1. Renombrar la envoltura vigente a <función>_<NNNN> (NNNN = migración que la definió o envolvió
--    por última vez), con un bloque idempotente, y crear la nueva envoltura con el nombre público.
-- 2. No redefinir nunca un cuerpo renombrado.
-- 3. Quitar del JSON solo las claves que la envoltura atiende y pasar las demás.
-- 4. Escribir después de llamar a la base, en la misma transacción, sin volver a subir la versión, y
--    reconstruir la respuesta con json_reporte.
-- El sufijo con dígitos impide llamar la definición interna desde la aplicación (validarFuncion).

alter table public.reportes
	add column if not exists dias_ejecucion jsonb not null default '[]'::jsonb,
	add column if not exists fecha_ejecucion_fin date;

-- Relleno de los reportes existentes sin tocar actualizado_en ni version.
alter table public.reportes disable trigger reportes_actualizado;
update public.reportes set
	dias_ejecucion = jsonb_build_array(jsonb_build_object('desde', fecha_ejecucion, 'hasta', fecha_ejecucion)),
	fecha_ejecucion_fin = fecha_ejecucion
where fecha_ejecucion is not null and dias_ejecucion = '[]'::jsonb;
alter table public.reportes enable trigger reportes_actualizado;

-- Segmentos válidos del mes `periodo`; devuelve false (no lanza) ante cualquier dato mal formado.
create or replace function public.dias_ejecucion_validos(dias jsonb, periodo date)
returns boolean
language plpgsql
immutable
as $$
declare
	elemento jsonb;
	desde date;
	hasta date;
	anterior date;
begin
	if dias is null or jsonb_typeof(dias) <> 'array' or jsonb_array_length(dias) > 31 then
		return false;
	end if;
	for elemento in select * from jsonb_array_elements(dias) loop
		if jsonb_typeof(elemento) <> 'object'
			or (select count(*) from jsonb_object_keys(elemento)) <> 2
			or jsonb_typeof(elemento -> 'desde') is distinct from 'string'
			or jsonb_typeof(elemento -> 'hasta') is distinct from 'string'
			or elemento ->> 'desde' !~ '^\d{4}-\d{2}-\d{2}$'
			or elemento ->> 'hasta' !~ '^\d{4}-\d{2}-\d{2}$' then
			return false;
		end if;
		begin
			desde := (elemento ->> 'desde')::date;
			hasta := (elemento ->> 'hasta')::date;
		exception when others then
			return false;
		end;
		if to_char(desde, 'YYYY-MM-DD') <> elemento ->> 'desde'
			or to_char(hasta, 'YYYY-MM-DD') <> elemento ->> 'hasta'
			or desde > hasta
			or (anterior is not null and desde <= anterior)
			or public.primer_dia_mes(desde) <> periodo
			or public.primer_dia_mes(hasta) <> periodo then
			return false;
		end if;
		anterior := hasta;
	end loop;
	return true;
end
$$;

alter table public.reportes drop constraint if exists reportes_dias_ejecucion_validos;
alter table public.reportes add constraint reportes_dias_ejecucion_validos
	check (public.dias_ejecucion_validos(dias_ejecucion, periodo_mes));
alter table public.reportes drop constraint if exists reportes_fecha_fin_en_periodo;
alter table public.reportes add constraint reportes_fecha_fin_en_periodo
	check (fecha_ejecucion_fin is null or (public.primer_dia_mes(fecha_ejecucion_fin) = periodo_mes
		and fecha_ejecucion is not null and fecha_ejecucion_fin >= fecha_ejecucion));

-- Un solo trigger: en un alta sin días copia los de la revisión original o convierte la fecha
-- heredada en un segmento de un día; en todo alta o cambio recalcula las fechas derivadas.
create or replace function public.preparar_dias_ejecucion()
returns trigger
language plpgsql
as $$
begin
	if tg_op = 'INSERT' and coalesce(new.dias_ejecucion, '[]'::jsonb) = '[]'::jsonb then
		if new.sustituye_a is not null then
			select dias_ejecucion into new.dias_ejecucion from public.reportes where id = new.sustituye_a;
		elsif new.fecha_ejecucion is not null then
			new.dias_ejecucion := jsonb_build_array(
				jsonb_build_object('desde', new.fecha_ejecucion, 'hasta', new.fecha_ejecucion));
		end if;
	elsif tg_op = 'UPDATE' and new.dias_ejecucion = old.dias_ejecucion
		and new.fecha_ejecucion is distinct from old.fecha_ejecucion then
		-- Ruta heredada que solo conoce la fecha.
		new.dias_ejecucion := case when new.fecha_ejecucion is null then '[]'::jsonb
			else jsonb_build_array(jsonb_build_object('desde', new.fecha_ejecucion, 'hasta', new.fecha_ejecucion)) end;
	end if;
	new.dias_ejecucion := coalesce(new.dias_ejecucion, '[]'::jsonb);
	if new.dias_ejecucion = '[]'::jsonb then
		new.fecha_ejecucion := null;
		new.fecha_ejecucion_fin := null;
	elsif public.dias_ejecucion_validos(new.dias_ejecucion, new.periodo_mes) then
		new.fecha_ejecucion := (new.dias_ejecucion -> 0 ->> 'desde')::date;
		new.fecha_ejecucion_fin := (new.dias_ejecucion -> -1 ->> 'hasta')::date;
	end if;
	-- Con días inválidos no se derivan las fechas: el check responde 23514.
	return new;
end
$$;

drop trigger if exists reportes_dias_ejecucion on public.reportes;
create trigger reportes_dias_ejecucion before insert or update on public.reportes
	for each row execute function public.preparar_dias_ejecucion();

-- Envolturas (D3).
do $$
begin
	if not exists (select 1 from pg_proc where proname = 'json_reporte_0007'
		and pronamespace = 'public'::regnamespace) then
		alter function public.json_reporte(uuid) rename to json_reporte_0007;
	end if;
	if not exists (select 1 from pg_proc where proname = 'api_insertar_reporte_0003'
		and pronamespace = 'public'::regnamespace) then
		alter function public.api_insertar_reporte(jsonb) rename to api_insertar_reporte_0003;
	end if;
	if not exists (select 1 from pg_proc where proname = 'api_guardar_reporte_0003'
		and pronamespace = 'public'::regnamespace) then
		alter function public.api_guardar_reporte(jsonb) rename to api_guardar_reporte_0003;
	end if;
end
$$;

create or replace function public.json_reporte(id_reporte uuid)
returns jsonb
language sql
stable
as $$
	select public.json_reporte_0007(r.id)
		|| jsonb_build_object('diasEjecucion', r.dias_ejecucion, 'fechaEjecucionFin', r.fecha_ejecucion_fin)
	from public.reportes r
	where r.id = id_reporte
$$;

-- Segmentos que pide el JSON: «diasEjecucion» o, en la ruta heredada, «fechaEjecucion» como un día.
create or replace function public.dias_de_entrada(p jsonb)
returns jsonb
language sql
immutable
as $$
	select case
		when p ? 'diasEjecucion' then coalesce(nullif(p -> 'diasEjecucion', 'null'::jsonb), '[]'::jsonb)
		when p ? 'fechaEjecucion' and nullif(p ->> 'fechaEjecucion', '') is not null then
			jsonb_build_array(jsonb_build_object('desde', p ->> 'fechaEjecucion', 'hasta', p ->> 'fechaEjecucion'))
		when p ? 'fechaEjecucion' then '[]'::jsonb
	end
$$;

create or replace function public.api_insertar_reporte(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	dias jsonb := public.dias_de_entrada(p);
	id_reporte uuid := (public.api_insertar_reporte_0003(p - 'diasEjecucion' - 'fechaEjecucion') ->> 'id')::uuid;
begin
	if dias is not null then
		update public.reportes set dias_ejecucion = dias where id = id_reporte;
	end if;
	return public.json_reporte(id_reporte);
end
$$;

create or replace function public.api_guardar_reporte(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	dias jsonb := public.dias_de_entrada(p);
	id_reporte uuid := (p ->> 'id')::uuid;
	resultado jsonb := public.api_guardar_reporte_0003(p - 'diasEjecucion' - 'fechaEjecucion');
begin
	if dias is not null then
		update public.reportes set dias_ejecucion = dias where id = id_reporte;
	end if;
	return jsonb_set(resultado, '{reporte}', public.json_reporte(id_reporte));
end
$$;

-- D4: mismo cuerpo que 0003 salvo la regla de los días.
create or replace function public.api_cambiar_estado(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	actual public.reportes := public.reporte_para_editar((p ->> 'id')::uuid, (p ->> 'version')::integer);
	destino text := p ->> 'estado';
begin
	if not ((actual.estado = 'borrador' and destino = 'en_revision')
		or (actual.estado = 'en_revision' and destino in ('borrador', 'emitido'))) then
		perform public.error_api('IC409', 'Transición de estado no permitida',
			jsonb_build_object('motivo', 'transicion', 'desde', actual.estado, 'hacia', destino));
	end if;
	if destino in ('en_revision', 'emitido') and jsonb_array_length(actual.dias_ejecucion) = 0 then
		perform public.error_api('IC422', 'Faltan los días de ejecución',
			jsonb_build_object('motivo', 'validacion', 'campos', jsonb_build_array('diasEjecucion')));
	end if;
	update public.reportes set
		estado = destino,
		emitido_en = case when destino = 'emitido' then now() else emitido_en end,
		version = version + 1
	where id = actual.id;
	if destino = 'emitido' and actual.sustituye_a is not null then
		update public.reportes set estado = 'sustituido' where id = actual.sustituye_a and estado = 'emitido';
	end if;
	return public.json_reporte(actual.id);
end
$$;

-- D11: en las partidas diarias cuenta los días distintos de los emitidos; en el resto, ocurrencias.
create or replace view public.v_ejecuciones_reportes with (security_invoker = true) as
select r.partida_id, r.periodo_mes as mes,
	case when bool_or(t.periodicidad = 'diaria') then (
		select count(distinct d.dia)
		from public.reportes e
		cross join lateral jsonb_array_elements(e.dias_ejecucion) s(segmento)
		cross join lateral generate_series((s.segmento ->> 'desde')::date, (s.segmento ->> 'hasta')::date,
			interval '1 day') d(dia)
		where e.partida_id = r.partida_id and e.periodo_mes = r.periodo_mes and e.estado = 'emitido'
	) else count(distinct coalesce(r.ocurrencia_tipo || ':' || r.ocurrencia_numero, '')) end as ejecuciones,
	jsonb_agg(r.id order by r.emitido_en) as reportes
from public.reportes r
join public.partidas t on t.id = r.partida_id
where r.estado = 'emitido'
group by r.partida_id, r.periodo_mes;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
