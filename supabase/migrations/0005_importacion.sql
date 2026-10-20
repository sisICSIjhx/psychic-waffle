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
