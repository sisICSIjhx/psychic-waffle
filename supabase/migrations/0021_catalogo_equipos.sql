-- 0021_catalogo_equipos.sql
-- Cambio catalogo-equipos-proyecto: el catálogo de equipos (tabla equipos de 0001, que ya da el TAG
-- de partidas y reportes) se amplía con los datos del Excel «Catálogo de equipos»: resolución,
-- clase, ubicación, propietario, responsable, crítico, estado, calibración, proveedor y notas (D1).
-- El TAG pasa a ser único por sitio y nombre (D3) y el guardado es parcial (D4).

-- ---------------------------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------------------------

alter table public.equipos
	add column if not exists tipo_normalizado text generated always as (public.normalizar_clave(tipo)) stored,
	add column if not exists resolucion text,
	add column if not exists clase text,
	add column if not exists ubicacion text,
	add column if not exists propietario text,
	-- Nombre de una persona: no se carga desde semillas versionadas.
	add column if not exists responsable text,
	add column if not exists critico boolean not null default false,
	add column if not exists estado text not null default 'en_servicio',
	add column if not exists intervalo_meses integer,
	add column if not exists ultima_calibracion date,
	add column if not exists proxima_calibracion date,
	add column if not exists proveedor text,
	add column if not exists notas text,
	add column if not exists orden integer not null default 0;

do $$
begin
	if not exists (select 1 from pg_constraint where conname = 'equipos_estado_valido') then
		alter table public.equipos add constraint equipos_estado_valido check (
			estado in ('en_servicio', 'fuera_de_servicio', 'fuera_de_operacion', 'baja')
		);
	end if;
	if not exists (select 1 from pg_constraint where conname = 'equipos_intervalo_valido') then
		alter table public.equipos add constraint equipos_intervalo_valido check (
			intervalo_meses is null or intervalo_meses between 1 and 120
		);
	end if;
	-- El mismo TAG puede nombrar dos instrumentos del lazo (transmisor e indicador magnético).
	if exists (select 1 from pg_constraint where conname = 'equipos_tag_unico') then
		alter table public.equipos drop constraint equipos_tag_unico;
	end if;
	if not exists (select 1 from pg_constraint where conname = 'equipos_tag_nombre_unico') then
		alter table public.equipos add constraint equipos_tag_nombre_unico
			unique (sitio_id, tag_normalizado, tipo_normalizado);
	end if;
end
$$;

-- Orden de los equipos existentes: el de su TAG dentro del sitio.
update public.equipos e set orden = o.posicion
from (
	select id, row_number() over (partition by sitio_id order by tag_normalizado, tipo_normalizado) as posicion
	from public.equipos
) o
where e.id = o.id and e.orden = 0;

create index if not exists equipos_sitio_orden_idx on public.equipos (sitio_id, orden);

-- ---------------------------------------------------------------------------------------------
-- Representación JSON del catálogo (json_equipo de 0001 sigue igual para partidas y reportes)
-- ---------------------------------------------------------------------------------------------

create or replace function public.json_equipo_catalogo(e public.equipos)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', e.id, 'sitioId', e.sitio_id,
		'sitio', (select jsonb_build_object('id', s.id, 'clave', s.clave, 'nombre', s.nombre)
			from public.sitios s where s.id = e.sitio_id),
		'tag', e.tag, 'tipo', e.tipo, 'marca', e.marca, 'modelo', e.modelo, 'numeroSerie', e.numero_serie,
		'rango', e.rango, 'resolucion', e.resolucion, 'clase', e.clase, 'ubicacion', e.ubicacion,
		'propietario', e.propietario, 'responsable', e.responsable, 'critico', e.critico,
		'estado', e.estado, 'intervaloMeses', e.intervalo_meses,
		'ultimaCalibracion', e.ultima_calibracion, 'proximaCalibracion', e.proxima_calibracion,
		'proveedor', e.proveedor, 'notas', e.notas, 'orden', e.orden,
		'enUso', exists (select 1 from public.partida_equipos pe where pe.equipo_id = e.id)
			or exists (select 1 from public.reporte_equipos re where re.equipo_id = e.id),
		'actualizadoEn', e.actualizado_en
	)
$$;

-- ---------------------------------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------------------------------

-- Alta o edición. Solo cambian los campos presentes en la carga (D4): la ficha del contrato envía
-- TAG, tipo, marca, modelo, rango y serie, y no borra la calibración. Devuelve el JSON de 0001;
-- el catálogo usa api_obtener_equipo.
create or replace function public.api_guardar_equipo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_equipo uuid := coalesce((p ->> 'id')::uuid, gen_random_uuid());
	actual public.equipos;
	existe boolean;
	id_sitio uuid;
	tag_equipo text;
	tipo_equipo text;
	estado_equipo text;
	intervalo integer;
	existente uuid;
	fila public.equipos;
