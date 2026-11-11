-- Contrato, órdenes de compra, carta de finalización, enlace del programa anual y cobranza mensual
-- por centro de costo (etapa 4 del seguimiento). Los valores del contrato y de cada orden siguen los
-- conceptos de la plantilla; la carta, el programa y la cobranza son iguales para todos los centros.
create table public.seguimiento_centros (
	sitio_id uuid primary key references public.sitios (id) on delete restrict,
	programa_enlace text,
	carta_fecha date,
	carta_enlace text,
	check (carta_enlace is null or carta_fecha is not null)
);

create table public.contrato_valores (
	sitio_id uuid not null references public.sitios (id) on delete restrict,
	concepto_id uuid not null references public.plantilla_conceptos (id) on delete restrict,
	valor jsonb not null,
	primary key (sitio_id, concepto_id)
);
create index contrato_valores_concepto_idx on public.contrato_valores (concepto_id);

create table public.ordenes_compra (
	id uuid primary key,
	sitio_id uuid not null references public.sitios (id) on delete restrict,
	creado_en timestamptz not null default now()
);
create index ordenes_compra_sitio_idx on public.ordenes_compra (sitio_id);

create table public.orden_compra_valores (
	orden_id uuid not null references public.ordenes_compra (id) on delete cascade,
	concepto_id uuid not null references public.plantilla_conceptos (id) on delete restrict,
	valor jsonb not null,
	primary key (orden_id, concepto_id)
);
create index orden_compra_valores_concepto_idx on public.orden_compra_valores (concepto_id);

create table public.cobranza_meses (
	sitio_id uuid not null references public.sitios (id) on delete restrict,
	mes date not null check (extract(day from mes) = 1),
	estimacion boolean not null default false,
	prefactura boolean not null default false,
	factura boolean not null default false,
	cobrado boolean not null default false,
	monto_cobrado numeric(14, 2) check (monto_cobrado >= 0),
	primary key (sitio_id, mes)
);

-- Un concepto con valores del contrato o de una orden tampoco se reinterpreta.
create or replace function public.validar_concepto_con_seguimiento()
returns trigger language plpgsql as $$
begin
	if (new.plantilla_id, new.bloque, new.tipo, new.nivel)
		is distinct from (old.plantilla_id, old.bloque, old.tipo, old.nivel)
		and (exists (select 1 from public.seguimiento_valores where concepto_id = old.id)
			or exists (select 1 from public.seguimiento_carpetas where concepto_id = old.id)
			or exists (select 1 from public.contrato_valores where concepto_id = old.id)
			or exists (select 1 from public.orden_compra_valores where concepto_id = old.id)) then
		perform public.error_api('IC409', 'El concepto tiene datos de seguimiento. Conserve su tipo, bloque y nivel.');
	end if;
	return new;
end
$$;

create function public.enlace_sharepoint_valido(enlace text)
returns boolean language sql immutable as $$
	select length(enlace) <= 2048
		and enlace ~ '^https://[A-Za-z0-9-]+\.sharepoint\.(com|us|de|cn)([/?#]|$)'
$$;

-- Valida una lista [{conceptoId, valor}] contra los conceptos de un bloque de la plantilla y
-- devuelve los que traen dato; un valor vacío equivale a no tenerlo.
create function public.valores_concepto_validados(plantilla uuid, bloque_destino text, valores jsonb)
returns table (concepto_id uuid, valor jsonb) language plpgsql stable as $$
declare
	fila jsonb;
	concepto public.plantilla_conceptos;
	dato jsonb;
	texto text;
begin
	for fila in select * from jsonb_array_elements(coalesce(valores, '[]'::jsonb)) loop
		select c.* into concepto from public.plantilla_conceptos c
		where c.id = (fila ->> 'conceptoId')::uuid and c.plantilla_id = plantilla
			and c.bloque = bloque_destino;
		if not found then perform public.error_api('IC404', 'Concepto no encontrado'); end if;
		dato := nullif(fila -> 'valor', 'null'::jsonb);
		texto := dato #>> '{}';
		if dato is null or dato = 'false'::jsonb or texto = ''
			or (concepto.tipo = 'estado' and texto = 'pendiente') then
			continue;
		end if;
		if not (case concepto.tipo
			when 'casilla' then jsonb_typeof(dato) = 'boolean'
			when 'estado' then texto in ('en_proceso', 'hecho')
			when 'cantidad' then case when jsonb_typeof(dato) = 'number' then texto::numeric >= 0 else false end
			when 'monto' then case when jsonb_typeof(dato) = 'number'
				then texto::numeric between 0 and 999999999999.99 and texto::numeric = round(texto::numeric, 2)
				else false end
			when 'fecha' then case when jsonb_typeof(dato) = 'string' and texto ~ '^\d{4}-\d{2}-\d{2}$'
				then texto::date is not null else false end
			when 'enlace' then jsonb_typeof(dato) = 'string' and public.enlace_sharepoint_valido(texto)
			when 'texto' then jsonb_typeof(dato) = 'string' and length(texto) <= 500
			else false end) then
			perform public.error_api('IC422', format('El valor de «%s» no es válido.', concepto.etiqueta));
		end if;
		concepto_id := concepto.id;
		valor := dato;
		return next;
	end loop;
