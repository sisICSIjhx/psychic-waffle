-- esquema_completo.sql: GENERADO con «npm run bd:script» a partir de supabase/migrations/.
-- No editar a mano: cambie o agregue una migración y vuelva a generarlo.
--
-- Crea en una base VACÍA de Supabase todo el esquema de ICSI Reportes: catálogo (clientes =
-- proyectos, contratos, sitios, partidas, alcances predeterminados, equipos y firmantes), programa
-- anual con ajustes, reportes con fotos y documentos, bitácora del catálogo y personal con rol y
-- proyectos. La aplicación solo usa las funciones public.api_* con la clave de servicio.
--
-- Fotos: se guardarán en SharePoint; la base conserva solo sus URL (reporte_fotos.almacenamiento =
-- 'sharepoint', url_original y url_optimizada). Los archivos no se suben a Supabase Storage.
--
-- Uso: pegar en Supabase > SQL Editor y ejecutar, o
--   psql "<cadena de conexión>" -f supabase/esquema_completo.sql
-- Si falla, la transacción se revierte completa. Para una base que ya tiene migraciones aplicadas,
-- use la CLI de Supabase con la carpeta supabase/migrations.

begin;

create schema if not exists interno;
create table if not exists interno.migraciones (nombre text primary key, aplicada_en timestamptz not null default now());

-- =============================================================================================
-- 0001_catalogo.sql
-- =============================================================================================
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
	-- Serializa las altas concurrentes del mismo contrato antes de comprobar el traslape.
	perform 1 from public.contratos where id = new.contrato_id for update;
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

insert into interno.migraciones (nombre) values ('0001_catalogo.sql') on conflict do nothing;

-- =============================================================================================
-- 0002_programa.sql
-- =============================================================================================
-- 0002_programa.sql
-- Programa anual de operación y mantenimiento por contrato y sitio: cantidades programadas por
-- partida y mes, y realizados registrados manualmente (trabajos documentados fuera del sistema).
-- La vista de realizado y la consulta del avance se crean en 0003, porque dependen de «reportes».

create table public.programas (
	id uuid primary key default gen_random_uuid(),
	contrato_id uuid not null,
	sitio_id uuid not null,
	nombre text,
	periodo_inicio date not null,
	periodo_fin date not null,
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint programas_sitio_del_contrato foreign key (contrato_id, sitio_id)
		references public.contrato_sitios (contrato_id, sitio_id) on delete restrict,
	constraint programas_periodo check (periodo_fin > periodo_inicio),
	constraint programas_periodo_unico unique (contrato_id, sitio_id, periodo_inicio)
);

create table public.programa_meses (
	programa_id uuid not null references public.programas (id) on delete cascade,
	partida_id uuid not null references public.partidas (id) on delete cascade,
	-- Primer día del mes.
	mes date not null check (extract(day from mes) = 1),
	cantidad numeric not null check (cantidad >= 0),
	primary key (programa_id, partida_id, mes)
);

create table public.programa_realizados_manuales (
	id uuid primary key default gen_random_uuid(),
	programa_id uuid not null references public.programas (id) on delete cascade,
	partida_id uuid not null references public.partidas (id) on delete cascade,
	mes date not null check (extract(day from mes) = 1),
	cantidad numeric not null check (cantidad > 0),
	nota text not null check (btrim(nota) <> ''),
	registrado_en timestamptz not null default now()
);
create index programa_realizados_partida_idx on public.programa_realizados_manuales (partida_id, mes);

create trigger programas_actualizado before update on public.programas
	for each row execute function public.tocar_actualizado_en();

-- Un contrato y sitio no tienen programas con periodos superpuestos, y un periodo no se acorta ni
-- se desplaza si deja fuera meses programados o realizados ya registrados.
create or replace function public.validar_programa()
returns trigger
language plpgsql
as $$
declare
	superpuesto uuid;
begin
	-- Serializa los cambios del mismo contrato antes de comprobar superposiciones.
	perform 1 from public.contratos where id = new.contrato_id for update;
	select g.id into superpuesto
	from public.programas g
	where g.contrato_id = new.contrato_id and g.sitio_id = new.sitio_id and g.id <> new.id
		and daterange(g.periodo_inicio, g.periodo_fin, '[]') && daterange(new.periodo_inicio, new.periodo_fin, '[]')
	limit 1;
	if superpuesto is not null then
		perform public.error_api('IC422', 'El periodo se superpone con otro programa del contrato y sitio',
			jsonb_build_object('motivo', 'programa_superpuesto', 'programaId', superpuesto));
	end if;
	if tg_op = 'UPDATE' and (
		exists (select 1 from public.programa_meses m where m.programa_id = new.id
			and (m.mes < public.primer_dia_mes(new.periodo_inicio) or m.mes > new.periodo_fin))
		or exists (select 1 from public.programa_realizados_manuales m where m.programa_id = new.id
			and (m.mes < public.primer_dia_mes(new.periodo_inicio) or m.mes > new.periodo_fin))
	) then
		perform public.error_api('IC422', 'El nuevo periodo deja fuera meses ya registrados',
			jsonb_build_object('motivo', 'periodo_con_datos_fuera'));
	end if;
	return new;
end
$$;
create trigger programas_validar before insert or update on public.programas
	for each row execute function public.validar_programa();

-- La partida de un mes programado o realizado pertenece al mismo contrato y sitio del programa, y
-- el mes cae dentro del periodo.
create or replace function public.validar_mes_programa()
returns trigger
language plpgsql
as $$
declare
	programa public.programas;
	partida public.partidas;
begin
	select * into programa from public.programas where id = new.programa_id;
	select * into partida from public.partidas where id = new.partida_id;
	if partida.contrato_id <> programa.contrato_id or partida.sitio_id <> programa.sitio_id then
		perform public.error_api('IC422', 'La partida no pertenece al contrato y sitio del programa',
			jsonb_build_object('motivo', 'partida_de_otro_programa', 'partidaId', new.partida_id));
	end if;
	if new.mes < public.primer_dia_mes(programa.periodo_inicio) or new.mes > programa.periodo_fin then
		perform public.error_api('IC422', 'El mes está fuera del periodo del programa',
			jsonb_build_object('motivo', 'mes_fuera_de_periodo', 'mes', new.mes));
	end if;
	return new;
end
$$;
create trigger programa_meses_validar before insert or update on public.programa_meses
	for each row execute function public.validar_mes_programa();
create trigger programa_realizados_validar before insert or update on public.programa_realizados_manuales
	for each row execute function public.validar_mes_programa();

-- Meses del periodo, en orden (p. ej. de mayo de 2026 a abril de 2027).
create or replace function public.meses_del_periodo(inicio date, fin date)
returns setof date
language sql
stable
as $$
	select generate_series(public.primer_dia_mes(inicio)::timestamp, public.primer_dia_mes(fin)::timestamp,
		interval '1 month')::date
$$;

create or replace function public.json_programa(g public.programas)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', g.id, 'contratoId', g.contrato_id, 'sitioId', g.sitio_id, 'nombre', g.nombre,
		'periodoInicio', g.periodo_inicio, 'periodoFin', g.periodo_fin,
		'meses', (select jsonb_agg(m order by m) from public.meses_del_periodo(g.periodo_inicio, g.periodo_fin) m)
	)
$$;

create or replace function public.api_guardar_programa(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	fila public.programas;
begin
	insert into public.programas as t (id, contrato_id, sitio_id, nombre, periodo_inicio, periodo_fin)
	values (coalesce((p ->> 'id')::uuid, gen_random_uuid()), (p ->> 'contratoId')::uuid,
		(p ->> 'sitioId')::uuid, public.texto_o_nulo(p ->> 'nombre'), (p ->> 'periodoInicio')::date,
		(p ->> 'periodoFin')::date)
	on conflict (id) do update set
		nombre = excluded.nombre, periodo_inicio = excluded.periodo_inicio, periodo_fin = excluded.periodo_fin
	returning * into fila;
	return public.json_programa(fila);
exception
	when unique_violation then
		perform public.error_api('IC422', 'Ya existe un programa con ese periodo para el contrato y sitio',
			jsonb_build_object('motivo', 'programa_duplicado'));
end
$$;

create or replace function public.api_listar_programas(p jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(public.json_programa(g) order by g.periodo_inicio desc), '[]'::jsonb)
	from public.programas g
	where (p ->> 'contratoId' is null or g.contrato_id = (p ->> 'contratoId')::uuid)
		and (p ->> 'sitioId' is null or g.sitio_id = (p ->> 'sitioId')::uuid)
$$;

-- Fija las cantidades programadas; una cantidad nula elimina el mes de esa partida.
create or replace function public.api_guardar_meses_programa(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_programa uuid := (p ->> 'programaId')::uuid;
	celda jsonb;
begin
	for celda in select * from jsonb_array_elements(coalesce(p -> 'meses', '[]'::jsonb)) loop
		if celda ->> 'cantidad' is null then
			delete from public.programa_meses
			where programa_id = id_programa and partida_id = (celda ->> 'partidaId')::uuid
				and mes = public.primer_dia_mes((celda ->> 'mes')::date);
		else
			insert into public.programa_meses (programa_id, partida_id, mes, cantidad)
			values (id_programa, (celda ->> 'partidaId')::uuid, public.primer_dia_mes((celda ->> 'mes')::date),
				(celda ->> 'cantidad')::numeric)
			on conflict (programa_id, partida_id, mes) do update set cantidad = excluded.cantidad;
		end if;
	end loop;
	return jsonb_build_object('programaId', id_programa,
		'meses', (select count(*) from public.programa_meses where programa_id = id_programa));
end
$$;

create or replace function public.api_registrar_realizado_manual(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	fila public.programa_realizados_manuales;
begin
	insert into public.programa_realizados_manuales (programa_id, partida_id, mes, cantidad, nota)
	values ((p ->> 'programaId')::uuid, (p ->> 'partidaId')::uuid,
		public.primer_dia_mes((p ->> 'mes')::date), coalesce((p ->> 'cantidad')::numeric, 1), p ->> 'nota')
	returning * into fila;
	return jsonb_build_object('id', fila.id, 'programaId', fila.programa_id, 'partidaId', fila.partida_id,
		'mes', fila.mes, 'cantidad', fila.cantidad, 'nota', fila.nota, 'registradoEn', fila.registrado_en);
end
$$;

insert into interno.migraciones (nombre) values ('0002_programa.sql') on conflict do nothing;

-- =============================================================================================
-- 0003_reportes.sql
-- =============================================================================================
-- 0003_reportes.sql
-- Reportes FOR-ICSI-RMT-01 con sus alcances, fotos, herramientas, equipos y documentos generados;
-- concurrencia optimista («version»), estados y revisiones; vista de realizado del programa.
--
-- Estados: borrador → en_revision → emitido; en_revision → borrador (devolución). Un reporte
-- emitido no se modifica: se corrige con una nueva revisión que, al emitirse, deja la anterior como
-- «sustituido». Solo los reportes emitidos cuentan como realizados.

create table public.reportes (
	id uuid primary key default gen_random_uuid(),
	contrato_id uuid not null references public.contratos (id) on delete restrict,
	sitio_id uuid not null references public.sitios (id) on delete restrict,
	partida_id uuid not null references public.partidas (id) on delete restrict,
	-- Primer día del mes del periodo.
	periodo_mes date not null check (extract(day from periodo_mes) = 1),
	ocurrencia_tipo text check (ocurrencia_tipo in ('semana', 'quincena', 'dia')),
	ocurrencia_numero integer check (ocurrencia_numero > 0),
	fecha_ejecucion date,
	titulo text not null,
	-- Copias del encabezado al crear el reporte; conservan lo emitido aunque cambie el catálogo.
	usuario text not null default '',
	contrato_texto text not null default '',
	sitio_texto text not null default '',
	periodicidad text not null default '',
	tipo_mantenimiento text not null default 'Preventivo',
	actividad text not null default '',
	numero_partida text not null default '',
	nombre_corto text,
	objetivo text not null default '',
	introduccion text not null default '',
	conclusiones text not null default '',
	disposicion_fotos text not null default 'cuadricula'
		check (disposicion_fotos in ('cuadricula', 'antes_durante_despues')),
	incluye_verificacion boolean not null default false,
	firmantes jsonb not null default '{}'::jsonb,
	estado text not null default 'borrador'
		check (estado in ('borrador', 'en_revision', 'emitido', 'sustituido')),
	version integer not null default 1 check (version > 0),
	revision integer not null default 0 check (revision >= 0),
	sustituye_a uuid references public.reportes (id) on delete restrict,
	emitido_en timestamptz,
	creado_en timestamptz not null default now(),
	actualizado_en timestamptz not null default now(),
	constraint reportes_ocurrencia_completa check ((ocurrencia_tipo is null) = (ocurrencia_numero is null)),
	constraint reportes_fecha_en_periodo check (
		fecha_ejecucion is null or public.primer_dia_mes(fecha_ejecucion) = periodo_mes
	),
	constraint reportes_una_revision unique (sustituye_a)
);
create index reportes_partida_mes_idx on public.reportes (partida_id, periodo_mes);
create index reportes_estado_idx on public.reportes (estado);

create table public.reporte_alcances (
	id uuid primary key default gen_random_uuid(),
	reporte_id uuid not null references public.reportes (id) on delete cascade,
	orden integer not null check (orden > 0),
	titulo text not null default '',
	descripcion text not null default '',
	estado_verificacion text not null default 'pendiente'
		check (estado_verificacion in ('pendiente', 'ok', 'no_aplica', 'con_observacion')),
	observaciones text not null default '',
	partida_alcance_id uuid references public.partida_alcances (id) on delete set null,
	constraint reporte_alcances_orden_unico unique (reporte_id, orden) deferrable initially deferred
);

create table public.reporte_fotos (
	id uuid primary key default gen_random_uuid(),
	reporte_alcance_id uuid not null references public.reporte_alcances (id) on delete cascade,
	orden integer not null check (orden > 0),
	descripcion text not null default '',
	momento text check (momento in ('antes', 'durante', 'despues')),
	ruta_original text not null,
	ruta_optimizada text not null,
	ancho integer not null check (ancho > 0),
	alto integer not null check (alto > 0),
	bytes integer not null check (bytes > 0),
	tipo_mime text not null,
	creado_en timestamptz not null default now(),
	constraint reporte_fotos_orden_unico unique (reporte_alcance_id, orden) deferrable initially deferred
);

create table public.reporte_herramientas (
	id uuid primary key default gen_random_uuid(),
	reporte_id uuid not null references public.reportes (id) on delete cascade,
	orden integer not null check (orden > 0),
	cantidad text,
	descripcion text not null check (btrim(descripcion) <> ''),
	constraint reporte_herramientas_orden_unico unique (reporte_id, orden) deferrable initially deferred
);

-- El orden define el encabezado y el primer TAG del nombre de archivo. El TAG se copia al asociar
-- el equipo, para que una corrección posterior del catálogo no altere reportes ya capturados.
create table public.reporte_equipos (
	reporte_id uuid not null references public.reportes (id) on delete cascade,
	equipo_id uuid not null references public.equipos (id) on delete restrict,
	orden integer not null check (orden > 0),
	tag text not null,
	primary key (reporte_id, equipo_id),
	constraint reporte_equipos_orden_unico unique (reporte_id, orden) deferrable initially deferred
);

-- Solo equipos del sitio del reporte; el TAG se toma del catálogo si no viene.
create or replace function public.validar_reporte_equipo()
returns trigger
language plpgsql
as $$
declare
	equipo public.equipos;
begin
	select * into equipo from public.equipos where id = new.equipo_id;
	if equipo.sitio_id is distinct from (select sitio_id from public.reportes where id = new.reporte_id) then
		perform public.error_api('IC422', 'El equipo no pertenece al sitio del reporte',
			jsonb_build_object('motivo', 'equipo_de_otro_sitio', 'equipoId', new.equipo_id));
	end if;
	new.tag := coalesce(new.tag, equipo.tag);
	return new;
end
$$;
create trigger reporte_equipos_mismo_sitio before insert or update on public.reporte_equipos
	for each row execute function public.validar_reporte_equipo();

create table public.documentos_generados (
	id uuid primary key default gen_random_uuid(),
	reporte_id uuid not null references public.reportes (id) on delete cascade,
	reporte_version integer not null,
	version_plantilla text not null,
	ruta text not null,
	nombre_archivo text not null,
	bytes integer not null check (bytes > 0),
	generado_en timestamptz not null default now()
);
create index documentos_generados_reporte_idx on public.documentos_generados (reporte_id, generado_en desc);

create trigger reportes_actualizado before update on public.reportes
	for each row execute function public.tocar_actualizado_en();

-- ---------------------------------------------------------------------------------------------
-- Representación JSON
-- ---------------------------------------------------------------------------------------------

create or replace function public.json_foto(f public.reporte_fotos)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', f.id, 'alcanceId', f.reporte_alcance_id, 'orden', f.orden, 'descripcion', f.descripcion,
		'momento', f.momento, 'rutaOriginal', f.ruta_original, 'rutaOptimizada', f.ruta_optimizada,
		'ancho', f.ancho, 'alto', f.alto, 'bytes', f.bytes, 'tipoMime', f.tipo_mime
	)
$$;

create or replace function public.json_reporte(id_reporte uuid)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', r.id, 'contratoId', r.contrato_id, 'sitioId', r.sitio_id, 'partidaId', r.partida_id,
		'periodoMes', r.periodo_mes,
		'ocurrencia', case when r.ocurrencia_tipo is null then null
			else jsonb_build_object('tipo', r.ocurrencia_tipo, 'numero', r.ocurrencia_numero) end,
		'fechaEjecucion', r.fecha_ejecucion, 'titulo', r.titulo, 'usuario', r.usuario,
		'contratoTexto', r.contrato_texto, 'sitioTexto', r.sitio_texto, 'periodicidad', r.periodicidad,
		'tipoMantenimiento', r.tipo_mantenimiento, 'actividad', r.actividad,
		'numeroPartida', r.numero_partida, 'nombreCorto', r.nombre_corto, 'objetivo', r.objetivo,
		'introduccion', r.introduccion, 'conclusiones', r.conclusiones,
		'disposicionFotos', r.disposicion_fotos, 'incluyeVerificacion', r.incluye_verificacion,
		'firmantes', r.firmantes, 'estado', r.estado, 'version', r.version, 'revision', r.revision,
		'sustituyeA', r.sustituye_a, 'emitidoEn', r.emitido_en, 'creadoEn', r.creado_en,
		'actualizadoEn', r.actualizado_en,
		'alcances', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', a.id, 'orden', a.orden, 'titulo', a.titulo, 'descripcion', a.descripcion,
				'estadoVerificacion', a.estado_verificacion, 'observaciones', a.observaciones,
				'partidaAlcanceId', a.partida_alcance_id,
				'fotos', coalesce((select jsonb_agg(public.json_foto(f) order by f.orden)
					from public.reporte_fotos f where f.reporte_alcance_id = a.id), '[]'::jsonb)
			) order by a.orden)
			from public.reporte_alcances a where a.reporte_id = r.id
		), '[]'::jsonb),
		'herramientas', coalesce((
			select jsonb_agg(jsonb_build_object('id', h.id, 'orden', h.orden, 'cantidad', h.cantidad,
				'descripcion', h.descripcion) order by h.orden)
			from public.reporte_herramientas h where h.reporte_id = r.id
		), '[]'::jsonb),
		'equipos', coalesce((
			select jsonb_agg(public.json_equipo(e) || jsonb_build_object('orden', re.orden, 'tag', re.tag)
				order by re.orden)
			from public.reporte_equipos re join public.equipos e on e.id = re.equipo_id
			where re.reporte_id = r.id
		), '[]'::jsonb),
		'documentos', coalesce((
			select jsonb_agg(jsonb_build_object('id', d.id, 'reporteVersion', d.reporte_version,
				'versionPlantilla', d.version_plantilla, 'ruta', d.ruta, 'nombreArchivo', d.nombre_archivo,
				'bytes', d.bytes, 'generadoEn', d.generado_en) order by d.generado_en desc)
			from public.documentos_generados d where d.reporte_id = r.id
		), '[]'::jsonb)
	)
	from public.reportes r
	where r.id = id_reporte
$$;

-- ---------------------------------------------------------------------------------------------
-- API de reportes
-- ---------------------------------------------------------------------------------------------

-- Reporte bloqueado para modificarlo; verifica existencia, estado editable y versión esperada.
create or replace function public.reporte_para_editar(id_reporte uuid, version_esperada integer)
returns public.reportes
language plpgsql
as $$
declare
	fila public.reportes;
begin
	select * into fila from public.reportes where id = id_reporte for update;
	if fila.id is null then
		perform public.error_api('IC404', 'Reporte no encontrado', jsonb_build_object('id', id_reporte));
	end if;
	if version_esperada is not null and fila.version <> version_esperada then
		perform public.error_api('IC409', 'Otra persona modificó el reporte; hay una versión más reciente',
			jsonb_build_object('motivo', 'version', 'versionActual', fila.version));
	end if;
	return fila;
end
$$;

