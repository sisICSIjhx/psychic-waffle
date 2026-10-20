-- 0001_catalogo.sql
-- Catálogo: clientes, contratos, sitios, partidas con alcances y herramientas, equipos/TAG y
-- firmantes por contrato. La aplicación accede solo mediante las funciones api_* (jsonb → jsonb),
-- que se invocan igual desde PGlite y desde Supabase (rpc).
--
-- Códigos de error propios (SQLSTATE):
--   IC404 no encontrado · IC409 conflicto de versión o de estado · IC422 dato inválido o duplicado.
--   El campo DETAIL lleva un JSON con información para la interfaz.

-- ---------------------------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------------------------

-- Clave comparable: sin acentos, en mayúsculas y con espacios simples.
create or replace function public.normalizar_clave(texto text)
returns text
language sql
immutable
parallel safe
as $$
	select upper(regexp_replace(btrim(translate(coalesce(texto, ''),
		'áéíóúäëïöüàèìòùâêîôûÁÉÍÓÚÄËÏÖÜÀÈÌÒÙÂÊÎÔÛ',
		'aeiouaeiouaeiouaeiouAEIOUAEIOUAEIOUAEIOU')), '\s+', ' ', 'g'))
$$;

-- «08» y «8» son el mismo número de partida.
create or replace function public.normalizar_numero_partida(numero text)
returns text
language sql
immutable
parallel safe
as $$
	select regexp_replace(public.normalizar_clave(numero), '^0+(?=[0-9])', '')
$$;

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
	new.actualizado_en := now();
	return new;
end
$$;

-- Primer día del mes, con aritmética de fechas (inmutable, sin depender de la zona horaria).
create or replace function public.primer_dia_mes(d date)
returns date
language sql
immutable
parallel safe
as $$
	select d - (extract(day from d)::integer - 1)
$$;

-- Texto opcional: nulo si viene vacío.
create or replace function public.texto_o_nulo(valor text)
returns text
language sql
immutable
parallel safe
as $$
	select nullif(btrim(coalesce(valor, '')), '')
$$;

create or replace function public.error_api(codigo text, mensaje text, detalle jsonb default '{}'::jsonb)
returns void
language plpgsql
as $$
begin
	raise exception using errcode = codigo, message = mensaje, detail = detalle::text;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------------------------

create table public.clientes (
	id uuid primary key default gen_random_uuid(),
	clave text not null,
	nombre text not null check (btrim(nombre) <> ''),
	razon_social text not null check (btrim(razon_social) <> ''),
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint clientes_clave_formato check (clave ~ '^[a-z0-9-]+$'),
	constraint clientes_clave_unica unique (clave)
);

create table public.contratos (
	id uuid primary key default gen_random_uuid(),
	cliente_id uuid not null references public.clientes (id) on delete restrict,
	numero text not null check (btrim(numero) <> ''),
	descripcion text,
	vigencia_inicio date not null,
	vigencia_fin date not null,
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint contratos_vigencia check (vigencia_fin >= vigencia_inicio),
	constraint contratos_numero_unico unique (cliente_id, numero)
);
create index contratos_cliente_idx on public.contratos (cliente_id);

create table public.sitios (
	id uuid primary key default gen_random_uuid(),
	clave text not null check (btrim(clave) <> ''),
	nombre text not null default '',
	clave_normalizada text generated always as (public.normalizar_clave(clave)) stored,
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint sitios_clave_unica unique (clave_normalizada)
);

create table public.contrato_sitios (
	contrato_id uuid not null references public.contratos (id) on delete cascade,
	sitio_id uuid not null references public.sitios (id) on delete restrict,
	primary key (contrato_id, sitio_id)
);