end
$$;

-- Lo que devuelve depende de lo que el servidor declara visible para quien consulta: sin
-- `verContrato` no salen contrato, órdenes, carta ni cobranza; sin `verPrograma`, tampoco el enlace.
create function public.api_obtener_contrato_cobranza(p jsonb)
returns jsonb language plpgsql stable as $$
declare
	centro public.sitios;
	datos public.seguimiento_centros;
	anio integer := (p ->> 'anio')::integer;
	fin date;
	resultado jsonb;
begin
	select * into centro from public.sitios where id = (p ->> 'sitioId')::uuid;
	if not found then perform public.error_api('IC404', 'No encontrado'); end if;
	select * into datos from public.seguimiento_centros where sitio_id = centro.id;
	resultado := jsonb_build_object('plantillaId', centro.plantilla_id);
	if coalesce((p ->> 'verPrograma')::boolean, false) then
		resultado := resultado || jsonb_build_object('programaEnlace', datos.programa_enlace);
	end if;
	if not coalesce((p ->> 'verContrato')::boolean, false) then return resultado; end if;

	select max(c.vigencia_fin) into fin from public.contratos c
	join public.contrato_sitios cs on cs.contrato_id = c.id where cs.sitio_id = centro.id;
	return resultado || jsonb_build_object('contrato', jsonb_build_object(
		'modoContrato', (select t.modo_contrato from public.plantillas_seguimiento t
			where t.id = centro.plantilla_id),
		'conceptos', coalesce((select jsonb_agg(jsonb_build_object(
			'id', c.id, 'bloque', c.bloque, 'tipo', c.tipo, 'etiqueta', c.etiqueta)
			order by public.orden_bloque(c.bloque), c.orden)
			from public.plantilla_conceptos c where c.plantilla_id = centro.plantilla_id
				and c.bloque in ('contrato', 'ordenes_compra')), '[]'::jsonb),
		'valores', coalesce((select jsonb_agg(jsonb_build_object(
			'conceptoId', v.concepto_id, 'valor', v.valor))
			from public.contrato_valores v where v.sitio_id = centro.id), '[]'::jsonb),
		'ordenes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id,
			'valores', coalesce((select jsonb_agg(jsonb_build_object(
				'conceptoId', v.concepto_id, 'valor', v.valor))
				from public.orden_compra_valores v where v.orden_id = o.id), '[]'::jsonb))
			order by o.creado_en, o.id)
			from public.ordenes_compra o where o.sitio_id = centro.id), '[]'::jsonb),
		'contratos', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'numero', c.numero,
			'vigenciaInicio', c.vigencia_inicio, 'vigenciaFin', c.vigencia_fin)
			order by c.vigencia_inicio, c.numero)
			from public.contratos c join public.contrato_sitios cs on cs.contrato_id = c.id
			where cs.sitio_id = centro.id), '[]'::jsonb),
		'carta', jsonb_build_object('fecha', datos.carta_fecha, 'enlace', datos.carta_enlace),
		'cartaFaltante', coalesce(fin < (p ->> 'hoy')::date, false) and datos.carta_fecha is null,
		'cobranza', coalesce((select jsonb_agg(jsonb_build_object('mes', m.mes,
			'estimacion', m.estimacion, 'prefactura', m.prefactura, 'factura', m.factura,
			'cobrado', m.cobrado, 'montoCobrado', m.monto_cobrado) order by m.mes)
			from public.cobranza_meses m where m.sitio_id = centro.id
				and extract(year from m.mes) = anio), '[]'::jsonb)
	));
end
$$;

create function public.api_guardar_contrato_cobranza(p jsonb)
returns jsonb language plpgsql as $$
declare
	centro public.sitios;
	accion text := p ->> 'accion';
	orden uuid := (p ->> 'id')::uuid;
	enlace text := public.texto_o_nulo(p ->> 'enlace');
	fecha date := (p ->> 'fecha')::date;
