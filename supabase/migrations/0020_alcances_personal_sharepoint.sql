-- 0020_alcances_personal_sharepoint.sql
-- Cambio alcances-personal-esquema-bd: biblioteca de alcances predeterminados por proyecto (el
-- proyecto es el cliente, D1), personal con rol y proyectos (D3) y fotos guardadas en SharePoint, de
-- las que la base solo conserva la URL (D4).
--
-- Parte de: json_foto (0017), api_agregar_foto (0003) y api_crear_revision_0003 (0003, renombrada en
-- 0017). Las tres se redefinen completas porque la copia de fotos debe llevar las columnas nuevas.

-- ---------------------------------------------------------------------------------------------
-- Alcances predeterminados
-- ---------------------------------------------------------------------------------------------

create table if not exists public.alcances_predeterminados (
	id uuid primary key default gen_random_uuid(),
	cliente_id uuid not null references public.clientes (id) on delete cascade,
	tipo text not null default 'alcance' check (tipo in ('alcance', 'nota', 'norma')),
	grupo text,
	texto text not null check (btrim(texto) <> ''),
	texto_normalizado text generated always as (public.normalizar_clave(texto)) stored,
	orden integer not null check (orden > 0),
	activo boolean not null default true,
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint alcances_predeterminados_unico unique (cliente_id, tipo, texto_normalizado)
);
create index if not exists alcances_predeterminados_cliente_idx
	on public.alcances_predeterminados (cliente_id, orden);

drop trigger if exists alcances_predeterminados_actualizado on public.alcances_predeterminados;
create trigger alcances_predeterminados_actualizado before update on public.alcances_predeterminados
	for each row execute function public.tocar_actualizado_en();

create or replace function public.json_alcance_predeterminado(a public.alcances_predeterminados)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', a.id, 'clienteId', a.cliente_id, 'tipo', a.tipo, 'grupo', a.grupo, 'texto', a.texto,
		'orden', a.orden, 'activo', a.activo
	)
$$;

-- Biblioteca de un proyecto (o de todos), agrupada y en el orden de alta.
create or replace function public.api_listar_alcances_predeterminados(p jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_alcance_predeterminado(a)
		order by public.normalizar_clave(coalesce(a.grupo, '')), a.orden), '[]'::jsonb)
	from public.alcances_predeterminados a
	where (p ->> 'clienteId' is null or a.cliente_id = (p ->> 'clienteId')::uuid)
		and (coalesce((p ->> 'soloActivos')::boolean, false) = false or a.activo)
$$;

