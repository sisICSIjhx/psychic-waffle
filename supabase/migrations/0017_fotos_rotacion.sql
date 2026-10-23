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
