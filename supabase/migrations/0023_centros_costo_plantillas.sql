-- 0023_centros_costo_plantillas.sql
-- Cambio centros-costo-plantillas (etapa 2 del plan de seguimiento por centro de costo): plantillas
-- de seguimiento con sus conceptos (D2 a D5), centros de costo con plantilla y sin contrato (D1),
-- personal asignado por centro de costo en lugar de por proyecto (D6), el alcance en la sesión (D7)
-- y las consultas que filtran por centro de costo (D8). El centro de costo sigue siendo `sitios`.

-- ---------------------------------------------------------------------------------------------
-- Reglas de los conceptos (D4)
-- ---------------------------------------------------------------------------------------------

-- Nivel que fija cada bloque; en «programa» es el valor por omisión (también admite actividad).
create or replace function public.nivel_de_bloque(bloque text)
returns text
language sql
immutable
parallel safe
as $$
	select case bloque
		when 'contrato' then 'contrato'
		when 'ordenes_compra' then 'orden_compra'
		when 'programa' then 'periodo'
		when 'documentos' then 'actividad'
		when 'carpetas' then 'periodo'
	end
$$;

create or replace function public.nivel_valido(bloque text, nivel text)
returns boolean
language sql
immutable
parallel safe
as $$
	select case when bloque = 'programa' then nivel in ('periodo', 'actividad')
		else nivel = public.nivel_de_bloque(bloque) end
$$;

-- Las carpetas son entregas (tipo carpeta) y ningún otro bloque las usa.
create or replace function public.tipo_valido(bloque text, tipo text)
returns boolean
language sql
immutable
parallel safe
as $$
	select (bloque = 'carpetas') = (tipo = 'carpeta')
$$;

-- Orden de presentación de los bloques (A, B, D, E y F del plan).
create or replace function public.orden_bloque(bloque text)
returns integer
language sql
immutable
parallel safe
as $$
	select array_position(array['contrato', 'ordenes_compra', 'programa', 'documentos', 'carpetas'],
		bloque)
$$;

-- ---------------------------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------------------------

create table if not exists public.plantillas_seguimiento (
	id uuid primary key default gen_random_uuid(),
	nombre text not null check (btrim(nombre) <> ''),
	nombre_normalizado text generated always as (public.normalizar_clave(nombre)) stored,
	descripcion text,
	modo_contrato text not null default 'obligatorio'
		check (modo_contrato in ('obligatorio', 'opcional', 'sin_contrato')),
	origen_actividades text not null default 'ninguno'
		check (origen_actividades in ('programa_anual', 'mensual', 'ninguno')),
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint plantillas_seguimiento_nombre_unico unique (nombre_normalizado)
);

create table if not exists public.plantilla_conceptos (
	id uuid primary key default gen_random_uuid(),
	plantilla_id uuid not null references public.plantillas_seguimiento (id) on delete cascade,
	bloque text not null
		check (bloque in ('contrato', 'ordenes_compra', 'programa', 'documentos', 'carpetas')),
	etiqueta text not null check (btrim(etiqueta) <> ''),
	etiqueta_normalizada text generated always as (public.normalizar_clave(etiqueta)) stored,
	tipo text not null
		check (tipo in ('casilla', 'estado', 'cantidad', 'monto', 'enlace', 'fecha', 'texto', 'carpeta')),
	nivel text not null check (nivel in ('contrato', 'orden_compra', 'periodo', 'actividad')),
	orden integer not null check (orden > 0),
	constraint plantilla_conceptos_nivel check (public.nivel_valido(bloque, nivel)),
	constraint plantilla_conceptos_tipo check (public.tipo_valido(bloque, tipo)),
	-- Diferida: al guardar se pueden intercambiar dos etiquetas en la misma operación.
	constraint plantilla_conceptos_etiqueta_unica unique (plantilla_id, bloque, etiqueta_normalizada)
		deferrable initially deferred
);
create index if not exists plantilla_conceptos_plantilla_idx
	on public.plantilla_conceptos (plantilla_id, bloque, orden);