create table public.partidas (
	id uuid primary key default gen_random_uuid(),
	contrato_id uuid not null,
	sitio_id uuid not null,
	numero text not null check (btrim(numero) <> ''),
	numero_normalizado text generated always as (public.normalizar_numero_partida(numero)) stored,
	actividad text not null check (btrim(actividad) <> ''),
	nombre_corto text,
	descripcion text,
	distribucion text check (distribucion in ('produccion', 'mantenimiento')),
	periodicidad text not null check (
		periodicidad in (
			'diaria', 'semanal', 'quincenal', 'mensual', 'bimestral', 'trimestral', 'cuatrimestral',
			'semestral', 'anual', 'cuando_aplique'
		)
	),
	cantidad_anual numeric check (cantidad_anual >= 0),
	entrega text,
	requiere_odm boolean not null default false,
	requiere_pt boolean not null default false,
	requiere_ast boolean not null default false,
	materiales_por text check (materiales_por in ('icsi', 'cliente')),
	reportes_homologados text,
	tipo_mantenimiento text not null default 'Preventivo',
	objetivo text,
	conclusiones_base text,
	disposicion_fotos text not null default 'cuadricula'
		check (disposicion_fotos in ('cuadricula', 'antes_durante_despues')),
	propone_verificacion boolean not null default false,
	estado_catalogo text not null default 'confirmado'
		check (estado_catalogo in ('confirmado', 'por_confirmar')),
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint partidas_sitio_del_contrato foreign key (contrato_id, sitio_id)
		references public.contrato_sitios (contrato_id, sitio_id) on delete restrict,
	constraint partidas_numero_unico unique (contrato_id, sitio_id, numero_normalizado),
	constraint partidas_cuando_aplique check (periodicidad <> 'cuando_aplique' or cantidad_anual is null)
);
create index partidas_contrato_sitio_idx on public.partidas (contrato_id, sitio_id);

create table public.partida_alcances (
	id uuid primary key default gen_random_uuid(),
	partida_id uuid not null references public.partidas (id) on delete cascade,
	orden integer not null check (orden > 0),
	tipo text not null check (tipo in ('alcance', 'nota', 'norma')),
	texto text not null check (btrim(texto) <> ''),
	constraint partida_alcances_orden_unico unique (partida_id, orden) deferrable initially deferred
);

create table public.partida_herramientas (
	id uuid primary key default gen_random_uuid(),
	partida_id uuid not null references public.partidas (id) on delete cascade,
	orden integer not null check (orden > 0),
	cantidad text,
	descripcion text not null check (btrim(descripcion) <> ''),
	constraint partida_herramientas_orden_unico unique (partida_id, orden) deferrable initially deferred
);

create table public.equipos (
	id uuid primary key default gen_random_uuid(),
	sitio_id uuid not null references public.sitios (id) on delete restrict,
	tag text not null check (btrim(tag) <> ''),
	tag_normalizado text generated always as (public.normalizar_clave(tag)) stored,
	tipo text,
	marca text,
	modelo text,
	rango text,
	numero_serie text,
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint equipos_tag_unico unique (sitio_id, tag_normalizado)
);

create table public.partida_equipos (
	partida_id uuid not null references public.partidas (id) on delete cascade,
	equipo_id uuid not null references public.equipos (id) on delete cascade,
	primary key (partida_id, equipo_id)
);

-- Datos personales: no se cargan desde semillas versionadas.
create table public.firmantes (
	id uuid primary key default gen_random_uuid(),
	contrato_id uuid not null references public.contratos (id) on delete cascade,
	funcion text not null check (funcion in ('elaboro', 'aprobo', 'recibio')),
	nombre text not null check (btrim(nombre) <> ''),
	cargo text not null default '',
	empresa text not null default '',
	vigente_desde date not null,
	vigente_hasta date,
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint firmantes_vigencia check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);
create index firmantes_contrato_idx on public.firmantes (contrato_id, funcion);

create trigger clientes_actualizado before update on public.clientes
	for each row execute function public.tocar_actualizado_en();
create trigger contratos_actualizado before update on public.contratos
	for each row execute function public.tocar_actualizado_en();
create trigger sitios_actualizado before update on public.sitios
	for each row execute function public.tocar_actualizado_en();
create trigger partidas_actualizado before update on public.partidas
	for each row execute function public.tocar_actualizado_en();
create trigger equipos_actualizado before update on public.equipos
	for each row execute function public.tocar_actualizado_en();
