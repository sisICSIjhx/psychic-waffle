-- Captura manual del seguimiento por centro de costo y mes.
create table public.seguimiento_meses (
	id uuid primary key default gen_random_uuid(),
	sitio_id uuid not null references public.sitios (id) on delete restrict,
	mes date not null check (extract(day from mes) = 1),
	plantilla_id uuid references public.plantillas_seguimiento (id) on delete restrict,
	origen text not null check (origen in ('programa_anual', 'mensual', 'ninguno')),
	unique (sitio_id, mes)
);

create table public.seguimiento_actividades (
	mes_id uuid not null references public.seguimiento_meses (id) on delete restrict,
	clave text not null,
	nombre text not null check (btrim(nombre) <> ''),
	ordinal integer check (ordinal > 0),
	fecha date,
	ejecutada boolean not null default false,
	primary key (mes_id, clave)
);

create table public.seguimiento_valores (
	mes_id uuid not null references public.seguimiento_meses (id) on delete restrict,
	actividad text,
	concepto_id uuid not null references public.plantilla_conceptos (id) on delete restrict,
	valor jsonb not null,
	foreign key (mes_id, actividad) references public.seguimiento_actividades (mes_id, clave) on delete restrict,
	unique nulls not distinct (mes_id, actividad, concepto_id)
);
create index seguimiento_valores_concepto_idx on public.seguimiento_valores (concepto_id);

create table public.seguimiento_nocturnas (
	mes_id uuid not null references public.seguimiento_meses (id) on delete restrict,
	id uuid not null,
	fecha date not null,
	descripcion text not null check (length(btrim(descripcion)) between 1 and 1000),
	primary key (mes_id, id)
);

create table public.seguimiento_carpetas (
	mes_id uuid not null references public.seguimiento_meses (id) on delete restrict,
	concepto_id uuid not null references public.plantilla_conceptos (id) on delete restrict,
	estado text not null check (estado in ('pendiente', 'en_proceso', 'entregada')),
	entrega_id uuid references public.personal (id) on delete restrict,
	recibe text,
	fecha date,
	enlace text,
	archivo_nombre text,
	archivo bytea,
	version integer not null default 1,
	primary key (mes_id, concepto_id),
	check ((archivo is null) = (archivo_nombre is null)),
	check (archivo is null or (enlace is null and octet_length(archivo) between 1 and 8388608)),
	check (estado <> 'entregada' or (entrega_id is not null and recibe is not null
		and fecha is not null and (enlace is not null or archivo is not null)))
);
create index seguimiento_carpetas_concepto_idx on public.seguimiento_carpetas (concepto_id);

create function public.validar_concepto_con_seguimiento()
returns trigger language plpgsql as $$
begin
	if (new.plantilla_id, new.bloque, new.tipo, new.nivel)
		is distinct from (old.plantilla_id, old.bloque, old.tipo, old.nivel)
		and (exists (select 1 from public.seguimiento_valores where concepto_id = old.id)
			or exists (select 1 from public.seguimiento_carpetas where concepto_id = old.id)) then
		perform public.error_api('IC409', 'El concepto tiene datos de seguimiento. Conserve su tipo, bloque y nivel.');
	end if;
	return new;
end
$$;
create trigger concepto_con_seguimiento before update on public.plantilla_conceptos
	for each row execute function public.validar_concepto_con_seguimiento();

create function public.conceptos_seguimiento_operativo(plantilla uuid)
returns setof public.plantilla_conceptos language sql stable as $$
	select c.* from public.plantilla_conceptos c
	where c.plantilla_id = plantilla
		and c.bloque in ('programa', 'documentos', 'carpetas')
		and c.tipo <> 'monto'
$$;

