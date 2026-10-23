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