create or replace function public.reemplazar_hijos_reporte(id_reporte uuid, p jsonb)
returns void
language plpgsql
as $$
begin
	if p ? 'herramientas' then
		delete from public.reporte_herramientas where reporte_id = id_reporte;
		insert into public.reporte_herramientas (reporte_id, orden, cantidad, descripcion)
		select id_reporte, h.posicion, public.texto_o_nulo(h.valor ->> 'cantidad'), btrim(h.valor ->> 'descripcion')
		from jsonb_array_elements(p -> 'herramientas') with ordinality as h(valor, posicion)
		where public.texto_o_nulo(h.valor ->> 'descripcion') is not null;
	end if;
	if p ? 'equipoIds' then
		delete from public.reporte_equipos where reporte_id = id_reporte;
		insert into public.reporte_equipos (reporte_id, equipo_id, orden)
		select id_reporte, (e.valor #>> '{}')::uuid, e.posicion
		from jsonb_array_elements(p -> 'equipoIds') with ordinality as e(valor, posicion);
	end if;
end
$$;

-- Inserta un reporte nuevo ya prellenado (la composición del título y del contenido se hace en el
-- dominio de la aplicación).
create or replace function public.api_insertar_reporte(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_reporte uuid := coalesce((p ->> 'id')::uuid, gen_random_uuid());
	partida public.partidas;
begin
	select * into partida from public.partidas where id = (p ->> 'partidaId')::uuid;
	if partida.id is null then
		perform public.error_api('IC404', 'Partida no encontrada', jsonb_build_object('id', p ->> 'partidaId'));
	end if;
	insert into public.reportes (
		id, contrato_id, sitio_id, partida_id, periodo_mes, ocurrencia_tipo, ocurrencia_numero,
		fecha_ejecucion, titulo, usuario, contrato_texto, sitio_texto, periodicidad, tipo_mantenimiento,
		actividad, numero_partida, nombre_corto, objetivo, introduccion, conclusiones, disposicion_fotos,
		incluye_verificacion, firmantes
	) values (
		id_reporte, partida.contrato_id, partida.sitio_id, partida.id,
		public.primer_dia_mes((p ->> 'periodoMes')::date), p #>> '{ocurrencia,tipo}',
		(p #>> '{ocurrencia,numero}')::integer, (p ->> 'fechaEjecucion')::date, p ->> 'titulo',
		coalesce(p ->> 'usuario', ''), coalesce(p ->> 'contratoTexto', ''), coalesce(p ->> 'sitioTexto', ''),
		coalesce(p ->> 'periodicidad', ''), coalesce(p ->> 'tipoMantenimiento', 'Preventivo'),
		coalesce(p ->> 'actividad', partida.actividad), coalesce(p ->> 'numeroPartida', partida.numero),
		public.texto_o_nulo(p ->> 'nombreCorto'), coalesce(p ->> 'objetivo', ''),
		coalesce(p ->> 'introduccion', ''), coalesce(p ->> 'conclusiones', ''),
		coalesce(p ->> 'disposicionFotos', partida.disposicion_fotos),
		coalesce((p ->> 'incluyeVerificacion')::boolean, partida.propone_verificacion),
		coalesce(p -> 'firmantes', '{}'::jsonb)
	);
	insert into public.reporte_alcances (reporte_id, orden, titulo, descripcion, partida_alcance_id)
	select id_reporte, a.posicion, coalesce(a.valor ->> 'titulo', ''), coalesce(a.valor ->> 'descripcion', ''),
		(a.valor ->> 'partidaAlcanceId')::uuid
	from jsonb_array_elements(coalesce(p -> 'alcances', '[]'::jsonb)) with ordinality as a(valor, posicion);
	perform public.reemplazar_hijos_reporte(id_reporte, p);
	return public.json_reporte(id_reporte);
end
$$;

create or replace function public.api_obtener_reporte(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
	resultado jsonb := public.json_reporte((p ->> 'id')::uuid);
begin
	if resultado is null then
		perform public.error_api('IC404', 'Reporte no encontrado', jsonb_build_object('id', p ->> 'id'));
	end if;
	return resultado;
end
$$;

-- Guarda el estado completo de un borrador con concurrencia optimista. Las fotos ya cargadas se
-- reordenan o se mueven entre alcances del mismo reporte; las que no aparecen se eliminan y sus
-- rutas se devuelven para limpiar el almacenamiento.
create or replace function public.api_guardar_reporte(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_reporte uuid := (p ->> 'id')::uuid;
	actual public.reportes := public.reporte_para_editar(id_reporte, (p ->> 'version')::integer);
	alcance jsonb;
	posicion integer;
	id_alcance uuid;
	ids_alcances uuid[] := '{}';
	ids_fotos uuid[] := '{}';
	foto jsonb;
	posicion_foto integer;
	eliminadas jsonb;
begin
	if actual.estado <> 'borrador' then
		perform public.error_api('IC409', 'Solo se puede editar un reporte en borrador',
			jsonb_build_object('motivo', 'estado', 'estado', actual.estado));
	end if;

	update public.reportes set
		fecha_ejecucion = case when p ? 'fechaEjecucion' then (p ->> 'fechaEjecucion')::date
			else fecha_ejecucion end,
		titulo = coalesce(p ->> 'titulo', titulo),
		tipo_mantenimiento = coalesce(p ->> 'tipoMantenimiento', tipo_mantenimiento),
		objetivo = coalesce(p ->> 'objetivo', objetivo),
		introduccion = coalesce(p ->> 'introduccion', introduccion),
		conclusiones = coalesce(p ->> 'conclusiones', conclusiones),
		incluye_verificacion = coalesce((p ->> 'incluyeVerificacion')::boolean, incluye_verificacion),
		firmantes = coalesce(p -> 'firmantes', firmantes),
		version = version + 1
	where id = id_reporte;

	if p ? 'alcances' then
		posicion := 0;
		for alcance in select * from jsonb_array_elements(p -> 'alcances') loop
			posicion := posicion + 1;
			id_alcance := (alcance ->> 'id')::uuid;
			if id_alcance is not null
				and exists (select 1 from public.reporte_alcances where id = id_alcance and reporte_id = id_reporte) then
				update public.reporte_alcances set
					orden = posicion,
					titulo = coalesce(alcance ->> 'titulo', ''),
					descripcion = coalesce(alcance ->> 'descripcion', ''),
					estado_verificacion = coalesce(alcance ->> 'estadoVerificacion', 'pendiente'),
					observaciones = coalesce(alcance ->> 'observaciones', '')
				where id = id_alcance;
			else
				insert into public.reporte_alcances (id, reporte_id, orden, titulo, descripcion,
					estado_verificacion, observaciones, partida_alcance_id)
				values (coalesce(id_alcance, gen_random_uuid()), id_reporte, posicion,
					coalesce(alcance ->> 'titulo', ''), coalesce(alcance ->> 'descripcion', ''),
					coalesce(alcance ->> 'estadoVerificacion', 'pendiente'),
					coalesce(alcance ->> 'observaciones', ''), (alcance ->> 'partidaAlcanceId')::uuid)
				returning id into id_alcance;
			end if;
			ids_alcances := ids_alcances || id_alcance;

			posicion_foto := 0;
			for foto in select * from jsonb_array_elements(coalesce(alcance -> 'fotos', '[]'::jsonb)) loop
				posicion_foto := posicion_foto + 1;
				update public.reporte_fotos f set
					reporte_alcance_id = id_alcance,
					orden = posicion_foto,
					descripcion = coalesce(foto ->> 'descripcion', ''),
					momento = foto ->> 'momento'
				from public.reporte_alcances a
				where f.id = (foto ->> 'id')::uuid and a.id = f.reporte_alcance_id and a.reporte_id = id_reporte;
				if found then
					ids_fotos := ids_fotos || (foto ->> 'id')::uuid;
				end if;
			end loop;
		end loop;

		select coalesce(jsonb_agg(jsonb_build_object('rutaOriginal', f.ruta_original,
			'rutaOptimizada', f.ruta_optimizada)), '[]'::jsonb)
		into eliminadas
		from public.reporte_fotos f join public.reporte_alcances a on a.id = f.reporte_alcance_id
		where a.reporte_id = id_reporte and not (f.id = any (ids_fotos));

		delete from public.reporte_fotos f using public.reporte_alcances a
		where a.id = f.reporte_alcance_id and a.reporte_id = id_reporte and not (f.id = any (ids_fotos));

		-- Las revisiones comparten archivos con el original: solo se devuelven las rutas sin uso.
		select coalesce(jsonb_agg(q.ruta), '[]'::jsonb)
		into eliminadas
		from jsonb_array_elements(eliminadas) as q(ruta)
		where not exists (select 1 from public.reporte_fotos f
			where f.ruta_original = q.ruta ->> 'rutaOriginal' or f.ruta_optimizada = q.ruta ->> 'rutaOptimizada');
		delete from public.reporte_alcances where reporte_id = id_reporte and not (id = any (ids_alcances));
	end if;

	perform public.reemplazar_hijos_reporte(id_reporte, p);
	return jsonb_build_object('reporte', public.json_reporte(id_reporte),
		'fotosEliminadas', coalesce(eliminadas, '[]'::jsonb));
end
$$;

-- Agrega una foto al final de un alcance; cuenta como modificación (sube la versión).
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
		ruta_optimizada, ancho, alto, bytes, tipo_mime)
	values ((p ->> 'alcanceId')::uuid,
		coalesce((select max(orden) from public.reporte_fotos where reporte_alcance_id = (p ->> 'alcanceId')::uuid), 0) + 1,
		coalesce(p ->> 'descripcion', ''), p ->> 'momento', p ->> 'rutaOriginal', p ->> 'rutaOptimizada',
		(p ->> 'ancho')::integer, (p ->> 'alto')::integer, (p ->> 'bytes')::integer, p ->> 'tipoMime')
	returning * into fila;
	update public.reportes set version = version + 1 where id = actual.id;
	return jsonb_build_object('foto', public.json_foto(fila), 'version', actual.version + 1);
end
$$;

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
	if destino in ('en_revision', 'emitido') and actual.fecha_ejecucion is null then
		perform public.error_api('IC422', 'Falta la fecha de ejecución',
			jsonb_build_object('motivo', 'validacion', 'campos', jsonb_build_array('fechaEjecucion')));
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

-- Nueva revisión de un reporte emitido: copia completa en borrador, vinculada al original.
create or replace function public.api_crear_revision(p jsonb)
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
			ruta_optimizada, ancho, alto, bytes, tipo_mime)
		select id_alcance, orden, descripcion, momento, ruta_original, ruta_optimizada, ancho, alto, bytes, tipo_mime
		from public.reporte_fotos where reporte_alcance_id = a.id;
	end loop;
	insert into public.reporte_herramientas (reporte_id, orden, cantidad, descripcion)
	select id_nuevo, orden, cantidad, descripcion from public.reporte_herramientas where reporte_id = original.id;
	insert into public.reporte_equipos (reporte_id, equipo_id, orden, tag)
	select id_nuevo, equipo_id, orden, tag from public.reporte_equipos where reporte_id = original.id;
	return public.json_reporte(id_nuevo);
end
$$;

-- Historial con filtros y paginación, del periodo más reciente al más antiguo.
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
			select jsonb_agg(fila order by orden_periodo desc, orden_actualizado desc)
			from (
				select f.periodo_mes as orden_periodo, f.actualizado_en as orden_actualizado,
					jsonb_build_object(
						'id', f.id, 'titulo', f.titulo, 'clienteClave', f.cliente_clave, 'usuario', f.usuario,
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
				order by f.periodo_mes desc, f.actualizado_en desc
				offset ((select numero from pagina) - 1) * (select tamano from pagina)
				limit (select tamano from pagina)
			) paginadas
		), '[]'::jsonb)
	)
$$;

create or replace function public.api_registrar_documento(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	fila public.documentos_generados;
begin
	insert into public.documentos_generados (reporte_id, reporte_version, version_plantilla, ruta,
		nombre_archivo, bytes)
	select r.id, r.version, p ->> 'versionPlantilla', p ->> 'ruta', p ->> 'nombreArchivo', (p ->> 'bytes')::integer
	from public.reportes r where r.id = (p ->> 'reporteId')::uuid
	returning * into fila;
	if fila.id is null then
		perform public.error_api('IC404', 'Reporte no encontrado', jsonb_build_object('id', p ->> 'reporteId'));
	end if;
	return jsonb_build_object('id', fila.id, 'reporteId', fila.reporte_id, 'reporteVersion', fila.reporte_version,
		'versionPlantilla', fila.version_plantilla, 'ruta', fila.ruta, 'nombreArchivo', fila.nombre_archivo,
		'bytes', fila.bytes, 'generadoEn', fila.generado_en);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Realizado del programa
-- ---------------------------------------------------------------------------------------------

-- Ejecuciones por partida y mes: ocurrencias distintas (periodo y ocurrencia) de reportes
-- emitidos; varios reportes por TAG en la misma ocurrencia cuentan una vez. Los borradores, los que
-- están en revisión y los sustituidos no cuentan.
create view public.v_ejecuciones_reportes with (security_invoker = true) as
select r.partida_id, r.periodo_mes as mes,
	count(distinct coalesce(r.ocurrencia_tipo || ':' || r.ocurrencia_numero, '')) as ejecuciones,
	jsonb_agg(r.id order by r.emitido_en) as reportes
from public.reportes r
where r.estado = 'emitido'
group by r.partida_id, r.periodo_mes;

-- Realizado de cada programa por partida y mes del periodo: ejecuciones de reportes más los
-- realizados manuales registrados en ese mismo programa.
create view public.v_realizado with (security_invoker = true) as
select g.id as programa_id, t.id as partida_id, m.mes,
	coalesce(e.ejecuciones, 0) as ejecuciones_reportes,
	coalesce(manual.cantidad, 0) as cantidad_manual,
	coalesce(e.ejecuciones, 0) + coalesce(manual.cantidad, 0) as realizado,
	coalesce(e.reportes, '[]'::jsonb) as reportes
from public.programas g
join public.partidas t on t.contrato_id = g.contrato_id and t.sitio_id = g.sitio_id
cross join lateral public.meses_del_periodo(g.periodo_inicio, g.periodo_fin) as m(mes)
left join public.v_ejecuciones_reportes e on e.partida_id = t.id and e.mes = m.mes
left join lateral (
	select sum(x.cantidad) as cantidad
	from public.programa_realizados_manuales x
	where x.programa_id = g.id and x.partida_id = t.id and x.mes = m.mes
) manual on true;

-- Avance de un programa: por partida y mes, lo programado y lo realizado, con totales y la
-- diferencia frente a la cantidad anual.
create or replace function public.api_obtener_programa(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
	programa public.programas;
begin
	select * into programa from public.programas where id = (p ->> 'id')::uuid;
	if programa.id is null then
		perform public.error_api('IC404', 'Programa no encontrado', jsonb_build_object('id', p ->> 'id'));
	end if;
	return jsonb_build_object(
		'programa', public.json_programa(programa),
		'partidas', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', t.id, 'numero', t.numero, 'actividad', t.actividad, 'periodicidad', t.periodicidad,
				'distribucion', t.distribucion, 'cantidadAnual', t.cantidad_anual,
				'celdas', celdas.valor, 'totalProgramado', celdas.programado, 'totalRealizado', celdas.realizado,
				'diferencia', case when t.cantidad_anual is null then null else t.cantidad_anual - celdas.programado end
			) order by
				case when t.numero_normalizado ~ '^[0-9]+$' then t.numero_normalizado::integer end,
				t.numero_normalizado)
			from public.partidas t,
			lateral (
				select jsonb_agg(jsonb_build_object(
						'mes', m.mes, 'programado', pm.cantidad,
						'realizado', coalesce(v.realizado, 0), 'reportes', coalesce(v.reportes, '[]'::jsonb)
					) order by m.mes) as valor,
					coalesce(sum(pm.cantidad), 0) as programado,
					coalesce(sum(v.realizado), 0) as realizado
				from public.meses_del_periodo(programa.periodo_inicio, programa.periodo_fin) as m(mes)
				left join public.programa_meses pm
					on pm.programa_id = programa.id and pm.partida_id = t.id and pm.mes = m.mes
				left join public.v_realizado v
					on v.programa_id = programa.id and v.partida_id = t.id and v.mes = m.mes
			) celdas
			where t.contrato_id = programa.contrato_id and t.sitio_id = programa.sitio_id
		), '[]'::jsonb)
	);
end
$$;

-- Con «reportes» ya creada, el cambio de periodo de un programa tampoco puede dejar fuera meses
-- con reportes emitidos de sus partidas (redefine la validación de 0002).
create or replace function public.validar_programa()
returns trigger
language plpgsql
as $$
declare
	superpuesto uuid;
begin
	-- Serializa los cambios del mismo contrato antes de comprobar superposiciones.
	perform 1 from public.contratos where id = new.contrato_id for update;
	select g.id into superpuesto
	from public.programas g
	where g.contrato_id = new.contrato_id and g.sitio_id = new.sitio_id and g.id <> new.id
		and daterange(g.periodo_inicio, g.periodo_fin, '[]') && daterange(new.periodo_inicio, new.periodo_fin, '[]')
	limit 1;
	if superpuesto is not null then
		perform public.error_api('IC422', 'El periodo se superpone con otro programa del contrato y sitio',
			jsonb_build_object('motivo', 'programa_superpuesto', 'programaId', superpuesto));
	end if;
	if tg_op = 'UPDATE' and (
		exists (select 1 from public.programa_meses m where m.programa_id = new.id
			and (m.mes < public.primer_dia_mes(new.periodo_inicio) or m.mes > new.periodo_fin))
		or exists (select 1 from public.programa_realizados_manuales m where m.programa_id = new.id
			and (m.mes < public.primer_dia_mes(new.periodo_inicio) or m.mes > new.periodo_fin))
		or exists (select 1 from public.reportes r
			where r.contrato_id = new.contrato_id and r.sitio_id = new.sitio_id and r.estado = 'emitido'
				and r.periodo_mes between public.primer_dia_mes(old.periodo_inicio) and old.periodo_fin
				and (r.periodo_mes < public.primer_dia_mes(new.periodo_inicio) or r.periodo_mes > new.periodo_fin))
	) then
		perform public.error_api('IC422', 'El nuevo periodo deja fuera meses ya registrados',
			jsonb_build_object('motivo', 'periodo_con_datos_fuera'));
	end if;
	return new;
end
$$;

insert into interno.migraciones (nombre) values ('0003_reportes.sql') on conflict do nothing;

-- =============================================================================================
-- 0004_rls.sql
-- =============================================================================================
-- 0004_rls.sql
-- Seguridad a nivel de fila en todas las tablas. Mientras no exista autenticación, solo el servidor
-- accede a los datos con el rol de servicio; las políticas por rol llegan con el cambio de
-- autenticación (Entra ID). En PGlite no existen los roles de Supabase y el bloque los omite.

do $$
declare
	tabla text;
	hay_roles_supabase boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
	for tabla in select tablename from pg_tables where schemaname = 'public' loop
		execute format('alter table public.%I enable row level security', tabla);
		if hay_roles_supabase then
			execute format(
				'create policy servicio_acceso_total on public.%I for all to service_role using (true) with check (true)',
				tabla
			);
		end if;
	end loop;

	if hay_roles_supabase then
		-- Las claves públicas (anon/authenticated) no leen tablas ni ejecutan funciones.
		revoke all on all tables in schema public from anon, authenticated;
		revoke all on all sequences in schema public from anon, authenticated;
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
		alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0004_rls.sql') on conflict do nothing;

-- =============================================================================================
-- 0005_importacion.sql
-- =============================================================================================
-- 0005_importacion.sql
-- Importación del catálogo de alcances y del programa anual desde Excel: columnas de entrega que
-- trae el catálogo y una función que compara, resume (ensayo) y aplica todo en una transacción.

alter table public.partidas add column entrega_oma text;
alter table public.partidas add column entrega_propuesta text;

create or replace function public.json_partida(id_partida uuid)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', p.id, 'contratoId', p.contrato_id, 'sitioId', p.sitio_id, 'numero', p.numero,
		'actividad', p.actividad, 'nombreCorto', p.nombre_corto, 'descripcion', p.descripcion,
		'distribucion', p.distribucion, 'periodicidad', p.periodicidad,
		'cantidadAnual', p.cantidad_anual, 'entrega', p.entrega, 'entregaOma', p.entrega_oma,
		'entregaPropuesta', p.entrega_propuesta, 'requiereOdm', p.requiere_odm,
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

-- La edición de una partida también guarda las entregas (si vienen en la carga).
create or replace function public.guardar_entregas_partida(p jsonb, id_partida uuid)
returns void
language sql
as $$
	update public.partidas set
		entrega_oma = case when p ? 'entregaOma' then public.texto_o_nulo(p ->> 'entregaOma') else entrega_oma end,
		entrega_propuesta = case when p ? 'entregaPropuesta'
			then public.texto_o_nulo(p ->> 'entregaPropuesta') else entrega_propuesta end
	where id = id_partida
$$;

create or replace function public.api_guardar_partida_completa(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	resultado jsonb := public.api_guardar_partida(p);
begin
	perform public.guardar_entregas_partida(p, (resultado ->> 'id')::uuid);
	return public.json_partida((resultado ->> 'id')::uuid);
end
$$;

-- Campos de una partida que provienen del catálogo de Excel, en forma comparable.
create or replace function public.partida_canonica_importacion(t public.partidas)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'actividad', t.actividad, 'descripcion', t.descripcion, 'distribucion', t.distribucion,
		'periodicidad', t.periodicidad, 'cantidadAnual', t.cantidad_anual, 'entrega', t.entrega,
		'entregaOma', t.entrega_oma, 'entregaPropuesta', t.entrega_propuesta,
		'requiereOdm', t.requiere_odm, 'requierePt', t.requiere_pt, 'requiereAst', t.requiere_ast,
		'materialesPor', t.materiales_por, 'reportesHomologados', t.reportes_homologados,
		'estadoCatalogo', t.estado_catalogo,
		'alcances', coalesce((
			select jsonb_agg(jsonb_build_object('tipo', a.tipo, 'texto', a.texto) order by a.orden)
			from public.partida_alcances a where a.partida_id = t.id
		), '[]'::jsonb)
	)
$$;

