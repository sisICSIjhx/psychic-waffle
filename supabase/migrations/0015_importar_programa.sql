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