begin
	select * into actual from public.equipos where id = id_equipo for update;
	existe := found;
	id_sitio := coalesce((p ->> 'sitioId')::uuid, actual.sitio_id);
	tag_equipo := case when not existe or p ? 'tag' then public.texto_o_nulo(p ->> 'tag') else actual.tag end;
	tipo_equipo := case when not existe or p ? 'tipo' then public.texto_o_nulo(p ->> 'tipo') else actual.tipo end;

	if id_sitio is null or not exists (select 1 from public.sitios where id = id_sitio) then
		perform public.error_api('IC404', 'Sitio no encontrado', jsonb_build_object('sitioId', p ->> 'sitioId'));
	end if;
	if tag_equipo is null then
		perform public.error_api('IC422', 'Escriba el TAG (Equipo ID)', jsonb_build_object('motivo', 'tag'));
	end if;
	if existe and id_sitio <> actual.sitio_id
		and (exists (select 1 from public.partida_equipos where equipo_id = id_equipo)
			or exists (select 1 from public.reporte_equipos where equipo_id = id_equipo)) then
		perform public.error_api('IC409', 'El equipo está en partidas o reportes y no puede cambiar de sitio',
			jsonb_build_object('motivo', 'en_uso'));
	end if;
	if p ? 'estado' then
		estado_equipo := coalesce(public.texto_o_nulo(p ->> 'estado'), 'en_servicio');
		if estado_equipo not in ('en_servicio', 'fuera_de_servicio', 'fuera_de_operacion', 'baja') then
			perform public.error_api('IC422', 'Estado del equipo no válido',
				jsonb_build_object('motivo', 'estado', 'estado', estado_equipo));
		end if;
	end if;
	if p ? 'intervaloMeses' then
		intervalo := (p ->> 'intervaloMeses')::integer;
		if intervalo is not null and (intervalo < 1 or intervalo > 120) then
			perform public.error_api('IC422', 'El intervalo debe estar entre 1 y 120 meses',
				jsonb_build_object('motivo', 'intervalo'));
		end if;
	end if;

	select id into existente from public.equipos
	where sitio_id = id_sitio
		and tag_normalizado = public.normalizar_clave(tag_equipo)
		and tipo_normalizado = public.normalizar_clave(tipo_equipo)
		and id <> id_equipo;
	if existente is not null then
		perform public.error_api('IC422', 'Ya existe un equipo con ese TAG y nombre en el sitio',
			jsonb_build_object('motivo', 'equipo_duplicado', 'equipoId', existente, 'tag', tag_equipo));
	end if;

	if not existe then
		-- Serializa las altas del sitio para que el orden no se repita.
		perform 1 from public.sitios where id = id_sitio for update;
		insert into public.equipos (id, sitio_id, tag, tipo, orden)
		values (id_equipo, id_sitio, tag_equipo, tipo_equipo, coalesce((p ->> 'orden')::integer,
			(select coalesce(max(orden), 0) + 1 from public.equipos where sitio_id = id_sitio)));
	end if;

	update public.equipos set
		sitio_id = id_sitio,
		tag = tag_equipo,
		tipo = tipo_equipo,
		marca = case when p ? 'marca' then public.texto_o_nulo(p ->> 'marca') else marca end,
		modelo = case when p ? 'modelo' then public.texto_o_nulo(p ->> 'modelo') else modelo end,
		numero_serie = case when p ? 'numeroSerie' then public.texto_o_nulo(p ->> 'numeroSerie') else numero_serie end,
		rango = case when p ? 'rango' then public.texto_o_nulo(p ->> 'rango') else rango end,
		resolucion = case when p ? 'resolucion' then public.texto_o_nulo(p ->> 'resolucion') else resolucion end,
		clase = case when p ? 'clase' then public.texto_o_nulo(p ->> 'clase') else clase end,
		ubicacion = case when p ? 'ubicacion' then public.texto_o_nulo(p ->> 'ubicacion') else ubicacion end,
		propietario = case when p ? 'propietario' then public.texto_o_nulo(p ->> 'propietario') else propietario end,
		responsable = case when p ? 'responsable' then public.texto_o_nulo(p ->> 'responsable') else responsable end,
		critico = case when p ? 'critico' then coalesce((p ->> 'critico')::boolean, false) else critico end,
		estado = coalesce(estado_equipo, estado),
		intervalo_meses = case when p ? 'intervaloMeses' then intervalo else intervalo_meses end,
		ultima_calibracion = case when p ? 'ultimaCalibracion'
			then public.texto_o_nulo(p ->> 'ultimaCalibracion')::date else ultima_calibracion end,
		proxima_calibracion = case when p ? 'proximaCalibracion'
			then public.texto_o_nulo(p ->> 'proximaCalibracion')::date else proxima_calibracion end,
		proveedor = case when p ? 'proveedor' then public.texto_o_nulo(p ->> 'proveedor') else proveedor end,
		notas = case when p ? 'notas' then public.texto_o_nulo(p ->> 'notas') else notas end,
		orden = case when existe and p ? 'orden' then (p ->> 'orden')::integer else orden end
	where id = id_equipo
	returning * into fila;
	return public.json_equipo(fila);
