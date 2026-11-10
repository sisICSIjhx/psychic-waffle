-- 0022_autenticacion.sql
-- Cambio inicio-sesion-roles: cuentas propias de correo y contraseña sobre el personal, sesiones
-- guardadas en la base (igual en PGlite y en Supabase), roles mesa directiva y contabilidad, sede y
-- carga del personal desde un archivo. La contraseña llega ya resumida por el servidor (scrypt): la
-- base nunca la ve.

-- ---------------------------------------------------------------------------------------------
-- Personal: sede, fecha de nacimiento opcional y seis roles
-- ---------------------------------------------------------------------------------------------

alter table public.personal add column if not exists sede text;
alter table public.personal alter column fecha_nacimiento drop not null;

do $$
declare
	restriccion text;
begin
	for restriccion in
		select conname from pg_constraint
		where conrelid = 'public.personal'::regclass and contype = 'c'
			and pg_get_constraintdef(oid) like '%lider_operativo%'
	loop
		execute format('alter table public.personal drop constraint %I', restriccion);
	end loop;
end
$$;

alter table public.personal add constraint personal_rol_valido check (
	rol in ('administrador', 'lider_administrativo', 'lider_operativo', 'reporteador',
		'mesa_directiva', 'contabilidad')
);

-- Roles que abarcan todos los proyectos y no guardan asignaciones.
create or replace function public.rol_sin_proyectos(rol text)
returns boolean
language sql
immutable
as $$
	select rol in ('administrador', 'mesa_directiva', 'contabilidad')
$$;

-- ---------------------------------------------------------------------------------------------
-- Cuentas y sesiones
-- ---------------------------------------------------------------------------------------------

-- Una cuenta por persona. `contrasena_hash` es el texto «scrypt$N$r$p$sal$resumen».
create table if not exists public.credenciales (
	personal_id uuid primary key references public.personal (id) on delete cascade,
	contrasena_hash text not null check (btrim(contrasena_hash) <> ''),
	-- Contraseña temporal: la persona debe cambiarla antes de usar la aplicación.
	debe_cambiar boolean not null default true,
	intentos_fallidos integer not null default 0 check (intentos_fallidos >= 0),
	bloqueada_hasta timestamptz,
	ultimo_acceso_en timestamptz,
	creada_en timestamptz not null default now(),
	contrasena_cambiada_en timestamptz not null default now()
);

-- `token_hash` es el SHA-256 del identificador que viaja en la cookie: con la base no se puede
-- reconstruir la cookie.
create table if not exists public.sesiones (
	id uuid primary key default gen_random_uuid(),
	token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
	personal_id uuid not null references public.personal (id) on delete cascade,
	creada_en timestamptz not null default now(),
	ultimo_uso_en timestamptz not null default now(),
	expira_en timestamptz not null,
	revocada_en timestamptz,
	agente text,
	constraint sesiones_token_unico unique (token_hash)
);
create index if not exists sesiones_personal_idx on public.sesiones (personal_id);

-- ¿Queda algún administrador activo con cuenta, sin contar a `excepto`?
create or replace function public.quedan_administradores_con_acceso(excepto uuid)
returns boolean
language sql
stable
as $$
	select exists (
		select 1 from public.personal s join public.credenciales k on k.personal_id = s.id
		where s.activo and s.rol = 'administrador' and s.id is distinct from excepto
	)
$$;

-- Usuario de una sesión: lo que el servidor pone en `locals.usuario`.
create or replace function public.json_usuario(id_personal uuid)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', s.id,
		'nombre', concat_ws(' ', btrim(s.nombre), btrim(s.apellido_paterno),
			public.texto_o_nulo(s.apellido_materno)),
		'correo', s.correo,
		'rol', s.rol,
		'debeCambiar', k.debe_cambiar
	)
	from public.personal s join public.credenciales k on k.personal_id = s.id
	where s.id = id_personal
$$;

