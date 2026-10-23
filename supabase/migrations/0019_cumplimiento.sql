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
		'ejecuciones', (select count(*) from public.reportes r
			where r.reprogramacion_id = a.id and r.estado = 'emitido'),
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