end
$$;

-- Los de 0001 (por sitio) siguen el orden del catálogo.
create or replace function public.api_listar_equipos(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_equipo(e) order by e.orden, e.tag_normalizado), '[]'::jsonb)
	from public.equipos e
	where e.sitio_id = (p ->> 'sitioId')::uuid
$$;

-- Equipos de un proyecto (cliente): los de los sitios de sus contratos (D2).
create or replace function public.api_listar_equipos_proyecto(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_equipo_catalogo(e)
		order by public.normalizar_clave(s.clave), e.orden, e.tag_normalizado, e.tipo_normalizado), '[]'::jsonb)
	from public.equipos e
	join public.sitios s on s.id = e.sitio_id
	where e.sitio_id in (
		select ks.sitio_id from public.contrato_sitios ks
		join public.contratos k on k.id = ks.contrato_id
		where k.cliente_id = (p ->> 'clienteId')::uuid
	)
$$;

-- Sitios de un proyecto, para el alta y la importación.
create or replace function public.api_listar_sitios_proyecto(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_sitio(s) order by public.normalizar_clave(s.clave)), '[]'::jsonb)
	from public.sitios s
	where s.id in (
		select ks.sitio_id from public.contrato_sitios ks
		join public.contratos k on k.id = ks.contrato_id
		where k.cliente_id = (p ->> 'clienteId')::uuid
	)
$$;

create or replace function public.api_obtener_equipo(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
	fila public.equipos;
begin
	select * into fila from public.equipos where id = (p ->> 'id')::uuid;
	if not found then
		perform public.error_api('IC404', 'Equipo no encontrado', jsonb_build_object('id', p ->> 'id'));
	end if;
	return public.json_equipo_catalogo(fila);
end
$$;

-- Solo si no está en partidas ni reportes (D6); si lo está, se marca «Dado de baja».
create or replace function public.api_eliminar_equipo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_equipo uuid := (p ->> 'id')::uuid;
begin
	if not exists (select 1 from public.equipos where id = id_equipo) then
		perform public.error_api('IC404', 'Equipo no encontrado', jsonb_build_object('id', id_equipo));
	end if;
	if exists (select 1 from public.partida_equipos where equipo_id = id_equipo)
		or exists (select 1 from public.reporte_equipos where equipo_id = id_equipo) then
		perform public.error_api('IC409',
			'El equipo está en partidas o reportes; márquelo «Dado de baja» en lugar de eliminarlo',
			jsonb_build_object('motivo', 'en_uso'));
	end if;
	delete from public.equipos where id = id_equipo;
	return jsonb_build_object('id', id_equipo);
end
$$;

-- Importación del Excel en un sitio (D7): empareja por TAG y nombre; los existentes se actualizan
-- con los campos del Excel y los nuevos se crean, en el orden del archivo. Con «ensayo» solo cuenta.
-- Una fila repetida en el archivo (mismo TAG y nombre) se omite y se informa.
create or replace function public.api_importar_equipos(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_sitio uuid := (p ->> 'sitioId')::uuid;
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	e jsonb;
	posicion bigint;
	existente uuid;
	clave text;
	vistas text[] := '{}';
	nuevos integer := 0;
	actualizados integer := 0;
	repetidas jsonb := '[]'::jsonb;
begin
	if id_sitio is null or not exists (select 1 from public.sitios where id = id_sitio) then
		perform public.error_api('IC404', 'Sitio no encontrado', jsonb_build_object('sitioId', p ->> 'sitioId'));
	end if;
	for e, posicion in
		select valor, orden from jsonb_array_elements(coalesce(p -> 'equipos', '[]'::jsonb))
			with ordinality as x(valor, orden)
	loop
		clave := public.normalizar_clave(e ->> 'tag') || '|' || public.normalizar_clave(e ->> 'tipo');
		if clave = any (vistas) then
			repetidas := repetidas || jsonb_build_array(jsonb_build_object('fila', e -> 'fila', 'tag', e ->> 'tag'));
			continue;
		end if;
		vistas := vistas || clave;
		select id into existente from public.equipos
		where sitio_id = id_sitio
			and tag_normalizado = public.normalizar_clave(e ->> 'tag')
			and tipo_normalizado = public.normalizar_clave(e ->> 'tipo');
		if existente is null then nuevos := nuevos + 1; else actualizados := actualizados + 1; end if;
		if not ensayo then
			perform public.api_guardar_equipo((e - 'fila') || jsonb_build_object(
				'id', existente, 'sitioId', id_sitio, 'orden', posicion));
		end if;
	end loop;
	return jsonb_build_object('ensayo', ensayo, 'nuevos', nuevos, 'actualizados', actualizados,
		'repetidas', repetidas);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Seguridad (política de 0004): las funciones nuevas, solo para el rol de servicio
-- ---------------------------------------------------------------------------------------------

do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