create function public.actividades_seguimiento(sitio uuid, periodo date, fuente text, id_mes uuid)
returns table (clave text, nombre text, ordinal integer, fecha date, ejecutada boolean, programada boolean)
language sql stable as $$
	with anuales as (
		select concat('a:', g.id, ':', m.partida_id, ':', n.ordinal) as clave,
			concat(t.numero, ' · ', coalesce(t.nombre_corto, t.actividad)) as nombre, n.ordinal
		from public.programa_meses m
		join public.programas g on g.id = m.programa_id
		join public.partidas t on t.id = m.partida_id
		cross join lateral generate_series(1, ceil(m.cantidad)::integer) n(ordinal)
		where fuente = 'programa_anual' and g.sitio_id = sitio and m.mes = periodo
	), guardadas as (
		select a.* from public.seguimiento_actividades a where a.mes_id = id_mes
	)
	select p.clave, p.nombre, p.ordinal, null::date, coalesce(a.ejecutada, false), true
	from anuales p left join guardadas a on a.clave = p.clave
	union all
	select a.clave, a.nombre, a.ordinal, a.fecha, a.ejecutada, a.ordinal is null
	from guardadas a where not exists (select 1 from anuales p where p.clave = a.clave)
$$;

create function public.api_obtener_seguimiento_operativo(p jsonb)
returns jsonb language plpgsql stable as $$
declare
	centro public.sitios;
	seguimiento public.seguimiento_meses;
	plantilla uuid;
	origen text;
	periodo date := (p ->> 'mes')::date;
begin
	select * into centro from public.sitios where id = (p ->> 'sitioId')::uuid;
	if not found then perform public.error_api('IC404', 'No encontrado'); end if;
	select * into seguimiento from public.seguimiento_meses where sitio_id = centro.id and mes = periodo;
	if seguimiento.plantilla_id is not null then
		plantilla := seguimiento.plantilla_id;
		origen := seguimiento.origen;
	else
		plantilla := centro.plantilla_id;
		select origen_actividades into origen from public.plantillas_seguimiento where id = plantilla;
		origen := coalesce(origen, 'ninguno');
	end if;

	return jsonb_build_object(
		'origen', origen, 'plantillaId', plantilla,
		'conceptos', coalesce((select jsonb_agg(jsonb_build_object(
			'id', c.id, 'bloque', c.bloque, 'nivel', c.nivel, 'tipo', c.tipo, 'etiqueta', c.etiqueta
		) order by public.orden_bloque(c.bloque), c.orden)
			from public.conceptos_seguimiento_operativo(plantilla) c), '[]'::jsonb),
		'actividades', coalesce((select jsonb_agg(to_jsonb(a) order by a.fecha nulls last,
			a.nombre, a.ordinal, a.clave)
			from public.actividades_seguimiento(centro.id, periodo, origen, seguimiento.id) a), '[]'::jsonb),
		'valores', coalesce((select jsonb_agg(jsonb_build_object(
			'actividad', v.actividad, 'conceptoId', v.concepto_id, 'valor', v.valor))
			from public.seguimiento_valores v where v.mes_id = seguimiento.id), '[]'::jsonb),
		'nocturnas', coalesce((select jsonb_agg(jsonb_build_object(
			'id', n.id, 'fecha', n.fecha, 'descripcion', n.descripcion) order by n.fecha, n.id)
			from public.seguimiento_nocturnas n where n.mes_id = seguimiento.id), '[]'::jsonb),
		'carpetas', coalesce((select jsonb_agg(jsonb_build_object(
			'conceptoId', c.concepto_id, 'estado', c.estado, 'entregaId', c.entrega_id,
			'entregaNombre', case when s.id is not null then concat_ws(' ', s.nombre, s.apellido_paterno, s.apellido_materno) end,
			'recibe', c.recibe, 'fecha', c.fecha, 'enlace', c.enlace,
			'archivoNombre', c.archivo_nombre, 'version', c.version))
			from public.seguimiento_carpetas c left join public.personal s on s.id = c.entrega_id
			where c.mes_id = seguimiento.id), '[]'::jsonb),
		'personal', coalesce((select jsonb_agg(jsonb_build_object(
			'id', s.id, 'nombre', concat_ws(' ', s.nombre, s.apellido_paterno, s.apellido_materno))
			order by s.nombre, s.apellido_paterno, s.id)
			from public.personal s where s.activo and p ->> 'incluirPersonal' = 'true'
				and exists (select 1 from public.conceptos_seguimiento_operativo(plantilla) c
					where c.bloque = 'carpetas')), '[]'::jsonb)
	);
end
$$;