create trigger firmantes_actualizado before update on public.firmantes
	for each row execute function public.tocar_actualizado_en();

-- Un equipo solo puede asociarse a partidas de su mismo sitio.
create or replace function public.validar_partida_equipo()
returns trigger
language plpgsql
as $$
begin
	if (select sitio_id from public.partidas where id = new.partida_id)
		is distinct from (select sitio_id from public.equipos where id = new.equipo_id) then
		perform public.error_api('IC422', 'El equipo no pertenece al sitio de la partida',
			jsonb_build_object('motivo', 'equipo_de_otro_sitio'));
	end if;
	return new;
end
$$;
create trigger partida_equipos_mismo_sitio before insert or update on public.partida_equipos
	for each row execute function public.validar_partida_equipo();

-- Los periodos de un firmante no se traslapan con otro de la misma función y contrato.
create or replace function public.validar_firmante()
returns trigger
language plpgsql
as $$
declare
	traslape uuid;
begin
	select f.id into traslape
	from public.firmantes f
	where f.contrato_id = new.contrato_id
		and f.funcion = new.funcion
		and f.id <> new.id
		and daterange(f.vigente_desde, f.vigente_hasta, '[]')
			&& daterange(new.vigente_desde, new.vigente_hasta, '[]')
	limit 1;
	if traslape is not null then
		perform public.error_api('IC422', 'La vigencia se traslapa con otro firmante de la misma función',
			jsonb_build_object('motivo', 'firmante_traslapado', 'firmanteId', traslape));
	end if;
	return new;
end
$$;
create trigger firmantes_sin_traslape before insert or update on public.firmantes
	for each row execute function public.validar_firmante();

-- ---------------------------------------------------------------------------------------------
-- Representación JSON
-- ---------------------------------------------------------------------------------------------

create or replace function public.json_cliente(c public.clientes)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object('id', c.id, 'clave', c.clave, 'nombre', c.nombre, 'razonSocial', c.razon_social)
$$;

create or replace function public.json_contrato(k public.contratos)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', k.id, 'clienteId', k.cliente_id, 'numero', k.numero, 'descripcion', k.descripcion,
		'vigenciaInicio', k.vigencia_inicio, 'vigenciaFin', k.vigencia_fin,
		'cliente', (select public.json_cliente(c) from public.clientes c where c.id = k.cliente_id)
	)
$$;

create or replace function public.json_sitio(s public.sitios)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object('id', s.id, 'clave', s.clave, 'nombre', s.nombre)
$$;

create or replace function public.json_equipo(e public.equipos)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', e.id, 'sitioId', e.sitio_id, 'tag', e.tag, 'tipo', e.tipo, 'marca', e.marca,
		'modelo', e.modelo, 'rango', e.rango, 'numeroSerie', e.numero_serie
	)
$$;

create or replace function public.json_firmante(f public.firmantes)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', f.id, 'contratoId', f.contrato_id, 'funcion', f.funcion, 'nombre', f.nombre,
		'cargo', f.cargo, 'empresa', f.empresa, 'vigenteDesde', f.vigente_desde,
		'vigenteHasta', f.vigente_hasta
	)
$$;