begin
	-- Las capturas de un centro se escriben en orden, igual que el seguimiento operativo.
	select * into centro from public.sitios where id = (p ->> 'sitioId')::uuid for update;
	if not found then perform public.error_api('IC404', 'No encontrado'); end if;
	perform 1 from public.plantilla_conceptos c where c.plantilla_id = centro.plantilla_id
		and c.bloque in ('contrato', 'ordenes_compra') order by c.id for share;
	if enlace is not null and not public.enlace_sharepoint_valido(enlace) then
		perform public.error_api('IC422', 'Ingrese un enlace HTTPS de SharePoint.');
	end if;

	if accion = 'contrato' then
		delete from public.contrato_valores v where v.sitio_id = centro.id and v.concepto_id in (
			select c.id from public.plantilla_conceptos c
			where c.plantilla_id = centro.plantilla_id and c.bloque = 'contrato');
		insert into public.contrato_valores (sitio_id, concepto_id, valor)
		select centro.id, n.concepto_id, n.valor
		from public.valores_concepto_validados(centro.plantilla_id, 'contrato', p -> 'valores') n;
	elsif accion in ('nuevaOrden', 'editarOrden') then
		if accion = 'nuevaOrden' then
			insert into public.ordenes_compra (id, sitio_id) values (orden, centro.id)
			on conflict (id) do nothing;
		end if;
		perform 1 from public.ordenes_compra o where o.id = orden and o.sitio_id = centro.id;
		if not found then perform public.error_api('IC404', 'Orden de compra no encontrada'); end if;
		delete from public.orden_compra_valores v where v.orden_id = orden and v.concepto_id in (
			select c.id from public.plantilla_conceptos c
			where c.plantilla_id = centro.plantilla_id and c.bloque = 'ordenes_compra');
		insert into public.orden_compra_valores (orden_id, concepto_id, valor)
		select orden, n.concepto_id, n.valor
		from public.valores_concepto_validados(centro.plantilla_id, 'ordenes_compra', p -> 'valores') n;
		if not exists (select 1 from public.orden_compra_valores v where v.orden_id = orden) then
			perform public.error_api('IC422', 'Capture al menos un dato de la orden de compra.');
		end if;
	elsif accion = 'quitarOrden' then
		delete from public.ordenes_compra o where o.id = orden and o.sitio_id = centro.id;
		if not found then perform public.error_api('IC404', 'Orden de compra no encontrada'); end if;
	elsif accion = 'carta' then
		if enlace is not null and fecha is null then
			perform public.error_api('IC422', 'Indique la fecha de la carta de finalización.');
		end if;
		insert into public.seguimiento_centros as s (sitio_id, carta_fecha, carta_enlace)
		values (centro.id, fecha, enlace)
		on conflict (sitio_id) do update
		set carta_fecha = excluded.carta_fecha, carta_enlace = excluded.carta_enlace;
	elsif accion = 'programa' then
		insert into public.seguimiento_centros as s (sitio_id, programa_enlace)
		values (centro.id, enlace)
		on conflict (sitio_id) do update set programa_enlace = excluded.programa_enlace;
	elsif accion = 'cobranza' then
		delete from public.cobranza_meses m where m.sitio_id = centro.id and m.mes in (
			select (f ->> 'mes')::date from jsonb_array_elements(p -> 'meses') f);
		insert into public.cobranza_meses
			(sitio_id, mes, estimacion, prefactura, factura, cobrado, monto_cobrado)
		select centro.id, (f ->> 'mes')::date, (f ->> 'estimacion')::boolean,
			(f ->> 'prefactura')::boolean, (f ->> 'factura')::boolean, (f ->> 'cobrado')::boolean,
			(f ->> 'montoCobrado')::numeric
		from jsonb_array_elements(p -> 'meses') f
		where (f ->> 'estimacion')::boolean or (f ->> 'prefactura')::boolean
			or (f ->> 'factura')::boolean or (f ->> 'cobrado')::boolean
			or f ->> 'montoCobrado' is not null;
	else
		perform public.error_api('IC422', 'Operación de contrato y cobranza no válida.');
	end if;
	return '{}'::jsonb;
end
$$;

do $$
declare
	tabla text;
begin
	foreach tabla in array array['seguimiento_centros', 'contrato_valores', 'ordenes_compra',
		'orden_compra_valores', 'cobranza_meses'] loop
		execute format('alter table public.%I enable row level security', tabla);
		if exists (select 1 from pg_roles where rolname = 'service_role') then
			execute format('revoke all on public.%I from public, anon, authenticated', tabla);
			execute format('grant select, insert, update, delete on public.%I to service_role', tabla);
			execute format('create policy servicio_acceso_total on public.%I for all to service_role using (true) with check (true)', tabla);
		end if;
	end loop;
	revoke execute on function public.enlace_sharepoint_valido(text),
		public.valores_concepto_validados(uuid, text, jsonb),
		public.api_obtener_contrato_cobranza(jsonb), public.api_guardar_contrato_cobranza(jsonb)
		from public;
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