-- Alta o edición; el proyecto no cambia en una edición. Mismo texto y tipo = duplicado.
create or replace function public.api_guardar_alcance_predeterminado(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_alcance uuid := (p ->> 'id')::uuid;
	actual public.alcances_predeterminados;
	id_cliente uuid;
	tipo_alcance text := coalesce(public.texto_o_nulo(p ->> 'tipo'), 'alcance');
	texto_alcance text := public.texto_o_nulo(p ->> 'texto');
	fila public.alcances_predeterminados;
begin
	if id_alcance is not null then
		select * into actual from public.alcances_predeterminados where id = id_alcance for update;
		if not found then
			perform public.error_api('IC404', 'Alcance predeterminado no encontrado',
				jsonb_build_object('id', id_alcance));
		end if;
		id_cliente := actual.cliente_id;
	else
		id_cliente := (p ->> 'clienteId')::uuid;
		if id_cliente is null or not exists (select 1 from public.clientes where id = id_cliente) then
			perform public.error_api('IC404', 'Proyecto no encontrado',
				jsonb_build_object('clienteId', p ->> 'clienteId'));
		end if;
	end if;
	if texto_alcance is null then
		perform public.error_api('IC422', 'Escriba el texto del alcance',
			jsonb_build_object('motivo', 'texto_vacio'));
	end if;
	if tipo_alcance not in ('alcance', 'nota', 'norma') then
		perform public.error_api('IC422', 'Tipo de alcance no válido',
			jsonb_build_object('motivo', 'tipo', 'tipo', tipo_alcance));
	end if;
	if exists (select 1 from public.alcances_predeterminados
		where cliente_id = id_cliente and tipo = tipo_alcance
			and texto_normalizado = public.normalizar_clave(texto_alcance)
			and id is distinct from id_alcance) then
		perform public.error_api('IC422', 'Ya existe ese alcance en el proyecto',
			jsonb_build_object('motivo', 'duplicado'));
	end if;

	if id_alcance is not null then
		update public.alcances_predeterminados set
			tipo = tipo_alcance,
			grupo = public.texto_o_nulo(p ->> 'grupo'),
			texto = texto_alcance,
			activo = coalesce((p ->> 'activo')::boolean, activo)
		where id = id_alcance
		returning * into fila;
	else
		-- Serializa las altas del mismo proyecto para que el orden no se repita.
		perform 1 from public.clientes where id = id_cliente for update;
		insert into public.alcances_predeterminados (cliente_id, tipo, grupo, texto, orden, activo)
		values (id_cliente, tipo_alcance, public.texto_o_nulo(p ->> 'grupo'), texto_alcance,
			coalesce((select max(orden) from public.alcances_predeterminados where cliente_id = id_cliente), 0) + 1,
			coalesce((p ->> 'activo')::boolean, true))
		returning * into fila;
	end if;
	return public.json_alcance_predeterminado(fila);
end
$$;

-- Borrar no afecta partidas ni reportes: los alcances se copiaron como texto (D2).
create or replace function public.api_eliminar_alcance_predeterminado(p jsonb)
returns jsonb
language plpgsql
as $$
begin
	delete from public.alcances_predeterminados where id = (p ->> 'id')::uuid;
	if not found then
		perform public.error_api('IC404', 'Alcance predeterminado no encontrado',
			jsonb_build_object('id', p ->> 'id'));
	end if;
	return jsonb_build_object('id', p ->> 'id');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Personal
-- ---------------------------------------------------------------------------------------------

-- Datos personales: no se cargan desde semillas versionadas.
create table if not exists public.personal (
	id uuid primary key default gen_random_uuid(),
	nombre text not null check (btrim(nombre) <> ''),
	apellido_paterno text not null check (btrim(apellido_paterno) <> ''),
	apellido_materno text,
	fecha_nacimiento date not null check (fecha_nacimiento >= date '1900-01-01'),
	correo text,
	correo_normalizado text generated always as (lower(btrim(correo))) stored,
	rol text not null check (
		rol in ('administrador', 'lider_administrativo', 'lider_operativo', 'reporteador')
	),
	activo boolean not null default true,
	-- Vínculo con el inicio de sesión (auth.users en Supabase); sin llave foránea por PGlite.
	usuario_auth_id uuid,
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint personal_correo_formato check (correo is null or correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
	constraint personal_correo_unico unique (correo_normalizado),
	constraint personal_usuario_auth_unico unique (usuario_auth_id)
);

create table if not exists public.personal_proyectos (
	personal_id uuid not null references public.personal (id) on delete cascade,
	cliente_id uuid not null references public.clientes (id) on delete cascade,
	primary key (personal_id, cliente_id)
);
create index if not exists personal_proyectos_cliente_idx on public.personal_proyectos (cliente_id);

drop trigger if exists personal_actualizado on public.personal;
create trigger personal_actualizado before update on public.personal
	for each row execute function public.tocar_actualizado_en();

create or replace function public.json_personal(id_personal uuid)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', s.id, 'nombre', s.nombre, 'apellidoPaterno', s.apellido_paterno,
		'apellidoMaterno', s.apellido_materno, 'fechaNacimiento', s.fecha_nacimiento,
		'correo', s.correo, 'rol', s.rol, 'activo', s.activo, 'actualizadoEn', s.actualizado_en,
		'proyectos', coalesce((
			select jsonb_agg(jsonb_build_object('id', c.id, 'clave', c.clave, 'nombre', c.nombre)
				order by c.nombre)
			from public.personal_proyectos pp join public.clientes c on c.id = pp.cliente_id
			where pp.personal_id = s.id
		), '[]'::jsonb)
	)
	from public.personal s
	where s.id = id_personal
$$;

create or replace function public.api_listar_personal(p jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_personal(s.id)
		order by s.activo desc, public.normalizar_clave(s.apellido_paterno),
			public.normalizar_clave(coalesce(s.apellido_materno, '')), public.normalizar_clave(s.nombre)),
		'[]'::jsonb)
	from public.personal s