create or replace function public.json_partida(id_partida uuid)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', p.id, 'contratoId', p.contrato_id, 'sitioId', p.sitio_id, 'numero', p.numero,
		'actividad', p.actividad, 'nombreCorto', p.nombre_corto, 'descripcion', p.descripcion,
		'distribucion', p.distribucion, 'periodicidad', p.periodicidad,
		'cantidadAnual', p.cantidad_anual, 'entrega', p.entrega, 'requiereOdm', p.requiere_odm,
		'requierePt', p.requiere_pt, 'requiereAst', p.requiere_ast, 'materialesPor', p.materiales_por,
		'reportesHomologados', p.reportes_homologados, 'tipoMantenimiento', p.tipo_mantenimiento,
		'objetivo', p.objetivo, 'conclusionesBase', p.conclusiones_base,
		'disposicionFotos', p.disposicion_fotos, 'proponeVerificacion', p.propone_verificacion,
		'estadoCatalogo', p.estado_catalogo, 'actualizadoEn', p.actualizado_en,
		'alcances', coalesce((
			select jsonb_agg(jsonb_build_object('id', a.id, 'orden', a.orden, 'tipo', a.tipo, 'texto', a.texto)
				order by a.orden)
			from public.partida_alcances a where a.partida_id = p.id
		), '[]'::jsonb),
		'herramientas', coalesce((
			select jsonb_agg(jsonb_build_object('id', h.id, 'orden', h.orden, 'cantidad', h.cantidad,
				'descripcion', h.descripcion) order by h.orden)
			from public.partida_herramientas h where h.partida_id = p.id
		), '[]'::jsonb),
		'equipos', coalesce((
			select jsonb_agg(public.json_equipo(e) order by e.tag_normalizado)
			from public.partida_equipos pe join public.equipos e on e.id = pe.equipo_id
			where pe.partida_id = p.id
		), '[]'::jsonb)
	)
	from public.partidas p
	where p.id = id_partida
$$;

-- ---------------------------------------------------------------------------------------------
-- API del catálogo
-- ---------------------------------------------------------------------------------------------

create or replace function public.api_guardar_cliente(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	fila public.clientes;
begin
	insert into public.clientes as c (id, clave, nombre, razon_social)
	values (coalesce((p ->> 'id')::uuid, gen_random_uuid()), p ->> 'clave', p ->> 'nombre', p ->> 'razonSocial')
	on conflict (clave) do update
		set nombre = excluded.nombre, razon_social = excluded.razon_social
	returning * into fila;
	return public.json_cliente(fila);
end
$$;

create or replace function public.api_listar_clientes(p jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_cliente(c) order by c.nombre), '[]'::jsonb) from public.clientes c
$$;

create or replace function public.api_guardar_contrato(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	fila public.contratos;
begin
	if p ? 'id' and p ->> 'id' is not null then
		update public.contratos set
			cliente_id = (p ->> 'clienteId')::uuid,
			numero = btrim(p ->> 'numero'),
			descripcion = public.texto_o_nulo(p ->> 'descripcion'),
			vigencia_inicio = (p ->> 'vigenciaInicio')::date,
			vigencia_fin = (p ->> 'vigenciaFin')::date
		where id = (p ->> 'id')::uuid
		returning * into fila;
		if fila.id is null then
			perform public.error_api('IC404', 'Contrato no encontrado', jsonb_build_object('id', p ->> 'id'));
		end if;
	else
		insert into public.contratos (cliente_id, numero, descripcion, vigencia_inicio, vigencia_fin)
		values ((p ->> 'clienteId')::uuid, btrim(p ->> 'numero'), public.texto_o_nulo(p ->> 'descripcion'),
			(p ->> 'vigenciaInicio')::date, (p ->> 'vigenciaFin')::date)
		returning * into fila;
	end if;
	return public.json_contrato(fila);
exception
	when unique_violation then
		perform public.error_api('IC422', 'Ya existe un contrato con ese número para el cliente',
			jsonb_build_object('motivo', 'contrato_duplicado', 'numero', p ->> 'numero'));
end
$$;

-- Contratos con su vigencia; con «vigentesEn» solo los vigentes en esa fecha.
create or replace function public.api_listar_contratos(p jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_contrato(k) || jsonb_build_object('vigente',
		coalesce((p ->> 'vigentesEn')::date, current_date) between k.vigencia_inicio and k.vigencia_fin)
		order by c.nombre, k.numero), '[]'::jsonb)
	from public.contratos k
	join public.clientes c on c.id = k.cliente_id
	where (p ->> 'clienteClave' is null or c.clave = p ->> 'clienteClave')
		and (p ->> 'vigentesEn' is null
			or (p ->> 'vigentesEn')::date between k.vigencia_inicio and k.vigencia_fin)
$$;