drop trigger if exists plantillas_seguimiento_actualizado on public.plantillas_seguimiento;
create trigger plantillas_seguimiento_actualizado before update on public.plantillas_seguimiento
	for each row execute function public.tocar_actualizado_en();

alter table public.sitios add column if not exists plantilla_id uuid
	references public.plantillas_seguimiento (id) on delete restrict;
create index if not exists sitios_plantilla_idx on public.sitios (plantilla_id);

create table if not exists public.personal_centros_costo (
	personal_id uuid not null references public.personal (id) on delete cascade,
	sitio_id uuid not null references public.sitios (id) on delete cascade,
	primary key (personal_id, sitio_id)
);
create index if not exists personal_centros_costo_sitio_idx on public.personal_centros_costo (sitio_id);

-- D6: cada proyecto asignado pasa a ser los centros de costo de los contratos de ese cliente.
do $$
begin
	if to_regclass('public.personal_proyectos') is not null then
		insert into public.personal_centros_costo (personal_id, sitio_id)
		select distinct pp.personal_id, cs.sitio_id
		from public.personal_proyectos pp
			join public.personal s on s.id = pp.personal_id
			join public.contratos k on k.cliente_id = pp.cliente_id
			join public.contrato_sitios cs on cs.contrato_id = k.id
		where not public.rol_sin_proyectos(s.rol)
		on conflict do nothing;
		drop table public.personal_proyectos;
	end if;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Personal con centros de costo
