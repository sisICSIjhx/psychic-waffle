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