create or replace function public.importacion_canonica(e jsonb)
returns jsonb
language sql
immutable
as $$
	select jsonb_build_object(
		'actividad', btrim(e ->> 'actividad'), 'descripcion', public.texto_o_nulo(e ->> 'descripcion'),
		'distribucion', public.texto_o_nulo(e ->> 'distribucion'), 'periodicidad', e ->> 'periodicidad',
		'cantidadAnual', (e ->> 'cantidadAnual')::numeric, 'entrega', public.texto_o_nulo(e ->> 'entrega'),
		'entregaOma', public.texto_o_nulo(e ->> 'entregaOma'),
		'entregaPropuesta', public.texto_o_nulo(e ->> 'entregaPropuesta'),
		'requiereOdm', coalesce((e ->> 'requiereOdm')::boolean, false),
		'requierePt', coalesce((e ->> 'requierePt')::boolean, false),
		'requiereAst', coalesce((e ->> 'requiereAst')::boolean, false),
		'materialesPor', public.texto_o_nulo(e ->> 'materialesPor'),
		'reportesHomologados', public.texto_o_nulo(e ->> 'reportesHomologados'),
		'estadoCatalogo', 'confirmado',
		'alcances', coalesce((
			select jsonb_agg(jsonb_build_object('tipo', a ->> 'tipo', 'texto', btrim(a ->> 'texto')) order by n)
			from jsonb_array_elements(e -> 'alcances') with ordinality as x(a, n)
		), '[]'::jsonb)
	)
$$;

-- Importa partidas, alcances y programa P/R de un contrato y sitio. Con «ensayo» solo devuelve el
-- resumen (crear, actualizar o sin cambios) sin modificar nada; sin él aplica todo en esta misma
-- transacción, así que un error no deja cambios parciales. Las partidas importadas quedan
-- «confirmadas» y reemplazan a las derivadas de reportes («por confirmar»). Los campos que no vienen
-- del Excel (objetivo, herramientas, conclusiones, disposición, equipos) se conservan.
create or replace function public.api_importar_catalogo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_contrato uuid := (p ->> 'contratoId')::uuid;
	id_sitio uuid := (p ->> 'sitioId')::uuid;
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	programa public.programas;
	accion_programa text := 'ninguno';
	entrada jsonb;
	existente public.partidas;
	id_partida uuid;
	accion text;
	meses_actuales jsonb;
	meses_nuevos jsonb;
	cambia_programa boolean;
	partidas_resumen jsonb := '[]'::jsonb;
	n_crear integer := 0;
	n_actualizar integer := 0;
	n_sin_cambios integer := 0;
	nota_realizado constant text := 'Marcado como realizado en el programa importado';