$$;

create or replace function public.api_obtener_personal(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
	resultado jsonb := public.json_personal((p ->> 'id')::uuid);
begin
	if resultado is null then
		perform public.error_api('IC404', 'Persona no encontrada', jsonb_build_object('id', p ->> 'id'));
	end if;
	return resultado;
end
$$;

-- Alta o edición con sus proyectos (se reemplazan). El administrador accede a todos los proyectos y
-- no guarda asignaciones; los demás roles requieren al menos uno. La baja es lógica (activo).
create or replace function public.api_guardar_personal(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_personal uuid := (p ->> 'id')::uuid;
	rol_personal text := public.texto_o_nulo(p ->> 'rol');
	correo_personal text := public.texto_o_nulo(p ->> 'correo');
	nacimiento date;
	hoy date := (now() at time zone 'America/Mexico_City')::date;
	proyectos uuid[] := coalesce((
		select array_agg(distinct valor::uuid)
		from jsonb_array_elements_text(coalesce(p -> 'clienteIds', '[]'::jsonb)) valor
	), '{}');
begin
	if id_personal is not null and not exists (select 1 from public.personal where id = id_personal) then
		perform public.error_api('IC404', 'Persona no encontrada', jsonb_build_object('id', id_personal));
	end if;
	if public.texto_o_nulo(p ->> 'nombre') is null then
		perform public.error_api('IC422', 'Escriba el nombre', jsonb_build_object('motivo', 'nombre'));
	end if;
	if public.texto_o_nulo(p ->> 'apellidoPaterno') is null then
		perform public.error_api('IC422', 'Escriba el apellido paterno',
			jsonb_build_object('motivo', 'apellido_paterno'));
	end if;
	if public.texto_o_nulo(p ->> 'fechaNacimiento') is null then
		perform public.error_api('IC422', 'Indique la fecha de nacimiento',
			jsonb_build_object('motivo', 'fecha_nacimiento'));
	end if;
	nacimiento := (p ->> 'fechaNacimiento')::date;
	if nacimiento < date '1900-01-01' or nacimiento > hoy then
		perform public.error_api('IC422', 'Fecha de nacimiento fuera de rango',
			jsonb_build_object('motivo', 'fecha_nacimiento'));
	end if;
	if rol_personal is null
		or rol_personal not in ('administrador', 'lider_administrativo', 'lider_operativo', 'reporteador') then
		perform public.error_api('IC422', 'Rol no válido', jsonb_build_object('motivo', 'rol'));
	end if;
	if correo_personal is not null then
		if correo_personal !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
			perform public.error_api('IC422', 'Correo no válido', jsonb_build_object('motivo', 'correo'));
		end if;
		if exists (select 1 from public.personal
			where correo_normalizado = lower(correo_personal) and id is distinct from id_personal) then
			perform public.error_api('IC422', 'Ya existe otra persona con ese correo',
				jsonb_build_object('motivo', 'correo_duplicado'));
		end if;
	end if;
	if rol_personal = 'administrador' then
		proyectos := '{}';
	elsif cardinality(proyectos) = 0 then
		perform public.error_api('IC422', 'Asigne al menos un proyecto',
			jsonb_build_object('motivo', 'sin_proyectos'));
	elsif exists (select 1 from unnest(proyectos) x(id)
		where not exists (select 1 from public.clientes c where c.id = x.id)) then
		perform public.error_api('IC422', 'Proyecto no encontrado', jsonb_build_object('motivo', 'proyecto'));
	end if;

	if id_personal is null then
		insert into public.personal (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
			correo, rol, activo)
		values (btrim(p ->> 'nombre'), btrim(p ->> 'apellidoPaterno'),
			public.texto_o_nulo(p ->> 'apellidoMaterno'), nacimiento, correo_personal, rol_personal,
			coalesce((p ->> 'activo')::boolean, true))
		returning id into id_personal;
	else
		update public.personal set
			nombre = btrim(p ->> 'nombre'),
			apellido_paterno = btrim(p ->> 'apellidoPaterno'),
			apellido_materno = public.texto_o_nulo(p ->> 'apellidoMaterno'),
			fecha_nacimiento = nacimiento,
			correo = correo_personal,
			rol = rol_personal,
			activo = coalesce((p ->> 'activo')::boolean, activo)
		where id = id_personal;
	end if;
	delete from public.personal_proyectos
	where personal_id = id_personal and not (cliente_id = any (proyectos));
	insert into public.personal_proyectos (personal_id, cliente_id)
	select id_personal, x.id from unnest(proyectos) x(id)
	on conflict do nothing;
	return public.json_personal(id_personal);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Fotos en SharePoint: solo la URL
-- ---------------------------------------------------------------------------------------------

alter table public.reporte_fotos
	add column if not exists almacenamiento text not null default 'local',
	add column if not exists url_original text,
	add column if not exists url_optimizada text;
alter table public.reporte_fotos alter column ruta_original drop not null;
alter table public.reporte_fotos alter column ruta_optimizada drop not null;

do $$
begin
	if not exists (select 1 from pg_constraint where conname = 'reporte_fotos_almacenamiento_valido') then
		alter table public.reporte_fotos add constraint reporte_fotos_almacenamiento_valido check (
			(almacenamiento = 'local' and ruta_original is not null and ruta_optimizada is not null)
			-- Con coalesce: un CHECK que da nulo se acepta, y la URL faltante debe rechazarse.
			or (almacenamiento = 'sharepoint' and coalesce(url_original ~ '^https://', false)
				and coalesce(url_optimizada ~ '^https://', false))
		);
	end if;
end
$$;

-- Cuerpo de 0017 más el almacenamiento y las URL.
create or replace function public.json_foto(f public.reporte_fotos)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', f.id, 'alcanceId', f.reporte_alcance_id, 'orden', f.orden, 'descripcion', f.descripcion,
		'momento', f.momento, 'rutaOriginal', f.ruta_original, 'rutaOptimizada', f.ruta_optimizada,
		'ancho', f.ancho, 'alto', f.alto, 'bytes', f.bytes, 'tipoMime', f.tipo_mime,
		'rotacion', f.rotacion, 'almacenamiento', f.almacenamiento, 'urlOriginal', f.url_original,
		'urlOptimizada', f.url_optimizada
	)
$$;

-- Cuerpo de 0003 más «almacenamiento», «urlOriginal» y «urlOptimizada» (SharePoint).
create or replace function public.api_agregar_foto(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	actual public.reportes;
	fila public.reporte_fotos;
begin
	if coalesce((p ->> 'version')::integer, 0) < 1 then
		perform public.error_api('IC422', 'Falta la versión del reporte',
			jsonb_build_object('motivo', 'version_requerida'));
	end if;
	actual := public.reporte_para_editar((p ->> 'reporteId')::uuid, (p ->> 'version')::integer);
	if actual.estado <> 'borrador' then
		perform public.error_api('IC409', 'Solo se pueden agregar fotos a un reporte en borrador',
			jsonb_build_object('motivo', 'estado', 'estado', actual.estado));
	end if;
	if not exists (select 1 from public.reporte_alcances
		where id = (p ->> 'alcanceId')::uuid and reporte_id = actual.id) then
		perform public.error_api('IC404', 'Alcance no encontrado en el reporte',
			jsonb_build_object('alcanceId', p ->> 'alcanceId'));
	end if;
	insert into public.reporte_fotos (reporte_alcance_id, orden, descripcion, momento, ruta_original,
		ruta_optimizada, ancho, alto, bytes, tipo_mime, almacenamiento, url_original, url_optimizada)
	values ((p ->> 'alcanceId')::uuid,
		coalesce((select max(orden) from public.reporte_fotos where reporte_alcance_id = (p ->> 'alcanceId')::uuid), 0) + 1,
		coalesce(p ->> 'descripcion', ''), p ->> 'momento', p ->> 'rutaOriginal', p ->> 'rutaOptimizada',
		(p ->> 'ancho')::integer, (p ->> 'alto')::integer, (p ->> 'bytes')::integer, p ->> 'tipoMime',
		coalesce(p ->> 'almacenamiento', 'local'), p ->> 'urlOriginal', p ->> 'urlOptimizada')
	returning * into fila;
	update public.reportes set version = version + 1 where id = actual.id;
	return jsonb_build_object('foto', public.json_foto(fila), 'version', actual.version + 1);
end
$$;

-- Cuerpo de 0003; la copia de fotos lleva el giro, el almacenamiento y las URL. La envoltura de 0017
-- (api_crear_revision) sigue igual: su copia del giro queda como repetición inofensiva.
create or replace function public.api_crear_revision_0003(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	original public.reportes := public.reporte_para_editar((p ->> 'id')::uuid, null);
	id_nuevo uuid := gen_random_uuid();
	a public.reporte_alcances;
	id_alcance uuid;
begin
	if original.estado <> 'emitido' then
		perform public.error_api('IC409', 'Solo se puede revisar un reporte emitido',
			jsonb_build_object('motivo', 'estado', 'estado', original.estado));
	end if;
	if exists (select 1 from public.reportes where sustituye_a = original.id) then
		perform public.error_api('IC409', 'El reporte ya tiene una revisión en curso',
			jsonb_build_object('motivo', 'revision_existente',
				'revisionId', (select id from public.reportes where sustituye_a = original.id)));
	end if;
	insert into public.reportes (
		id, contrato_id, sitio_id, partida_id, periodo_mes, ocurrencia_tipo, ocurrencia_numero,
		fecha_ejecucion, titulo, usuario, contrato_texto, sitio_texto, periodicidad, tipo_mantenimiento,
		actividad, numero_partida, nombre_corto, objetivo, introduccion, conclusiones, disposicion_fotos,
		incluye_verificacion, firmantes, revision, sustituye_a
	)
	select id_nuevo, contrato_id, sitio_id, partida_id, periodo_mes, ocurrencia_tipo, ocurrencia_numero,
		fecha_ejecucion, titulo, usuario, contrato_texto, sitio_texto, periodicidad, tipo_mantenimiento,
		actividad, numero_partida, nombre_corto, objetivo, introduccion, conclusiones, disposicion_fotos,
		incluye_verificacion, firmantes, revision + 1, id
	from public.reportes where id = original.id;

	for a in select * from public.reporte_alcances where reporte_id = original.id order by orden loop
		insert into public.reporte_alcances (reporte_id, orden, titulo, descripcion, estado_verificacion,
			observaciones, partida_alcance_id)
		values (id_nuevo, a.orden, a.titulo, a.descripcion, a.estado_verificacion, a.observaciones,
			a.partida_alcance_id)
		returning id into id_alcance;
		insert into public.reporte_fotos (reporte_alcance_id, orden, descripcion, momento, ruta_original,
			ruta_optimizada, ancho, alto, bytes, tipo_mime, rotacion, almacenamiento, url_original,
			url_optimizada)
		select id_alcance, orden, descripcion, momento, ruta_original, ruta_optimizada, ancho, alto, bytes,
			tipo_mime, rotacion, almacenamiento, url_original, url_optimizada
		from public.reporte_fotos where reporte_alcance_id = a.id;
	end loop;
	insert into public.reporte_herramientas (reporte_id, orden, cantidad, descripcion)
	select id_nuevo, orden, cantidad, descripcion from public.reporte_herramientas where reporte_id = original.id;
	insert into public.reporte_equipos (reporte_id, equipo_id, orden, tag)
	select id_nuevo, equipo_id, orden, tag from public.reporte_equipos where reporte_id = original.id;
	return public.json_reporte(id_nuevo);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Seguridad (política de 0004): solo el rol de servicio
-- ---------------------------------------------------------------------------------------------

do $$
declare
	tabla text;
begin
	foreach tabla in array array['alcances_predeterminados', 'personal', 'personal_proyectos'] loop
		execute format('alter table public.%I enable row level security', tabla);
		if exists (select 1 from pg_roles where rolname = 'service_role')
			and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tabla
				and policyname = 'servicio_acceso_total') then
			execute format(
				'create policy servicio_acceso_total on public.%I for all to service_role using (true) with check (true)',
				tabla
			);
		end if;
	end loop;
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke all on public.alcances_predeterminados, public.personal, public.personal_proyectos
			from anon, authenticated;
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