create or replace function public.json_personal(id_personal uuid)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', s.id, 'nombre', s.nombre, 'apellidoPaterno', s.apellido_paterno,
		'apellidoMaterno', s.apellido_materno, 'fechaNacimiento', s.fecha_nacimiento,
		'correo', s.correo, 'sede', s.sede, 'rol', s.rol, 'activo', s.activo,
		'actualizadoEn', s.actualizado_en,
		'proyectos', coalesce((
			select jsonb_agg(jsonb_build_object('id', c.id, 'clave', c.clave, 'nombre', c.nombre)
				order by c.nombre)
			from public.personal_proyectos pp join public.clientes c on c.id = pp.cliente_id
			where pp.personal_id = s.id
		), '[]'::jsonb),
		-- Estado de la cuenta, o null si la persona no tiene; nunca incluye el resumen.
		'acceso', (
			select jsonb_build_object(
				'debeCambiar', k.debe_cambiar,
				'bloqueadaHasta', case when k.bloqueada_hasta > now() then k.bloqueada_hasta end,
				'ultimoAccesoEn', k.ultimo_acceso_en
			)
			from public.credenciales k where k.personal_id = s.id
		)
	)
	from public.personal s
	where s.id = id_personal
$$;

-- Alta o edición con sus proyectos (se reemplazan). Administrador, mesa directiva y contabilidad
-- abarcan todos los proyectos y no guardan asignaciones; los demás roles pueden quedar sin ninguno.
-- La baja es lógica (activo) y cierra las sesiones. Con cuentas activadas, el último administrador
-- con acceso no puede darse de baja ni cambiar de rol, y una persona con cuenta conserva su correo.
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
	anterior public.personal%rowtype;
	queda_activo boolean;
	proyectos uuid[] := coalesce((
		select array_agg(distinct valor::uuid)
		from jsonb_array_elements_text(coalesce(p -> 'clienteIds', '[]'::jsonb)) valor
	), '{}');
begin
	if id_personal is not null then
		select * into anterior from public.personal where id = id_personal;
		if not found then
			perform public.error_api('IC404', 'Persona no encontrada', jsonb_build_object('id', id_personal));
		end if;
	end if;
	if public.texto_o_nulo(p ->> 'nombre') is null then
		perform public.error_api('IC422', 'Escriba el nombre', jsonb_build_object('motivo', 'nombre'));
	end if;
	if public.texto_o_nulo(p ->> 'apellidoPaterno') is null then
		perform public.error_api('IC422', 'Escriba el apellido paterno',
			jsonb_build_object('motivo', 'apellido_paterno'));
	end if;
	if public.texto_o_nulo(p ->> 'fechaNacimiento') is not null then
		nacimiento := (p ->> 'fechaNacimiento')::date;
		if nacimiento < date '1900-01-01' or nacimiento > hoy then
			perform public.error_api('IC422', 'Fecha de nacimiento fuera de rango',
				jsonb_build_object('motivo', 'fecha_nacimiento'));
		end if;
	end if;
	if rol_personal is null
		or rol_personal not in ('administrador', 'lider_administrativo', 'lider_operativo',
			'reporteador', 'mesa_directiva', 'contabilidad') then
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
	if public.rol_sin_proyectos(rol_personal) then
		proyectos := '{}';
	elsif exists (select 1 from unnest(proyectos) x(id)
		where not exists (select 1 from public.clientes c where c.id = x.id)) then
		perform public.error_api('IC422', 'Proyecto no encontrado', jsonb_build_object('motivo', 'proyecto'));
	end if;

	if id_personal is null then
		insert into public.personal (nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
			correo, sede, rol, activo)
		values (btrim(p ->> 'nombre'), btrim(p ->> 'apellidoPaterno'),
			public.texto_o_nulo(p ->> 'apellidoMaterno'), nacimiento, correo_personal,
			public.texto_o_nulo(p ->> 'sede'), rol_personal,
			coalesce((p ->> 'activo')::boolean, true))
		returning id into id_personal;
	else
		queda_activo := coalesce((p ->> 'activo')::boolean, anterior.activo);
		if exists (select 1 from public.credenciales where personal_id = id_personal) then
			if correo_personal is null then
				perform public.error_api('IC422', 'Quite primero el acceso de la persona para dejarla sin correo',
					jsonb_build_object('motivo', 'correo_con_cuenta'));
			end if;
			if anterior.activo and anterior.rol = 'administrador'
				and (rol_personal <> 'administrador' or not queda_activo)
				and not public.quedan_administradores_con_acceso(id_personal) then
				perform public.error_api('IC422', 'Debe quedar al menos un administrador con acceso',
					jsonb_build_object('motivo', 'ultimo_administrador'));
			end if;
		end if;
		update public.personal set
			nombre = btrim(p ->> 'nombre'),
			apellido_paterno = btrim(p ->> 'apellidoPaterno'),
			apellido_materno = public.texto_o_nulo(p ->> 'apellidoMaterno'),
			fecha_nacimiento = nacimiento,
			correo = correo_personal,
			-- Quien no envía la sede (formularios anteriores) la conserva.
			sede = case when p ? 'sede' then public.texto_o_nulo(p ->> 'sede') else sede end,
			rol = rol_personal,
			activo = queda_activo
		where id = id_personal;
		if not queda_activo then
			update public.sesiones set revocada_en = now()
			where personal_id = id_personal and revocada_en is null;
		end if;
	end if;
	delete from public.personal_proyectos
	where personal_id = id_personal and not (cliente_id = any (proyectos));
	insert into public.personal_proyectos (personal_id, cliente_id)
	select id_personal, x.id from unnest(proyectos) x(id)
	on conflict do nothing;
	return public.json_personal(id_personal);