create or replace function public.api_guardar_sitio(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	existente public.sitios;
	fila public.sitios;
begin
	select * into existente from public.sitios
	where clave_normalizada = public.normalizar_clave(p ->> 'clave')
		and id is distinct from (p ->> 'id')::uuid;
	if existente.id is not null then
		perform public.error_api('IC422', 'Ya existe un sitio con la misma clave',
			jsonb_build_object('motivo', 'sitio_duplicado', 'existente', public.json_sitio(existente)));
	end if;
	if p ->> 'id' is not null then
		update public.sitios set clave = btrim(p ->> 'clave'), nombre = coalesce(btrim(p ->> 'nombre'), '')
		where id = (p ->> 'id')::uuid
		returning * into fila;
		if fila.id is null then
			perform public.error_api('IC404', 'Sitio no encontrado', jsonb_build_object('id', p ->> 'id'));
		end if;
	else
		insert into public.sitios (clave, nombre)
		values (btrim(p ->> 'clave'), coalesce(btrim(p ->> 'nombre'), ''))
		returning * into fila;
	end if;
	return public.json_sitio(fila);
end
$$;

create or replace function public.api_asociar_sitio(p jsonb)
returns jsonb
language plpgsql
as $$
begin
	insert into public.contrato_sitios (contrato_id, sitio_id)
	values ((p ->> 'contratoId')::uuid, (p ->> 'sitioId')::uuid)
	on conflict do nothing;
	return jsonb_build_object('contratoId', p ->> 'contratoId', 'sitioId', p ->> 'sitioId');
end
$$;

create or replace function public.api_listar_sitios(p jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_sitio(s) order by s.clave_normalizada), '[]'::jsonb)
	from public.sitios s
	where p ->> 'contratoId' is null
		or exists (select 1 from public.contrato_sitios cs
			where cs.sitio_id = s.id and cs.contrato_id = (p ->> 'contratoId')::uuid)
$$;