create function public.guardar_carpeta_seguimiento(id_mes uuid, plantilla uuid, p jsonb)
returns void language plpgsql as $$
declare
	concepto uuid := (p ->> 'conceptoId')::uuid;
	actual public.seguimiento_carpetas;
	enlace text := public.texto_o_nulo(p ->> 'enlace');
	recibe text := public.texto_o_nulo(p ->> 'recibe');
	entrega uuid := (p ->> 'entregaId')::uuid;
	fecha date := (p ->> 'fecha')::date;
	estado text := p ->> 'estado';
	nombre text;
	archivo bytea;
begin
	perform 1 from public.conceptos_seguimiento_operativo(plantilla) c
	where c.id = concepto and c.bloque = 'carpetas';
	if not found then perform public.error_api('IC404', 'Carpeta no encontrada'); end if;
	select c.* into actual from public.seguimiento_carpetas c
	where c.mes_id = id_mes and c.concepto_id = concepto;
	if coalesce(actual.version, 0) is distinct from (p ->> 'version')::integer then
		perform public.error_api('IC409', 'La carpeta cambió. Revise sus datos actualizados antes de guardar.');
	end if;
	if entrega is not null and entrega is distinct from actual.entrega_id
		and not exists (select 1 from public.personal where id = entrega and activo) then
		perform public.error_api('IC422', 'Seleccione a una persona activa para la entrega.');
	end if;
	if enlace is not null and (length(enlace) > 2048 or enlace !~
		'^https://[A-Za-z0-9-]+\.sharepoint\.(com|us|de|cn)([/?#]|$)') then
		perform public.error_api('IC422', 'Ingrese un enlace HTTPS de SharePoint.');
	end if;
	if p ->> 'archivo' is not null then
		if enlace is not null then perform public.error_api('IC422', 'Use un enlace o un archivo para la carpeta.'); end if;
		nombre := public.texto_o_nulo(p ->> 'archivoNombre');
		archivo := decode(p ->> 'archivo', 'base64');
		if nombre is null or length(nombre) > 255 or octet_length(archivo) not between 1 and 8388608 then
			perform public.error_api('IC422', 'Seleccione un archivo válido de hasta 8 MiB.');
		end if;
	elsif enlace is null and p ->> 'quitarArchivo' is distinct from 'true' then
		nombre := actual.archivo_nombre;
		archivo := actual.archivo;
	end if;
	if estado = 'entregada' and (entrega is null or recibe is null or fecha is null
		or (enlace is null and archivo is null)) then
		perform public.error_api('IC422', 'Para completar la entrega, indique quién entrega, quién recibe, la fecha y un enlace o archivo.');
	end if;
	insert into public.seguimiento_carpetas as c
		(mes_id, concepto_id, estado, entrega_id, recibe, fecha, enlace, archivo_nombre, archivo)
	values (id_mes, concepto, estado, entrega, recibe, fecha, enlace, nombre, archivo)
	on conflict (mes_id, concepto_id) do update set estado = excluded.estado,
		entrega_id = excluded.entrega_id, recibe = excluded.recibe, fecha = excluded.fecha,
		enlace = excluded.enlace, archivo_nombre = excluded.archivo_nombre, archivo = excluded.archivo,
		version = c.version + 1;
end
$$;

create function public.api_guardar_seguimiento_operativo(p jsonb)
returns jsonb language plpgsql as $$
declare
	centro public.sitios;
	seguimiento public.seguimiento_meses;
	periodo date := (p ->> 'mes')::date;
	accion text := p ->> 'accion';
	fila text := p ->> 'actividad';
	concepto public.plantilla_conceptos;
	valor jsonb := nullif(p -> 'valor', 'null'::jsonb);
	fecha_captura date := (p ->> 'fecha')::date;