end
$$;

-- Carga en bloque (ensayo por omisión): da de alta a quienes no están por su correo, como
-- reporteadores activos, sin proyectos y sin cuenta. No modifica a quien ya existe.
create or replace function public.api_importar_personal(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	fila jsonb;
	filas jsonb := '[]'::jsonb;
	correo_fila text;
	estado text;
	motivo text;
	vistos text[] := '{}';
	nuevas integer := 0;
	existentes integer := 0;
	invalidas integer := 0;
begin
	for fila in
		select t.valor from jsonb_array_elements(coalesce(p -> 'personas', '[]'::jsonb))
			with ordinality t(valor, n)
		order by t.n
	loop
		correo_fila := lower(public.texto_o_nulo(fila ->> 'correo'));
		motivo := null;
		if public.texto_o_nulo(fila ->> 'nombre') is null
			or public.texto_o_nulo(fila ->> 'apellidoPaterno') is null then
			estado := 'invalida';
			motivo := 'Falta el nombre o el apellido';
		elsif correo_fila is null
			or correo_fila !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
			estado := 'invalida';
			motivo := 'Correo no válido';
		elsif correo_fila = any (vistos) then
			estado := 'invalida';
			motivo := 'Correo repetido en el archivo';
		elsif exists (select 1 from public.personal where correo_normalizado = correo_fila) then
			estado := 'existente';
		else
			estado := 'nueva';
			if not ensayo then
				insert into public.personal (nombre, apellido_paterno, apellido_materno, correo, sede,
					rol, activo)
				values (btrim(fila ->> 'nombre'), btrim(fila ->> 'apellidoPaterno'),
					public.texto_o_nulo(fila ->> 'apellidoMaterno'), correo_fila,
					public.texto_o_nulo(fila ->> 'sede'), 'reporteador', true);
			end if;
		end if;
		if correo_fila is not null then
			vistos := vistos || correo_fila;
		end if;
		nuevas := nuevas + (estado = 'nueva')::integer;
		existentes := existentes + (estado = 'existente')::integer;
		invalidas := invalidas + (estado = 'invalida')::integer;
		filas := filas || jsonb_build_object('linea', fila -> 'linea', 'correo', correo_fila,
			'estado', estado, 'motivo', motivo);
	end loop;
	return jsonb_build_object(
		'ensayo', ensayo,
		'resumen', jsonb_build_object('nuevas', nuevas, 'existentes', existentes, 'invalidas', invalidas),
		'filas', filas
	);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Acceso
-- ---------------------------------------------------------------------------------------------

-- Una llamada por petición: si el inicio de sesión está activado (existe alguna cuenta) y el usuario
-- de la sesión, o null si no vale. Renueva el último uso como mucho cada 5 minutos.
create or replace function public.api_contexto_acceso(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
as $$
declare
	resumen text := public.texto_o_nulo(p ->> 'tokenHash');
	inactividad interval := make_interval(mins => coalesce((p ->> 'inactividadMinutos')::integer, 720));
	id_sesion uuid;
	id_personal uuid;
	ultimo_uso timestamptz;
	usuario jsonb;
begin
	if resumen is not null then
		select x.id, x.personal_id, x.ultimo_uso_en into id_sesion, id_personal, ultimo_uso
		from public.sesiones x
			join public.personal s on s.id = x.personal_id and s.activo
			join public.credenciales k on k.personal_id = s.id
		where x.token_hash = resumen and x.revocada_en is null
			and x.expira_en > now() and x.ultimo_uso_en + inactividad > now();
		if found then
			if ultimo_uso < now() - interval '5 minutes' then
				update public.sesiones set ultimo_uso_en = now() where id = id_sesion;
			end if;
			usuario := public.json_usuario(id_personal);
		end if;
	end if;
	return jsonb_build_object(
		'activada', exists (select 1 from public.credenciales),
		'usuario', usuario
	);
end
$$;

-- Datos para comprobar una contraseña en el servidor; null si el correo no tiene cuenta.
create or replace function public.api_credencial_de_correo(p jsonb)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'personalId', s.id,
		'hash', k.contrasena_hash,
		'activo', s.activo,
		'bloqueadaHasta', case when k.bloqueada_hasta > now() then k.bloqueada_hasta end
	)
	from public.personal s join public.credenciales k on k.personal_id = s.id
	where s.correo_normalizado = lower(btrim(coalesce(p ->> 'correo', '')))
$$;

-- Contraseña incorrecta: al llegar al máximo, la cuenta se bloquea y el contador vuelve a cero.
create or replace function public.api_registrar_acceso_fallido(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	maximo integer := coalesce((p ->> 'maxIntentos')::integer, 5);
	minutos integer := coalesce((p ->> 'minutosBloqueo')::integer, 15);
	intentos integer;
	bloqueo timestamptz;
begin
	update public.credenciales set
		bloqueada_hasta = case when intentos_fallidos + 1 >= maximo
			then now() + make_interval(mins => minutos) else bloqueada_hasta end,
		intentos_fallidos = case when intentos_fallidos + 1 >= maximo then 0 else intentos_fallidos + 1 end
	where personal_id = (p ->> 'personalId')::uuid
	returning intentos_fallidos, bloqueada_hasta into intentos, bloqueo;
	return jsonb_build_object(
		'intentosFallidos', coalesce(intentos, 0),
		'bloqueadaHasta', case when bloqueo > now() then bloqueo end
	);
end
$$;

-- Abre la sesión de una persona activa con cuenta y reinicia sus intentos fallidos.
create or replace function public.api_abrir_sesion(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_personal uuid := (p ->> 'personalId')::uuid;
	minutos integer := coalesce((p ->> 'duracionMinutos')::integer, 10080);
begin
	if not exists (
		select 1 from public.personal s join public.credenciales k on k.personal_id = s.id
		where s.id = id_personal and s.activo
	) then
		perform public.error_api('IC422', 'La persona no tiene acceso', jsonb_build_object('motivo', 'sin_acceso'));
	end if;
	-- Limpieza: las sesiones caducadas o cerradas de la persona ya no sirven.
	delete from public.sesiones
	where personal_id = id_personal and (expira_en < now() or revocada_en is not null);
	insert into public.sesiones (token_hash, personal_id, expira_en, agente)
	values (p ->> 'tokenHash', id_personal, now() + make_interval(mins => minutos),
		left(public.texto_o_nulo(p ->> 'agente'), 300));
	update public.credenciales set intentos_fallidos = 0, bloqueada_hasta = null, ultimo_acceso_en = now()
	where personal_id = id_personal;
	return public.json_usuario(id_personal);
end
$$;

create or replace function public.api_cerrar_sesion(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	cerradas integer;
begin
	update public.sesiones set revocada_en = now()
	where token_hash = p ->> 'tokenHash' and revocada_en is null;
	get diagnostics cerradas = row_count;
	return jsonb_build_object('cerrada', cerradas > 0);
end
$$;

-- Crea o sustituye la contraseña (ya resumida) de una persona activa con correo y cierra sus demás
-- sesiones. La primera cuenta del sistema debe ser de un administrador: es la que activa el inicio
-- de sesión para todos.
create or replace function public.api_establecer_contrasena(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_personal uuid := (p ->> 'personalId')::uuid;
	resumen text := public.texto_o_nulo(p ->> 'hash');
	persona public.personal%rowtype;
begin
	select * into persona from public.personal where id = id_personal;
	if not found then
		perform public.error_api('IC404', 'Persona no encontrada', jsonb_build_object('id', id_personal));
	end if;
	if not persona.activo then
		perform public.error_api('IC422', 'La persona está dada de baja', jsonb_build_object('motivo', 'inactiva'));
	end if;
	if persona.correo is null then
		perform public.error_api('IC422', 'Registre primero el correo de la persona',
			jsonb_build_object('motivo', 'sin_correo'));
	end if;
	if resumen is null then
		perform public.error_api('IC422', 'Falta la contraseña', jsonb_build_object('motivo', 'contrasena'));
	end if;
	if persona.rol <> 'administrador' and not exists (select 1 from public.credenciales) then
		perform public.error_api('IC422', 'La primera cuenta debe ser de un administrador',
			jsonb_build_object('motivo', 'primera_cuenta'));
	end if;
	insert into public.credenciales (personal_id, contrasena_hash, debe_cambiar)
	values (id_personal, resumen, coalesce((p ->> 'debeCambiar')::boolean, true))
	on conflict (personal_id) do update set
		contrasena_hash = excluded.contrasena_hash,
		debe_cambiar = excluded.debe_cambiar,
		intentos_fallidos = 0,
		bloqueada_hasta = null,
		contrasena_cambiada_en = now();
	update public.sesiones set revocada_en = now()
	where personal_id = id_personal and revocada_en is null
		and token_hash is distinct from public.texto_o_nulo(p ->> 'conservarTokenHash');
	return public.json_personal(id_personal);
end
$$;

-- Elimina la cuenta y cierra las sesiones. El último administrador con acceso no puede quitarse.
create or replace function public.api_quitar_acceso(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_personal uuid := (p ->> 'personalId')::uuid;
	persona public.personal%rowtype;
begin
	select * into persona from public.personal where id = id_personal;
	if not found then
		perform public.error_api('IC404', 'Persona no encontrada', jsonb_build_object('id', id_personal));
	end if;
	if persona.activo and persona.rol = 'administrador'
		and exists (select 1 from public.credenciales where personal_id = id_personal)
		and not public.quedan_administradores_con_acceso(id_personal) then
		perform public.error_api('IC422', 'Debe quedar al menos un administrador con acceso',
			jsonb_build_object('motivo', 'ultimo_administrador'));
	end if;
	delete from public.sesiones where personal_id = id_personal;
	delete from public.credenciales where personal_id = id_personal;
	return public.json_personal(id_personal);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Seguridad (política de 0004): solo el rol de servicio
-- ---------------------------------------------------------------------------------------------

do $$
declare
	tabla text;
begin
	foreach tabla in array array['credenciales', 'sesiones'] loop
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
		revoke all on public.credenciales, public.sesiones from anon, authenticated;
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