begin
	if not exists (select 1 from public.contrato_sitios where contrato_id = id_contrato and sitio_id = id_sitio) then
		perform public.error_api('IC422', 'El sitio no pertenece al contrato',
			jsonb_build_object('motivo', 'sitio_de_otro_contrato'));
	end if;

	if p -> 'programa' is not null and jsonb_typeof(p -> 'programa') = 'object' then
		select * into programa from public.programas
		where contrato_id = id_contrato and sitio_id = id_sitio
			and periodo_inicio = (p #>> '{programa,periodoInicio}')::date;
		if programa.id is null then
			accion_programa := 'crear';
			if not ensayo then
				insert into public.programas (contrato_id, sitio_id, periodo_inicio, periodo_fin, nombre)
				values (id_contrato, id_sitio, (p #>> '{programa,periodoInicio}')::date,
					(p #>> '{programa,periodoFin}')::date, public.texto_o_nulo(p #>> '{programa,nombre}'))
				returning * into programa;
			end if;
		else
			accion_programa := 'existente';
		end if;
	end if;

	for entrada in select * from jsonb_array_elements(coalesce(p -> 'partidas', '[]'::jsonb)) loop
		select * into existente from public.partidas
		where contrato_id = id_contrato and sitio_id = id_sitio
			and numero_normalizado = public.normalizar_numero_partida(entrada ->> 'numero');

		meses_nuevos := coalesce((
			select jsonb_agg(jsonb_build_object('mes', public.primer_dia_mes((m ->> 'mes')::date),
				'cantidad', (m ->> 'cantidad')::numeric) order by (m ->> 'mes')::date)
			from jsonb_array_elements(coalesce(entrada -> 'meses', '[]'::jsonb)) m
		), '[]'::jsonb);
		meses_actuales := case when programa.id is null or existente.id is null then '[]'::jsonb else coalesce((
			select jsonb_agg(jsonb_build_object('mes', pm.mes, 'cantidad', pm.cantidad) order by pm.mes)
			from public.programa_meses pm where pm.programa_id = programa.id and pm.partida_id = existente.id
		), '[]'::jsonb) end;
		cambia_programa := accion_programa <> 'ninguno' and meses_nuevos <> meses_actuales;

		if existente.id is null then
			accion := 'crear';
			n_crear := n_crear + 1;
		elsif public.partida_canonica_importacion(existente) <> public.importacion_canonica(entrada)
			or cambia_programa then
			accion := 'actualizar';
			n_actualizar := n_actualizar + 1;
		else
			accion := 'sin_cambios';
			n_sin_cambios := n_sin_cambios + 1;
		end if;

		partidas_resumen := partidas_resumen || jsonb_build_object(
			'numero', entrada ->> 'numero', 'actividad', entrada ->> 'actividad', 'accion', accion,
			'alcances', jsonb_array_length(coalesce(entrada -> 'alcances', '[]'::jsonb)),
			'mesesProgramados', jsonb_array_length(meses_nuevos), 'cambiaPrograma', cambia_programa,
			'estabaPorConfirmar', coalesce(existente.estado_catalogo = 'por_confirmar', false)
		);

		if ensayo or accion = 'sin_cambios' then
			continue;
		end if;

		if existente.id is null then
			insert into public.partidas (contrato_id, sitio_id, numero, actividad, periodicidad)
			values (id_contrato, id_sitio, btrim(entrada ->> 'numero'), btrim(entrada ->> 'actividad'),
				entrada ->> 'periodicidad')
			returning id into id_partida;
		else
			id_partida := existente.id;
		end if;
		update public.partidas set
			actividad = btrim(entrada ->> 'actividad'),
			descripcion = public.texto_o_nulo(entrada ->> 'descripcion'),
			distribucion = public.texto_o_nulo(entrada ->> 'distribucion'),
			periodicidad = entrada ->> 'periodicidad',
			cantidad_anual = (entrada ->> 'cantidadAnual')::numeric,
			entrega = public.texto_o_nulo(entrada ->> 'entrega'),
			entrega_oma = public.texto_o_nulo(entrada ->> 'entregaOma'),
			entrega_propuesta = public.texto_o_nulo(entrada ->> 'entregaPropuesta'),
			requiere_odm = coalesce((entrada ->> 'requiereOdm')::boolean, false),
			requiere_pt = coalesce((entrada ->> 'requierePt')::boolean, false),
			requiere_ast = coalesce((entrada ->> 'requiereAst')::boolean, false),
			materiales_por = public.texto_o_nulo(entrada ->> 'materialesPor'),
			reportes_homologados = public.texto_o_nulo(entrada ->> 'reportesHomologados'),
			estado_catalogo = 'confirmado'
		where id = id_partida;

		delete from public.partida_alcances where partida_id = id_partida;
		insert into public.partida_alcances (partida_id, orden, tipo, texto)
		select id_partida, a.n, a.valor ->> 'tipo', btrim(a.valor ->> 'texto')
		from jsonb_array_elements(coalesce(entrada -> 'alcances', '[]'::jsonb)) with ordinality as a(valor, n);

		if programa.id is not null then
			delete from public.programa_meses where programa_id = programa.id and partida_id = id_partida;
			insert into public.programa_meses (programa_id, partida_id, mes, cantidad)
			select programa.id, id_partida, (m ->> 'mes')::date, (m ->> 'cantidad')::numeric
			from jsonb_array_elements(meses_nuevos) m;
			insert into public.programa_realizados_manuales (programa_id, partida_id, mes, cantidad, nota)
			select programa.id, id_partida, public.primer_dia_mes((r ->> 'mes')::date),
				coalesce((r ->> 'cantidad')::numeric, 1), nota_realizado
			from jsonb_array_elements(coalesce(entrada -> 'realizados', '[]'::jsonb)) r
			where not exists (select 1 from public.programa_realizados_manuales x
				where x.programa_id = programa.id and x.partida_id = id_partida and x.nota = nota_realizado
					and x.mes = public.primer_dia_mes((r ->> 'mes')::date));
		end if;
	end loop;

	return jsonb_build_object(
		'ensayo', ensayo,
		'programa', jsonb_build_object('accion', accion_programa, 'id', programa.id),
		'resumen', jsonb_build_object('crear', n_crear, 'actualizar', n_actualizar, 'sinCambios', n_sin_cambios),
		'partidas', partidas_resumen
	);
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0005_importacion.sql') on conflict do nothing;

-- =============================================================================================
-- 0006_importacion_correcciones.sql
-- =============================================================================================
-- 0006_importacion_correcciones.sql
-- Correcciones de la revisión de la fase 4 a la importación del catálogo (0005 ya puede estar
-- aplicada, por eso se redefine aquí):
-- - Los campos que el libro no trae (hoy, la descripción de la partida) no se comparan ni se borran.
-- - Las marcas R del programa se comparan y se sincronizan con el libro: las retiradas se eliminan.
--   Los realizados capturados a mano (con otra nota) no se tocan.
-- - Un programa existente con el mismo inicio actualiza su fin (y su nombre, si el libro lo trae).

create or replace function public.api_importar_catalogo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_contrato uuid := (p ->> 'contratoId')::uuid;
	id_sitio uuid := (p ->> 'sitioId')::uuid;
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	programa public.programas;
	accion_programa text := 'ninguno';
	entrada jsonb;
	existente public.partidas;
	id_partida uuid;
	accion text;
	meses_actuales jsonb;
	meses_nuevos jsonb;
	realizados_actuales jsonb;
	realizados_nuevos jsonb;
	canon_existente jsonb;
	canon_nueva jsonb;
	cambia_programa boolean;
	partidas_resumen jsonb := '[]'::jsonb;
	n_crear integer := 0;
	n_actualizar integer := 0;
	n_sin_cambios integer := 0;
	nota_realizado constant text := 'Marcado como realizado en el programa importado';
begin
	if not exists (select 1 from public.contrato_sitios where contrato_id = id_contrato and sitio_id = id_sitio) then
		perform public.error_api('IC422', 'El sitio no pertenece al contrato',
			jsonb_build_object('motivo', 'sitio_de_otro_contrato'));
	end if;

	if p -> 'programa' is not null and jsonb_typeof(p -> 'programa') = 'object' then
		select * into programa from public.programas
		where contrato_id = id_contrato and sitio_id = id_sitio
			and periodo_inicio = (p #>> '{programa,periodoInicio}')::date;
		if programa.id is null then
			accion_programa := 'crear';
			if not ensayo then
				insert into public.programas (contrato_id, sitio_id, periodo_inicio, periodo_fin, nombre)
				values (id_contrato, id_sitio, (p #>> '{programa,periodoInicio}')::date,
					(p #>> '{programa,periodoFin}')::date, public.texto_o_nulo(p #>> '{programa,nombre}'))
				returning * into programa;
			end if;
		elsif programa.periodo_fin is distinct from (p #>> '{programa,periodoFin}')::date
			or ((p -> 'programa') ? 'nombre'
				and programa.nombre is distinct from public.texto_o_nulo(p #>> '{programa,nombre}')) then
			accion_programa := 'actualizar';
			if not ensayo then
				-- Las reglas de periodo (sin traslapes ni reportes fuera) las aplican sus restricciones.
				update public.programas set
					periodo_fin = (p #>> '{programa,periodoFin}')::date,
					nombre = case when (p -> 'programa') ? 'nombre'
						then public.texto_o_nulo(p #>> '{programa,nombre}') else nombre end
				where id = programa.id
				returning * into programa;
			end if;
		else
			accion_programa := 'existente';
		end if;
	end if;

	for entrada in select * from jsonb_array_elements(coalesce(p -> 'partidas', '[]'::jsonb)) loop
		select * into existente from public.partidas
		where contrato_id = id_contrato and sitio_id = id_sitio
			and numero_normalizado = public.normalizar_numero_partida(entrada ->> 'numero');

		meses_nuevos := coalesce((
			select jsonb_agg(jsonb_build_object('mes', public.primer_dia_mes((m ->> 'mes')::date),
				'cantidad', (m ->> 'cantidad')::numeric) order by (m ->> 'mes')::date)
			from jsonb_array_elements(coalesce(entrada -> 'meses', '[]'::jsonb)) m
		), '[]'::jsonb);
		realizados_nuevos := coalesce((
			select jsonb_agg(jsonb_build_object('mes', public.primer_dia_mes((r ->> 'mes')::date),
				'cantidad', coalesce((r ->> 'cantidad')::numeric, 1)) order by (r ->> 'mes')::date)
			from jsonb_array_elements(coalesce(entrada -> 'realizados', '[]'::jsonb)) r
		), '[]'::jsonb);
		if programa.id is null or existente.id is null then
			meses_actuales := '[]'::jsonb;
			realizados_actuales := '[]'::jsonb;
		else
			meses_actuales := coalesce((
				select jsonb_agg(jsonb_build_object('mes', pm.mes, 'cantidad', pm.cantidad) order by pm.mes)
				from public.programa_meses pm where pm.programa_id = programa.id and pm.partida_id = existente.id
			), '[]'::jsonb);
			realizados_actuales := coalesce((
				select jsonb_agg(jsonb_build_object('mes', x.mes, 'cantidad', x.cantidad) order by x.mes)
				from public.programa_realizados_manuales x
				where x.programa_id = programa.id and x.partida_id = existente.id and x.nota = nota_realizado
			), '[]'::jsonb);
		end if;
		cambia_programa := accion_programa <> 'ninguno'
			and (meses_nuevos <> meses_actuales or realizados_nuevos <> realizados_actuales);

		-- Solo se comparan los campos que trae el libro.
		canon_nueva := public.importacion_canonica(entrada);
		canon_existente := case when existente.id is null then null
			else public.partida_canonica_importacion(existente) end;
		if not entrada ? 'descripcion' then
			canon_nueva := canon_nueva - 'descripcion';
			canon_existente := canon_existente - 'descripcion';
		end if;

		if existente.id is null then
			accion := 'crear';
			n_crear := n_crear + 1;
		elsif canon_existente <> canon_nueva or cambia_programa then
			accion := 'actualizar';
			n_actualizar := n_actualizar + 1;
		else
			accion := 'sin_cambios';
			n_sin_cambios := n_sin_cambios + 1;
		end if;

		partidas_resumen := partidas_resumen || jsonb_build_object(
			'numero', entrada ->> 'numero', 'actividad', entrada ->> 'actividad', 'accion', accion,
			'alcances', jsonb_array_length(coalesce(entrada -> 'alcances', '[]'::jsonb)),
			'mesesProgramados', jsonb_array_length(meses_nuevos), 'cambiaPrograma', cambia_programa,
			'estabaPorConfirmar', coalesce(existente.estado_catalogo = 'por_confirmar', false)
		);

		if ensayo or accion = 'sin_cambios' then
			continue;
		end if;

		if existente.id is null then
			insert into public.partidas (contrato_id, sitio_id, numero, actividad, periodicidad)
			values (id_contrato, id_sitio, btrim(entrada ->> 'numero'), btrim(entrada ->> 'actividad'),
				entrada ->> 'periodicidad')
			returning id into id_partida;
		else
			id_partida := existente.id;
		end if;
		update public.partidas set
			actividad = btrim(entrada ->> 'actividad'),
			descripcion = case when entrada ? 'descripcion'
				then public.texto_o_nulo(entrada ->> 'descripcion') else descripcion end,
			distribucion = public.texto_o_nulo(entrada ->> 'distribucion'),
			periodicidad = entrada ->> 'periodicidad',
			cantidad_anual = (entrada ->> 'cantidadAnual')::numeric,
			entrega = public.texto_o_nulo(entrada ->> 'entrega'),
			entrega_oma = public.texto_o_nulo(entrada ->> 'entregaOma'),
			entrega_propuesta = public.texto_o_nulo(entrada ->> 'entregaPropuesta'),
			requiere_odm = coalesce((entrada ->> 'requiereOdm')::boolean, false),
			requiere_pt = coalesce((entrada ->> 'requierePt')::boolean, false),
			requiere_ast = coalesce((entrada ->> 'requiereAst')::boolean, false),
			materiales_por = public.texto_o_nulo(entrada ->> 'materialesPor'),
			reportes_homologados = public.texto_o_nulo(entrada ->> 'reportesHomologados'),
			estado_catalogo = 'confirmado'
		where id = id_partida;

		delete from public.partida_alcances where partida_id = id_partida;
		insert into public.partida_alcances (partida_id, orden, tipo, texto)
		select id_partida, a.n, a.valor ->> 'tipo', btrim(a.valor ->> 'texto')
		from jsonb_array_elements(coalesce(entrada -> 'alcances', '[]'::jsonb)) with ordinality as a(valor, n);

		if programa.id is not null then
			delete from public.programa_meses where programa_id = programa.id and partida_id = id_partida;
			insert into public.programa_meses (programa_id, partida_id, mes, cantidad)
			select programa.id, id_partida, (m ->> 'mes')::date, (m ->> 'cantidad')::numeric
			from jsonb_array_elements(meses_nuevos) m;
			-- Las marcas R importadas se reemplazan; las capturadas a mano llevan otra nota.
			delete from public.programa_realizados_manuales
			where programa_id = programa.id and partida_id = id_partida and nota = nota_realizado;
			insert into public.programa_realizados_manuales (programa_id, partida_id, mes, cantidad, nota)
			select programa.id, id_partida, (r ->> 'mes')::date, (r ->> 'cantidad')::numeric, nota_realizado
			from jsonb_array_elements(realizados_nuevos) r;
		end if;
	end loop;

	return jsonb_build_object(
		'ensayo', ensayo,
		'programa', jsonb_build_object('accion', accion_programa, 'id', programa.id),
		'resumen', jsonb_build_object('crear', n_crear, 'actualizar', n_actualizar, 'sinCambios', n_sin_cambios),
		'partidas', partidas_resumen
	);
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0006_importacion_correcciones.sql') on conflict do nothing;

-- =============================================================================================
-- 0007_captura.sql
-- =============================================================================================
-- Fase 5: captura de reportes.
--
-- Cada reporte guarda la huella del contenido que copió del catálogo (objetivo, introducción,
-- conclusiones, alcances y herramientas de la partida). Si la partida cambia después, la huella
-- vigente deja de coincidir y el editor ofrece aplicar los cambios de forma explícita; el borrador
-- conserva su contenido mientras tanto. La huella la calcula la aplicación (dominio/captura.ts).

alter table public.reportes add column if not exists catalogo_huella text not null default '';

-- json_reporte se extiende sin reescribirlo: la definición anterior se conserva con otro nombre y
-- las funciones que lo invocan resuelven el nombre al ejecutarse. El renombrado es idempotente.
do $$
begin
	if not exists (select 1 from pg_proc where proname = 'json_reporte_base'
		and pronamespace = 'public'::regnamespace) then
		alter function public.json_reporte(uuid) rename to json_reporte_base;
	end if;
end
$$;

create or replace function public.json_reporte(id_reporte uuid)
returns jsonb
language sql
stable
as $$
	select public.json_reporte_base(r.id) || jsonb_build_object('catalogoHuella', r.catalogo_huella)
	from public.reportes r
	where r.id = id_reporte
$$;

-- Una revisión conserva la huella de su original (api_crear_revision copia el reporte sin ella).
create or replace function public.copiar_huella_revision()
returns trigger
language plpgsql
as $$
begin
	if new.sustituye_a is not null and new.catalogo_huella = '' then
		select catalogo_huella into new.catalogo_huella from public.reportes where id = new.sustituye_a;
	end if;
	return new;
end
$$;

drop trigger if exists reportes_copiar_huella on public.reportes;
create trigger reportes_copiar_huella before insert on public.reportes
	for each row execute function public.copiar_huella_revision();

-- Alta de un reporte prellenado junto con la huella del catálogo, en una sola transacción.
create or replace function public.api_crear_reporte(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_reporte uuid := (public.api_insertar_reporte(p) ->> 'id')::uuid;
begin
	update public.reportes set catalogo_huella = coalesce(p ->> 'catalogoHuella', '')
	where id = id_reporte;
	return public.json_reporte(id_reporte);
end
$$;

-- Guarda el borrador con el contenido del catálogo ya aplicado y registra la huella nueva. Usa la
-- misma concurrencia optimista que api_guardar_reporte.
create or replace function public.api_aplicar_catalogo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	resultado jsonb;
	id_reporte uuid := (p ->> 'id')::uuid;
begin
	if coalesce(p ->> 'catalogoHuella', '') = '' then
		perform public.error_api('IC422', 'Falta la huella del catálogo',
			jsonb_build_object('motivo', 'huella_requerida'));
	end if;
	resultado := public.api_guardar_reporte(p);
	update public.reportes set catalogo_huella = p ->> 'catalogoHuella' where id = id_reporte;
	return jsonb_set(resultado, '{reporte}', public.json_reporte(id_reporte));
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0007_captura.sql') on conflict do nothing;

-- =============================================================================================
-- 0008_realizados_origen.sql
-- =============================================================================================
-- 0008_realizados_origen.sql
-- Corrección de la revisión de la fase 4 (ronda 2): los realizados que vienen de las marcas R del
-- Excel se distinguen por una columna de origen y no por el texto de la nota, para que la
-- reimportación nunca borre un realizado capturado a mano aunque use la misma nota.

alter table public.programa_realizados_manuales
	add column if not exists origen text not null default 'manual'
	check (origen in ('manual', 'importacion'));

-- Hasta ahora la importación era la única que escribía esta nota.
update public.programa_realizados_manuales set origen = 'importacion'
where nota = 'Marcado como realizado en el programa importado' and origen = 'manual';

create or replace function public.api_importar_catalogo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_contrato uuid := (p ->> 'contratoId')::uuid;
	id_sitio uuid := (p ->> 'sitioId')::uuid;
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	programa public.programas;
	accion_programa text := 'ninguno';
	entrada jsonb;
	existente public.partidas;
	id_partida uuid;
	accion text;
	meses_actuales jsonb;
	meses_nuevos jsonb;
	realizados_actuales jsonb;
	realizados_nuevos jsonb;
	canon_existente jsonb;
	canon_nueva jsonb;
	cambia_programa boolean;
	partidas_resumen jsonb := '[]'::jsonb;
	n_crear integer := 0;
	n_actualizar integer := 0;
	n_sin_cambios integer := 0;
	nota_realizado constant text := 'Marcado como realizado en el programa importado';
begin
	if not exists (select 1 from public.contrato_sitios where contrato_id = id_contrato and sitio_id = id_sitio) then
		perform public.error_api('IC422', 'El sitio no pertenece al contrato',
			jsonb_build_object('motivo', 'sitio_de_otro_contrato'));
	end if;

	if p -> 'programa' is not null and jsonb_typeof(p -> 'programa') = 'object' then
		select * into programa from public.programas
		where contrato_id = id_contrato and sitio_id = id_sitio
			and periodo_inicio = (p #>> '{programa,periodoInicio}')::date;
		if programa.id is null then
			accion_programa := 'crear';
			if not ensayo then
				insert into public.programas (contrato_id, sitio_id, periodo_inicio, periodo_fin, nombre)
				values (id_contrato, id_sitio, (p #>> '{programa,periodoInicio}')::date,
					(p #>> '{programa,periodoFin}')::date, public.texto_o_nulo(p #>> '{programa,nombre}'))
				returning * into programa;
			end if;
		elsif programa.periodo_fin is distinct from (p #>> '{programa,periodoFin}')::date
			or ((p -> 'programa') ? 'nombre'
				and programa.nombre is distinct from public.texto_o_nulo(p #>> '{programa,nombre}')) then
			accion_programa := 'actualizar';
			if not ensayo then
				-- Las reglas de periodo (sin traslapes ni reportes fuera) las aplican sus restricciones.
				update public.programas set
					periodo_fin = (p #>> '{programa,periodoFin}')::date,
					nombre = case when (p -> 'programa') ? 'nombre'
						then public.texto_o_nulo(p #>> '{programa,nombre}') else nombre end
				where id = programa.id
				returning * into programa;
			end if;
		else
			accion_programa := 'existente';
		end if;
	end if;

	for entrada in select * from jsonb_array_elements(coalesce(p -> 'partidas', '[]'::jsonb)) loop
		select * into existente from public.partidas
		where contrato_id = id_contrato and sitio_id = id_sitio
			and numero_normalizado = public.normalizar_numero_partida(entrada ->> 'numero');

		meses_nuevos := coalesce((
			select jsonb_agg(jsonb_build_object('mes', public.primer_dia_mes((m ->> 'mes')::date),
				'cantidad', (m ->> 'cantidad')::numeric) order by (m ->> 'mes')::date)
			from jsonb_array_elements(coalesce(entrada -> 'meses', '[]'::jsonb)) m
		), '[]'::jsonb);
		realizados_nuevos := coalesce((
			select jsonb_agg(jsonb_build_object('mes', public.primer_dia_mes((r ->> 'mes')::date),
				'cantidad', coalesce((r ->> 'cantidad')::numeric, 1)) order by (r ->> 'mes')::date)
			from jsonb_array_elements(coalesce(entrada -> 'realizados', '[]'::jsonb)) r
		), '[]'::jsonb);
		if programa.id is null or existente.id is null then
			meses_actuales := '[]'::jsonb;
			realizados_actuales := '[]'::jsonb;
		else
			meses_actuales := coalesce((
				select jsonb_agg(jsonb_build_object('mes', pm.mes, 'cantidad', pm.cantidad) order by pm.mes)
				from public.programa_meses pm where pm.programa_id = programa.id and pm.partida_id = existente.id
			), '[]'::jsonb);
			realizados_actuales := coalesce((
				select jsonb_agg(jsonb_build_object('mes', x.mes, 'cantidad', x.cantidad) order by x.mes)
				from public.programa_realizados_manuales x
				where x.programa_id = programa.id and x.partida_id = existente.id and x.origen = 'importacion'
			), '[]'::jsonb);
		end if;
		cambia_programa := accion_programa <> 'ninguno'
			and (meses_nuevos <> meses_actuales or realizados_nuevos <> realizados_actuales);

		-- Solo se comparan los campos que trae el libro.
		canon_nueva := public.importacion_canonica(entrada);
		canon_existente := case when existente.id is null then null
			else public.partida_canonica_importacion(existente) end;
		if not entrada ? 'descripcion' then
			canon_nueva := canon_nueva - 'descripcion';
			canon_existente := canon_existente - 'descripcion';
		end if;

		if existente.id is null then
			accion := 'crear';
			n_crear := n_crear + 1;
		elsif canon_existente <> canon_nueva or cambia_programa then
			accion := 'actualizar';
			n_actualizar := n_actualizar + 1;
		else
			accion := 'sin_cambios';
			n_sin_cambios := n_sin_cambios + 1;
		end if;

		partidas_resumen := partidas_resumen || jsonb_build_object(
			'numero', entrada ->> 'numero', 'actividad', entrada ->> 'actividad', 'accion', accion,
			'alcances', jsonb_array_length(coalesce(entrada -> 'alcances', '[]'::jsonb)),
			'mesesProgramados', jsonb_array_length(meses_nuevos), 'cambiaPrograma', cambia_programa,
			'estabaPorConfirmar', coalesce(existente.estado_catalogo = 'por_confirmar', false)
		);

		if ensayo or accion = 'sin_cambios' then
			continue;
		end if;

		if existente.id is null then
			insert into public.partidas (contrato_id, sitio_id, numero, actividad, periodicidad)
			values (id_contrato, id_sitio, btrim(entrada ->> 'numero'), btrim(entrada ->> 'actividad'),
				entrada ->> 'periodicidad')
			returning id into id_partida;
		else
			id_partida := existente.id;
		end if;
		update public.partidas set
			actividad = btrim(entrada ->> 'actividad'),
			descripcion = case when entrada ? 'descripcion'
				then public.texto_o_nulo(entrada ->> 'descripcion') else descripcion end,
			distribucion = public.texto_o_nulo(entrada ->> 'distribucion'),
			periodicidad = entrada ->> 'periodicidad',
			cantidad_anual = (entrada ->> 'cantidadAnual')::numeric,
			entrega = public.texto_o_nulo(entrada ->> 'entrega'),
			entrega_oma = public.texto_o_nulo(entrada ->> 'entregaOma'),
			entrega_propuesta = public.texto_o_nulo(entrada ->> 'entregaPropuesta'),
			requiere_odm = coalesce((entrada ->> 'requiereOdm')::boolean, false),
			requiere_pt = coalesce((entrada ->> 'requierePt')::boolean, false),
			requiere_ast = coalesce((entrada ->> 'requiereAst')::boolean, false),
			materiales_por = public.texto_o_nulo(entrada ->> 'materialesPor'),
			reportes_homologados = public.texto_o_nulo(entrada ->> 'reportesHomologados'),
			estado_catalogo = 'confirmado'
		where id = id_partida;

		delete from public.partida_alcances where partida_id = id_partida;
		insert into public.partida_alcances (partida_id, orden, tipo, texto)
		select id_partida, a.n, a.valor ->> 'tipo', btrim(a.valor ->> 'texto')
		from jsonb_array_elements(coalesce(entrada -> 'alcances', '[]'::jsonb)) with ordinality as a(valor, n);

		if programa.id is not null then
			delete from public.programa_meses where programa_id = programa.id and partida_id = id_partida;
			insert into public.programa_meses (programa_id, partida_id, mes, cantidad)
			select programa.id, id_partida, (m ->> 'mes')::date, (m ->> 'cantidad')::numeric
			from jsonb_array_elements(meses_nuevos) m;
			-- Las marcas R importadas se reemplazan; las capturadas a mano tienen origen «manual».
			delete from public.programa_realizados_manuales
			where programa_id = programa.id and partida_id = id_partida and origen = 'importacion';
			insert into public.programa_realizados_manuales (programa_id, partida_id, mes, cantidad, nota, origen)
			select programa.id, id_partida, (r ->> 'mes')::date, (r ->> 'cantidad')::numeric, nota_realizado,
				'importacion'
			from jsonb_array_elements(realizados_nuevos) r;
		end if;
	end loop;

	return jsonb_build_object(
		'ensayo', ensayo,
		'programa', jsonb_build_object('accion', accion_programa, 'id', programa.id),
		'resumen', jsonb_build_object('crear', n_crear, 'actualizar', n_actualizar, 'sinCambios', n_sin_cambios),
		'partidas', partidas_resumen
	);
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0008_realizados_origen.sql') on conflict do nothing;

-- =============================================================================================
-- 0009_importacion_alcances.sql
-- =============================================================================================
-- 0009_importacion_alcances.sql
-- Cuando el libro no trae alcances ejecutables de una partida (solo notas o normas), la importación
-- conserva los alcances ya registrados, por ejemplo los tomados de los reportes con
-- «derivar-partidas --complementar», y solo compara y reemplaza las notas y normas.

create or replace function public.api_importar_catalogo(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_contrato uuid := (p ->> 'contratoId')::uuid;
	id_sitio uuid := (p ->> 'sitioId')::uuid;
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	programa public.programas;
	accion_programa text := 'ninguno';
	entrada jsonb;
	existente public.partidas;
	id_partida uuid;
	accion text;
	meses_actuales jsonb;
	meses_nuevos jsonb;
	realizados_actuales jsonb;
	realizados_nuevos jsonb;
	canon_existente jsonb;
	canon_nueva jsonb;
	cambia_programa boolean;
	sin_alcances boolean;
	partidas_resumen jsonb := '[]'::jsonb;
	n_crear integer := 0;
	n_actualizar integer := 0;
	n_sin_cambios integer := 0;
	nota_realizado constant text := 'Marcado como realizado en el programa importado';
begin
	if not exists (select 1 from public.contrato_sitios where contrato_id = id_contrato and sitio_id = id_sitio) then
		perform public.error_api('IC422', 'El sitio no pertenece al contrato',
			jsonb_build_object('motivo', 'sitio_de_otro_contrato'));
	end if;

	if p -> 'programa' is not null and jsonb_typeof(p -> 'programa') = 'object' then
		select * into programa from public.programas
		where contrato_id = id_contrato and sitio_id = id_sitio
			and periodo_inicio = (p #>> '{programa,periodoInicio}')::date;
		if programa.id is null then
			accion_programa := 'crear';
			if not ensayo then
				insert into public.programas (contrato_id, sitio_id, periodo_inicio, periodo_fin, nombre)
				values (id_contrato, id_sitio, (p #>> '{programa,periodoInicio}')::date,
					(p #>> '{programa,periodoFin}')::date, public.texto_o_nulo(p #>> '{programa,nombre}'))
				returning * into programa;
			end if;
		elsif programa.periodo_fin is distinct from (p #>> '{programa,periodoFin}')::date
			or ((p -> 'programa') ? 'nombre'
				and programa.nombre is distinct from public.texto_o_nulo(p #>> '{programa,nombre}')) then
			accion_programa := 'actualizar';
			if not ensayo then
				-- Las reglas de periodo (sin traslapes ni reportes fuera) las aplican sus restricciones.
				update public.programas set
					periodo_fin = (p #>> '{programa,periodoFin}')::date,
					nombre = case when (p -> 'programa') ? 'nombre'
						then public.texto_o_nulo(p #>> '{programa,nombre}') else nombre end
				where id = programa.id
				returning * into programa;
			end if;
		else
			accion_programa := 'existente';
		end if;
	end if;

	for entrada in select * from jsonb_array_elements(coalesce(p -> 'partidas', '[]'::jsonb)) loop
		select * into existente from public.partidas
		where contrato_id = id_contrato and sitio_id = id_sitio
			and numero_normalizado = public.normalizar_numero_partida(entrada ->> 'numero');

		meses_nuevos := coalesce((
			select jsonb_agg(jsonb_build_object('mes', public.primer_dia_mes((m ->> 'mes')::date),
				'cantidad', (m ->> 'cantidad')::numeric) order by (m ->> 'mes')::date)
			from jsonb_array_elements(coalesce(entrada -> 'meses', '[]'::jsonb)) m
		), '[]'::jsonb);
		realizados_nuevos := coalesce((
			select jsonb_agg(jsonb_build_object('mes', public.primer_dia_mes((r ->> 'mes')::date),
				'cantidad', coalesce((r ->> 'cantidad')::numeric, 1)) order by (r ->> 'mes')::date)
			from jsonb_array_elements(coalesce(entrada -> 'realizados', '[]'::jsonb)) r
		), '[]'::jsonb);
		if programa.id is null or existente.id is null then
			meses_actuales := '[]'::jsonb;
			realizados_actuales := '[]'::jsonb;
		else
			meses_actuales := coalesce((
				select jsonb_agg(jsonb_build_object('mes', pm.mes, 'cantidad', pm.cantidad) order by pm.mes)
				from public.programa_meses pm where pm.programa_id = programa.id and pm.partida_id = existente.id
			), '[]'::jsonb);
			realizados_actuales := coalesce((
				select jsonb_agg(jsonb_build_object('mes', x.mes, 'cantidad', x.cantidad) order by x.mes)
				from public.programa_realizados_manuales x
				where x.programa_id = programa.id and x.partida_id = existente.id and x.origen = 'importacion'
			), '[]'::jsonb);
		end if;
		cambia_programa := accion_programa <> 'ninguno'
			and (meses_nuevos <> meses_actuales or realizados_nuevos <> realizados_actuales);

		-- Solo se comparan los campos que trae el libro.
		canon_nueva := public.importacion_canonica(entrada);
		canon_existente := case when existente.id is null then null
			else public.partida_canonica_importacion(existente) end;
		if not entrada ? 'descripcion' then
			canon_nueva := canon_nueva - 'descripcion';
			canon_existente := canon_existente - 'descripcion';
		end if;
		-- Si el libro no trae alcances ejecutables de la partida (solo notas o normas), se conservan los
		-- registrados (p. ej. tomados de los reportes) y solo se comparan y reemplazan notas y normas.
		sin_alcances := not exists (
			select 1 from jsonb_array_elements(coalesce(entrada -> 'alcances', '[]'::jsonb)) a
			where a ->> 'tipo' = 'alcance'
		);
		if sin_alcances and existente.id is not null then
			canon_existente := jsonb_set(canon_existente, '{alcances}', coalesce((
				select jsonb_agg(a order by n)
				from jsonb_array_elements(canon_existente -> 'alcances') with ordinality as x(a, n)
				where a ->> 'tipo' <> 'alcance'
			), '[]'::jsonb));
		end if;

		if existente.id is null then
			accion := 'crear';
			n_crear := n_crear + 1;
		elsif canon_existente <> canon_nueva or cambia_programa then
			accion := 'actualizar';
			n_actualizar := n_actualizar + 1;
		else
			accion := 'sin_cambios';
			n_sin_cambios := n_sin_cambios + 1;
		end if;

		partidas_resumen := partidas_resumen || jsonb_build_object(
			'numero', entrada ->> 'numero', 'actividad', entrada ->> 'actividad', 'accion', accion,
			'alcances', jsonb_array_length(coalesce(entrada -> 'alcances', '[]'::jsonb)),
			'mesesProgramados', jsonb_array_length(meses_nuevos), 'cambiaPrograma', cambia_programa,
			'estabaPorConfirmar', coalesce(existente.estado_catalogo = 'por_confirmar', false)
		);

		if ensayo or accion = 'sin_cambios' then
			continue;
		end if;

		if existente.id is null then
			insert into public.partidas (contrato_id, sitio_id, numero, actividad, periodicidad)
			values (id_contrato, id_sitio, btrim(entrada ->> 'numero'), btrim(entrada ->> 'actividad'),
				entrada ->> 'periodicidad')
			returning id into id_partida;
		else
			id_partida := existente.id;
		end if;
		update public.partidas set
			actividad = btrim(entrada ->> 'actividad'),
			descripcion = case when entrada ? 'descripcion'
				then public.texto_o_nulo(entrada ->> 'descripcion') else descripcion end,
			distribucion = public.texto_o_nulo(entrada ->> 'distribucion'),
			periodicidad = entrada ->> 'periodicidad',
			cantidad_anual = (entrada ->> 'cantidadAnual')::numeric,
			entrega = public.texto_o_nulo(entrada ->> 'entrega'),
			entrega_oma = public.texto_o_nulo(entrada ->> 'entregaOma'),
			entrega_propuesta = public.texto_o_nulo(entrada ->> 'entregaPropuesta'),
			requiere_odm = coalesce((entrada ->> 'requiereOdm')::boolean, false),
			requiere_pt = coalesce((entrada ->> 'requierePt')::boolean, false),
			requiere_ast = coalesce((entrada ->> 'requiereAst')::boolean, false),
			materiales_por = public.texto_o_nulo(entrada ->> 'materialesPor'),
			reportes_homologados = public.texto_o_nulo(entrada ->> 'reportesHomologados'),
			estado_catalogo = 'confirmado'
		where id = id_partida;

		if sin_alcances then
			-- Se conservan los alcances ejecutables; las notas y normas se reemplazan después de ellos.
			delete from public.partida_alcances where partida_id = id_partida and tipo <> 'alcance';
			insert into public.partida_alcances (partida_id, orden, tipo, texto)
			select id_partida,
				coalesce((select max(orden) from public.partida_alcances where partida_id = id_partida), 0) + a.n,
				a.valor ->> 'tipo', btrim(a.valor ->> 'texto')
			from jsonb_array_elements(coalesce(entrada -> 'alcances', '[]'::jsonb)) with ordinality as a(valor, n);
		else
			delete from public.partida_alcances where partida_id = id_partida;
			insert into public.partida_alcances (partida_id, orden, tipo, texto)
			select id_partida, a.n, a.valor ->> 'tipo', btrim(a.valor ->> 'texto')
			from jsonb_array_elements(coalesce(entrada -> 'alcances', '[]'::jsonb)) with ordinality as a(valor, n);
		end if;

		if programa.id is not null then
			delete from public.programa_meses where programa_id = programa.id and partida_id = id_partida;
			insert into public.programa_meses (programa_id, partida_id, mes, cantidad)
			select programa.id, id_partida, (m ->> 'mes')::date, (m ->> 'cantidad')::numeric
			from jsonb_array_elements(meses_nuevos) m;
			-- Las marcas R importadas se reemplazan; las capturadas a mano tienen origen «manual».
			delete from public.programa_realizados_manuales
			where programa_id = programa.id and partida_id = id_partida and origen = 'importacion';
			insert into public.programa_realizados_manuales (programa_id, partida_id, mes, cantidad, nota, origen)
			select programa.id, id_partida, (r ->> 'mes')::date, (r ->> 'cantidad')::numeric, nota_realizado,
				'importacion'
			from jsonb_array_elements(realizados_nuevos) r;
		end if;
	end loop;

	return jsonb_build_object(
		'ensayo', ensayo,
		'programa', jsonb_build_object('accion', accion_programa, 'id', programa.id),
		'resumen', jsonb_build_object('crear', n_crear, 'actualizar', n_actualizar, 'sinCambios', n_sin_cambios),
		'partidas', partidas_resumen
	);
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0009_importacion_alcances.sql') on conflict do nothing;

-- =============================================================================================
-- 0010_documento_version.sql
-- =============================================================================================
-- 0010_documento_version.sql
-- Corrección de la revisión de la fase 5: el documento se registra con la versión del reporte con la
-- que se generó. Si el reporte cambió mientras se generaba (p. ej. un autoguardado), se rechaza con
-- un conflicto en lugar de asociar el contenido anterior a la versión nueva.

create or replace function public.api_registrar_documento(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	actual public.reportes;
	fila public.documentos_generados;
begin
	select * into actual from public.reportes where id = (p ->> 'reporteId')::uuid for update;
	if actual.id is null then
		perform public.error_api('IC404', 'Reporte no encontrado', jsonb_build_object('id', p ->> 'reporteId'));
	end if;
	if p ? 'reporteVersion' and actual.version <> (p ->> 'reporteVersion')::integer then
		perform public.error_api('IC409', 'El reporte cambió mientras se generaba el documento',
			jsonb_build_object('motivo', 'version', 'versionActual', actual.version));
	end if;
	insert into public.documentos_generados (reporte_id, reporte_version, version_plantilla, ruta,
		nombre_archivo, bytes)
	values (actual.id, actual.version, p ->> 'versionPlantilla', p ->> 'ruta', p ->> 'nombreArchivo',
		(p ->> 'bytes')::integer)
	returning * into fila;
	return jsonb_build_object('id', fila.id, 'reporteId', fila.reporte_id, 'reporteVersion', fila.reporte_version,
		'versionPlantilla', fila.version_plantilla, 'ruta', fila.ruta, 'nombreArchivo', fila.nombre_archivo,
		'bytes', fila.bytes, 'generadoEn', fila.generado_en);
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0010_documento_version.sql') on conflict do nothing;

-- =============================================================================================
-- 0011_documento_version_obligatoria.sql
-- =============================================================================================
-- 0011_documento_version_obligatoria.sql
-- Corrección de la revisión de la fase 5 (ronda 2): la versión con la que se generó el documento es
-- obligatoria; sin ella (o si no es un entero) se rechaza, para que ningún llamador registre un DOCX
-- obsoleto como el de la versión vigente.

create or replace function public.api_registrar_documento(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	actual public.reportes;
	fila public.documentos_generados;
	version_esperada integer;
begin
	if coalesce(p ->> 'reporteVersion', '') !~ '^\d+$' then
		perform public.error_api('IC422', 'Falta la versión del reporte con la que se generó el documento',
			jsonb_build_object('motivo', 'version_requerida'));
	end if;
	version_esperada := (p ->> 'reporteVersion')::integer;
	select * into actual from public.reportes where id = (p ->> 'reporteId')::uuid for update;
	if actual.id is null then
		perform public.error_api('IC404', 'Reporte no encontrado', jsonb_build_object('id', p ->> 'reporteId'));
	end if;
	if actual.version <> version_esperada then
		perform public.error_api('IC409', 'El reporte cambió mientras se generaba el documento',
			jsonb_build_object('motivo', 'version', 'versionActual', actual.version));
	end if;
	insert into public.documentos_generados (reporte_id, reporte_version, version_plantilla, ruta,
		nombre_archivo, bytes)
	values (actual.id, actual.version, p ->> 'versionPlantilla', p ->> 'ruta', p ->> 'nombreArchivo',
		(p ->> 'bytes')::integer)
	returning * into fila;
	return jsonb_build_object('id', fila.id, 'reporteId', fila.reporte_id, 'reporteVersion', fila.reporte_version,
		'versionPlantilla', fila.version_plantilla, 'ruta', fila.ruta, 'nombreArchivo', fila.nombre_archivo,
		'bytes', fila.bytes, 'generadoEn', fila.generado_en);
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0011_documento_version_obligatoria.sql') on conflict do nothing;

-- =============================================================================================
-- 0012_avance_desglose.sql
-- =============================================================================================
-- 0012_avance_desglose.sql
-- Corrección de la revisión de la fase 6 (ronda 2): cada celda del avance separa las ejecuciones que
-- vienen de reportes emitidos (varios reportes por TAG cuentan una) de lo realizado sin reporte
-- (marcas R del Excel y realizados capturados a mano), para no inferirlo restando documentos.

create or replace function public.api_obtener_programa(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
	programa public.programas;
begin
	select * into programa from public.programas where id = (p ->> 'id')::uuid;
	if programa.id is null then
		perform public.error_api('IC404', 'Programa no encontrado', jsonb_build_object('id', p ->> 'id'));
	end if;
	return jsonb_build_object(
		'programa', public.json_programa(programa),
		'partidas', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', t.id, 'numero', t.numero, 'actividad', t.actividad, 'periodicidad', t.periodicidad,
				'distribucion', t.distribucion, 'cantidadAnual', t.cantidad_anual,
				'celdas', celdas.valor, 'totalProgramado', celdas.programado, 'totalRealizado', celdas.realizado,
				'diferencia', case when t.cantidad_anual is null then null else t.cantidad_anual - celdas.programado end
			) order by
				case when t.numero_normalizado ~ '^[0-9]+$' then t.numero_normalizado::integer end,
				t.numero_normalizado)
			from public.partidas t,
			lateral (
				select jsonb_agg(jsonb_build_object(
						'mes', m.mes, 'programado', pm.cantidad,
						'realizado', coalesce(v.realizado, 0), 'reportes', coalesce(v.reportes, '[]'::jsonb),
						'ejecucionesReportes', coalesce(v.ejecuciones_reportes, 0),
						'realizadoSinReporte', coalesce(v.cantidad_manual, 0)
					) order by m.mes) as valor,
					coalesce(sum(pm.cantidad), 0) as programado,
					coalesce(sum(v.realizado), 0) as realizado
				from public.meses_del_periodo(programa.periodo_inicio, programa.periodo_fin) as m(mes)
				left join public.programa_meses pm
					on pm.programa_id = programa.id and pm.partida_id = t.id and pm.mes = m.mes
				left join public.v_realizado v
					on v.programa_id = programa.id and v.partida_id = t.id and v.mes = m.mes
			) celdas
			where t.contrato_id = programa.contrato_id and t.sitio_id = programa.sitio_id
		), '[]'::jsonb)
	);
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0012_avance_desglose.sql') on conflict do nothing;

-- =============================================================================================
-- 0013_resumen_reportes_partida.sql
-- =============================================================================================
-- 0013_resumen_reportes_partida.sql
-- Cambio ux-editor-inicio-captura (fase C): cada fila del historial trae también la partida y el sitio
-- del reporte, para relacionar borradores con pendientes del programa sin comparar textos. Misma firma
-- y mismo resultado que en 0003, con dos campos más.

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
			select jsonb_agg(fila order by orden_periodo desc, orden_actualizado desc)
			from (
				select f.periodo_mes as orden_periodo, f.actualizado_en as orden_actualizado,
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
				order by f.periodo_mes desc, f.actualizado_en desc
				offset ((select numero from pagina) - 1) * (select tamano from pagina)
				limit (select tamano from pagina)
			) paginadas
		), '[]'::jsonb)
	)
$$;

insert into interno.migraciones (nombre) values ('0013_resumen_reportes_partida.sql') on conflict do nothing;

-- =============================================================================================
-- 0014_listar_reportes_orden_estable.sql
-- =============================================================================================
-- 0014_listar_reportes_orden_estable.sql
-- Corrección de la revisión de Codex (fase C, ronda 1): el historial se pagina con OFFSET y el orden
-- por periodo y fecha de actualización no era total; con empates en el límite de una página,
-- PostgreSQL podía devolverlos en distinto orden entre consultas y listarTodos duplicar u omitir
-- filas. Se desempata por id. Misma firma y resultado que 0013.

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

insert into interno.migraciones (nombre) values ('0014_listar_reportes_orden_estable.sql') on conflict do nothing;

-- =============================================================================================
-- 0015_importar_programa.sql
-- =============================================================================================
-- 0015_importar_programa.sql
-- Importación de solo programa anual (libros como el de Proagro, sin hoja de catálogo): crea o
-- actualiza el programa del sitio y, por partida, solo la periodicidad, la cantidad anual, los meses
-- programados y las marcas R de origen importación. No toca alcances, entregas, requisitos,
-- materiales, notas, normas, descripción ni distribución; la actividad y el estado del catálogo solo
-- cambian si se piden («usarActividad» y «confirmar»). Con «ensayo» calcula sin escribir.

create or replace function public.api_importar_programa(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_contrato uuid := (p ->> 'contratoId')::uuid;
	id_sitio uuid := (p ->> 'sitioId')::uuid;
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	confirmar boolean := coalesce((p ->> 'confirmar')::boolean, false);
	inicio date := (p #>> '{programa,periodoInicio}')::date;
	fin date := (p #>> '{programa,periodoFin}')::date;
	nombre_programa text := public.texto_o_nulo(p #>> '{programa,nombre}');
	programa public.programas;
	superpuesto public.programas;
	accion_programa text;
	entrada jsonb;
	existente public.partidas;
	id_partida uuid;
	accion text;
	actividad_nueva text;
	periodicidad_nueva text;
	cantidad_nueva numeric;
	meses_actuales jsonb;
	meses_nuevos jsonb;
	realizados_actuales jsonb;
	realizados_nuevos jsonb;
	cambia_programa boolean;
	cambia_partida boolean;
	estaba_por_confirmar boolean;
	queda_por_confirmar boolean;
	numeros text[] := '{}';
	partidas_resumen jsonb := '[]'::jsonb;
	n_crear integer := 0;
	n_actualizar integer := 0;
	n_sin_cambios integer := 0;
	nota_realizado constant text := 'Marcado como realizado en el programa importado';
begin
	if not exists (select 1 from public.contrato_sitios where contrato_id = id_contrato and sitio_id = id_sitio) then
		perform public.error_api('IC422', 'El sitio no pertenece al contrato',
			jsonb_build_object('motivo', 'sitio_de_otro_contrato'));
	end if;
	if inicio is null or fin is null or fin < inicio then
		perform public.error_api('IC422', 'El periodo del programa no es válido',
			jsonb_build_object('motivo', 'periodo_invalido'));
	end if;

	select * into superpuesto from public.programas
	where contrato_id = id_contrato and sitio_id = id_sitio and periodo_inicio <> inicio
		and daterange(periodo_inicio, periodo_fin, '[]') && daterange(inicio, fin, '[]')
	limit 1;
	if superpuesto.id is not null then
		perform public.error_api('IC422', 'El periodo se superpone con otro programa del sitio',
			jsonb_build_object('motivo', 'programa_superpuesto',
				'existente', jsonb_build_object('periodoInicio', superpuesto.periodo_inicio,
					'periodoFin', superpuesto.periodo_fin),
				'importado', jsonb_build_object('periodoInicio', inicio, 'periodoFin', fin)));
	end if;

	select * into programa from public.programas
	where contrato_id = id_contrato and sitio_id = id_sitio and periodo_inicio = inicio;
	if programa.id is null then
		accion_programa := 'crear';
		if not ensayo then
			insert into public.programas (contrato_id, sitio_id, periodo_inicio, periodo_fin, nombre)
			values (id_contrato, id_sitio, inicio, fin, nombre_programa)
			returning * into programa;
		end if;
	elsif programa.periodo_fin is distinct from fin
		or ((p -> 'programa') ? 'nombre' and programa.nombre is distinct from nombre_programa) then
		accion_programa := 'actualizar';
		if not ensayo then
			-- Los meses de las partidas del libro se reemplazan después; los que quedarían fuera de un
			-- periodo más corto se quitan antes para que validar_programa acepte el nuevo fin. Los de
			-- otras partidas se conservan y, si quedan fuera, el trigger rechaza el cambio.
			delete from public.programa_meses pm
			using public.partidas t
			where pm.programa_id = programa.id and pm.partida_id = t.id and pm.mes > fin
				and t.numero_normalizado in (
					select public.normalizar_numero_partida(e ->> 'numero')
					from jsonb_array_elements(coalesce(p -> 'partidas', '[]'::jsonb)) e);
			delete from public.programa_realizados_manuales x
			using public.partidas t
			where x.programa_id = programa.id and x.partida_id = t.id and x.mes > fin
				and x.origen = 'importacion'
				and t.numero_normalizado in (
					select public.normalizar_numero_partida(e ->> 'numero')
					from jsonb_array_elements(coalesce(p -> 'partidas', '[]'::jsonb)) e);
			update public.programas set
				periodo_fin = fin,
				nombre = case when (p -> 'programa') ? 'nombre' then nombre_programa else nombre end
			where id = programa.id
			returning * into programa;
		end if;
	else
		accion_programa := 'existente';
	end if;

	for entrada in select * from jsonb_array_elements(coalesce(p -> 'partidas', '[]'::jsonb)) loop
		numeros := numeros || public.normalizar_numero_partida(entrada ->> 'numero');
		select * into existente from public.partidas
		where contrato_id = id_contrato and sitio_id = id_sitio
			and numero_normalizado = public.normalizar_numero_partida(entrada ->> 'numero');

		periodicidad_nueva := entrada ->> 'periodicidad';
		cantidad_nueva := case when periodicidad_nueva = 'cuando_aplique' then null
			else (entrada ->> 'cantidadAnual')::numeric end;
		actividad_nueva := case
			when existente.id is null or coalesce((entrada ->> 'usarActividad')::boolean, false)
				then btrim(entrada ->> 'actividad')
			else existente.actividad end;
		estaba_por_confirmar := coalesce(existente.estado_catalogo = 'por_confirmar', false);
		queda_por_confirmar := not confirmar and (existente.id is null or estaba_por_confirmar);

		meses_nuevos := coalesce((
			select jsonb_agg(jsonb_build_object('mes', public.primer_dia_mes((m ->> 'mes')::date),
				'cantidad', (m ->> 'cantidad')::numeric) order by (m ->> 'mes')::date)
			from jsonb_array_elements(coalesce(entrada -> 'meses', '[]'::jsonb)) m
		), '[]'::jsonb);
		realizados_nuevos := coalesce((
			select jsonb_agg(jsonb_build_object('mes', public.primer_dia_mes((r ->> 'mes')::date),
				'cantidad', coalesce((r ->> 'cantidad')::numeric, 1)) order by (r ->> 'mes')::date)
			from jsonb_array_elements(coalesce(entrada -> 'realizados', '[]'::jsonb)) r
		), '[]'::jsonb);
		if programa.id is null or existente.id is null then
			meses_actuales := '[]'::jsonb;
			realizados_actuales := '[]'::jsonb;
		else
			meses_actuales := coalesce((
				select jsonb_agg(jsonb_build_object('mes', pm.mes, 'cantidad', pm.cantidad) order by pm.mes)
				from public.programa_meses pm where pm.programa_id = programa.id and pm.partida_id = existente.id
			), '[]'::jsonb);
			realizados_actuales := coalesce((
				select jsonb_agg(jsonb_build_object('mes', x.mes, 'cantidad', x.cantidad) order by x.mes)
				from public.programa_realizados_manuales x
				where x.programa_id = programa.id and x.partida_id = existente.id and x.origen = 'importacion'
			), '[]'::jsonb);
		end if;
		cambia_programa := meses_nuevos <> meses_actuales or realizados_nuevos <> realizados_actuales;
		cambia_partida := existente.id is null
			or existente.periodicidad is distinct from periodicidad_nueva
			or existente.cantidad_anual is distinct from cantidad_nueva
			or existente.actividad is distinct from actividad_nueva
			or (confirmar and estaba_por_confirmar);

		if existente.id is null then
			accion := 'crear';
			n_crear := n_crear + 1;
		elsif cambia_partida or cambia_programa then
			accion := 'actualizar';
			n_actualizar := n_actualizar + 1;
		else
			accion := 'sin_cambios';
			n_sin_cambios := n_sin_cambios + 1;
		end if;

		partidas_resumen := partidas_resumen || jsonb_build_object(
			'numero', btrim(entrada ->> 'numero'),
			'actividad', actividad_nueva,
			'accion', accion,
			'periodicidadAntes', existente.periodicidad,
			'periodicidad', periodicidad_nueva,
			'cantidadAntes', existente.cantidad_anual,
			'cantidadAnual', cantidad_nueva,
			'meses', meses_nuevos,
			'totalProgramado', coalesce((select sum((m ->> 'cantidad')::numeric)
				from jsonb_array_elements(meses_nuevos) m), 0),
			'realizados', realizados_nuevos,
			'cambiaPrograma', cambia_programa,
			'estabaPorConfirmar', estaba_por_confirmar,
			'quedaPorConfirmar', queda_por_confirmar,
			'tieneReportes', existente.id is not null
				and exists (select 1 from public.reportes r where r.partida_id = existente.id)
		);

		if ensayo or accion = 'sin_cambios' then
			continue;
		end if;

		if existente.id is null then
			insert into public.partidas (contrato_id, sitio_id, numero, actividad, periodicidad,
				cantidad_anual, estado_catalogo)
			values (id_contrato, id_sitio, btrim(entrada ->> 'numero'), actividad_nueva,
				periodicidad_nueva, cantidad_nueva,
				case when confirmar then 'confirmado' else 'por_confirmar' end)
			returning id into id_partida;
		else
			id_partida := existente.id;
			update public.partidas set
				actividad = actividad_nueva,
				periodicidad = periodicidad_nueva,
				cantidad_anual = cantidad_nueva,
				estado_catalogo = case when confirmar then 'confirmado' else estado_catalogo end
			where id = id_partida;
		end if;

		delete from public.programa_meses where programa_id = programa.id and partida_id = id_partida;
		insert into public.programa_meses (programa_id, partida_id, mes, cantidad)
		select programa.id, id_partida, (m ->> 'mes')::date, (m ->> 'cantidad')::numeric
		from jsonb_array_elements(meses_nuevos) m;
		-- Las marcas R importadas se reemplazan; las capturadas a mano tienen origen «manual».
		delete from public.programa_realizados_manuales
		where programa_id = programa.id and partida_id = id_partida and origen = 'importacion';
		insert into public.programa_realizados_manuales (programa_id, partida_id, mes, cantidad, nota, origen)
		select programa.id, id_partida, (r ->> 'mes')::date, (r ->> 'cantidad')::numeric, nota_realizado,
			'importacion'
		from jsonb_array_elements(realizados_nuevos) r;
	end loop;

	return jsonb_build_object(
		'ensayo', ensayo,
		'programa', jsonb_build_object('accion', accion_programa, 'id', programa.id,
			'periodoInicio', inicio, 'periodoFin', fin),
		'resumen', jsonb_build_object('crear', n_crear, 'actualizar', n_actualizar, 'sinCambios', n_sin_cambios),
		'partidas', partidas_resumen,
		'noIncluidas', coalesce((
			select jsonb_agg(jsonb_build_object('numero', t.numero, 'actividad', t.actividad)
				order by case when t.numero_normalizado ~ '^[0-9]+$' then t.numero_normalizado::integer end,
					t.numero_normalizado)
			from public.partidas t
			where t.contrato_id = id_contrato and t.sitio_id = id_sitio
				and not (t.numero_normalizado = any (numeros))
		), '[]'::jsonb)
	);
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0015_importar_programa.sql') on conflict do nothing;

-- =============================================================================================
-- 0016_dias_ejecucion.sql
-- =============================================================================================
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

insert into interno.migraciones (nombre) values ('0016_dias_ejecucion.sql') on conflict do nothing;

-- =============================================================================================
-- 0017_fotos_rotacion.sql
-- =============================================================================================
-- Giro de las fotos en pasos de 90° como dato de la foto (cambio editor-fotos, D8). Los archivos nunca
-- se reescriben: el editor gira con CSS y el documento con sharp. Las funciones vigentes se renombran
-- y se envuelven (convención D3 de fechas-ejecucion-multiples).

alter table public.reporte_fotos
	add column if not exists rotacion smallint not null default 0;

do $$
begin
	if not exists (select 1 from pg_constraint where conname = 'reporte_fotos_rotacion_valida') then
		alter table public.reporte_fotos
			add constraint reporte_fotos_rotacion_valida check (rotacion in (0, 90, 180, 270));
	end if;
end
$$;

-- Cuerpo de 0003 más «rotacion»: el reporte y la respuesta de api_agregar_foto la traen.
create or replace function public.json_foto(f public.reporte_fotos)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', f.id, 'alcanceId', f.reporte_alcance_id, 'orden', f.orden, 'descripcion', f.descripcion,
		'momento', f.momento, 'rutaOriginal', f.ruta_original, 'rutaOptimizada', f.ruta_optimizada,
		'ancho', f.ancho, 'alto', f.alto, 'bytes', f.bytes, 'tipoMime', f.tipo_mime,
		'rotacion', f.rotacion
	)
$$;

do $$
begin
	if not exists (select 1 from pg_proc where proname = 'api_guardar_reporte_0016'
		and pronamespace = 'public'::regnamespace) then
		alter function public.api_guardar_reporte(jsonb) rename to api_guardar_reporte_0016;
	end if;
	if not exists (select 1 from pg_proc where proname = 'api_crear_revision_0003'
		and pronamespace = 'public'::regnamespace) then
		alter function public.api_crear_revision(jsonb) rename to api_crear_revision_0003;
	end if;
end
$$;

-- Fotos del envío con su giro; sin «rotacion» (o con null) la foto conserva el que tenía.
create or replace function public.rotaciones_de_entrada(p jsonb)
returns table (foto_id uuid, valor jsonb)
language sql
immutable
as $$
	select (f.foto ->> 'id')::uuid, f.foto -> 'rotacion'
	from jsonb_array_elements(coalesce(p -> 'alcances', '[]'::jsonb)) a(alcance)
	cross join lateral jsonb_array_elements(coalesce(a.alcance -> 'fotos', '[]'::jsonb)) f(foto)
	where f.foto ? 'rotacion' and f.foto -> 'rotacion' <> 'null'::jsonb
$$;

create or replace function public.api_guardar_reporte(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_reporte uuid := (p ->> 'id')::uuid;
	resultado jsonb;
begin
	-- Se valida antes de guardar nada: un giro no válido no cambia la versión ni los datos.
	if exists (select 1 from public.rotaciones_de_entrada(p) r
		where jsonb_typeof(r.valor) <> 'number' or r.valor::text not in ('0', '90', '180', '270')) then
		perform public.error_api('IC422', 'El giro de una foto debe ser 0, 90, 180 o 270 grados',
			jsonb_build_object('motivo', 'rotacion'));
	end if;
	resultado := public.api_guardar_reporte_0016(p);
	update public.reporte_fotos f set rotacion = (r.valor::text)::smallint
	from public.rotaciones_de_entrada(p) r, public.reporte_alcances a
	where f.id = r.foto_id and a.id = f.reporte_alcance_id and a.reporte_id = id_reporte;
	return jsonb_set(resultado, '{reporte}', public.json_reporte(id_reporte));
end
$$;

-- La revisión copia el giro de las fotos del original, que la base copia con el mismo orden y rutas.
create or replace function public.api_crear_revision(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_original uuid := (p ->> 'id')::uuid;
	id_nuevo uuid := (public.api_crear_revision_0003(p) ->> 'id')::uuid;
begin
	update public.reporte_fotos nf set rotacion = fo.rotacion
	from public.reporte_alcances na, public.reporte_alcances ao, public.reporte_fotos fo
	where na.reporte_id = id_nuevo and nf.reporte_alcance_id = na.id
		and ao.reporte_id = id_original and ao.orden = na.orden
		and fo.reporte_alcance_id = ao.id and fo.orden = nf.orden
		and fo.ruta_optimizada = nf.ruta_optimizada;
	return public.json_reporte(id_nuevo);
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0017_fotos_rotacion.sql') on conflict do nothing;

-- =============================================================================================
-- 0018_bitacora_catalogo.sql
-- =============================================================================================
-- Corrección del contrato, sus sitios y sus firmantes con confirmación, motivo y bitácora de solo
-- agregar (cambio edicion-contratos-bitacora). Cada edición se calcula primero en ensayo con la misma
-- lógica que la aplicación (D3); cada reporte guarda la copia de los datos del contrato que recibió
-- para que los borradores se actualicen campo por campo sin perder lo escrito a mano (D8).

-- ---------------------------------------------------------------------------------------------
-- Bitácora (D2)
-- ---------------------------------------------------------------------------------------------

create table if not exists public.cambios_catalogo (
	id uuid primary key default gen_random_uuid(),
	entidad text not null check (entidad in ('contrato', 'sitio', 'firmante', 'contrato_sitio')),
	entidad_id uuid not null,
	-- Contrato desde el que se hizo el cambio (nulo en altas de sitio hechas sin contrato).
	contrato_id uuid references public.contratos (id) on delete restrict,
	accion text not null check (accion in ('crear', 'editar', 'reemplazar', 'asociar', 'quitar')),
	cambios jsonb not null default '[]'::jsonb,
	motivo text check (motivo is null or char_length(btrim(motivo)) between 10 and 500),
	efectos jsonb not null default '{}'::jsonb,
	usuario_id uuid,
	usuario_texto text,
	origen text not null default 'interfaz' check (origen in ('interfaz', 'script')),
	realizado_en timestamptz not null default now()
);
create index if not exists cambios_catalogo_contrato_idx
	on public.cambios_catalogo (contrato_id, realizado_en desc);
create index if not exists cambios_catalogo_entidad_idx
	on public.cambios_catalogo (entidad, entidad_id, realizado_en desc);

create or replace function public.bitacora_solo_agregar()
returns trigger
language plpgsql
as $$
begin
	perform public.error_api('IC422', 'La bitácora del catálogo no se modifica ni se borra',
		jsonb_build_object('motivo', 'bitacora_inmutable'));
	return null;
end
$$;

drop trigger if exists cambios_catalogo_inmutable on public.cambios_catalogo;
create trigger cambios_catalogo_inmutable before update or delete on public.cambios_catalogo
	for each row execute function public.bitacora_solo_agregar();
drop trigger if exists cambios_catalogo_sin_truncar on public.cambios_catalogo;
create trigger cambios_catalogo_sin_truncar before truncate on public.cambios_catalogo
	for each statement execute function public.bitacora_solo_agregar();

alter table public.cambios_catalogo enable row level security;
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		if not exists (select 1 from pg_policies where tablename = 'cambios_catalogo'
			and policyname = 'servicio_acceso_total') then
			create policy servicio_acceso_total on public.cambios_catalogo for all to service_role
				using (true) with check (true);
		end if;
		revoke all on public.cambios_catalogo from anon, authenticated;
	end if;
end
$$;

-- Motivo sin espacios al inicio ni al final; obligatorio (10 a 500 caracteres) en ediciones y quitas.
create or replace function public.motivo_de_cambio(p jsonb, requerido boolean)
returns text
language plpgsql
as $$
declare
	motivo text := nullif(btrim(coalesce(p ->> 'motivo', '')), '');
begin
	if (requerido and motivo is null) or char_length(coalesce(motivo, 'xxxxxxxxxx')) not between 10 and 500 then
		perform public.error_api('IC422', 'El motivo debe tener de 10 a 500 caracteres',
			jsonb_build_object('motivo', 'motivo_invalido'));
	end if;
	return motivo;
end
$$;

create or replace function public.registrar_cambio_catalogo(
	p jsonb, entidad text, entidad_id uuid, contrato_id uuid, accion text, cambios jsonb,
	motivo text, efectos jsonb
)
returns uuid
language sql
as $$
	insert into public.cambios_catalogo (entidad, entidad_id, contrato_id, accion, cambios, motivo,
		efectos, usuario_id, usuario_texto, origen)
	values (entidad, entidad_id, contrato_id, accion, coalesce(cambios, '[]'::jsonb), motivo,
		coalesce(efectos, '{}'::jsonb), (p ->> 'usuarioId')::uuid, nullif(p ->> 'usuarioTexto', ''),
		coalesce(nullif(p ->> 'origen', ''), 'interfaz'))
	returning id
$$;

-- Ensayo por reversión: la función interna aplica todo y, en ensayo, un error reservado revierte la
-- subtransacción; el resultado calculado queda en la variable, que no se revierte. El código no
-- termina en 000: ese sufijo atraparía toda la clase IC (los errores de validación).
create or replace function public.con_ensayo(funcion text, p jsonb)
returns jsonb
language plpgsql
as $$
declare
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	resultado jsonb;
begin
	begin
		execute format('select public.%I($1)', funcion) into resultado using p;
		if ensayo then
			raise exception using errcode = 'ICE01', message = 'ensayo';
		end if;
	exception when sqlstate 'ICE01' then
		null;
	end;
	-- En ensayo no hay registro aplicado: el que se calculó se revirtió.
	return case when ensayo then resultado - 'aplicado' else resultado end
		|| jsonb_build_object('ensayo', ensayo);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Versión de los datos para la concurrencia optimista (D9)
-- ---------------------------------------------------------------------------------------------

create or replace function public.json_contrato(k public.contratos)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', k.id, 'clienteId', k.cliente_id, 'numero', k.numero, 'descripcion', k.descripcion,
		'vigenciaInicio', k.vigencia_inicio, 'vigenciaFin', k.vigencia_fin,
		'cliente', (select public.json_cliente(c) from public.clientes c where c.id = k.cliente_id),
		'actualizadoEn', k.actualizado_en
	)
$$;

create or replace function public.json_sitio(s public.sitios)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object('id', s.id, 'clave', s.clave, 'nombre', s.nombre,
		'actualizadoEn', s.actualizado_en)
$$;

create or replace function public.json_firmante(f public.firmantes)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', f.id, 'contratoId', f.contrato_id, 'funcion', f.funcion, 'nombre', f.nombre,
		'cargo', f.cargo, 'empresa', f.empresa, 'vigenteDesde', f.vigente_desde,
		'vigenteHasta', f.vigente_hasta, 'actualizadoEn', f.actualizado_en
	)
$$;

create or replace function public.comprobar_version(actual timestamptz, p jsonb, entidad text)
returns void
language plpgsql
as $$
begin
	if p ->> 'actualizadoEn' is null or actual <> (p ->> 'actualizadoEn')::timestamptz then
		perform public.error_api('IC409',
			format('El %s cambió desde que lo abrió; recargue para ver los datos actuales', entidad),
			jsonb_build_object('motivo', 'version', 'entidad', entidad));
	end if;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Copia de los datos del contrato en cada reporte y reconciliación (D8)
-- ---------------------------------------------------------------------------------------------

alter table public.reportes add column if not exists contrato_copia jsonb;

-- Datos que el contrato da a un reporte, con las reglas de prellenarReporte: razón social, número,
-- «clave nombre» del sitio y firmantes vigentes el día 1 del mes (solo los que existen).
create or replace function public.datos_contrato_reporte(contrato uuid, sitio uuid, mes date)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'usuario', coalesce(c.razon_social, ''),
		'contrato', k.numero,
		'sitio', btrim(s.clave || ' ' || s.nombre),
		'firmantes', coalesce((
			select jsonb_object_agg(f.funcion, jsonb_build_object('nombre', f.nombre, 'cargo', f.cargo,
				'empresa', f.empresa))
			from public.firmantes f
			where f.contrato_id = k.id
				and public.primer_dia_mes(mes) between f.vigente_desde and coalesce(f.vigente_hasta, 'infinity')
		), '{}'::jsonb)
	)
	from public.contratos k
	join public.clientes c on c.id = k.cliente_id
	join public.sitios s on s.id = sitio
	where k.id = contrato
$$;

create or replace function public.copiar_contrato_reporte()
returns trigger
language plpgsql
as $$
begin
	if new.contrato_copia is null then
		if new.sustituye_a is not null then
			select contrato_copia into new.contrato_copia from public.reportes where id = new.sustituye_a;
		end if;
		new.contrato_copia := coalesce(new.contrato_copia,
			public.datos_contrato_reporte(new.contrato_id, new.sitio_id, new.periodo_mes));
	end if;
	return new;
end
$$;

drop trigger if exists reportes_copiar_contrato on public.reportes;
create trigger reportes_copiar_contrato before insert on public.reportes
	for each row execute function public.copiar_contrato_reporte();

-- Relleno de los reportes existentes con los datos vigentes, sin tocar actualizado_en ni version.
alter table public.reportes disable trigger reportes_actualizado;
update public.reportes
set contrato_copia = public.datos_contrato_reporte(contrato_id, sitio_id, periodo_mes)
where contrato_copia is null;
alter table public.reportes enable trigger reportes_actualizado;
alter table public.reportes alter column contrato_copia set not null;

-- Datos del contrato que cambiaron desde la copia del reporte: {campo, reporte, contrato}. Sin
-- firmante vigente para una función no hay diferencia (la firma del reporte se conserva).
create or replace function public.diferencias_contrato_reporte(r public.reportes)
returns jsonb
language plpgsql
stable
as $$
declare
	vigente jsonb := public.datos_contrato_reporte(r.contrato_id, r.sitio_id, r.periodo_mes);
	copia jsonb := r.contrato_copia;
	diferencias jsonb := '[]'::jsonb;
	funcion text;
begin
	if vigente is null then
		return diferencias;
	end if;
	if vigente -> 'usuario' is distinct from copia -> 'usuario' then
		diferencias := diferencias || jsonb_build_object('campo', 'usuario', 'reporte', r.usuario,
			'contrato', vigente -> 'usuario');
	end if;
	if vigente -> 'contrato' is distinct from copia -> 'contrato' then
		diferencias := diferencias || jsonb_build_object('campo', 'contrato', 'reporte', r.contrato_texto,
			'contrato', vigente -> 'contrato');
	end if;
	if vigente -> 'sitio' is distinct from copia -> 'sitio' then
		diferencias := diferencias || jsonb_build_object('campo', 'sitio', 'reporte', r.sitio_texto,
			'contrato', vigente -> 'sitio');
	end if;
	foreach funcion in array array['elaboro', 'aprobo', 'recibio'] loop
		if vigente -> 'firmantes' ? funcion
			and vigente -> 'firmantes' -> funcion is distinct from copia -> 'firmantes' -> funcion then
			diferencias := diferencias || jsonb_build_object('campo', 'firmantes.' || funcion,
				'reporte', r.firmantes -> funcion, 'contrato', vigente -> 'firmantes' -> funcion);
		end if;
	end loop;
	return diferencias;
end
$$;

-- Lleva a un borrador los datos vigentes del contrato que cambiaron: un campo que conserva el valor
-- de la copia (o con `forzar`) se actualiza; uno escrito a mano se deja y queda con aviso. Si aplica
-- algo sube la versión (invalida el DOCX en caché y el guardado de una pestaña abierta).
create or replace function public.reconciliar_contrato_reporte(id_reporte uuid, forzar boolean)
returns boolean
language plpgsql
as $$
declare
	r public.reportes;
	d jsonb;
	funcion text;
	aplicado boolean := false;
begin
	select * into r from public.reportes where id = id_reporte for update;
	if r.id is null or r.estado <> 'borrador' then
		return false;
	end if;
	for d in select value from jsonb_array_elements(public.diferencias_contrato_reporte(r)) loop
		case d ->> 'campo'
			when 'usuario' then
				if forzar or r.usuario = r.contrato_copia ->> 'usuario' then
					r.usuario := d ->> 'contrato';
					r.contrato_copia := jsonb_set(r.contrato_copia, '{usuario}', d -> 'contrato');
					aplicado := true;
				end if;
			when 'contrato' then
				if forzar or r.contrato_texto = r.contrato_copia ->> 'contrato' then
					r.contrato_texto := d ->> 'contrato';
					r.contrato_copia := jsonb_set(r.contrato_copia, '{contrato}', d -> 'contrato');
					aplicado := true;
				end if;
			when 'sitio' then
				if forzar or r.sitio_texto = r.contrato_copia ->> 'sitio' then
					r.sitio_texto := d ->> 'contrato';
					r.contrato_copia := jsonb_set(r.contrato_copia, '{sitio}', d -> 'contrato');
					aplicado := true;
				end if;
			else
				funcion := substr(d ->> 'campo', length('firmantes.') + 1);
				if forzar or r.firmantes -> funcion is not distinct from r.contrato_copia -> 'firmantes' -> funcion then
					r.firmantes := jsonb_set(r.firmantes, array[funcion], d -> 'contrato');
					r.contrato_copia := jsonb_set(r.contrato_copia, '{firmantes}',
						coalesce(r.contrato_copia -> 'firmantes', '{}'::jsonb)
							|| jsonb_build_object(funcion, d -> 'contrato'));
					aplicado := true;
				end if;
		end case;
	end loop;
	if aplicado then
		update public.reportes set
			usuario = r.usuario, contrato_texto = r.contrato_texto, sitio_texto = r.sitio_texto,
			firmantes = r.firmantes, contrato_copia = r.contrato_copia, version = version + 1
		where id = r.id;
	end if;
	return aplicado;
end
$$;

-- Diferencias de cada reporte del alcance: {id: diferencias}.
create or replace function public.diferencias_de_reportes(ids uuid[])
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_object_agg(r.id, public.diferencias_contrato_reporte(r)), '{}'::jsonb)
	from public.reportes r where r.id = any (ids)
$$;

-- Impacto de un cambio ya aplicado sobre los reportes del alcance cuyas diferencias cambiaron, y
-- propagación opcional a los borradores (sin forzar).
create or replace function public.propagar_cambio(ids uuid[], antes jsonb, actualizar boolean)
returns jsonb
language plpgsql
as $$
declare
	r public.reportes;
	despues public.reportes;
	borradores uuid[] := '{}';
	actualizados uuid[] := '{}';
	con_aviso uuid[] := '{}';
	en_revision integer := 0;
	emitidos integer := 0;
	sustituidos integer := 0;
begin
	for r in select * from public.reportes where id = any (ids) order by periodo_mes, id loop
		if public.diferencias_contrato_reporte(r) is not distinct from coalesce(antes -> r.id::text, '[]'::jsonb) then
			continue;
		end if;
		case r.estado
			when 'borrador' then
				borradores := borradores || r.id;
				if actualizar and public.reconciliar_contrato_reporte(r.id, false) then
					actualizados := actualizados || r.id;
				end if;
				select * into despues from public.reportes where id = r.id;
				if jsonb_array_length(public.diferencias_contrato_reporte(despues)) > 0 then
					con_aviso := con_aviso || r.id;
				end if;
			when 'en_revision' then en_revision := en_revision + 1;
			when 'emitido' then emitidos := emitidos + 1;
			else sustituidos := sustituidos + 1;
		end case;
	end loop;
	return jsonb_build_object(
		'borradores', cardinality(borradores), 'borradoresIds', to_jsonb(borradores),
		'borradoresActualizados', to_jsonb(actualizados), 'borradoresConAviso', to_jsonb(con_aviso),
		'enRevision', en_revision, 'emitidos', emitidos, 'sustituidos', sustituidos
	);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Contrato (D1, D5)
-- ---------------------------------------------------------------------------------------------

-- Lo que la vigencia propuesta deja fuera: meses con reportes y programas con meses fuera. Un mes
-- está dentro si alguno de sus días cae en la vigencia.
create or replace function public.fuera_de_vigencia(contrato uuid, inicio date, fin date)
returns jsonb
language sql
stable
as $$
	with fuera as (
		select 'reportes' as tipo, null::text as sitio, r.periodo_mes as mes
		from public.reportes r
		where r.contrato_id = contrato
			and (r.periodo_mes < public.primer_dia_mes(inicio) or r.periodo_mes > fin)
		union
		select 'programa', s.clave, m::date
		from public.programas g
		join public.sitios s on s.id = g.sitio_id
		cross join lateral generate_series(public.primer_dia_mes(g.periodo_inicio), g.periodo_fin,
			interval '1 month') m
		where g.contrato_id = contrato
			and (m::date < public.primer_dia_mes(inicio) or m::date > fin)
		-- Los meses programados y los realizados manuales caen dentro del periodo de su programa (0002),
		-- pero la vigencia los revisa también por sí mismos.
		union
		select 'meses', s.clave, pm.mes
		from public.programa_meses pm
		join public.programas g on g.id = pm.programa_id
		join public.sitios s on s.id = g.sitio_id
		where g.contrato_id = contrato and pm.cantidad > 0
			and (pm.mes < public.primer_dia_mes(inicio) or pm.mes > fin)
		union
		select 'realizados', s.clave, x.mes
		from public.programa_realizados_manuales x
		join public.programas g on g.id = x.programa_id
		join public.sitios s on s.id = g.sitio_id
		where g.contrato_id = contrato
			and (x.mes < public.primer_dia_mes(inicio) or x.mes > fin)
	)
	select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'sitio', sitio, 'meses', meses)
		order by tipo, sitio), '[]'::jsonb)
	from (
		select tipo, sitio, jsonb_agg(distinct mes order by mes) as meses from fuera group by tipo, sitio
	) agrupado
$$;

create or replace function public.editar_contrato(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	motivo text := public.motivo_de_cambio(p, not ensayo);
	actual public.contratos;
	nuevo public.contratos;
	cambios jsonb := '[]'::jsonb;
	fuera jsonb;
	ids uuid[];
	antes jsonb;
	impacto jsonb;
	cambio_id uuid;
begin
	select * into actual from public.contratos where id = (p ->> 'id')::uuid for update;
	if actual.id is null then
		perform public.error_api('IC404', 'Contrato no encontrado', jsonb_build_object('id', p ->> 'id'));
	end if;
	perform public.comprobar_version(actual.actualizado_en, p, 'contrato');
	if p ? 'clienteId' and (p ->> 'clienteId')::uuid <> actual.cliente_id then
		perform public.error_api('IC422',
			'El cliente de un contrato no cambia; una renovación se registra como contrato nuevo',
			jsonb_build_object('motivo', 'cliente_fijo'));
	end if;
	nuevo := actual;
	nuevo.numero := btrim(coalesce(p ->> 'numero', actual.numero));
	nuevo.descripcion := case when p ? 'descripcion' then public.texto_o_nulo(p ->> 'descripcion')
		else actual.descripcion end;
	nuevo.vigencia_inicio := coalesce((p ->> 'vigenciaInicio')::date, actual.vigencia_inicio);
	nuevo.vigencia_fin := coalesce((p ->> 'vigenciaFin')::date, actual.vigencia_fin);
	if nuevo.numero = '' then
		perform public.error_api('IC422', 'El número del contrato es obligatorio',
			jsonb_build_object('motivo', 'validacion', 'campos', jsonb_build_array('numero')));
	end if;
	if nuevo.vigencia_fin < nuevo.vigencia_inicio then
		perform public.error_api('IC422', 'El fin de la vigencia es anterior a su inicio',
			jsonb_build_object('motivo', 'validacion', 'campos', jsonb_build_array('vigenciaFin')));
	end if;
	if nuevo.numero <> actual.numero then
		cambios := cambios || jsonb_build_object('campo', 'numero', 'antes', actual.numero, 'despues', nuevo.numero);
	end if;
	if nuevo.descripcion is distinct from actual.descripcion then
		cambios := cambios || jsonb_build_object('campo', 'descripcion', 'antes', actual.descripcion,
			'despues', nuevo.descripcion);
	end if;
	if nuevo.vigencia_inicio <> actual.vigencia_inicio then
		cambios := cambios || jsonb_build_object('campo', 'vigenciaInicio', 'antes', actual.vigencia_inicio,
			'despues', nuevo.vigencia_inicio);
	end if;
	if nuevo.vigencia_fin <> actual.vigencia_fin then
		cambios := cambios || jsonb_build_object('campo', 'vigenciaFin', 'antes', actual.vigencia_fin,
			'despues', nuevo.vigencia_fin);
	end if;
	if jsonb_array_length(cambios) = 0 then
		perform public.error_api('IC422', 'No hay cambios que guardar', jsonb_build_object('motivo', 'sin_cambios'));
	end if;
	if exists (select 1 from public.contratos where cliente_id = actual.cliente_id and id <> actual.id
		and numero = nuevo.numero) then
		perform public.error_api('IC422', 'Ya existe un contrato con ese número para el cliente',
			jsonb_build_object('motivo', 'contrato_duplicado', 'numero', nuevo.numero, 'existente',
				(select public.json_contrato(k) from public.contratos k where k.cliente_id = actual.cliente_id
					and k.id <> actual.id and k.numero = nuevo.numero)));
	end if;
	fuera := public.fuera_de_vigencia(actual.id, nuevo.vigencia_inicio, nuevo.vigencia_fin);
	if jsonb_array_length(fuera) > 0 then
		perform public.error_api('IC422', 'La vigencia deja fuera meses con reportes o programas',
			jsonb_build_object('motivo', 'vigencia_con_datos_fuera', 'fuera', fuera));
	end if;

	ids := array(select id from public.reportes where contrato_id = actual.id);
	antes := public.diferencias_de_reportes(ids);
	update public.contratos set numero = nuevo.numero, descripcion = nuevo.descripcion,
		vigencia_inicio = nuevo.vigencia_inicio, vigencia_fin = nuevo.vigencia_fin
	where id = actual.id
	returning * into nuevo;
	impacto := public.propagar_cambio(ids, antes, coalesce((p ->> 'actualizarBorradores')::boolean, true));
	cambio_id := public.registrar_cambio_catalogo(p, 'contrato', actual.id, actual.id, 'editar', cambios,
		motivo, impacto);
	return jsonb_build_object('cambios', cambios, 'impacto', impacto, 'contrato', public.json_contrato(nuevo),
		'aplicado', jsonb_build_object('cambioId', cambio_id,
			'borradoresActualizados', impacto -> 'borradoresActualizados',
			'borradoresConAviso', impacto -> 'borradoresConAviso'));
end
$$;

create or replace function public.api_editar_contrato(p jsonb)
returns jsonb
language sql
as $$
	select public.con_ensayo('editar_contrato', p)
$$;

-- ---------------------------------------------------------------------------------------------
-- Sitios (D6)
-- ---------------------------------------------------------------------------------------------

create or replace function public.contratos_del_sitio(sitio uuid, excepto uuid)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'numero', k.numero) order by k.numero), '[]'::jsonb)
	from public.contrato_sitios cs join public.contratos k on k.id = cs.contrato_id
	where cs.sitio_id = sitio and cs.contrato_id is distinct from excepto
$$;

create or replace function public.exigir_sitio_del_contrato(contrato uuid, sitio uuid)
returns void
language plpgsql
as $$
begin
	if not exists (select 1 from public.contrato_sitios where contrato_id = contrato and sitio_id = sitio) then
		perform public.error_api('IC422', 'El sitio no está asociado al contrato',
			jsonb_build_object('motivo', 'sitio_ajeno'));
	end if;
end
$$;

create or replace function public.editar_sitio(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	motivo text := public.motivo_de_cambio(p, not ensayo);
	contrato uuid := (p ->> 'contratoId')::uuid;
	actual public.sitios;
	nuevo public.sitios;
	existente public.sitios;
	cambios jsonb := '[]'::jsonb;
	ids uuid[];
	antes jsonb;
	impacto jsonb;
	cambio_id uuid;
begin
	select * into actual from public.sitios where id = (p ->> 'id')::uuid for update;
	if actual.id is null then
		perform public.error_api('IC404', 'Sitio no encontrado', jsonb_build_object('id', p ->> 'id'));
	end if;
	perform public.exigir_sitio_del_contrato(contrato, actual.id);
	perform public.comprobar_version(actual.actualizado_en, p, 'sitio');
	nuevo := actual;
	nuevo.clave := btrim(coalesce(p ->> 'clave', actual.clave));
	nuevo.nombre := btrim(coalesce(p ->> 'nombre', actual.nombre));
	if nuevo.clave = '' then
		perform public.error_api('IC422', 'La clave del sitio es obligatoria',
			jsonb_build_object('motivo', 'validacion', 'campos', jsonb_build_array('clave')));
	end if;
	if nuevo.clave <> actual.clave then
		cambios := cambios || jsonb_build_object('campo', 'clave', 'antes', actual.clave, 'despues', nuevo.clave);
	end if;
	if nuevo.nombre <> actual.nombre then
		cambios := cambios || jsonb_build_object('campo', 'nombre', 'antes', actual.nombre, 'despues', nuevo.nombre);
	end if;
	if jsonb_array_length(cambios) = 0 then
		perform public.error_api('IC422', 'No hay cambios que guardar', jsonb_build_object('motivo', 'sin_cambios'));
	end if;
	select * into existente from public.sitios
	where clave_normalizada = public.normalizar_clave(nuevo.clave) and id <> actual.id;
	if existente.id is not null then
		perform public.error_api('IC422', 'Ya existe un sitio con la misma clave',
			jsonb_build_object('motivo', 'sitio_duplicado', 'existente', public.json_sitio(existente)));
	end if;

	ids := array(select id from public.reportes where sitio_id = actual.id);
	antes := public.diferencias_de_reportes(ids);
	update public.sitios set clave = nuevo.clave, nombre = nuevo.nombre where id = actual.id
	returning * into nuevo;
	impacto := public.propagar_cambio(ids, antes, coalesce((p ->> 'actualizarBorradores')::boolean, true))
		|| jsonb_build_object('otrosContratos', public.contratos_del_sitio(actual.id, contrato));
	cambio_id := public.registrar_cambio_catalogo(p, 'sitio', actual.id, contrato, 'editar', cambios,
		motivo, impacto);
	return jsonb_build_object('cambios', cambios, 'impacto', impacto, 'sitio', public.json_sitio(nuevo),
		'aplicado', jsonb_build_object('cambioId', cambio_id,
			'borradoresActualizados', impacto -> 'borradoresActualizados',
			'borradoresConAviso', impacto -> 'borradoresConAviso'));
end
$$;

create or replace function public.api_editar_sitio(p jsonb)
returns jsonb
language sql
as $$
	select public.con_ensayo('editar_sitio', p)
$$;

-- Partidas, programas y reportes de un contrato en un sitio.
create or replace function public.datos_sitio_contrato(contrato uuid, sitio uuid)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'partidas', (select count(*) from public.partidas where contrato_id = contrato and sitio_id = sitio),
		'programas', (select count(*) from public.programas where contrato_id = contrato and sitio_id = sitio),
		'reportes', (select count(*) from public.reportes where contrato_id = contrato and sitio_id = sitio)
	)
$$;

create or replace function public.quitar_sitio(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	motivo text := public.motivo_de_cambio(p, not ensayo);
	contrato uuid := (p ->> 'contratoId')::uuid;
	sitio public.sitios;
	datos jsonb;
	cambios jsonb;
	cambio_id uuid;
begin
	select * into sitio from public.sitios where id = (p ->> 'sitioId')::uuid;
	if sitio.id is null then
		perform public.error_api('IC404', 'Sitio no encontrado', jsonb_build_object('id', p ->> 'sitioId'));
	end if;
	perform 1 from public.contratos where id = contrato for update;
	perform public.exigir_sitio_del_contrato(contrato, sitio.id);
	datos := public.datos_sitio_contrato(contrato, sitio.id);
	if (datos ->> 'partidas')::integer + (datos ->> 'programas')::integer + (datos ->> 'reportes')::integer > 0 then
		perform public.error_api('IC422', 'El sitio tiene partidas, programas o reportes en el contrato',
			jsonb_build_object('motivo', 'sitio_con_datos') || datos);
	end if;
	delete from public.contrato_sitios where contrato_id = contrato and sitio_id = sitio.id;
	cambios := jsonb_build_array(jsonb_build_object('campo', 'sitio',
		'antes', btrim(sitio.clave || ' ' || sitio.nombre), 'despues', null));
	cambio_id := public.registrar_cambio_catalogo(p, 'contrato_sitio', sitio.id, contrato, 'quitar',
		cambios, motivo, '{}'::jsonb);
	return jsonb_build_object('cambios', cambios, 'impacto', jsonb_build_object('borradores', 0,
		'enRevision', 0, 'emitidos', 0, 'sustituidos', 0,
		'otrosContratos', public.contratos_del_sitio(sitio.id, contrato)),
		'aplicado', jsonb_build_object('cambioId', cambio_id, 'borradoresActualizados', '[]'::jsonb,
			'borradoresConAviso', '[]'::jsonb));
end
$$;

create or replace function public.api_quitar_sitio(p jsonb)
returns jsonb
language sql
as $$
	select public.con_ensayo('quitar_sitio', p)
$$;

create or replace function public.api_resumen_sitios_contrato(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(jsonb_build_object('sitioId', cs.sitio_id)
		|| public.datos_sitio_contrato(cs.contrato_id, cs.sitio_id)
		|| jsonb_build_object('otrosContratos', public.contratos_del_sitio(cs.sitio_id, cs.contrato_id))
		order by s.clave), '[]'::jsonb)
	from public.contrato_sitios cs join public.sitios s on s.id = cs.sitio_id
	where cs.contrato_id = (p ->> 'contratoId')::uuid
$$;

-- ---------------------------------------------------------------------------------------------
-- Firmantes (D7)
-- ---------------------------------------------------------------------------------------------

create or replace function public.firmante_para_editar(p jsonb)
returns public.firmantes
language plpgsql
as $$
declare
	actual public.firmantes;
begin
	select * into actual from public.firmantes where id = (p ->> 'id')::uuid for update;
	if actual.id is null or actual.contrato_id is distinct from (p ->> 'contratoId')::uuid then
		perform public.error_api('IC404', 'Firmante no encontrado', jsonb_build_object('id', p ->> 'id'));
	end if;
	perform public.comprobar_version(actual.actualizado_en, p, 'firmante');
	return actual;
end
$$;

create or replace function public.cambios_firmante(antes public.firmantes, despues public.firmantes)
returns jsonb
language sql
immutable
as $$
	select coalesce(jsonb_agg(c), '[]'::jsonb) from (
		select jsonb_build_object('campo', 'nombre', 'antes', antes.nombre, 'despues', despues.nombre) c
		where antes.nombre is distinct from despues.nombre
		union all
		select jsonb_build_object('campo', 'cargo', 'antes', antes.cargo, 'despues', despues.cargo)
		where antes.cargo is distinct from despues.cargo
		union all
		select jsonb_build_object('campo', 'empresa', 'antes', antes.empresa, 'despues', despues.empresa)
		where antes.empresa is distinct from despues.empresa
		union all
		select jsonb_build_object('campo', 'vigenteDesde', 'antes', antes.vigente_desde, 'despues', despues.vigente_desde)
		where antes.vigente_desde is distinct from despues.vigente_desde
		union all
		select jsonb_build_object('campo', 'vigenteHasta', 'antes', antes.vigente_hasta, 'despues', despues.vigente_hasta)
		where antes.vigente_hasta is distinct from despues.vigente_hasta
	) t
$$;

create or replace function public.corregir_firmante(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	motivo text := public.motivo_de_cambio(p, not ensayo);
	actual public.firmantes := public.firmante_para_editar(p);
	nuevo public.firmantes;
	cambios jsonb;
	ids uuid[];
	antes jsonb;
	impacto jsonb;
	cambio_id uuid;
begin
	nuevo := actual;
	nuevo.nombre := btrim(coalesce(p ->> 'nombre', actual.nombre));
	nuevo.cargo := btrim(coalesce(p ->> 'cargo', actual.cargo));
	nuevo.empresa := btrim(coalesce(p ->> 'empresa', actual.empresa));
	nuevo.vigente_desde := coalesce((p ->> 'vigenteDesde')::date, actual.vigente_desde);
	nuevo.vigente_hasta := case when p ? 'vigenteHasta' then (p ->> 'vigenteHasta')::date
		else actual.vigente_hasta end;
	if nuevo.nombre = '' then
		perform public.error_api('IC422', 'El nombre del firmante es obligatorio',
			jsonb_build_object('motivo', 'validacion', 'campos', jsonb_build_array('nombre')));
	end if;
	if nuevo.vigente_hasta is not null and nuevo.vigente_hasta < nuevo.vigente_desde then
		perform public.error_api('IC422', 'El fin de la vigencia es anterior a su inicio',
			jsonb_build_object('motivo', 'validacion', 'campos', jsonb_build_array('vigenteHasta')));
	end if;
	cambios := public.cambios_firmante(actual, nuevo);
	if jsonb_array_length(cambios) = 0 then
		perform public.error_api('IC422', 'No hay cambios que guardar', jsonb_build_object('motivo', 'sin_cambios'));
	end if;
	ids := array(select id from public.reportes where contrato_id = actual.contrato_id);
	antes := public.diferencias_de_reportes(ids);
	-- El trigger de 0001 rechaza un traslape con otro firmante de la misma función.
	update public.firmantes set nombre = nuevo.nombre, cargo = nuevo.cargo, empresa = nuevo.empresa,
		vigente_desde = nuevo.vigente_desde, vigente_hasta = nuevo.vigente_hasta
	where id = actual.id
	returning * into nuevo;
	impacto := public.propagar_cambio(ids, antes, coalesce((p ->> 'actualizarBorradores')::boolean, true));
	cambio_id := public.registrar_cambio_catalogo(p, 'firmante', actual.id, actual.contrato_id, 'editar',
		cambios, motivo, impacto || jsonb_build_object('funcion', actual.funcion));
	return jsonb_build_object('cambios', cambios, 'impacto', impacto, 'firmante', public.json_firmante(nuevo),
		'aplicado', jsonb_build_object('cambioId', cambio_id,
			'borradoresActualizados', impacto -> 'borradoresActualizados',
			'borradoresConAviso', impacto -> 'borradoresConAviso'));
end
$$;

create or replace function public.api_corregir_firmante(p jsonb)
returns jsonb
language sql
as $$
	select public.con_ensayo('corregir_firmante', p)
$$;

create or replace function public.cambiar_firmante(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	motivo text := public.motivo_de_cambio(p, not ensayo);
	actual public.firmantes := public.firmante_para_editar(p);
	desde date := (p ->> 'desde')::date;
	nuevo public.firmantes;
	desde_mes date;
	cambios jsonb;
	ids uuid[];
	antes jsonb;
	impacto jsonb;
	cambio_id uuid;
begin
	if desde is null or desde <= actual.vigente_desde
		or (actual.vigente_hasta is not null and desde > actual.vigente_hasta) then
		perform public.error_api('IC422', 'La fecha del cambio debe caer dentro de la vigencia del firmante actual',
			jsonb_build_object('motivo', 'fecha_cambio_invalida', 'primeraFecha', actual.vigente_desde + 1,
				'ultimaFecha', actual.vigente_hasta));
	end if;
	if btrim(coalesce(p ->> 'nombre', '')) = '' then
		perform public.error_api('IC422', 'El nombre del firmante es obligatorio',
			jsonb_build_object('motivo', 'validacion', 'campos', jsonb_build_array('nombre')));
	end if;
	desde_mes := case when extract(day from desde) = 1 then desde
		else (public.primer_dia_mes(desde) + interval '1 month')::date end;
	ids := array(select id from public.reportes where contrato_id = actual.contrato_id);
	antes := public.diferencias_de_reportes(ids);
	update public.firmantes set vigente_hasta = desde - 1 where id = actual.id;
	insert into public.firmantes (contrato_id, funcion, nombre, cargo, empresa, vigente_desde, vigente_hasta)
	values (actual.contrato_id, actual.funcion, btrim(p ->> 'nombre'), btrim(coalesce(p ->> 'cargo', '')),
		btrim(coalesce(p ->> 'empresa', '')), desde, actual.vigente_hasta)
	returning * into nuevo;
	cambios := public.cambios_firmante(actual, nuevo);
	impacto := public.propagar_cambio(ids, antes, coalesce((p ->> 'actualizarBorradores')::boolean, true))
		|| jsonb_build_object('desdeMes', desde_mes);
	cambio_id := public.registrar_cambio_catalogo(p, 'firmante', nuevo.id, actual.contrato_id, 'reemplazar',
		cambios, motivo, impacto || jsonb_build_object('funcion', actual.funcion, 'firmanteAnterior', actual.id));
	return jsonb_build_object('cambios', cambios, 'impacto', impacto, 'firmante', public.json_firmante(nuevo),
		'aplicado', jsonb_build_object('cambioId', cambio_id,
			'borradoresActualizados', impacto -> 'borradoresActualizados',
			'borradoresConAviso', impacto -> 'borradoresConAviso'));
end
$$;

create or replace function public.api_cambiar_firmante(p jsonb)
returns jsonb
language sql
as $$
	select public.con_ensayo('cambiar_firmante', p)
$$;

-- ---------------------------------------------------------------------------------------------
-- Altas registradas; las rutas de actualización sin bitácora se cierran (D4)
-- ---------------------------------------------------------------------------------------------

create or replace function public.rechazar_id_en_alta(p jsonb)
returns void
language plpgsql
as $$
begin
	if p ->> 'id' is not null then
		perform public.error_api('IC422', 'Para corregir un dato registrado use la edición con motivo',
			jsonb_build_object('motivo', 'usar_edicion'));
	end if;
end
$$;

create or replace function public.api_guardar_contrato(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	fila public.contratos;
begin
	perform public.rechazar_id_en_alta(p);
	insert into public.contratos (cliente_id, numero, descripcion, vigencia_inicio, vigencia_fin)
	values ((p ->> 'clienteId')::uuid, btrim(p ->> 'numero'), public.texto_o_nulo(p ->> 'descripcion'),
		(p ->> 'vigenciaInicio')::date, (p ->> 'vigenciaFin')::date)
	returning * into fila;
	perform public.registrar_cambio_catalogo(p, 'contrato', fila.id, fila.id, 'crear',
		jsonb_build_array(jsonb_build_object('campo', 'numero', 'antes', null, 'despues', fila.numero),
			jsonb_build_object('campo', 'vigenciaInicio', 'antes', null, 'despues', fila.vigencia_inicio),
			jsonb_build_object('campo', 'vigenciaFin', 'antes', null, 'despues', fila.vigencia_fin)),
		public.motivo_de_cambio(p, false), '{}'::jsonb);
	return public.json_contrato(fila);
exception
	when unique_violation then
		perform public.error_api('IC422', 'Ya existe un contrato con ese número para el cliente',
			jsonb_build_object('motivo', 'contrato_duplicado', 'numero', p ->> 'numero'));
end
$$;

create or replace function public.api_guardar_sitio(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	existente public.sitios;
	fila public.sitios;
begin
	perform public.rechazar_id_en_alta(p);
	select * into existente from public.sitios
	where clave_normalizada = public.normalizar_clave(p ->> 'clave');
	if existente.id is not null then
		perform public.error_api('IC422', 'Ya existe un sitio con la misma clave',
			jsonb_build_object('motivo', 'sitio_duplicado', 'existente', public.json_sitio(existente)));
	end if;
	insert into public.sitios (clave, nombre)
	values (btrim(p ->> 'clave'), coalesce(btrim(p ->> 'nombre'), ''))
	returning * into fila;
	perform public.registrar_cambio_catalogo(p, 'sitio', fila.id, (p ->> 'contratoId')::uuid, 'crear',
		jsonb_build_array(jsonb_build_object('campo', 'clave', 'antes', null, 'despues', fila.clave),
			jsonb_build_object('campo', 'nombre', 'antes', null, 'despues', fila.nombre)),
		public.motivo_de_cambio(p, false), '{}'::jsonb);
	return public.json_sitio(fila);
end
$$;

create or replace function public.api_asociar_sitio(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	sitio public.sitios;
begin
	insert into public.contrato_sitios (contrato_id, sitio_id)
	values ((p ->> 'contratoId')::uuid, (p ->> 'sitioId')::uuid)
	on conflict do nothing;
	if found then
		select * into sitio from public.sitios where id = (p ->> 'sitioId')::uuid;
		perform public.registrar_cambio_catalogo(p, 'contrato_sitio', sitio.id, (p ->> 'contratoId')::uuid,
			'asociar', jsonb_build_array(jsonb_build_object('campo', 'sitio', 'antes', null,
				'despues', btrim(sitio.clave || ' ' || sitio.nombre))),
			public.motivo_de_cambio(p, false), '{}'::jsonb);
	end if;
	return jsonb_build_object('contratoId', p ->> 'contratoId', 'sitioId', p ->> 'sitioId');
end
$$;

create or replace function public.api_guardar_firmante(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	fila public.firmantes;
begin
	perform public.rechazar_id_en_alta(p);
	insert into public.firmantes (contrato_id, funcion, nombre, cargo, empresa, vigente_desde, vigente_hasta)
	values ((p ->> 'contratoId')::uuid, p ->> 'funcion', btrim(p ->> 'nombre'),
		coalesce(btrim(p ->> 'cargo'), ''), coalesce(btrim(p ->> 'empresa'), ''),
		(p ->> 'vigenteDesde')::date, (p ->> 'vigenteHasta')::date)
	returning * into fila;
	perform public.registrar_cambio_catalogo(p, 'firmante', fila.id, fila.contrato_id, 'crear',
		public.cambios_firmante((null::public.firmantes), fila),
		public.motivo_de_cambio(p, false), jsonb_build_object('funcion', fila.funcion));
	return public.json_firmante(fila);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Consultas: historial del contrato y estado del contrato en un reporte (D11, D13)
-- ---------------------------------------------------------------------------------------------

create or replace function public.api_listar_cambios_catalogo(p jsonb)
returns jsonb
language sql
stable
as $$
	with parametros as (
		select (p ->> 'contratoId')::uuid as contrato,
			greatest(coalesce((p ->> 'pagina')::integer, 1), 1) as pagina,
			least(greatest(coalesce((p ->> 'tamano')::integer, 20), 1), 100) as tamano
	),
	filas as (
		select c.* from public.cambios_catalogo c, parametros q
		where c.contrato_id = q.contrato
			or (c.entidad = 'sitio' and c.entidad_id in
				(select sitio_id from public.contrato_sitios where contrato_id = q.contrato))
	)
	select jsonb_build_object(
		'total', (select count(*) from filas),
		'pagina', q.pagina,
		'tamano', q.tamano,
		'filas', coalesce((
			select jsonb_agg(jsonb_build_object('id', f.id, 'entidad', f.entidad, 'entidadId', f.entidad_id,
				'contratoId', f.contrato_id, 'accion', f.accion, 'cambios', f.cambios, 'motivo', f.motivo,
				'efectos', f.efectos, 'usuarioId', f.usuario_id, 'usuarioTexto', f.usuario_texto,
				'origen', f.origen, 'realizadoEn', f.realizado_en) order by f.realizado_en desc, f.id)
			from (select * from filas order by realizado_en desc, id
				limit q.tamano offset (q.pagina - 1) * q.tamano) f
		), '[]'::jsonb)
	)
	from parametros q
$$;

-- Datos del contrato que cambiaron desde la copia del reporte (borradores y en revisión).
create or replace function public.api_estado_contrato_reporte(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
	r public.reportes;
	datos jsonb;
begin
	select * into r from public.reportes where id = (p ->> 'id')::uuid;
	if r.id is null then
		perform public.error_api('IC404', 'Reporte no encontrado', jsonb_build_object('id', p ->> 'id'));
	end if;
	if r.estado not in ('borrador', 'en_revision') then
		return jsonb_build_object('cambiado', false, 'datos', '[]'::jsonb);
	end if;
	datos := public.diferencias_contrato_reporte(r);
	return jsonb_build_object('cambiado', jsonb_array_length(datos) > 0, 'datos', datos);
end
$$;

-- Lleva al borrador todos los datos vigentes del contrato, también los escritos a mano.
create or replace function public.api_actualizar_contrato_reporte(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	actual public.reportes := public.reporte_para_editar((p ->> 'id')::uuid, (p ->> 'version')::integer);
begin
	if actual.estado <> 'borrador' then
		perform public.error_api('IC409', 'Solo un borrador toma los datos del contrato',
			jsonb_build_object('motivo', 'estado', 'estado', actual.estado));
	end if;
	perform public.reconciliar_contrato_reporte(actual.id, true);
	return public.json_reporte(actual.id);
end
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0018_bitacora_catalogo.sql') on conflict do nothing;

-- =============================================================================================
-- 0019_cumplimiento.sql
-- =============================================================================================
-- Cumplimiento del programa anual (cambio tablero-cumplimiento): ajustes del programa (reprogramado y
-- no ejecutado) sobre el plan original, reportes ligados a una reprogramación, conteo de ejecuciones
-- con ese vínculo y lecturas ampliadas para la matriz, la vista mensual, la semanal y el tablero.
--
-- Punto de partida (tarea 1.2), según la última definición en 0001…0018:
--   v_ejecuciones_reportes: 0016_dias_ejecucion.sql (días distintos en las diarias).
--   json_reporte: la envoltura de 0016 (base json_reporte_0007); 0017 y 0018 no la tocan.
--   api_crear_reporte: 0007_captura.sql (llama a api_insertar_reporte por nombre: pasa por la
--     envoltura de 0016).
--   api_obtener_programa: 0012_avance_desglose.sql.
-- Reglas de envoltura (D3 de fechas-ejecucion-multiples): la definición vigente se renombra a
-- <función>_<NNNN> (la migración que la definió o envolvió por última vez) con un bloque idempotente
-- que consulta pg_proc; la envoltura conserva el nombre y la firma públicos, llama a la base y aplica
-- lo suyo en la misma transacción sin volver a subir la versión. Un nombre con dígitos no pasa
-- validarFuncion: la aplicación solo llama la envoltura.

-- ---------------------------------------------------------------------------------------------
-- Ajustes del programa (D2)
-- ---------------------------------------------------------------------------------------------

create table if not exists public.programa_ajustes (
	id uuid primary key default gen_random_uuid(),
	programa_id uuid not null references public.programas (id) on delete cascade,
	partida_id uuid not null references public.partidas (id) on delete cascade,
	tipo text not null check (tipo in ('reprogramado', 'no_ejecutado')),
	mes_origen date not null check (extract(day from mes_origen) = 1),
	mes_destino date check (mes_destino is null or extract(day from mes_destino) = 1),
	cantidad integer not null check (cantidad > 0),
	motivo text not null check (motivo in ('cliente_operacion', 'clima', 'materiales_refacciones',
		'acceso_permisos', 'personal', 'otro')),
	nota text check (nota is null or char_length(nota) <= 500),
	registrado_en timestamptz not null default now(),
	anulado_en timestamptz,
	constraint programa_ajustes_destino check (
		(tipo = 'reprogramado' and mes_destino is not null and mes_destino > mes_origen)
		or (tipo = 'no_ejecutado' and mes_destino is null)
	),
	constraint programa_ajustes_nota_otro check (motivo <> 'otro' or btrim(coalesce(nota, '')) <> '')
);
create index if not exists programa_ajustes_origen_idx
	on public.programa_ajustes (programa_id, partida_id, mes_origen) where anulado_en is null;
create index if not exists programa_ajustes_destino_idx
	on public.programa_ajustes (programa_id, partida_id, mes_destino) where anulado_en is null;

alter table public.programa_ajustes enable row level security;
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		if not exists (select 1 from pg_policies where tablename = 'programa_ajustes'
			and policyname = 'servicio_acceso_total') then
			create policy servicio_acceso_total on public.programa_ajustes for all to service_role
				using (true) with check (true);
		end if;
		revoke all on public.programa_ajustes from anon, authenticated;
	end if;
end
$$;

-- La partida es del contrato y sitio del programa y los meses caen en su periodo.
create or replace function public.validar_ajuste()
returns trigger
language plpgsql
as $$
declare
	programa public.programas;
	partida public.partidas;
begin
	select * into programa from public.programas where id = new.programa_id;
	select * into partida from public.partidas where id = new.partida_id;
	if partida.contrato_id is distinct from programa.contrato_id
		or partida.sitio_id is distinct from programa.sitio_id then
		perform public.error_api('IC422', 'La partida no pertenece al contrato y sitio del programa',
			jsonb_build_object('motivo', 'partida_ajena'));
	end if;
	if not exists (select 1 from public.meses_del_periodo(programa.periodo_inicio, programa.periodo_fin) m
		where m = new.mes_origen)
		or (new.mes_destino is not null and not exists (
			select 1 from public.meses_del_periodo(programa.periodo_inicio, programa.periodo_fin) m
			where m = new.mes_destino)) then
		perform public.error_api('IC422', 'El mes está fuera del periodo del programa',
			jsonb_build_object('motivo', 'mes_fuera_del_periodo'));
	end if;
	return new;
end
$$;

drop trigger if exists programa_ajustes_validar on public.programa_ajustes;
create trigger programa_ajustes_validar before insert or update on public.programa_ajustes
	for each row execute function public.validar_ajuste();

-- ---------------------------------------------------------------------------------------------
-- Reportes ligados a una reprogramación (D3)
-- ---------------------------------------------------------------------------------------------

alter table public.reportes
	add column if not exists reprogramacion_id uuid references public.programa_ajustes (id) on delete restrict;
create index if not exists reportes_reprogramacion_idx
	on public.reportes (reprogramacion_id) where reprogramacion_id is not null;

-- Ejecuciones emitidas de una reprogramación con la unidad de v_ejecuciones_reportes: días distintos en
-- las diarias y ocurrencias distintas en las demás (varios TAG de la misma ocurrencia cuentan una).
create or replace function public.ejecuciones_de_ajuste(a public.programa_ajustes)
returns integer
language sql
stable
as $$
	select case when t.periodicidad = 'diaria' then (
		select count(distinct d.dia)
		from public.reportes e
		cross join lateral jsonb_array_elements(e.dias_ejecucion) s(segmento)
		cross join lateral generate_series((s.segmento ->> 'desde')::date, (s.segmento ->> 'hasta')::date,
			interval '1 day') d(dia)
		where e.reprogramacion_id = a.id and e.estado = 'emitido'
	) else (
		select count(distinct coalesce(e.ocurrencia_tipo || ':' || e.ocurrencia_numero, ''))
		from public.reportes e
		where e.reprogramacion_id = a.id and e.estado = 'emitido'
	) end::integer
	from public.partidas t
	where t.id = a.partida_id
$$;

-- Ajuste con sus reportes ligados: ejecuciones emitidas, borradores y los que impiden anularlo.
create or replace function public.json_ajuste(a public.programa_ajustes)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', a.id, 'programaId', a.programa_id, 'partidaId', a.partida_id, 'tipo', a.tipo,
		'mesOrigen', a.mes_origen, 'mesDestino', a.mes_destino, 'cantidad', a.cantidad,
		'motivo', a.motivo, 'nota', a.nota, 'registradoEn', a.registrado_en, 'anuladoEn', a.anulado_en,
		'ejecuciones', public.ejecuciones_de_ajuste(a),
		'borradores', (select count(*) from public.reportes r
			where r.reprogramacion_id = a.id and r.estado = 'borrador'),
		'bloqueantes', (select count(*) from public.reportes r
			where r.reprogramacion_id = a.id and r.estado in ('en_revision', 'emitido'))
	)
$$;

-- Una revisión conserva el vínculo del reporte que sustituye (como copiar_huella_revision de 0007).
create or replace function public.copiar_reprogramacion_revision()
returns trigger
language plpgsql
as $$
begin
	if new.sustituye_a is not null and new.reprogramacion_id is null then
		select reprogramacion_id into new.reprogramacion_id from public.reportes where id = new.sustituye_a;
	end if;
	return new;
end
$$;

drop trigger if exists reportes_reprogramacion_copiar on public.reportes;
create trigger reportes_reprogramacion_copiar before insert on public.reportes
	for each row execute function public.copiar_reprogramacion_revision();

-- El vínculo exige una reprogramación vigente de la misma partida con destino en el mes del reporte.
create or replace function public.validar_reprogramacion_reporte()
returns trigger
language plpgsql
as $$
begin
	if new.reprogramacion_id is not null and not exists (
		select 1 from public.programa_ajustes a
		where a.id = new.reprogramacion_id and a.tipo = 'reprogramado' and a.anulado_en is null
			and a.partida_id = new.partida_id and a.mes_destino = new.periodo_mes
	) then
		perform public.error_api('IC422',
			'La reprogramación no corresponde a la partida y el mes del reporte o ya se anuló',
			jsonb_build_object('motivo', 'reprogramacion_invalida'));
	end if;
	return new;
end
$$;

-- El nombre ordena este disparador después de la copia (los BEFORE se ejecutan por nombre).
drop trigger if exists reportes_reprogramacion_validar on public.reportes;
create trigger reportes_reprogramacion_validar
	before insert or update of reprogramacion_id, partida_id, periodo_mes on public.reportes
	for each row execute function public.validar_reprogramacion_reporte();

do $$
begin
	if not exists (select 1 from pg_proc where proname = 'json_reporte_0016'
		and pronamespace = 'public'::regnamespace) then
		alter function public.json_reporte(uuid) rename to json_reporte_0016;
	end if;
	if not exists (select 1 from pg_proc where proname = 'api_crear_reporte_0007'
		and pronamespace = 'public'::regnamespace) then
		alter function public.api_crear_reporte(jsonb) rename to api_crear_reporte_0007;
	end if;
end
$$;

create or replace function public.json_reporte(id_reporte uuid)
returns jsonb
language sql
stable
as $$
	select public.json_reporte_0016(r.id) || jsonb_build_object('reprogramacionId', r.reprogramacion_id,
		'reprogramadoDesde', (select a.mes_origen from public.programa_ajustes a where a.id = r.reprogramacion_id))
	from public.reportes r
	where r.id = id_reporte
$$;

-- Alta prellenada con el vínculo opcional a una reprogramación; no sube la versión.
create or replace function public.api_crear_reporte(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_reporte uuid := (public.api_crear_reporte_0007(p - 'reprogramacionId') ->> 'id')::uuid;
begin
	if nullif(p ->> 'reprogramacionId', '') is not null then
		update public.reportes set reprogramacion_id = (p ->> 'reprogramacionId')::uuid
		where id = id_reporte;
	end if;
	return public.json_reporte(id_reporte);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Conteo de ejecuciones con discriminador (D4)
-- ---------------------------------------------------------------------------------------------

-- Igual que 0016, pero cada reprogramación cuenta aparte: un reporte ligado a una reprogramación
-- suma aunque el mes ya tenga su propia ocurrencia. Varios TAG de la misma unidad cuentan uno.
create or replace view public.v_ejecuciones_reportes with (security_invoker = true) as
select r.partida_id, r.periodo_mes as mes,
	case when bool_or(t.periodicidad = 'diaria') then (
		select count(distinct (d.dia::text || '|' || coalesce(e.reprogramacion_id::text, '')))
		from public.reportes e
		cross join lateral jsonb_array_elements(e.dias_ejecucion) s(segmento)
		cross join lateral generate_series((s.segmento ->> 'desde')::date, (s.segmento ->> 'hasta')::date,
			interval '1 day') d(dia)
		where e.partida_id = r.partida_id and e.periodo_mes = r.periodo_mes and e.estado = 'emitido'
	) else count(distinct (coalesce(r.ocurrencia_tipo || ':' || r.ocurrencia_numero, '') || '|'
		|| coalesce(r.reprogramacion_id::text, ''))) end as ejecuciones,
	jsonb_agg(r.id order by r.emitido_en) as reportes
from public.reportes r
join public.partidas t on t.id = r.partida_id
where r.estado = 'emitido'
group by r.partida_id, r.periodo_mes;

-- ---------------------------------------------------------------------------------------------
-- Registro y anulación de ajustes (D2)
-- ---------------------------------------------------------------------------------------------

-- Lo que falta en una celda: programado + entradas − salidas − no ejecutados − realizado.
create or replace function public.falta_en_celda(programa uuid, partida uuid, mes date)
returns integer
language sql
stable
as $$
	select (coalesce((select cantidad from public.programa_meses
			where programa_id = programa and partida_id = partida and programa_meses.mes = falta_en_celda.mes), 0)
		+ coalesce((select sum(a.cantidad) from public.programa_ajustes a where a.programa_id = programa
			and a.partida_id = partida and a.tipo = 'reprogramado' and a.mes_destino = falta_en_celda.mes
			and a.anulado_en is null), 0)
		- coalesce((select sum(a.cantidad) from public.programa_ajustes a where a.programa_id = programa
			and a.partida_id = partida and a.mes_origen = falta_en_celda.mes and a.anulado_en is null), 0)
		- coalesce((select v.realizado from public.v_realizado v where v.programa_id = programa
			and v.partida_id = partida and v.mes = falta_en_celda.mes), 0))::integer
$$;

create or replace function public.api_registrar_ajuste(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	programa_id_p uuid := (p ->> 'programaId')::uuid;
	partida_id_p uuid := (p ->> 'partidaId')::uuid;
	origen date := (p ->> 'mesOrigen')::date;
	cantidad_p integer := (p ->> 'cantidad')::integer;
	falta integer;
	fila public.programa_ajustes;
begin
	perform 1 from public.programas where id = programa_id_p for update;
	if not found then
		perform public.error_api('IC404', 'Programa no encontrado', jsonb_build_object('id', programa_id_p));
	end if;
	-- Primero se inserta: el disparador valida partida y meses. Si el nuevo ajuste deja lo que falta en
	-- negativo, se rechaza y la transacción lo revierte.
	insert into public.programa_ajustes (programa_id, partida_id, tipo, mes_origen, mes_destino,
		cantidad, motivo, nota)
	values (programa_id_p, partida_id_p, p ->> 'tipo', origen, (p ->> 'mesDestino')::date, cantidad_p,
		p ->> 'motivo', nullif(btrim(coalesce(p ->> 'nota', '')), ''))
	returning * into fila;
	falta := public.falta_en_celda(programa_id_p, partida_id_p, origen) + cantidad_p;
	if cantidad_p > falta then
		perform public.error_api('IC422',
			format('La cantidad supera lo que falta en el mes (%s)', greatest(falta, 0)),
			jsonb_build_object('motivo', 'cantidad_mayor_que_falta', 'falta', greatest(falta, 0)));
	end if;
	return public.json_ajuste(fila);
exception
	when check_violation then
		perform public.error_api('IC422', case
			when sqlerrm like '%programa_ajustes_destino%' then
				'El mes destino debe ser posterior al de origen'
			when sqlerrm like '%programa_ajustes_nota_otro%' then 'Con el motivo «Otro» la nota es obligatoria'
			when sqlerrm like '%cantidad%' then 'La cantidad debe ser un entero mayor que cero'
			else 'Revise los datos del ajuste' end,
			jsonb_build_object('motivo', 'ajuste_invalido'));
end
$$;

create or replace function public.api_anular_ajuste(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	fila public.programa_ajustes;
	bloqueantes integer;
begin
	select * into fila from public.programa_ajustes where id = (p ->> 'id')::uuid for update;
	if fila.id is null then
		perform public.error_api('IC404', 'Ajuste no encontrado', jsonb_build_object('id', p ->> 'id'));
	end if;
	if fila.anulado_en is not null then
		perform public.error_api('IC409', 'El ajuste ya estaba anulado', jsonb_build_object('motivo', 'ya_anulado'));
	end if;
	select count(*) into bloqueantes from public.reportes
	where reprogramacion_id = fila.id and estado in ('en_revision', 'emitido', 'sustituido');
	if bloqueantes > 0 then
		perform public.error_api('IC409',
			'La reprogramación tiene reportes en revisión o emitidos y no se puede anular',
			jsonb_build_object('motivo', 'con_reportes', 'reportes', bloqueantes));
	end if;
	-- Los borradores ligados se desligan sin cambiar su versión (el guardado no envía el vínculo).
	update public.reportes set reprogramacion_id = null
	where reprogramacion_id = fila.id and estado = 'borrador';
	update public.programa_ajustes set anulado_en = now() where id = fila.id returning * into fila;
	return public.json_ajuste(fila);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Lecturas (D5)
-- ---------------------------------------------------------------------------------------------

-- Cuerpo de 0012 más, por celda, los ajustes vigentes y los reportes abiertos.
create or replace function public.api_obtener_programa(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
	programa public.programas;
begin
	select * into programa from public.programas where id = (p ->> 'id')::uuid;
	if programa.id is null then
		perform public.error_api('IC404', 'Programa no encontrado', jsonb_build_object('id', p ->> 'id'));
	end if;
	return jsonb_build_object(
		'programa', public.json_programa(programa),
		'partidas', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', t.id, 'numero', t.numero, 'actividad', t.actividad, 'periodicidad', t.periodicidad,
				'distribucion', t.distribucion, 'cantidadAnual', t.cantidad_anual,
				'celdas', celdas.valor, 'totalProgramado', celdas.programado, 'totalRealizado', celdas.realizado,
				'diferencia', case when t.cantidad_anual is null then null else t.cantidad_anual - celdas.programado end
			) order by
				case when t.numero_normalizado ~ '^[0-9]+$' then t.numero_normalizado::integer end,
				t.numero_normalizado)
			from public.partidas t,
			lateral (
				select jsonb_agg(jsonb_build_object(
						'mes', m.mes, 'programado', pm.cantidad,
						'realizado', coalesce(v.realizado, 0), 'reportes', coalesce(v.reportes, '[]'::jsonb),
						'ejecucionesReportes', coalesce(v.ejecuciones_reportes, 0),
						'realizadoSinReporte', coalesce(v.cantidad_manual, 0),
						'salida', coalesce(aj.salida, 0), 'entrada', coalesce(aj.entrada, 0),
						'noEjecutado', coalesce(aj.no_ejecutado, 0),
						'ajustes', coalesce(aj.lista, '[]'::jsonb),
						'reportesAbiertos', coalesce((
							select jsonb_agg(jsonb_build_object('id', r.id, 'estado', r.estado)
								order by r.actualizado_en desc)
							from public.reportes r
							where r.partida_id = t.id and r.periodo_mes = m.mes
								and r.estado in ('borrador', 'en_revision')
						), '[]'::jsonb)
					) order by m.mes) as valor,
					coalesce(sum(pm.cantidad), 0) as programado,
					coalesce(sum(v.realizado), 0) as realizado
				from public.meses_del_periodo(programa.periodo_inicio, programa.periodo_fin) as m(mes)
				left join public.programa_meses pm
					on pm.programa_id = programa.id and pm.partida_id = t.id and pm.mes = m.mes
				left join public.v_realizado v
					on v.programa_id = programa.id and v.partida_id = t.id and v.mes = m.mes
				left join lateral (
					select
						sum(a.cantidad) filter (where a.tipo = 'reprogramado' and a.mes_origen = m.mes) as salida,
						sum(a.cantidad) filter (where a.tipo = 'reprogramado' and a.mes_destino = m.mes) as entrada,
						sum(a.cantidad) filter (where a.tipo = 'no_ejecutado' and a.mes_origen = m.mes) as no_ejecutado,
						jsonb_agg(public.json_ajuste(a) order by a.registrado_en) as lista
					from public.programa_ajustes a
					where a.programa_id = programa.id and a.partida_id = t.id and a.anulado_en is null
						and (a.mes_origen = m.mes or a.mes_destino = m.mes)
				) aj on true
			) celdas
			where t.contrato_id = programa.contrato_id and t.sitio_id = programa.sitio_id
		), '[]'::jsonb)
	);
end
$$;

-- Programas cuyo periodo contiene el mes de corte, con su contrato, sitio y avance.
create or replace function public.api_obtener_cumplimiento(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(jsonb_build_object(
			'contrato', public.json_contrato(k),
			'sitio', public.json_sitio(s),
			'avance', public.api_obtener_programa(jsonb_build_object('id', g.id))
		) order by k.numero, s.clave), '[]'::jsonb)
	from public.programas g
	join public.contratos k on k.id = g.contrato_id
	join public.clientes c on c.id = k.cliente_id
	join public.sitios s on s.id = g.sitio_id
	where (p ->> 'corte')::date between public.primer_dia_mes(g.periodo_inicio) and g.periodo_fin
		and (p ->> 'clienteClave' is null or c.clave = p ->> 'clienteClave')
		and (p ->> 'contratoId' is null or k.id = (p ->> 'contratoId')::uuid)
		and (p ->> 'sitioId' is null or s.id = (p ->> 'sitioId')::uuid)
$$;

-- Reportes no sustituidos de las partidas del programa en un mes, para la vista semanal (D14).
create or replace function public.api_listar_ejecuciones_mes(p jsonb)
returns jsonb
language sql
stable
as $$
	select coalesce(jsonb_agg(jsonb_build_object(
			'id', r.id, 'partidaId', r.partida_id, 'estado', r.estado,
			'ocurrencia', case when r.ocurrencia_tipo is null then null
				else jsonb_build_object('tipo', r.ocurrencia_tipo, 'numero', r.ocurrencia_numero) end,
			'reprogramacionId', r.reprogramacion_id, 'diasEjecucion', r.dias_ejecucion
		) order by r.periodo_mes, r.creado_en), '[]'::jsonb)
	from public.reportes r
	join public.programas g on g.id = (p ->> 'programaId')::uuid
	join public.partidas t on t.id = r.partida_id
	where t.contrato_id = g.contrato_id and t.sitio_id = g.sitio_id
		and r.periodo_mes = public.primer_dia_mes((p ->> 'mes')::date)
		and r.estado <> 'sustituido'
$$;

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;

insert into interno.migraciones (nombre) values ('0019_cumplimiento.sql') on conflict do nothing;

-- =============================================================================================
-- 0020_alcances_personal_sharepoint.sql
-- =============================================================================================
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

insert into interno.migraciones (nombre) values ('0020_alcances_personal_sharepoint.sql') on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- Seguridad final: RLS en todas las tablas públicas, solo el rol de servicio accede y las claves
-- públicas (anon, authenticated) no leen tablas ni ejecutan funciones. Idempotente.
-- ---------------------------------------------------------------------------------------------
do $$
declare
	tabla text;
	hay_roles_supabase boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
	for tabla in select tablename from pg_tables where schemaname = 'public' loop
		execute format('alter table public.%I enable row level security', tabla);
		if hay_roles_supabase and not exists (select 1 from pg_policies
			where schemaname = 'public' and tablename = tabla and policyname = 'servicio_acceso_total') then
			execute format(
				'create policy servicio_acceso_total on public.%I for all to service_role using (true) with check (true)',
				tabla
			);
		end if;
	end loop;
	if hay_roles_supabase then
		revoke all on all tables in schema public from anon, authenticated;
		revoke all on all sequences in schema public from anon, authenticated;
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
		alter default privileges in schema public revoke all on tables from anon, authenticated;
		alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
		revoke all on schema interno from anon, authenticated;
	end if;
end
$$;

commit;