begin
	-- La plantilla asignada y todas las capturas de un centro se escriben en orden.
	select * into centro from public.sitios where id = (p ->> 'sitioId')::uuid for update;
	if not found then perform public.error_api('IC404', 'No encontrado'); end if;
	insert into public.seguimiento_meses as s (sitio_id, mes, plantilla_id, origen)
	select centro.id, periodo, centro.plantilla_id, coalesce((
		select origen_actividades from public.plantillas_seguimiento where id = centro.plantilla_id
	), 'ninguno') on conflict (sitio_id, mes) do update
	set plantilla_id = excluded.plantilla_id, origen = excluded.origen
	where s.plantilla_id is null and excluded.plantilla_id is not null;
	select * into seguimiento from public.seguimiento_meses where sitio_id = centro.id and mes = periodo;
	-- La edición de una plantilla no puede reinterpretar un concepto durante el guardado.
	perform 1 from public.plantillas_seguimiento where id = seguimiento.plantilla_id for share;
	perform 1 from public.conceptos_seguimiento_operativo(seguimiento.plantilla_id) c
		join public.plantilla_conceptos t on t.id = c.id order by t.id for share of t;
	if p ? 'plantillaId' and seguimiento.plantilla_id is distinct from (p ->> 'plantillaId')::uuid then
		perform public.error_api('IC409', 'Cambió la plantilla de seguimiento. Revise el mes actualizado.');
	end if;

	if accion in ('nuevaActividad', 'editarActividad', 'nuevaNocturna') and fecha_captura is not null
		and public.primer_dia_mes(fecha_captura) <> periodo then
		perform public.error_api('IC422', 'La fecha debe pertenecer al mes seleccionado.');
	end if;
	if accion in ('nuevaActividad', 'editarActividad', 'quitarActividad') then
		if seguimiento.origen <> 'mensual' then
			perform public.error_api('IC422', 'La plantilla no permite capturar actividades del mes.');
		end if;
		if accion = 'nuevaActividad' then
			insert into public.seguimiento_actividades (mes_id, clave, nombre, fecha)
			values (seguimiento.id, 'm:' || (p ->> 'id')::uuid, btrim(p ->> 'nombre'), fecha_captura)
			on conflict (mes_id, clave) do nothing;
		elsif accion = 'editarActividad' then
			update public.seguimiento_actividades set nombre = btrim(p ->> 'nombre'), fecha = fecha_captura
			where mes_id = seguimiento.id and clave = fila and ordinal is null;
			if not found then perform public.error_api('IC404', 'Actividad no encontrada'); end if;
		else
			delete from public.seguimiento_actividades a
			where a.mes_id = seguimiento.id and a.clave = fila and a.ordinal is null and not a.ejecutada
				and not exists (select 1 from public.seguimiento_valores v
					where v.mes_id = a.mes_id and v.actividad = a.clave);
			if not found then perform public.error_api('IC409', 'La actividad no existe o ya tiene seguimiento.'); end if;
		end if;
	elsif accion = 'nuevaNocturna' then
		insert into public.seguimiento_nocturnas (mes_id, id, fecha, descripcion)
		values (seguimiento.id, (p ->> 'id')::uuid, fecha_captura, btrim(p ->> 'descripcion'))
		on conflict (mes_id, id) do nothing;
	elsif accion = 'quitarNocturna' then
		delete from public.seguimiento_nocturnas where mes_id = seguimiento.id and id = (p ->> 'id')::uuid;
	elsif accion = 'carpeta' then
		perform public.guardar_carpeta_seguimiento(seguimiento.id, seguimiento.plantilla_id, p);
	elsif accion in ('ejecucion', 'valor', 'marcarFila', 'marcarMes') then
		if fila is not null or accion = 'marcarMes' then
			insert into public.seguimiento_actividades (mes_id, clave, nombre, ordinal, fecha)
			select seguimiento.id, a.clave, a.nombre, a.ordinal, a.fecha
			from public.actividades_seguimiento(centro.id, periodo, seguimiento.origen, seguimiento.id) a
			where accion = 'marcarMes' or a.clave = fila
			on conflict (mes_id, clave) do nothing;
		end if;
		if accion in ('ejecucion', 'marcarFila') or fila is not null then
			if not exists (select 1 from public.seguimiento_actividades where mes_id = seguimiento.id and clave = fila) then
				perform public.error_api('IC404', 'Actividad no encontrada');
			end if;
		end if;
		if accion = 'ejecucion' then
			update public.seguimiento_actividades set ejecutada = (p ->> 'valor')::boolean
			where mes_id = seguimiento.id and clave = fila;
		elsif accion = 'valor' then
			select c.* into concepto from public.conceptos_seguimiento_operativo(seguimiento.plantilla_id) c
			where c.id = (p ->> 'conceptoId')::uuid and c.bloque <> 'carpetas'
				and c.nivel = case when fila is null then 'periodo' else 'actividad' end;
			if not found then perform public.error_api('IC404', 'Concepto no encontrado'); end if;
			if valor is not null and not (case concepto.tipo
				when 'casilla' then jsonb_typeof(valor) = 'boolean'
				when 'estado' then valor #>> '{}' in ('pendiente', 'en_proceso', 'hecho')
				when 'cantidad' then case when jsonb_typeof(valor) = 'number' then (valor #>> '{}')::numeric >= 0 else false end
				when 'fecha' then jsonb_typeof(valor) = 'string' and (valor #>> '{}')::date is not null
				when 'enlace' then jsonb_typeof(valor) = 'string' and (valor #>> '{}') ~ '^https://'
				when 'texto' then jsonb_typeof(valor) = 'string'
				else false end) then
				perform public.error_api('IC422', 'El valor no corresponde al tipo de concepto.');
			end if;
			if valor is null or valor = 'false'::jsonb or valor = '"pendiente"'::jsonb then
				delete from public.seguimiento_valores v where v.mes_id = seguimiento.id
					and v.actividad is not distinct from fila and v.concepto_id = concepto.id;
			else
				insert into public.seguimiento_valores (mes_id, actividad, concepto_id, valor)
				values (seguimiento.id, fila, concepto.id, valor)
				on conflict (mes_id, actividad, concepto_id) do update set valor = excluded.valor;
			end if;
		else
			update public.seguimiento_actividades set ejecutada = true
			where mes_id = seguimiento.id and (accion = 'marcarMes' or clave = fila);
			insert into public.seguimiento_valores (mes_id, actividad, concepto_id, valor)
			select seguimiento.id, destinos.clave, c.id,
				case when c.tipo = 'casilla' then 'true'::jsonb else '"hecho"'::jsonb end
			from public.conceptos_seguimiento_operativo(seguimiento.plantilla_id) c
			join lateral (
				select a.clave from public.seguimiento_actividades a where a.mes_id = seguimiento.id
					and c.nivel = 'actividad' and (accion = 'marcarMes' or a.clave = fila)
				union all
				select null::text where c.nivel = 'periodo' and accion = 'marcarMes'
			) destinos on true
			where c.tipo in ('casilla', 'estado')
			on conflict (mes_id, actividad, concepto_id) do update set valor = excluded.valor;
		end if;
	else
		perform public.error_api('IC422', 'Operación de seguimiento no válida.');
	end if;
	return '{}'::jsonb;
end
$$;

create function public.api_archivo_carpeta_seguimiento(p jsonb)
returns jsonb language sql stable as $$
	select jsonb_build_object('nombre', c.archivo_nombre, 'datos', encode(c.archivo, 'base64'))
	from public.seguimiento_carpetas c join public.seguimiento_meses m on m.id = c.mes_id
	where m.sitio_id = (p ->> 'sitioId')::uuid and m.mes = (p ->> 'mes')::date
		and c.concepto_id = (p ->> 'conceptoId')::uuid and c.archivo is not null
$$;

do $$
declare
	tabla text;
begin
	foreach tabla in array array['seguimiento_meses', 'seguimiento_actividades', 'seguimiento_valores',
		'seguimiento_nocturnas', 'seguimiento_carpetas'] loop
		execute format('alter table public.%I enable row level security', tabla);
		if exists (select 1 from pg_roles where rolname = 'service_role') then
			execute format('revoke all on public.%I from public, anon, authenticated', tabla);
			execute format('grant select, insert, update, delete on public.%I to service_role', tabla);
			execute format('create policy servicio_acceso_total on public.%I for all to service_role using (true) with check (true)', tabla);
		end if;
	end loop;
	revoke execute on function public.validar_concepto_con_seguimiento(),
		public.conceptos_seguimiento_operativo(uuid), public.actividades_seguimiento(uuid, date, text, uuid),
		public.guardar_carpeta_seguimiento(uuid, uuid, jsonb), public.api_obtener_seguimiento_operativo(jsonb),
		public.api_guardar_seguimiento_operativo(jsonb), public.api_archivo_carpeta_seguimiento(jsonb) from public;
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
