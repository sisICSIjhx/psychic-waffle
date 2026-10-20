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