-- Guarda una partida completa: datos, alcances, herramientas y equipos (los hijos se reemplazan).
create or replace function public.api_guardar_partida(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_partida uuid := coalesce((p ->> 'id')::uuid, gen_random_uuid());
	existente uuid;
begin
	select id into existente from public.partidas
	where contrato_id = (p ->> 'contratoId')::uuid
		and sitio_id = (p ->> 'sitioId')::uuid
		and numero_normalizado = public.normalizar_numero_partida(p ->> 'numero')
		and id <> id_partida;
	if existente is not null then
		perform public.error_api('IC422', 'El número de partida ya existe en el contrato y sitio',
			jsonb_build_object('motivo', 'partida_duplicada', 'partidaId', existente, 'numero', p ->> 'numero'));
	end if;

	insert into public.partidas as t (
		id, contrato_id, sitio_id, numero, actividad, nombre_corto, descripcion, distribucion,
		periodicidad, cantidad_anual, entrega, requiere_odm, requiere_pt, requiere_ast, materiales_por,
		reportes_homologados, tipo_mantenimiento, objetivo, conclusiones_base, disposicion_fotos,
		propone_verificacion, estado_catalogo
	) values (
		id_partida, (p ->> 'contratoId')::uuid, (p ->> 'sitioId')::uuid, btrim(p ->> 'numero'),
		btrim(p ->> 'actividad'), public.texto_o_nulo(p ->> 'nombreCorto'),
		public.texto_o_nulo(p ->> 'descripcion'), public.texto_o_nulo(p ->> 'distribucion'),
		p ->> 'periodicidad', (p ->> 'cantidadAnual')::numeric, public.texto_o_nulo(p ->> 'entrega'),
		coalesce((p ->> 'requiereOdm')::boolean, false), coalesce((p ->> 'requierePt')::boolean, false),
		coalesce((p ->> 'requiereAst')::boolean, false), public.texto_o_nulo(p ->> 'materialesPor'),
		public.texto_o_nulo(p ->> 'reportesHomologados'),
		coalesce(public.texto_o_nulo(p ->> 'tipoMantenimiento'), 'Preventivo'),
		public.texto_o_nulo(p ->> 'objetivo'), public.texto_o_nulo(p ->> 'conclusionesBase'),
		coalesce(p ->> 'disposicionFotos', 'cuadricula'),
		coalesce((p ->> 'proponeVerificacion')::boolean, false),
		coalesce(p ->> 'estadoCatalogo', 'confirmado')
	)
	on conflict (id) do update set
		contrato_id = excluded.contrato_id, sitio_id = excluded.sitio_id, numero = excluded.numero,
		actividad = excluded.actividad, nombre_corto = excluded.nombre_corto,
		descripcion = excluded.descripcion, distribucion = excluded.distribucion,
		periodicidad = excluded.periodicidad, cantidad_anual = excluded.cantidad_anual,
		entrega = excluded.entrega, requiere_odm = excluded.requiere_odm,
		requiere_pt = excluded.requiere_pt, requiere_ast = excluded.requiere_ast,
		materiales_por = excluded.materiales_por, reportes_homologados = excluded.reportes_homologados,
		tipo_mantenimiento = excluded.tipo_mantenimiento, objetivo = excluded.objetivo,
		conclusiones_base = excluded.conclusiones_base, disposicion_fotos = excluded.disposicion_fotos,
		propone_verificacion = excluded.propone_verificacion, estado_catalogo = excluded.estado_catalogo;

	if p ? 'alcances' then
		delete from public.partida_alcances where partida_id = id_partida;
		insert into public.partida_alcances (partida_id, orden, tipo, texto)
		select id_partida, a.posicion, coalesce(a.valor ->> 'tipo', 'alcance'), btrim(a.valor ->> 'texto')
		from jsonb_array_elements(p -> 'alcances') with ordinality as a(valor, posicion);
	end if;
	if p ? 'herramientas' then
		delete from public.partida_herramientas where partida_id = id_partida;
		insert into public.partida_herramientas (partida_id, orden, cantidad, descripcion)
		select id_partida, h.posicion, public.texto_o_nulo(h.valor ->> 'cantidad'), btrim(h.valor ->> 'descripcion')
		from jsonb_array_elements(p -> 'herramientas') with ordinality as h(valor, posicion);
	end if;
	if p ? 'equipoIds' then
		delete from public.partida_equipos where partida_id = id_partida;
		insert into public.partida_equipos (partida_id, equipo_id)
		select id_partida, (e.valor #>> '{}')::uuid from jsonb_array_elements(p -> 'equipoIds') as e(valor);
	end if;
	return public.json_partida(id_partida);
end
$$;

create or replace function public.api_obtener_partida(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
	resultado jsonb := public.json_partida((p ->> 'id')::uuid);
begin
	if resultado is null then
		perform public.error_api('IC404', 'Partida no encontrada', jsonb_build_object('id', p ->> 'id'));
	end if;
	return resultado;
end
$$;

create or replace function public.api_listar_partidas(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(jsonb_build_object(
		'id', t.id, 'contratoId', t.contrato_id, 'sitioId', t.sitio_id, 'numero', t.numero,
		'actividad', t.actividad, 'nombreCorto', t.nombre_corto, 'periodicidad', t.periodicidad,
		'distribucion', t.distribucion, 'cantidadAnual', t.cantidad_anual,
		'disposicionFotos', t.disposicion_fotos, 'proponeVerificacion', t.propone_verificacion,
		'estadoCatalogo', t.estado_catalogo,
		'tieneEquipos', exists (select 1 from public.partida_equipos pe where pe.partida_id = t.id)
	) order by
		case when t.numero_normalizado ~ '^[0-9]+$' then t.numero_normalizado::integer end,
		t.numero_normalizado), '[]'::jsonb)
	from public.partidas t
	where (p ->> 'contratoId' is null or t.contrato_id = (p ->> 'contratoId')::uuid)
		and (p ->> 'sitioId' is null or t.sitio_id = (p ->> 'sitioId')::uuid)
		and (p ->> 'estadoCatalogo' is null or t.estado_catalogo = p ->> 'estadoCatalogo')
$$;

create or replace function public.api_confirmar_partida(p jsonb)
returns jsonb
language plpgsql
as $$
begin
	update public.partidas set estado_catalogo = 'confirmado' where id = (p ->> 'id')::uuid;
	if not found then
		perform public.error_api('IC404', 'Partida no encontrada', jsonb_build_object('id', p ->> 'id'));
	end if;
	return public.json_partida((p ->> 'id')::uuid);
end
$$;

create or replace function public.api_guardar_equipo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	existente uuid;
	fila public.equipos;
begin
	select id into existente from public.equipos
	where sitio_id = (p ->> 'sitioId')::uuid
		and tag_normalizado = public.normalizar_clave(p ->> 'tag')
		and id is distinct from (p ->> 'id')::uuid;
	if existente is not null then
		perform public.error_api('IC422', 'El TAG ya existe en el sitio',
			jsonb_build_object('motivo', 'equipo_duplicado', 'equipoId', existente, 'tag', p ->> 'tag'));
	end if;
	insert into public.equipos as t (id, sitio_id, tag, tipo, marca, modelo, rango, numero_serie)
	values (coalesce((p ->> 'id')::uuid, gen_random_uuid()), (p ->> 'sitioId')::uuid, btrim(p ->> 'tag'),
		public.texto_o_nulo(p ->> 'tipo'), public.texto_o_nulo(p ->> 'marca'),
		public.texto_o_nulo(p ->> 'modelo'), public.texto_o_nulo(p ->> 'rango'),
		public.texto_o_nulo(p ->> 'numeroSerie'))
	on conflict (id) do update set
		sitio_id = excluded.sitio_id, tag = excluded.tag, tipo = excluded.tipo, marca = excluded.marca,
		modelo = excluded.modelo, rango = excluded.rango, numero_serie = excluded.numero_serie
	returning * into fila;
	return public.json_equipo(fila);
end
$$;

create or replace function public.api_listar_equipos(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_equipo(e) order by e.tag_normalizado), '[]'::jsonb)
	from public.equipos e
	where e.sitio_id = (p ->> 'sitioId')::uuid
$$;

create or replace function public.api_guardar_firmante(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	fila public.firmantes;
begin
	insert into public.firmantes as t (id, contrato_id, funcion, nombre, cargo, empresa, vigente_desde, vigente_hasta)
	values (coalesce((p ->> 'id')::uuid, gen_random_uuid()), (p ->> 'contratoId')::uuid, p ->> 'funcion',
		btrim(p ->> 'nombre'), coalesce(btrim(p ->> 'cargo'), ''), coalesce(btrim(p ->> 'empresa'), ''),
		(p ->> 'vigenteDesde')::date, (p ->> 'vigenteHasta')::date)
	on conflict (id) do update set
		funcion = excluded.funcion, nombre = excluded.nombre, cargo = excluded.cargo,
		empresa = excluded.empresa, vigente_desde = excluded.vigente_desde,
		vigente_hasta = excluded.vigente_hasta
	returning * into fila;
	return public.json_firmante(fila);
end
$$;

create or replace function public.api_listar_firmantes(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_firmante(f) order by f.funcion, f.vigente_desde desc), '[]'::jsonb)
	from public.firmantes f
	where f.contrato_id = (p ->> 'contratoId')::uuid
$$;

-- Firmante vigente de cada función en una fecha (nulo si no hay).
create or replace function public.api_firmantes_vigentes(p jsonb)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'elaboro', (select public.json_firmante(f) from public.firmantes f where f.contrato_id = k.id
			and f.funcion = 'elaboro' and fecha.valor between f.vigente_desde and coalesce(f.vigente_hasta, 'infinity')),
		'aprobo', (select public.json_firmante(f) from public.firmantes f where f.contrato_id = k.id
			and f.funcion = 'aprobo' and fecha.valor between f.vigente_desde and coalesce(f.vigente_hasta, 'infinity')),
		'recibio', (select public.json_firmante(f) from public.firmantes f where f.contrato_id = k.id
			and f.funcion = 'recibio' and fecha.valor between f.vigente_desde and coalesce(f.vigente_hasta, 'infinity'))
	)
	from public.contratos k,
		lateral (select coalesce((p ->> 'fecha')::date, current_date) as valor) fecha
	where k.id = (p ->> 'contratoId')::uuid
$$;