-- ---------------------------------------------------------------------------------------------

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
		'centrosCosto', coalesce((
			select jsonb_agg(jsonb_build_object('id', t.id, 'clave', t.clave, 'nombre', t.nombre)
				order by t.clave_normalizada)
			from public.personal_centros_costo pc join public.sitios t on t.id = pc.sitio_id
			where pc.personal_id = s.id
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

-- Usuario de una sesión: lo que el servidor pone en `locals.usuario`. `centrosCosto` es null cuando
-- el rol abarca todos los centros de costo (D7).
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
		'debeCambiar', k.debe_cambiar,
		'centrosCosto', case when public.rol_sin_proyectos(s.rol) then null else coalesce((
			select jsonb_agg(pc.sitio_id order by pc.sitio_id)
			from public.personal_centros_costo pc where pc.personal_id = s.id
		), '[]'::jsonb) end
	)
	from public.personal s join public.credenciales k on k.personal_id = s.id
	where s.id = id_personal
$$;

-- Alta o edición con sus centros de costo (se reemplazan). Administrador, mesa directiva y
-- contabilidad abarcan todos y no guardan asignaciones; los demás roles pueden quedar sin ninguno.
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
	centros uuid[] := coalesce((
		select array_agg(distinct valor::uuid)
		from jsonb_array_elements_text(coalesce(p -> 'centroCostoIds', '[]'::jsonb)) valor
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
		centros := '{}';
	elsif exists (select 1 from unnest(centros) x(id)
		where not exists (select 1 from public.sitios t where t.id = x.id)) then
		perform public.error_api('IC422', 'Centro de costo no encontrado',
			jsonb_build_object('motivo', 'centro_costo'));
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
	delete from public.personal_centros_costo
	where personal_id = id_personal and not (sitio_id = any (centros));
	insert into public.personal_centros_costo (personal_id, sitio_id)
	select id_personal, x.id from unnest(centros) x(id)
	on conflict do nothing;
	return public.json_personal(id_personal);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Plantillas de seguimiento
-- ---------------------------------------------------------------------------------------------

create or replace function public.json_plantilla_seguimiento(id_plantilla uuid)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', g.id, 'nombre', g.nombre, 'descripcion', g.descripcion,
		'modoContrato', g.modo_contrato, 'origenActividades', g.origen_actividades,
		'actualizadoEn', g.actualizado_en,
		'conceptos', coalesce((
			select jsonb_agg(jsonb_build_object('id', c.id, 'bloque', c.bloque, 'etiqueta', c.etiqueta,
				'tipo', c.tipo, 'nivel', c.nivel, 'orden', c.orden)
				order by public.orden_bloque(c.bloque), c.orden)
			from public.plantilla_conceptos c where c.plantilla_id = g.id
		), '[]'::jsonb),
		'centros', coalesce((
			select jsonb_agg(jsonb_build_object('id', t.id, 'clave', t.clave, 'nombre', t.nombre)
				order by t.clave_normalizada)
			from public.sitios t where t.plantilla_id = g.id
		), '[]'::jsonb)
	)
	from public.plantillas_seguimiento g
	where g.id = id_plantilla
$$;

create or replace function public.api_listar_plantillas_seguimiento(p jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_plantilla_seguimiento(g.id) order by g.nombre_normalizado),
		'[]'::jsonb)
	from public.plantillas_seguimiento g
$$;

create or replace function public.api_obtener_plantilla_seguimiento(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
	resultado jsonb := public.json_plantilla_seguimiento((p ->> 'id')::uuid);
begin
	if resultado is null then
		perform public.error_api('IC404', 'Plantilla no encontrada', jsonb_build_object('id', p ->> 'id'));
	end if;
	return resultado;
end
$$;

-- Alta o edición con la lista completa de conceptos (D5): los que traen id se actualizan, los
-- nuevos se insertan y los que faltan se borran. El orden es el de la lista dentro de cada bloque.
create or replace function public.api_guardar_plantilla_seguimiento(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_plantilla uuid := (p ->> 'id')::uuid;
	nombre_plantilla text := public.texto_o_nulo(p ->> 'nombre');
	modo text := coalesce(public.texto_o_nulo(p ->> 'modoContrato'), 'obligatorio');
	origen text := coalesce(public.texto_o_nulo(p ->> 'origenActividades'), 'ninguno');
	conceptos jsonb := coalesce(p -> 'conceptos', '[]'::jsonb);
	concepto jsonb;
	bloque_c text;
	etiqueta_c text;
	tipo_c text;
	nivel_c text;
	contador integer;
	ordenes jsonb := '{}'::jsonb;
	repetida text;
begin
	if nombre_plantilla is null then
		perform public.error_api('IC422', 'Escriba el nombre de la plantilla',
			jsonb_build_object('motivo', 'nombre'));
	end if;
	if modo not in ('obligatorio', 'opcional', 'sin_contrato') then
		perform public.error_api('IC422', 'Modo de contrato no válido', jsonb_build_object('motivo', 'modo'));
	end if;
	if origen not in ('programa_anual', 'mensual', 'ninguno') then
		perform public.error_api('IC422', 'Origen de las actividades no válido',
			jsonb_build_object('motivo', 'origen'));
	end if;
	if jsonb_typeof(conceptos) <> 'array' then
		perform public.error_api('IC422', 'Conceptos no válidos', jsonb_build_object('motivo', 'conceptos'));
	end if;
	if exists (select 1 from public.plantillas_seguimiento
		where nombre_normalizado = public.normalizar_clave(nombre_plantilla)
			and id is distinct from id_plantilla) then
		perform public.error_api('IC422', 'Ya existe una plantilla con ese nombre',
			jsonb_build_object('motivo', 'plantilla_duplicada'));
	end if;
	select min(btrim(c ->> 'etiqueta')) into repetida
	from jsonb_array_elements(conceptos) c
	where public.texto_o_nulo(c ->> 'etiqueta') is not null
	group by c ->> 'bloque', public.normalizar_clave(c ->> 'etiqueta')
	having count(*) > 1
	limit 1;
	if repetida is not null then
		perform public.error_api('IC422', 'Concepto repetido en el bloque',
			jsonb_build_object('motivo', 'concepto_duplicado', 'etiqueta', repetida));
	end if;

	if id_plantilla is null then
		insert into public.plantillas_seguimiento (nombre, descripcion, modo_contrato, origen_actividades)
		values (nombre_plantilla, public.texto_o_nulo(p ->> 'descripcion'), modo, origen)
		returning id into id_plantilla;
	else
		update public.plantillas_seguimiento set
			nombre = nombre_plantilla,
			descripcion = public.texto_o_nulo(p ->> 'descripcion'),
			modo_contrato = modo,
			origen_actividades = origen
		where id = id_plantilla;
		if not found then
			perform public.error_api('IC404', 'Plantilla no encontrada', jsonb_build_object('id', id_plantilla));
		end if;
		delete from public.plantilla_conceptos
		where plantilla_id = id_plantilla
			and id not in (
				select (c ->> 'id')::uuid from jsonb_array_elements(conceptos) c
				where public.texto_o_nulo(c ->> 'id') is not null
			);
	end if;

	for concepto in
		select t.valor from jsonb_array_elements(conceptos) with ordinality t(valor, n) order by t.n
	loop
		bloque_c := concepto ->> 'bloque';
		etiqueta_c := public.texto_o_nulo(concepto ->> 'etiqueta');
		tipo_c := concepto ->> 'tipo';
		nivel_c := coalesce(public.texto_o_nulo(concepto ->> 'nivel'), public.nivel_de_bloque(bloque_c));
		if public.orden_bloque(bloque_c) is null then
			perform public.error_api('IC422', 'Bloque no válido', jsonb_build_object('motivo', 'bloque'));
		end if;
		if etiqueta_c is null then
			perform public.error_api('IC422', 'Escriba la etiqueta del concepto',
				jsonb_build_object('motivo', 'etiqueta'));
		end if;
		if tipo_c is null or tipo_c not in ('casilla', 'estado', 'cantidad', 'monto', 'enlace', 'fecha',
			'texto', 'carpeta') then
			perform public.error_api('IC422', 'Tipo de concepto no válido', jsonb_build_object('motivo', 'tipo'));
		end if;
		if not public.tipo_valido(bloque_c, tipo_c) then
			perform public.error_api('IC422', 'El tipo no corresponde al bloque',
				jsonb_build_object('motivo', 'tipo_bloque', 'etiqueta', etiqueta_c));
		end if;
		if not public.nivel_valido(bloque_c, nivel_c) then
			perform public.error_api('IC422', 'El nivel no corresponde al bloque',
				jsonb_build_object('motivo', 'nivel_bloque', 'etiqueta', etiqueta_c));
		end if;
		contador := coalesce((ordenes ->> bloque_c)::integer, 0) + 1;
		ordenes := ordenes || jsonb_build_object(bloque_c, contador);
		if public.texto_o_nulo(concepto ->> 'id') is not null then
			update public.plantilla_conceptos set
				bloque = bloque_c, etiqueta = etiqueta_c, tipo = tipo_c, nivel = nivel_c, orden = contador
			where id = (concepto ->> 'id')::uuid and plantilla_id = id_plantilla;
			if not found then
				perform public.error_api('IC422', 'El concepto no pertenece a la plantilla',
					jsonb_build_object('motivo', 'concepto_ajeno'));
			end if;
		else
			insert into public.plantilla_conceptos (plantilla_id, bloque, etiqueta, tipo, nivel, orden)
			values (id_plantilla, bloque_c, etiqueta_c, tipo_c, nivel_c, contador);
		end if;
	end loop;
	return public.json_plantilla_seguimiento(id_plantilla);
end
$$;

-- Copia con otro nombre y conceptos nuevos; ningún centro de costo cambia de plantilla.
create or replace function public.api_duplicar_plantilla_seguimiento(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	origen public.plantillas_seguimiento;
	nombre_copia text := public.texto_o_nulo(p ->> 'nombre');
	id_copia uuid;
begin
	select * into origen from public.plantillas_seguimiento where id = (p ->> 'id')::uuid;
	if not found then
		perform public.error_api('IC404', 'Plantilla no encontrada', jsonb_build_object('id', p ->> 'id'));
	end if;
	if nombre_copia is null then
		perform public.error_api('IC422', 'Escriba el nombre de la copia', jsonb_build_object('motivo', 'nombre'));
	end if;
	if exists (select 1 from public.plantillas_seguimiento
		where nombre_normalizado = public.normalizar_clave(nombre_copia)) then
		perform public.error_api('IC422', 'Ya existe una plantilla con ese nombre',
			jsonb_build_object('motivo', 'plantilla_duplicada'));
	end if;
	insert into public.plantillas_seguimiento (nombre, descripcion, modo_contrato, origen_actividades)
	values (nombre_copia, origen.descripcion, origen.modo_contrato, origen.origen_actividades)
	returning id into id_copia;
	insert into public.plantilla_conceptos (plantilla_id, bloque, etiqueta, tipo, nivel, orden)
	select id_copia, c.bloque, c.etiqueta, c.tipo, c.nivel, c.orden
	from public.plantilla_conceptos c where c.plantilla_id = origen.id;
	return public.json_plantilla_seguimiento(id_copia);
end
$$;

create or replace function public.api_eliminar_plantilla_seguimiento(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_plantilla uuid := (p ->> 'id')::uuid;
	en_uso integer;
begin
	select count(*) into en_uso from public.sitios where plantilla_id = id_plantilla;
	if en_uso > 0 then
		perform public.error_api('IC409',
			case when en_uso = 1 then 'La usa 1 centro de costo' else format('La usan %s centros de costo', en_uso) end,
			jsonb_build_object('motivo', 'plantilla_en_uso', 'centros', en_uso));
	end if;
	delete from public.plantillas_seguimiento where id = id_plantilla;
	if not found then
		perform public.error_api('IC404', 'Plantilla no encontrada', jsonb_build_object('id', id_plantilla));
	end if;
	return jsonb_build_object('id', id_plantilla);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Centros de costo
-- ---------------------------------------------------------------------------------------------

create or replace function public.json_centro_costo(id_sitio uuid)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', t.id, 'clave', t.clave, 'nombre', t.nombre,
		'plantilla', (
			select jsonb_build_object('id', g.id, 'nombre', g.nombre, 'modoContrato', g.modo_contrato,
				'origenActividades', g.origen_actividades)
			from public.plantillas_seguimiento g where g.id = t.plantilla_id
		),
		'contratos', coalesce((
			select jsonb_agg(jsonb_build_object('id', k.id, 'numero', k.numero,
				'cliente', c.nombre, 'vigenciaFin', k.vigencia_fin,
				'vigente', current_date between k.vigencia_inicio and k.vigencia_fin)
				order by k.vigencia_fin desc, k.numero)
			from public.contrato_sitios cs
				join public.contratos k on k.id = cs.contrato_id
				join public.clientes c on c.id = k.cliente_id
			where cs.sitio_id = t.id
		), '[]'::jsonb),
		'partidas', (select count(*) from public.partidas x where x.sitio_id = t.id),
		'personas', (
			select count(*) from public.personal_centros_costo pc
				join public.personal s on s.id = pc.personal_id and s.activo
			where pc.sitio_id = t.id
		)
	)
	from public.sitios t
	where t.id = id_sitio
$$;

-- Todos los centros de costo, con o sin contrato; `sitioIds` limita al alcance de quien consulta.
create or replace function public.api_listar_centros_costo(p jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_centro_costo(t.id) order by t.clave_normalizada), '[]'::jsonb)
	from public.sitios t
	where p -> 'sitioIds' is null or jsonb_typeof(p -> 'sitioIds') = 'null'
		or t.id in (select x::uuid from jsonb_array_elements_text(p -> 'sitioIds') x)
$$;

-- Alta (clave, nombre y plantilla) o edición del nombre y la plantilla. La clave de un centro de
-- costo existente se corrige desde su contrato, con motivo y bitácora.
create or replace function public.api_guardar_centro_costo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_sitio uuid := (p ->> 'id')::uuid;
	clave_centro text := public.texto_o_nulo(p ->> 'clave');
	id_plantilla uuid := (public.texto_o_nulo(p ->> 'plantillaId'))::uuid;
begin
	if id_plantilla is not null
		and not exists (select 1 from public.plantillas_seguimiento where id = id_plantilla) then
		perform public.error_api('IC422', 'Plantilla no encontrada', jsonb_build_object('motivo', 'plantilla'));
	end if;
	if id_sitio is null then
		if clave_centro is null then
			perform public.error_api('IC422', 'Escriba la clave del centro de costo',
				jsonb_build_object('motivo', 'clave'));
		end if;
		if exists (select 1 from public.sitios where clave_normalizada = public.normalizar_clave(clave_centro)) then
			perform public.error_api('IC422', 'Ya existe un centro de costo con esa clave',
				jsonb_build_object('motivo', 'centro_duplicado'));
		end if;
		insert into public.sitios (clave, nombre, plantilla_id)
		values (clave_centro, coalesce(btrim(p ->> 'nombre'), ''), id_plantilla)
		returning id into id_sitio;
	else
		update public.sitios set
			nombre = coalesce(btrim(p ->> 'nombre'), ''),
			plantilla_id = id_plantilla
		where id = id_sitio;
		if not found then
			perform public.error_api('IC404', 'Centro de costo no encontrado', jsonb_build_object('id', id_sitio));
		end if;
	end if;
	return public.json_centro_costo(id_sitio);
end
$$;

-- Carga en bloque (D9). Da de alta las plantillas que no existen por nombre y los centros que no
-- existen por clave, y asigna la plantilla a los centros existentes que no tienen una. Todo se hace
-- dentro de un bloque que se deshace en el ensayo o si alguna fila no es válida.
create or replace function public.api_importar_centros_costo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	aplicado boolean := false;
	fila jsonb;
	estado text;
	motivo text;
	nombres_vistos text[] := '{}';
	claves_vistas text[] := '{}';
	nombre_norm text;
	clave_norm text;
	id_plantilla uuid;
	existente public.sitios;
	filas_plantillas jsonb := '[]'::jsonb;
	filas_centros jsonb := '[]'::jsonb;
	plantillas_nuevas integer := 0;
	plantillas_existentes integer := 0;
	centros_nuevos integer := 0;
	centros_asignados integer := 0;
	centros_existentes integer := 0;
	invalidas integer := 0;
begin
	begin
		for fila in
			select t.valor from jsonb_array_elements(coalesce(p -> 'plantillas', '[]'::jsonb))
				with ordinality t(valor, n) order by t.n
		loop
			nombre_norm := public.normalizar_clave(fila ->> 'nombre');
			motivo := null;
			if nombre_norm = '' then
				estado := 'invalida';
				motivo := 'Falta el nombre';
			elsif nombre_norm = any (nombres_vistos) then
				estado := 'invalida';
				motivo := 'Plantilla repetida en el archivo';
			elsif exists (select 1 from public.plantillas_seguimiento where nombre_normalizado = nombre_norm) then
				estado := 'existente';
			else
				begin
					perform public.api_guardar_plantilla_seguimiento(fila - 'id');
					estado := 'nueva';
				exception when others then
					estado := 'invalida';
					motivo := sqlerrm;
				end;
			end if;
			nombres_vistos := nombres_vistos || nombre_norm;
			plantillas_nuevas := plantillas_nuevas + (estado = 'nueva')::integer;
			plantillas_existentes := plantillas_existentes + (estado = 'existente')::integer;
			invalidas := invalidas + (estado = 'invalida')::integer;
			filas_plantillas := filas_plantillas || jsonb_build_object('nombre', fila ->> 'nombre',
				'estado', estado, 'motivo', motivo);
		end loop;

		for fila in
			select t.valor from jsonb_array_elements(coalesce(p -> 'centros', '[]'::jsonb))
				with ordinality t(valor, n) order by t.n
		loop
			clave_norm := public.normalizar_clave(fila ->> 'clave');
			motivo := null;
			id_plantilla := null;
			if public.texto_o_nulo(fila ->> 'plantilla') is not null then
				select id into id_plantilla from public.plantillas_seguimiento
				where nombre_normalizado = public.normalizar_clave(fila ->> 'plantilla');
			end if;
			select * into existente from public.sitios where clave_normalizada = clave_norm;
			if clave_norm = '' then
				estado := 'invalida';
				motivo := 'Falta la clave';
			elsif clave_norm = any (claves_vistas) then
				estado := 'invalida';
				motivo := 'Centro de costo repetido en el archivo';
			elsif public.texto_o_nulo(fila ->> 'plantilla') is not null and id_plantilla is null then
				estado := 'invalida';
				motivo := 'Plantilla desconocida';
			elsif existente.id is null then
				insert into public.sitios (clave, nombre, plantilla_id)
				values (btrim(fila ->> 'clave'), coalesce(btrim(fila ->> 'nombre'), ''), id_plantilla);
				estado := 'nuevo';
			elsif existente.plantilla_id is null and id_plantilla is not null then
				update public.sitios set plantilla_id = id_plantilla where id = existente.id;
				estado := 'asignado';
			else
				estado := 'existente';
				if existente.plantilla_id is distinct from id_plantilla and id_plantilla is not null then
					motivo := 'Ya tiene otra plantilla; no se cambia';
				end if;
			end if;
			claves_vistas := claves_vistas || clave_norm;
			centros_nuevos := centros_nuevos + (estado = 'nuevo')::integer;
			centros_asignados := centros_asignados + (estado = 'asignado')::integer;
			centros_existentes := centros_existentes + (estado = 'existente')::integer;
			invalidas := invalidas + (estado = 'invalida')::integer;
			filas_centros := filas_centros || jsonb_build_object('clave', fila ->> 'clave',
				'estado', estado, 'motivo', motivo);
		end loop;

		aplicado := not ensayo and invalidas = 0;
		if not aplicado then
			raise exception using errcode = 'IC000', message = 'deshacer';
		end if;
	exception when sqlstate 'IC000' then
		-- Deshace lo escrito en el bloque; las variables conservan el informe.
		null;
	end;
	return jsonb_build_object(
		'ensayo', ensayo,
		'aplicado', aplicado,
		'resumen', jsonb_build_object(
			'plantillasNuevas', plantillas_nuevas, 'plantillasExistentes', plantillas_existentes,
			'centrosNuevos', centros_nuevos, 'centrosAsignados', centros_asignados,
			'centrosExistentes', centros_existentes, 'invalidas', invalidas),
		'plantillas', filas_plantillas,
		'centros', filas_centros
	);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Alcance por centro de costo (D8)
-- ---------------------------------------------------------------------------------------------

-- Contratos con su cliente y sus centros de costo, para filtrar las listas en el servidor.
create or replace function public.api_contratos_centros(p jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(jsonb_build_object(
		'contratoId', k.id, 'clienteId', k.cliente_id,
		'sitioIds', coalesce((select jsonb_agg(cs.sitio_id) from public.contrato_sitios cs
			where cs.contrato_id = k.id), '[]'::jsonb)
	)), '[]'::jsonb)
	from public.contratos k
$$;

-- Centros de costo de un recurso pedido por id; lista vacía si no existe.
create or replace function public.api_centros_de_recurso(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(distinct x.sitio_id), '[]'::jsonb)
	from (
		select r.sitio_id from public.reportes r
		where p ->> 'tipo' = 'reporte' and r.id = (p ->> 'id')::uuid
		union all
		select t.sitio_id from public.partidas t
		where p ->> 'tipo' = 'partida' and t.id = (p ->> 'id')::uuid
		union all
		select cs.sitio_id from public.contrato_sitios cs
		where p ->> 'tipo' = 'contrato' and cs.contrato_id = (p ->> 'id')::uuid
		union all
		select e.sitio_id from public.equipos e
		where p ->> 'tipo' = 'equipo' and e.id = (p ->> 'id')::uuid
		union all
		select g.sitio_id from public.programas g
		where p ->> 'tipo' = 'programa' and g.id = (p ->> 'id')::uuid
		union all
		select g.sitio_id from public.programa_ajustes a join public.programas g on g.id = a.programa_id
		where p ->> 'tipo' = 'ajuste' and a.id = (p ->> 'id')::uuid
	) x
$$;

-- Historial con el filtro `sitioIds` (alcance de quien consulta). Igual que 0014 en lo demás.
create or replace function public.api_listar_reportes(p jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
	with filtrados as (
		select r.*, c.clave as cliente_clave,
			(select string_agg(re.tag, ', ' order by re.orden) from public.reporte_equipos re
				where re.reporte_id = r.id) as tags
		from public.reportes r
		join public.contratos k on k.id = r.contrato_id
		join public.clientes c on c.id = k.cliente_id
		where (p ->> 'clienteClave' is null or c.clave = p ->> 'clienteClave')
			and (p ->> 'contratoId' is null or r.contrato_id = (p ->> 'contratoId')::uuid)
			and (p ->> 'sitioId' is null or r.sitio_id = (p ->> 'sitioId')::uuid)
			and (p -> 'sitioIds' is null or jsonb_typeof(p -> 'sitioIds') = 'null'
				or r.sitio_id in (select x::uuid from jsonb_array_elements_text(p -> 'sitioIds') x))
			and (p ->> 'partidaId' is null or r.partida_id = (p ->> 'partidaId')::uuid)
			and (p ->> 'estado' is null or r.estado = p ->> 'estado')
			and (p ->> 'desde' is null or r.periodo_mes >= public.primer_dia_mes((p ->> 'desde')::date))
			and (p ->> 'hasta' is null or r.periodo_mes <= (p ->> 'hasta')::date)
			and (p ->> 'tag' is null or exists (
				select 1 from public.reporte_equipos re
				where re.reporte_id = r.id and public.normalizar_clave(re.tag) = public.normalizar_clave(p ->> 'tag')))
	),
	pagina as (
		select greatest(coalesce((p ->> 'pagina')::integer, 1), 1) as numero,
			least(greatest(coalesce((p ->> 'tamano')::integer, 20), 1), 100) as tamano
	)
	select jsonb_build_object(
		'total', (select count(*) from filtrados),
		'pagina', (select numero from pagina),
		'tamano', (select tamano from pagina),
		'filas', coalesce((
			select jsonb_agg(fila order by orden_periodo desc, orden_actualizado desc, orden_id)
			from (
				select f.periodo_mes as orden_periodo, f.actualizado_en as orden_actualizado, f.id as orden_id,
					jsonb_build_object(
						'id', f.id, 'partidaId', f.partida_id, 'sitioId', f.sitio_id,
						'titulo', f.titulo, 'clienteClave', f.cliente_clave, 'usuario', f.usuario,
						'contratoTexto', f.contrato_texto, 'sitioTexto', f.sitio_texto,
						'numeroPartida', f.numero_partida, 'actividad', f.actividad, 'tags', f.tags,
						'periodoMes', f.periodo_mes,
						'ocurrencia', case when f.ocurrencia_tipo is null then null
							else jsonb_build_object('tipo', f.ocurrencia_tipo, 'numero', f.ocurrencia_numero) end,
						'estado', f.estado, 'revision', f.revision, 'actualizadoEn', f.actualizado_en,
						'documento', (select jsonb_build_object('id', d.id, 'nombreArchivo', d.nombre_archivo,
							'generadoEn', d.generado_en) from public.documentos_generados d
							where d.reporte_id = f.id order by d.generado_en desc limit 1)
					) as fila
				from filtrados f
				order by f.periodo_mes desc, f.actualizado_en desc, f.id
				offset ((select numero from pagina) - 1) * (select tamano from pagina)
				limit (select tamano from pagina)
			) paginadas
		), '[]'::jsonb)
	)
$$;

-- ---------------------------------------------------------------------------------------------
-- Seguridad (política de 0004): solo el rol de servicio
-- ---------------------------------------------------------------------------------------------

do $$
declare
	tabla text;
begin
	foreach tabla in array array['plantillas_seguimiento', 'plantilla_conceptos', 'personal_centros_costo'] loop
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
		revoke all on public.plantillas_seguimiento, public.plantilla_conceptos,
			public.personal_centros_costo from anon, authenticated;
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
