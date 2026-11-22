-- 0028_kpi_estatus_centros.sql
-- Cambio kpi-estatus-centros: indicador, «por definir» y carpeta de cada concepto (D1), nivel
-- «partida» (D2), actividades con grupo y partidas escritas a mano con programa anual (D3),
-- atenciones de emergencia con horario y personal (D4), carpeta con recepción y acuse (D5),
-- adicionales (D6), monto cobrado derivado de la cobranza (D7), resumen de estatus por centro de
-- costo (D8) y complemento de las plantillas existentes (D10).

-- ---------------------------------------------------------------------------------------------
-- Nivel «partida» (D2) y grupo de las actividades (D3)
-- ---------------------------------------------------------------------------------------------

-- «programa» admite además actividad y partida; «documentos», actividad o partida.
create or replace function public.nivel_valido(bloque text, nivel text)
returns boolean
language sql
immutable
parallel safe
as $$
	select case bloque
		when 'programa' then nivel in ('periodo', 'actividad', 'partida')
		when 'documentos' then nivel in ('actividad', 'partida')
		else nivel = public.nivel_de_bloque(bloque) end
$$;

alter table public.plantilla_conceptos
	drop constraint plantilla_conceptos_nivel_check,
	add constraint plantilla_conceptos_nivel_check
		check (nivel in ('contrato', 'orden_compra', 'periodo', 'actividad', 'partida'));

-- La partida de cada actividad guardada. Hasta ahora «escrita a mano» se deducía de no tener ordinal.
alter table public.seguimiento_actividades
	add column grupo text,
	add column manual boolean not null default false;
update public.seguimiento_actividades set
	manual = ordinal is null,
	grupo = case when ordinal is null then clave else regexp_replace(clave, ':[0-9]+$', '') end;
alter table public.seguimiento_actividades alter column grupo set not null;
create index seguimiento_actividades_grupo_idx on public.seguimiento_actividades (mes_id, grupo);

-- El reporte es por partida: los documentos «Reporte…» dejan de marcarse en cada ejecución. El
-- disparador que protege los conceptos con datos se desactiva solo durante la conversión.
alter table public.plantilla_conceptos disable trigger concepto_con_seguimiento;
update public.plantilla_conceptos set nivel = 'partida'
where bloque = 'documentos' and nivel = 'actividad' and etiqueta_normalizada like 'REPORTE%';
-- Ningún cambio diferido queda pendiente al volver a tocar la tabla.
set constraints public.plantilla_conceptos_etiqueta_unica immediate;
alter table public.plantilla_conceptos enable trigger concepto_con_seguimiento;
set constraints public.plantilla_conceptos_etiqueta_unica deferred;

-- Fusión de lo ya capturado: de cada partida queda un solo valor (marcado si alguna de sus
-- actividades lo estaba), y se guarda en su primera actividad.
delete from public.seguimiento_valores v
using (
	select w.mes_id, w.actividad, w.concepto_id,
		row_number() over (
			partition by w.mes_id, a.grupo, w.concepto_id
			order by (w.valor in ('true'::jsonb, '"hecho"'::jsonb)) desc, a.ordinal nulls first, a.clave
		) as lugar
	from public.seguimiento_valores w
		join public.plantilla_conceptos c on c.id = w.concepto_id and c.nivel = 'partida'
		join public.seguimiento_actividades a on a.mes_id = w.mes_id and a.clave = w.actividad
) x
where x.lugar > 1 and v.mes_id = x.mes_id and v.actividad = x.actividad
	and v.concepto_id = x.concepto_id;

update public.seguimiento_valores v set actividad = p.clave
from public.plantilla_conceptos c, public.seguimiento_actividades a, (
	select distinct on (b.mes_id, b.grupo) b.mes_id, b.grupo, b.clave
	from public.seguimiento_actividades b
	order by b.mes_id, b.grupo, b.ordinal nulls first, b.clave
) p
where c.id = v.concepto_id and c.nivel = 'partida'
	and a.mes_id = v.mes_id and a.clave = v.actividad
	and p.mes_id = a.mes_id and p.grupo = a.grupo and p.clave <> v.actividad;

-- ---------------------------------------------------------------------------------------------
-- Indicador, «por definir» y carpeta del concepto (D1)
-- ---------------------------------------------------------------------------------------------

-- Qué mide un concepto y en qué bloque, tipo y nivel tiene sentido.
create function public.indicador_valido(indicador text, bloque text, tipo text, nivel text)
returns boolean
language sql
immutable
parallel safe
as $$
	select case indicador
		when 'monto_contrato' then (bloque, tipo, nivel) = ('contrato', 'monto', 'contrato')
		when 'monto_cobrado' then (bloque, tipo, nivel) = ('contrato', 'monto', 'contrato')
		when 'monto_facturado' then (bloque, tipo, nivel) = ('contrato', 'monto', 'contrato')
		when 'periodicidad' then (bloque, tipo, nivel) = ('contrato', 'texto', 'contrato')
		when 'em_programadas' then (bloque, tipo, nivel) = ('programa', 'cantidad', 'periodo')
		when 'em_realizadas' then (bloque, tipo, nivel) = ('programa', 'cantidad', 'periodo')
		when 'em_cobradas' then (bloque, tipo, nivel) = ('programa', 'cantidad', 'periodo')
		when 'actividad_cobrada' then (bloque, tipo, nivel) = ('programa', 'casilla', 'actividad')
		else indicador is null end
$$;

alter table public.plantilla_conceptos
	add column indicador text,
	add column por_definir boolean not null default false,
	add column carpeta_id uuid references public.plantilla_conceptos (id) on delete set null,
	add constraint plantilla_conceptos_indicador
		check (public.indicador_valido(indicador, bloque, tipo, nivel)),
	-- Diferida: al guardar, un indicador puede pasar de un concepto a otro en la misma operación.
	add constraint plantilla_conceptos_indicador_unico unique (plantilla_id, indicador)
		deferrable initially deferred;
create index plantilla_conceptos_carpeta_idx on public.plantilla_conceptos (carpeta_id)
	where carpeta_id is not null;

-- Solo un documento pertenece a una carpeta, y a una de su misma plantilla.
create function public.validar_carpeta_de_concepto()
returns trigger language plpgsql as $$
begin
	if new.carpeta_id is not null and (new.bloque <> 'documentos' or not exists (
		select 1 from public.plantilla_conceptos k
		where k.id = new.carpeta_id and k.plantilla_id = new.plantilla_id and k.bloque = 'carpetas')) then
		perform public.error_api('IC422',
			format('La carpeta de «%s» no es válida: solo un documento pertenece a una carpeta de su plantilla.',
				new.etiqueta),
			jsonb_build_object('motivo', 'carpeta', 'etiqueta', new.etiqueta));
	end if;
	return new;
end
$$;
create trigger concepto_con_carpeta before insert or update on public.plantilla_conceptos
	for each row execute function public.validar_carpeta_de_concepto();

-- Las plantillas ya cargadas reciben su indicador por la etiqueta, si el bloque, tipo y nivel
-- coinciden y la plantilla aún no lo tiene.
with propuestos as (
	select distinct on (c.plantilla_id, i.indicador) c.id, i.indicador
	from public.plantilla_conceptos c
		join (values
			('MONTO', 'monto_contrato'), ('MONTO TOTAL', 'monto_contrato'),
			('MONTO PACTADO', 'monto_contrato'), ('MONTO COBRADO', 'monto_cobrado'),
			('MONTO FACTURADO', 'monto_facturado'), ('PERIODICIDAD', 'periodicidad'),
			('EM PROGRAMADAS', 'em_programadas'), ('EM REALIZADAS', 'em_realizadas'),
			('EM EJECUTADAS', 'em_realizadas'), ('EM CON COBRO', 'em_cobradas'),
			('COBRADA', 'actividad_cobrada')
		) i (etiqueta, indicador) on i.etiqueta = c.etiqueta_normalizada
	where c.indicador is null and public.indicador_valido(i.indicador, c.bloque, c.tipo, c.nivel)
	order by c.plantilla_id, i.indicador, c.orden, c.id
)
update public.plantilla_conceptos c set indicador = p.indicador
from propuestos p where p.id = c.id;

create or replace function public.json_plantilla_seguimiento(id_plantilla uuid)
returns jsonb
language sql
stable
as $$
	select jsonb_build_object(
		'id', g.id, 'nombre', g.nombre, 'descripcion', g.descripcion,
		'modoContrato', g.modo_contrato, 'origenActividades', g.origen_actividades,
		'actualizadoEn', g.actualizado_en,
		'conceptos', coalesce((
			select jsonb_agg(jsonb_build_object('id', c.id, 'bloque', c.bloque, 'etiqueta', c.etiqueta,
				'tipo', c.tipo, 'nivel', c.nivel, 'orden', c.orden, 'indicador', c.indicador,
				'porDefinir', c.por_definir, 'carpetaId', c.carpeta_id)
				order by public.orden_bloque(c.bloque), c.orden)
			from public.plantilla_conceptos c where c.plantilla_id = g.id
		), '[]'::jsonb),
		'centros', coalesce((
			select jsonb_agg(jsonb_build_object('id', t.id, 'clave', t.clave, 'nombre', t.nombre)
				order by t.clave_normalizada)
			from public.sitios t where t.plantilla_id = g.id
		), '[]'::jsonb)
	)
	from public.plantillas_seguimiento g
	where g.id = id_plantilla
$$;

-- Alta o edición con la lista completa de conceptos, como en 0023. Cada concepto puede traer
-- `indicador`, `porDefinir` y su carpeta (`carpetaId`, o `carpeta` con la etiqueta de un concepto de
-- carpeta de la misma lista); el que no trae esas llaves conserva lo que tenía.
create or replace function public.api_guardar_plantilla_seguimiento(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	id_plantilla uuid := (p ->> 'id')::uuid;
	nombre_plantilla text := public.texto_o_nulo(p ->> 'nombre');
	modo text := coalesce(public.texto_o_nulo(p ->> 'modoContrato'), 'obligatorio');
	origen text := coalesce(public.texto_o_nulo(p ->> 'origenActividades'), 'ninguno');
	conceptos jsonb := coalesce(p -> 'conceptos', '[]'::jsonb);
	concepto jsonb;
	bloque_c text;
	etiqueta_c text;
	tipo_c text;
	nivel_c text;
	indicador_c text;
	id_concepto uuid;
	id_carpeta uuid;
	con_carpeta jsonb := '[]'::jsonb;
	contador integer;
	ordenes jsonb := '{}'::jsonb;
	repetida text;
begin
	if nombre_plantilla is null then
		perform public.error_api('IC422', 'Escriba el nombre de la plantilla',
			jsonb_build_object('motivo', 'nombre'));
	end if;
	if modo not in ('obligatorio', 'opcional', 'sin_contrato') then
		perform public.error_api('IC422', 'Modo de contrato no válido', jsonb_build_object('motivo', 'modo'));
	end if;
	if origen not in ('programa_anual', 'mensual', 'ninguno') then
		perform public.error_api('IC422', 'Origen de las actividades no válido',
			jsonb_build_object('motivo', 'origen'));
	end if;
	if jsonb_typeof(conceptos) <> 'array' then
		perform public.error_api('IC422', 'Conceptos no válidos', jsonb_build_object('motivo', 'conceptos'));
	end if;
	if exists (select 1 from public.plantillas_seguimiento
		where nombre_normalizado = public.normalizar_clave(nombre_plantilla)
			and id is distinct from id_plantilla) then
		perform public.error_api('IC422', 'Ya existe una plantilla con ese nombre',
			jsonb_build_object('motivo', 'plantilla_duplicada'));
	end if;
	select min(btrim(c ->> 'etiqueta')) into repetida
	from jsonb_array_elements(conceptos) c
	where public.texto_o_nulo(c ->> 'etiqueta') is not null
	group by c ->> 'bloque', public.normalizar_clave(c ->> 'etiqueta')
	having count(*) > 1
	limit 1;
	if repetida is not null then
		perform public.error_api('IC422', 'Concepto repetido en el bloque',
			jsonb_build_object('motivo', 'concepto_duplicado', 'etiqueta', repetida));
	end if;

	if id_plantilla is null then
		insert into public.plantillas_seguimiento (nombre, descripcion, modo_contrato, origen_actividades)
		values (nombre_plantilla, public.texto_o_nulo(p ->> 'descripcion'), modo, origen)
		returning id into id_plantilla;
	else
		update public.plantillas_seguimiento set
			nombre = nombre_plantilla,
			descripcion = public.texto_o_nulo(p ->> 'descripcion'),
			modo_contrato = modo,
			origen_actividades = origen
		where id = id_plantilla;
		if not found then
			perform public.error_api('IC404', 'Plantilla no encontrada', jsonb_build_object('id', id_plantilla));
		end if;
		delete from public.plantilla_conceptos
		where plantilla_id = id_plantilla
			and id not in (
				select (c ->> 'id')::uuid from jsonb_array_elements(conceptos) c
				where public.texto_o_nulo(c ->> 'id') is not null
			);
	end if;

	for concepto in
		select t.valor from jsonb_array_elements(conceptos) with ordinality t(valor, n) order by t.n
	loop
		bloque_c := concepto ->> 'bloque';
		etiqueta_c := public.texto_o_nulo(concepto ->> 'etiqueta');
		tipo_c := concepto ->> 'tipo';
		nivel_c := coalesce(public.texto_o_nulo(concepto ->> 'nivel'), public.nivel_de_bloque(bloque_c));
		indicador_c := public.texto_o_nulo(concepto ->> 'indicador');
		if public.orden_bloque(bloque_c) is null then
			perform public.error_api('IC422', 'Bloque no válido', jsonb_build_object('motivo', 'bloque'));
		end if;
		if etiqueta_c is null then
			perform public.error_api('IC422', 'Escriba la etiqueta del concepto',
				jsonb_build_object('motivo', 'etiqueta'));
		end if;
		if tipo_c is null or tipo_c not in ('casilla', 'estado', 'cantidad', 'monto', 'enlace', 'fecha',
			'texto', 'carpeta') then
			perform public.error_api('IC422', 'Tipo de concepto no válido', jsonb_build_object('motivo', 'tipo'));
		end if;
		if not public.tipo_valido(bloque_c, tipo_c) then
			perform public.error_api('IC422', 'El tipo no corresponde al bloque',
				jsonb_build_object('motivo', 'tipo_bloque', 'etiqueta', etiqueta_c));
		end if;
		if not public.nivel_valido(bloque_c, nivel_c) then
			perform public.error_api('IC422', 'El nivel no corresponde al bloque',
				jsonb_build_object('motivo', 'nivel_bloque', 'etiqueta', etiqueta_c));
		end if;
		if not public.indicador_valido(indicador_c, bloque_c, tipo_c, nivel_c) then
			perform public.error_api('IC422',
				format('El indicador de «%s» no corresponde a su bloque, tipo y nivel.', etiqueta_c),
				jsonb_build_object('motivo', 'indicador', 'etiqueta', etiqueta_c));
		end if;
		contador := coalesce((ordenes ->> bloque_c)::integer, 0) + 1;
		ordenes := ordenes || jsonb_build_object(bloque_c, contador);
		if public.texto_o_nulo(concepto ->> 'id') is not null then
			update public.plantilla_conceptos c set
				bloque = bloque_c, etiqueta = etiqueta_c, tipo = tipo_c, nivel = nivel_c, orden = contador,
				indicador = case when concepto ? 'indicador' then indicador_c
					when public.indicador_valido(c.indicador, bloque_c, tipo_c, nivel_c) then c.indicador end,
				por_definir = case when concepto ? 'porDefinir'
					then coalesce((concepto ->> 'porDefinir')::boolean, false) else c.por_definir end,
				carpeta_id = case when concepto ? 'carpetaId' or concepto ? 'carpeta'
					or bloque_c <> 'documentos' then null else c.carpeta_id end
			where c.id = (concepto ->> 'id')::uuid and c.plantilla_id = id_plantilla
			returning c.id into id_concepto;
			if not found then
				perform public.error_api('IC422', 'El concepto no pertenece a la plantilla',
					jsonb_build_object('motivo', 'concepto_ajeno'));
			end if;
		else
			insert into public.plantilla_conceptos
				(plantilla_id, bloque, etiqueta, tipo, nivel, orden, indicador, por_definir)
			values (id_plantilla, bloque_c, etiqueta_c, tipo_c, nivel_c, contador, indicador_c,
				coalesce((concepto ->> 'porDefinir')::boolean, false))
			returning id into id_concepto;
		end if;
		if public.texto_o_nulo(concepto ->> 'carpetaId') is not null
			or public.texto_o_nulo(concepto ->> 'carpeta') is not null then
			con_carpeta := con_carpeta || jsonb_build_object('id', id_concepto, 'etiqueta', etiqueta_c,
				'carpetaId', public.texto_o_nulo(concepto ->> 'carpetaId'),
				'carpeta', public.texto_o_nulo(concepto ->> 'carpeta'));
		end if;
	end loop;

	-- Las carpetas se resuelven al final: un documento puede nombrar una carpeta nueva de la lista.
	for concepto in select t.valor from jsonb_array_elements(con_carpeta) t(valor) loop
		select k.id into id_carpeta from public.plantilla_conceptos k
		where k.plantilla_id = id_plantilla and k.bloque = 'carpetas'
			and case when concepto ->> 'carpetaId' is not null then k.id = (concepto ->> 'carpetaId')::uuid
				else k.etiqueta_normalizada = public.normalizar_clave(concepto ->> 'carpeta') end;
		if not found then
			perform public.error_api('IC422',
				format('La carpeta de «%s» no existe en la plantilla.', concepto ->> 'etiqueta'),
				jsonb_build_object('motivo', 'carpeta', 'etiqueta', concepto ->> 'etiqueta'));
		end if;
		update public.plantilla_conceptos set carpeta_id = id_carpeta where id = (concepto ->> 'id')::uuid;
	end loop;
	update public.plantilla_conceptos d set carpeta_id = null
	where d.plantilla_id = id_plantilla and d.carpeta_id is not null and not exists (
		select 1 from public.plantilla_conceptos k where k.id = d.carpeta_id and k.bloque = 'carpetas');

	select string_agg(format('«%s»', c.etiqueta), ' y ' order by public.orden_bloque(c.bloque), c.orden)
	into repetida
	from public.plantilla_conceptos c
	where c.plantilla_id = id_plantilla and c.indicador is not null
	group by c.indicador
	having count(*) > 1
	limit 1;
	if repetida is not null then
		perform public.error_api('IC422', format('%s tienen el mismo indicador.', repetida),
			jsonb_build_object('motivo', 'indicador_duplicado'));
	end if;
	return public.json_plantilla_seguimiento(id_plantilla);
end
$$;

-- Copia con otro nombre y conceptos nuevos, con sus indicadores y carpetas.
create or replace function public.api_duplicar_plantilla_seguimiento(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	origen public.plantillas_seguimiento;
	nombre_copia text := public.texto_o_nulo(p ->> 'nombre');
	id_copia uuid;
begin
	select * into origen from public.plantillas_seguimiento where id = (p ->> 'id')::uuid;
	if not found then
		perform public.error_api('IC404', 'Plantilla no encontrada', jsonb_build_object('id', p ->> 'id'));
	end if;
	if nombre_copia is null then
		perform public.error_api('IC422', 'Escriba el nombre de la copia', jsonb_build_object('motivo', 'nombre'));
	end if;
	if exists (select 1 from public.plantillas_seguimiento
		where nombre_normalizado = public.normalizar_clave(nombre_copia)) then
		perform public.error_api('IC422', 'Ya existe una plantilla con ese nombre',
			jsonb_build_object('motivo', 'plantilla_duplicada'));
	end if;
	insert into public.plantillas_seguimiento (nombre, descripcion, modo_contrato, origen_actividades)
	values (nombre_copia, origen.descripcion, origen.modo_contrato, origen.origen_actividades)
	returning id into id_copia;
	insert into public.plantilla_conceptos
		(plantilla_id, bloque, etiqueta, tipo, nivel, orden, indicador, por_definir)
	select id_copia, c.bloque, c.etiqueta, c.tipo, c.nivel, c.orden, c.indicador, c.por_definir
	from public.plantilla_conceptos c where c.plantilla_id = origen.id;
	update public.plantilla_conceptos d set carpeta_id = k.id
	from public.plantilla_conceptos o
		join public.plantilla_conceptos ko on ko.id = o.carpeta_id
		join public.plantilla_conceptos k on k.plantilla_id = id_copia and k.bloque = 'carpetas'
			and k.etiqueta_normalizada = ko.etiqueta_normalizada
	where o.plantilla_id = origen.id and d.plantilla_id = id_copia and d.bloque = o.bloque
		and d.etiqueta_normalizada = o.etiqueta_normalizada;
	return public.json_plantilla_seguimiento(id_copia);
end
$$;

-- Complemento de las plantillas que ya existen (D10): agrega los conceptos que falten (por bloque y
-- etiqueta) y actualiza indicador, «por definir» y carpeta de los existentes cuando el archivo los
-- trae. Nunca cambia tipo, bloque ni nivel de un concepto, ni elimina conceptos. Ensayo por omisión.
create function public.api_complementar_plantillas(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	ensayo boolean := coalesce((p ->> 'ensayo')::boolean, true);
	aplicado boolean := false;
	fila jsonb;
	concepto jsonb;
	plantilla public.plantillas_seguimiento;
	existente public.plantilla_conceptos;
	bloque_c text;
	etiqueta_c text;
	indicador_c text;
	id_carpeta uuid;
	nuevos uuid[];
	cambiados uuid[];
	avisos jsonb;
	cambios jsonb;
	estado text;
	filas jsonb := '[]'::jsonb;
	total_agregados integer := 0;
	total_actualizados integer := 0;
	ausentes integer := 0;
	invalidas integer := 0;
begin
	begin
		for fila in
			select t.valor from jsonb_array_elements(coalesce(p -> 'plantillas', '[]'::jsonb))
				with ordinality t(valor, n) order by t.n
		loop
			nuevos := '{}';
			cambiados := '{}';
			avisos := '[]'::jsonb;
			cambios := '[]'::jsonb;
			select * into plantilla from public.plantillas_seguimiento
			where nombre_normalizado = public.normalizar_clave(fila ->> 'nombre');
			if not found then
				ausentes := ausentes + 1;
				filas := filas || jsonb_build_object('nombre', fila ->> 'nombre', 'estado', 'ausente',
					'agregados', 0, 'actualizados', 0, 'cambios', cambios,
					'avisos', jsonb_build_array('No existe en la base: cárguela sin --complementar'));
				continue;
			end if;
			begin
				for concepto in
					select t.valor from jsonb_array_elements(coalesce(fila -> 'conceptos', '[]'::jsonb))
						with ordinality t(valor, n) order by t.n
				loop
					bloque_c := concepto ->> 'bloque';
					etiqueta_c := public.texto_o_nulo(concepto ->> 'etiqueta');
					indicador_c := public.texto_o_nulo(concepto ->> 'indicador');
					select * into existente from public.plantilla_conceptos c
					where c.plantilla_id = plantilla.id and c.bloque = bloque_c
						and c.etiqueta_normalizada = public.normalizar_clave(etiqueta_c);
					if not found then
						-- El archivo es el objetivo: el indicador pasa al concepto que él señala.
						update public.plantilla_conceptos set indicador = null
						where plantilla_id = plantilla.id and indicador = indicador_c;
						insert into public.plantilla_conceptos
							(plantilla_id, bloque, etiqueta, tipo, nivel, orden, indicador, por_definir)
						values (plantilla.id, bloque_c, etiqueta_c, concepto ->> 'tipo',
							coalesce(public.texto_o_nulo(concepto ->> 'nivel'), public.nivel_de_bloque(bloque_c)),
							coalesce((select max(c.orden) from public.plantilla_conceptos c
								where c.plantilla_id = plantilla.id and c.bloque = bloque_c), 0) + 1,
							indicador_c, coalesce((concepto ->> 'porDefinir')::boolean, false))
						returning * into existente;
						nuevos := nuevos || existente.id;
						cambios := cambios || to_jsonb(format('Se agrega «%s» (%s)', etiqueta_c, bloque_c));
						continue;
					end if;
					if concepto ->> 'tipo' is distinct from existente.tipo
						or coalesce(public.texto_o_nulo(concepto ->> 'nivel'), existente.nivel) <> existente.nivel then
						avisos := avisos || to_jsonb(format(
							'«%s» (%s) tiene otro tipo o nivel en la base (%s, %s); no se cambia',
							existente.etiqueta, bloque_c, existente.tipo, existente.nivel));
					end if;
					if concepto ? 'indicador' and indicador_c is distinct from existente.indicador then
						if not public.indicador_valido(indicador_c, existente.bloque, existente.tipo, existente.nivel) then
							avisos := avisos || to_jsonb(format(
								'«%s» (%s): el indicador «%s» no corresponde a su tipo y nivel; no se asigna',
								existente.etiqueta, bloque_c, indicador_c));
						else
							update public.plantilla_conceptos set indicador = null
							where plantilla_id = plantilla.id and indicador = indicador_c and id <> existente.id;
							update public.plantilla_conceptos set indicador = indicador_c where id = existente.id;
							cambiados := cambiados || existente.id;
							cambios := cambios || to_jsonb(format('«%s» (%s): indicador %s', existente.etiqueta,
								bloque_c, coalesce(indicador_c, 'ninguno')));
						end if;
					end if;
					if concepto ? 'porDefinir'
						and coalesce((concepto ->> 'porDefinir')::boolean, false) <> existente.por_definir then
						update public.plantilla_conceptos set por_definir = not existente.por_definir
						where id = existente.id;
						cambiados := cambiados || existente.id;
						cambios := cambios || to_jsonb(format('«%s» (%s): %s', existente.etiqueta, bloque_c,
							case when existente.por_definir then 'deja de estar por definir' else 'por definir' end));
					end if;
				end loop;

				-- Las carpetas, al final: pueden ser conceptos recién agregados.
				for concepto in
					select t.valor from jsonb_array_elements(coalesce(fila -> 'conceptos', '[]'::jsonb))
						with ordinality t(valor, n) where t.valor ? 'carpeta' order by t.n
				loop
					bloque_c := concepto ->> 'bloque';
					select * into existente from public.plantilla_conceptos c
					where c.plantilla_id = plantilla.id and c.bloque = bloque_c
						and c.etiqueta_normalizada = public.normalizar_clave(concepto ->> 'etiqueta');
					id_carpeta := null;
					if public.texto_o_nulo(concepto ->> 'carpeta') is not null then
						select k.id into id_carpeta from public.plantilla_conceptos k
						where k.plantilla_id = plantilla.id and k.bloque = 'carpetas'
							and k.etiqueta_normalizada = public.normalizar_clave(concepto ->> 'carpeta');
						if not found then
							avisos := avisos || to_jsonb(format('«%s» (%s): la carpeta «%s» no existe; no se asigna',
								existente.etiqueta, bloque_c, concepto ->> 'carpeta'));
							continue;
						end if;
					end if;
					if id_carpeta is distinct from existente.carpeta_id then
						update public.plantilla_conceptos set carpeta_id = id_carpeta where id = existente.id;
						if not (existente.id = any (nuevos)) then
							cambiados := cambiados || existente.id;
						end if;
						cambios := cambios || to_jsonb(format('«%s» (%s): carpeta %s', existente.etiqueta,
							bloque_c, coalesce(format('«%s»', concepto ->> 'carpeta'), 'ninguna')));
					end if;
				end loop;
				cambiados := array(select distinct x from unnest(cambiados) x);
				estado := case when cardinality(nuevos) + cardinality(cambiados) > 0 then 'complementada'
					else 'sin_cambios' end;
			exception when others then
				estado := 'invalida';
				nuevos := '{}';
				cambiados := '{}';
				cambios := '[]'::jsonb;
				avisos := jsonb_build_array(sqlerrm);
				invalidas := invalidas + 1;
			end;
			total_agregados := total_agregados + cardinality(nuevos);
			total_actualizados := total_actualizados + cardinality(cambiados);
			filas := filas || jsonb_build_object('nombre', plantilla.nombre, 'estado', estado,
				'agregados', cardinality(nuevos), 'actualizados', cardinality(cambiados),
				'cambios', cambios, 'avisos', avisos);
		end loop;

		aplicado := not ensayo and invalidas = 0;
		if not aplicado then
			raise exception using errcode = 'IC000', message = 'deshacer';
		end if;
	exception when sqlstate 'IC000' then
		-- Deshace lo escrito en el bloque; las variables conservan el informe.
		null;
	end;
	return jsonb_build_object(
		'ensayo', ensayo,
		'aplicado', aplicado,
		'resumen', jsonb_build_object('agregados', total_agregados, 'actualizados', total_actualizados,
			'ausentes', ausentes, 'invalidas', invalidas),
		'plantillas', filas
	);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Atenciones de emergencia (D4) y carpeta con recepción y acuse (D5)
-- ---------------------------------------------------------------------------------------------

-- Horario opcional; si la atención cruza la medianoche, el fin es menor que el inicio.
alter table public.seguimiento_nocturnas
	add column hora_inicio time,
	add column hora_fin time,
	alter column descripcion drop not null;

create table public.seguimiento_nocturna_personal (
	mes_id uuid not null,
	nocturna_id uuid not null,
	personal_id uuid not null references public.personal (id) on delete restrict,
	primary key (mes_id, nocturna_id, personal_id),
	foreign key (mes_id, nocturna_id) references public.seguimiento_nocturnas (mes_id, id)
		on delete cascade
);
create index seguimiento_nocturna_personal_persona_idx
	on public.seguimiento_nocturna_personal (personal_id);

-- Las reglas de la entrega cambian: se quitan la lista de estados y la que exigía enlace o archivo.
do $$
declare
	restriccion text;
begin
	for restriccion in
		select conname from pg_constraint
		where conrelid = 'public.seguimiento_carpetas'::regclass and contype = 'c'
			and pg_get_constraintdef(oid) like '%entregada%'
	loop
		execute format('alter table public.seguimiento_carpetas drop constraint %I', restriccion);
	end loop;
end
$$;

alter table public.seguimiento_carpetas
	add column fecha_recepcion date,
	add column comentarios text check (length(btrim(comentarios)) between 1 and 1000),
	add column acuse_enlace text,
	add column acuse_archivo_nombre text,
	add column acuse_archivo bytea,
	add constraint seguimiento_carpetas_estado_check check (estado in
		('pendiente', 'en_proceso', 'entregada', 'recibida_comentarios', 'recibida')),
	add constraint seguimiento_carpetas_entrega check (
		estado not in ('entregada', 'recibida_comentarios', 'recibida')
		or (entrega_id is not null and fecha is not null)),
	add constraint seguimiento_carpetas_recepcion check (
		estado not in ('recibida_comentarios', 'recibida')
		or (recibe is not null and fecha_recepcion is not null)),
	add constraint seguimiento_carpetas_comentarios check (
		estado <> 'recibida_comentarios' or comentarios is not null),
	add constraint seguimiento_carpetas_acuse check (
		estado <> 'recibida' or acuse_enlace is not null or acuse_archivo is not null),
	add constraint seguimiento_carpetas_acuse_archivo check (
		(acuse_archivo is null) = (acuse_archivo_nombre is null)
		and (acuse_archivo is null
			or (acuse_enlace is null and octet_length(acuse_archivo) between 1 and 8388608)));

-- ---------------------------------------------------------------------------------------------
-- Seguimiento operativo: actividades con su partida
-- ---------------------------------------------------------------------------------------------

-- Cada actividad lleva su partida (`grupo` y `partida`) y si la escribió una persona (`manual`).
-- Las escritas a mano cuentan como programadas también en un centro con programa anual.
drop function public.actividades_seguimiento(uuid, date, text, uuid);
create function public.actividades_seguimiento(sitio uuid, periodo date, fuente text, id_mes uuid)
returns table (clave text, nombre text, ordinal integer, fecha date, ejecutada boolean,
	programada boolean, grupo text, partida text, manual boolean)
language sql stable as $$
	with anuales as (
		select concat('a:', g.id, ':', m.partida_id) as grupo,
			concat(t.numero, ' · ', coalesce(t.nombre_corto, t.actividad)) as nombre, n.ordinal
		from public.programa_meses m
		join public.programas g on g.id = m.programa_id
		join public.partidas t on t.id = m.partida_id
		cross join lateral generate_series(1, ceil(m.cantidad)::integer) n(ordinal)
		where fuente = 'programa_anual' and g.sitio_id = sitio and m.mes = periodo
	), guardadas as (
		select a.* from public.seguimiento_actividades a where a.mes_id = id_mes
	)
	select concat(p.grupo, ':', p.ordinal), p.nombre, p.ordinal, null::date,
		coalesce(a.ejecutada, false), true, p.grupo, p.nombre, false
	from anuales p left join guardadas a on a.clave = concat(p.grupo, ':', p.ordinal)
	union all
	select a.clave, a.nombre, a.ordinal, a.fecha, a.ejecutada, a.manual, a.grupo, a.nombre, a.manual
	from guardadas a
	where not exists (select 1 from anuales p where concat(p.grupo, ':', p.ordinal) = a.clave)
$$;

-- Primera actividad de cada partida (la de menor ordinal): ahí se captura un concepto por partida.
create function public.primeras_de_partida(sitio uuid, periodo date, fuente text, id_mes uuid)
returns table (grupo text, clave text)
language sql stable as $$
	select distinct on (a.grupo) a.grupo, a.clave
	from public.actividades_seguimiento(sitio, periodo, fuente, id_mes) a
	order by a.grupo, a.ordinal nulls first, a.clave
$$;

create or replace function public.api_obtener_seguimiento_operativo(p jsonb)
returns jsonb language plpgsql stable as $$
declare
	centro public.sitios;
	seguimiento public.seguimiento_meses;
	plantilla uuid;
	origen text;
	periodo date := (p ->> 'mes')::date;
begin
	select * into centro from public.sitios where id = (p ->> 'sitioId')::uuid;
	if not found then perform public.error_api('IC404', 'No encontrado'); end if;
	select * into seguimiento from public.seguimiento_meses where sitio_id = centro.id and mes = periodo;
	if seguimiento.plantilla_id is not null then
		plantilla := seguimiento.plantilla_id;
		origen := seguimiento.origen;
	else
		plantilla := centro.plantilla_id;
		select origen_actividades into origen from public.plantillas_seguimiento where id = plantilla;
		origen := coalesce(origen, 'ninguno');
	end if;

	return jsonb_build_object(
		'origen', origen, 'plantillaId', plantilla,
		'conceptos', coalesce((select jsonb_agg(jsonb_build_object(
			'id', c.id, 'bloque', c.bloque, 'nivel', c.nivel, 'tipo', c.tipo, 'etiqueta', c.etiqueta,
			'indicador', c.indicador, 'porDefinir', c.por_definir, 'carpetaId', c.carpeta_id
		) order by public.orden_bloque(c.bloque), c.orden)
			from public.conceptos_seguimiento_operativo(plantilla) c), '[]'::jsonb),
		-- Las actividades de una partida van juntas; las partidas, por su primera fecha y su nombre.
		'actividades', coalesce((select jsonb_agg(to_jsonb(a) - 'inicio'
			order by a.inicio nulls last, a.nombre, a.grupo, a.ordinal nulls first, a.clave)
			from (
				select x.*, min(x.fecha) over (partition by x.grupo) as inicio
				from public.actividades_seguimiento(centro.id, periodo, origen, seguimiento.id) x
			) a), '[]'::jsonb),
		-- Un concepto por partida se entrega en la primera actividad de su partida, esté donde esté.
		'valores', coalesce((select jsonb_agg(jsonb_build_object(
			'actividad', x.actividad, 'conceptoId', x.concepto_id, 'valor', x.valor))
			from (
				select v.actividad, v.concepto_id, v.valor
				from public.seguimiento_valores v
					join public.plantilla_conceptos c on c.id = v.concepto_id
				where v.mes_id = seguimiento.id and c.nivel <> 'partida'
				union all
				(select distinct on (a.grupo, v.concepto_id) f.clave, v.concepto_id, v.valor
				from public.seguimiento_valores v
					join public.plantilla_conceptos c on c.id = v.concepto_id and c.nivel = 'partida'
					join public.actividades_seguimiento(centro.id, periodo, origen, seguimiento.id) a
						on a.clave = v.actividad
					join public.primeras_de_partida(centro.id, periodo, origen, seguimiento.id) f
						on f.grupo = a.grupo
				where v.mes_id = seguimiento.id
				order by a.grupo, v.concepto_id, (a.clave = f.clave) desc, a.ordinal nulls first, a.clave)
			) x), '[]'::jsonb),
		'nocturnas', coalesce((select jsonb_agg(jsonb_build_object(
			'id', n.id, 'fecha', n.fecha, 'horaInicio', to_char(n.hora_inicio, 'HH24:MI'),
			'horaFin', to_char(n.hora_fin, 'HH24:MI'), 'descripcion', n.descripcion,
			'asistentes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id,
				'nombre', concat_ws(' ', s.nombre, s.apellido_paterno, s.apellido_materno))
				order by s.nombre, s.apellido_paterno, s.id)
				from public.seguimiento_nocturna_personal np
					join public.personal s on s.id = np.personal_id
				where np.mes_id = n.mes_id and np.nocturna_id = n.id), '[]'::jsonb))
			order by n.fecha, n.hora_inicio nulls last, n.id)
			from public.seguimiento_nocturnas n where n.mes_id = seguimiento.id), '[]'::jsonb),
		'carpetas', coalesce((select jsonb_agg(jsonb_build_object(
			'conceptoId', c.concepto_id, 'estado', c.estado, 'entregaId', c.entrega_id,
			'entregaNombre', case when s.id is not null then concat_ws(' ', s.nombre, s.apellido_paterno, s.apellido_materno) end,
			'recibe', c.recibe, 'fecha', c.fecha, 'enlace', c.enlace,
			'archivoNombre', c.archivo_nombre, 'fechaRecepcion', c.fecha_recepcion,
			'comentarios', c.comentarios, 'acuseEnlace', c.acuse_enlace,
			'acuseArchivoNombre', c.acuse_archivo_nombre, 'version', c.version))
			from public.seguimiento_carpetas c left join public.personal s on s.id = c.entrega_id
			where c.mes_id = seguimiento.id), '[]'::jsonb),
		-- El directorio sirve a las carpetas y a las atenciones: se entrega a quien puede editar.
		'personal', coalesce((select jsonb_agg(jsonb_build_object(
			'id', s.id, 'nombre', concat_ws(' ', s.nombre, s.apellido_paterno, s.apellido_materno))
			order by s.nombre, s.apellido_paterno, s.id)
			from public.personal s where s.activo and p ->> 'incluirPersonal' = 'true'), '[]'::jsonb)
	);
end
$$;

-- Guarda una carpeta. Las llaves que no vienen conservan lo guardado, para que cada paso (preparar,
-- entregar, recibir) envíe solo sus datos; `estado` y `version` vienen siempre.
create or replace function public.guardar_carpeta_seguimiento(id_mes uuid, plantilla uuid, p jsonb)
returns void language plpgsql as $$
declare
	concepto uuid := (p ->> 'conceptoId')::uuid;
	actual public.seguimiento_carpetas;
	nueva public.seguimiento_carpetas;
begin
	perform 1 from public.conceptos_seguimiento_operativo(plantilla) c
	where c.id = concepto and c.bloque = 'carpetas';
	if not found then perform public.error_api('IC404', 'Carpeta no encontrada'); end if;
	select c.* into actual from public.seguimiento_carpetas c
	where c.mes_id = id_mes and c.concepto_id = concepto;
	if coalesce(actual.version, 0) is distinct from (p ->> 'version')::integer then
		perform public.error_api('IC409', 'La carpeta cambió. Revise sus datos actualizados antes de guardar.');
	end if;
	nueva := actual;
	nueva.estado := p ->> 'estado';
	if nueva.estado is null or nueva.estado not in
		('pendiente', 'en_proceso', 'entregada', 'recibida_comentarios', 'recibida') then
		perform public.error_api('IC422', 'Estado de la carpeta no válido.');
	end if;
	if p ? 'entregaId' then nueva.entrega_id := (p ->> 'entregaId')::uuid; end if;
	if p ? 'recibe' then nueva.recibe := public.texto_o_nulo(p ->> 'recibe'); end if;
	if p ? 'fecha' then nueva.fecha := (p ->> 'fecha')::date; end if;
	if p ? 'fechaRecepcion' then nueva.fecha_recepcion := (p ->> 'fechaRecepcion')::date; end if;
	-- Los comentarios de una recepción siguen a la vista al entregar de nuevo; se van al recibirla bien.
	if p ? 'comentarios' then
		nueva.comentarios := public.texto_o_nulo(p ->> 'comentarios');
	elsif nueva.estado = 'recibida' then
		nueva.comentarios := null;
	end if;
	if p ? 'enlace' then nueva.enlace := public.texto_o_nulo(p ->> 'enlace'); end if;
	if p ? 'acuseEnlace' then nueva.acuse_enlace := public.texto_o_nulo(p ->> 'acuseEnlace'); end if;

	if nueva.entrega_id is not null and nueva.entrega_id is distinct from actual.entrega_id
		and not exists (select 1 from public.personal where id = nueva.entrega_id and activo) then
		perform public.error_api('IC422', 'Seleccione a una persona activa para la entrega.');
	end if;
	if (nueva.enlace is not null and not public.enlace_sharepoint_valido(nueva.enlace))
		or (nueva.acuse_enlace is not null and not public.enlace_sharepoint_valido(nueva.acuse_enlace)) then
		perform public.error_api('IC422', 'Ingrese un enlace HTTPS de SharePoint.');
	end if;
	if length(nueva.comentarios) > 1000 then
		perform public.error_api('IC422', 'Los comentarios admiten hasta 1000 caracteres.');
	end if;

	-- Enlace y archivo son excluyentes; un archivo guardado se conserva mientras no se sustituya.
	if p ->> 'archivo' is not null then
		if p ? 'enlace' and nueva.enlace is not null then
			perform public.error_api('IC422', 'Use un enlace o un archivo para la carpeta.');
		end if;
		nueva.enlace := null;
		nueva.archivo_nombre := public.texto_o_nulo(p ->> 'archivoNombre');
		nueva.archivo := decode(p ->> 'archivo', 'base64');
		if nueva.archivo_nombre is null or length(nueva.archivo_nombre) > 255
			or octet_length(nueva.archivo) not between 1 and 8388608 then
			perform public.error_api('IC422', 'Seleccione un archivo válido de hasta 8 MiB.');
		end if;
	elsif nueva.enlace is not null or p ->> 'quitarArchivo' = 'true' then
		nueva.archivo_nombre := null;
		nueva.archivo := null;
	end if;
	if p ->> 'acuseArchivo' is not null then
		if p ? 'acuseEnlace' and nueva.acuse_enlace is not null then
			perform public.error_api('IC422', 'Use un enlace o un archivo para el acuse.');
		end if;
		nueva.acuse_enlace := null;
		nueva.acuse_archivo_nombre := public.texto_o_nulo(p ->> 'acuseArchivoNombre');
		nueva.acuse_archivo := decode(p ->> 'acuseArchivo', 'base64');
		if nueva.acuse_archivo_nombre is null or length(nueva.acuse_archivo_nombre) > 255
			or octet_length(nueva.acuse_archivo) not between 1 and 8388608 then
			perform public.error_api('IC422', 'Seleccione un acuse válido de hasta 8 MiB.');
		end if;
	elsif nueva.acuse_enlace is not null or p ->> 'quitarAcuse' = 'true' then
		nueva.acuse_archivo_nombre := null;
		nueva.acuse_archivo := null;
	end if;

	if nueva.estado in ('entregada', 'recibida_comentarios', 'recibida')
		and (nueva.entrega_id is null or nueva.fecha is null) then
		perform public.error_api('IC422',
			'Para entregar la carpeta, indique quién la entrega y la fecha de entrega.');
	end if;
	if nueva.estado in ('recibida_comentarios', 'recibida')
		and (nueva.recibe is null or nueva.fecha_recepcion is null) then
		perform public.error_api('IC422',
			'Para registrar la recepción, indique quién recibe y la fecha de recepción.');
	end if;
	-- Al entregar de nuevo una carpeta devuelta se conservan la recepción y los comentarios anteriores
	-- hasta la siguiente recepción: el orden de las fechas solo se exige al recibir.
	if nueva.estado in ('recibida_comentarios', 'recibida') and nueva.fecha_recepcion < nueva.fecha then
		perform public.error_api('IC422', 'La fecha de recepción no puede ser anterior a la de entrega.');
	end if;
	if nueva.estado = 'recibida_comentarios' and nueva.comentarios is null then
		perform public.error_api('IC422', 'Escriba los comentarios con los que se recibió la carpeta.');
	end if;
	if nueva.estado = 'recibida' and nueva.acuse_enlace is null and nueva.acuse_archivo is null then
		perform public.error_api('IC422',
			'Para cerrar la carpeta, agregue el acuse de recibido: un enlace o un archivo.');
	end if;

	insert into public.seguimiento_carpetas as c
		(mes_id, concepto_id, estado, entrega_id, recibe, fecha, enlace, archivo_nombre, archivo,
			fecha_recepcion, comentarios, acuse_enlace, acuse_archivo_nombre, acuse_archivo)
	values (id_mes, concepto, nueva.estado, nueva.entrega_id, nueva.recibe, nueva.fecha, nueva.enlace,
		nueva.archivo_nombre, nueva.archivo, nueva.fecha_recepcion, nueva.comentarios,
		nueva.acuse_enlace, nueva.acuse_archivo_nombre, nueva.acuse_archivo)
	on conflict (mes_id, concepto_id) do update set estado = excluded.estado,
		entrega_id = excluded.entrega_id, recibe = excluded.recibe, fecha = excluded.fecha,
		enlace = excluded.enlace, archivo_nombre = excluded.archivo_nombre, archivo = excluded.archivo,
		fecha_recepcion = excluded.fecha_recepcion, comentarios = excluded.comentarios,
		acuse_enlace = excluded.acuse_enlace, acuse_archivo_nombre = excluded.acuse_archivo_nombre,
		acuse_archivo = excluded.acuse_archivo, version = c.version + 1;
end
$$;

create or replace function public.api_guardar_seguimiento_operativo(p jsonb)
returns jsonb language plpgsql as $$
declare
	centro public.sitios;
	seguimiento public.seguimiento_meses;
	periodo date := (p ->> 'mes')::date;
	accion text := p ->> 'accion';
	fila text := p ->> 'actividad';
	concepto public.plantilla_conceptos;
	valor jsonb := nullif(p -> 'valor', 'null'::jsonb);
	fecha_captura date := (p ->> 'fecha')::date;
	veces integer := coalesce((p ->> 'veces')::integer, 1);
	partida_fila text;
	asistentes uuid[];
begin
	-- La plantilla asignada y todas las capturas de un centro se escriben en orden.
	select * into centro from public.sitios where id = (p ->> 'sitioId')::uuid for update;
	if not found then perform public.error_api('IC404', 'No encontrado'); end if;
	insert into public.seguimiento_meses as s (sitio_id, mes, plantilla_id, origen)
	select centro.id, periodo, centro.plantilla_id, coalesce((
		select origen_actividades from public.plantillas_seguimiento where id = centro.plantilla_id
	), 'ninguno') on conflict (sitio_id, mes) do update
	set plantilla_id = excluded.plantilla_id, origen = excluded.origen
	where s.plantilla_id is null and excluded.plantilla_id is not null;
	select * into seguimiento from public.seguimiento_meses where sitio_id = centro.id and mes = periodo;
	-- La edición de una plantilla no puede reinterpretar un concepto durante el guardado.
	perform 1 from public.plantillas_seguimiento where id = seguimiento.plantilla_id for share;
	perform 1 from public.conceptos_seguimiento_operativo(seguimiento.plantilla_id) c
		join public.plantilla_conceptos t on t.id = c.id order by t.id for share of t;
	if p ? 'plantillaId' and seguimiento.plantilla_id is distinct from (p ->> 'plantillaId')::uuid then
		perform public.error_api('IC409', 'Cambió la plantilla de seguimiento. Revise el mes actualizado.');
	end if;

	if accion in ('nuevaActividad', 'editarActividad', 'nuevaNocturna') and fecha_captura is not null
		and public.primer_dia_mes(fecha_captura) <> periodo then
		perform public.error_api('IC422', 'La fecha debe pertenecer al mes seleccionado.');
	end if;
	if accion in ('nuevaActividad', 'editarActividad', 'quitarActividad') then
		-- Una partida escrita a mano cabe donde hay actividades: capturadas cada mes o, fuera del
		-- programa, con programa anual.
		if seguimiento.origen = 'ninguno' then
			perform public.error_api('IC422', 'La plantilla no permite capturar actividades del mes.');
		end if;
		if accion = 'nuevaActividad' then
			if veces not between 1 and 31 then
				perform public.error_api('IC422', 'Indique de 1 a 31 ejecuciones en el mes.');
			end if;
			-- Una partida, `veces` actividades. La fecha, si viene, es la de la primera.
			partida_fila := 'm:' || (p ->> 'id')::uuid;
			insert into public.seguimiento_actividades (mes_id, clave, nombre, ordinal, fecha, grupo, manual)
			select seguimiento.id, case when veces = 1 then partida_fila else concat(partida_fila, ':', n) end,
				btrim(p ->> 'nombre'), case when veces > 1 then n end,
				case when n = 1 then fecha_captura end, partida_fila, true
			from generate_series(1, veces) n
			where not exists (select 1 from public.seguimiento_actividades a
				where a.mes_id = seguimiento.id and a.grupo = partida_fila)
			on conflict (mes_id, clave) do nothing;
		else
			select a.grupo into partida_fila from public.seguimiento_actividades a
			where a.mes_id = seguimiento.id and a.clave = fila and a.manual;
			if accion = 'editarActividad' then
				if partida_fila is null then perform public.error_api('IC404', 'Actividad no encontrada'); end if;
				-- El nombre es el de la partida; la fecha, la de la actividad señalada.
				update public.seguimiento_actividades a set nombre = btrim(p ->> 'nombre'),
					fecha = case when a.clave = fila then fecha_captura else a.fecha end
				where a.mes_id = seguimiento.id and a.grupo = partida_fila;
			else
				if partida_fila is null or exists (select 1 from public.seguimiento_actividades a
					where a.mes_id = seguimiento.id and a.grupo = partida_fila and (a.ejecutada
						or exists (select 1 from public.seguimiento_valores v
							where v.mes_id = a.mes_id and v.actividad = a.clave))) then
					perform public.error_api('IC409', 'La actividad no existe o ya tiene seguimiento.');
				end if;
				delete from public.seguimiento_actividades a
				where a.mes_id = seguimiento.id and a.grupo = partida_fila;
			end if;
		end if;
	elsif accion = 'nuevaNocturna' then
		asistentes := coalesce((
			select array_agg(distinct x::uuid) from jsonb_array_elements_text(
				case when jsonb_typeof(p -> 'asistentes') = 'array' then p -> 'asistentes' else '[]'::jsonb end) x
		), '{}');
		if exists (select 1 from unnest(asistentes) x(id)
			where not exists (select 1 from public.personal s where s.id = x.id and s.activo)) then
			perform public.error_api('IC422', 'Seleccione personas activas como asistentes.');
		end if;
		if length(btrim(p ->> 'descripcion')) > 1000 then
			perform public.error_api('IC422', 'La descripción admite hasta 1000 caracteres.');
		end if;
		insert into public.seguimiento_nocturnas (mes_id, id, fecha, hora_inicio, hora_fin, descripcion)
		values (seguimiento.id, (p ->> 'id')::uuid, fecha_captura, (p ->> 'horaInicio')::time,
			(p ->> 'horaFin')::time, public.texto_o_nulo(p ->> 'descripcion'))
		on conflict (mes_id, id) do nothing;
		if found then
			insert into public.seguimiento_nocturna_personal (mes_id, nocturna_id, personal_id)
			select seguimiento.id, (p ->> 'id')::uuid, x.id from unnest(asistentes) x(id);
		end if;
	elsif accion = 'quitarNocturna' then
		delete from public.seguimiento_nocturnas where mes_id = seguimiento.id and id = (p ->> 'id')::uuid;
	elsif accion = 'carpeta' then
		perform public.guardar_carpeta_seguimiento(seguimiento.id, seguimiento.plantilla_id, p);
	elsif accion in ('ejecucion', 'valor', 'marcarFila', 'marcarMes') then
		if fila is not null or accion = 'marcarMes' then
			insert into public.seguimiento_actividades (mes_id, clave, nombre, ordinal, fecha, grupo, manual)
			select seguimiento.id, a.clave, a.nombre, a.ordinal, a.fecha, a.grupo, a.manual
			from public.actividades_seguimiento(centro.id, periodo, seguimiento.origen, seguimiento.id) a
			where accion = 'marcarMes' or a.clave = fila
			on conflict (mes_id, clave) do nothing;
		end if;
		if accion in ('ejecucion', 'marcarFila') or fila is not null then
			if not exists (select 1 from public.seguimiento_actividades where mes_id = seguimiento.id and clave = fila) then
				perform public.error_api('IC404', 'Actividad no encontrada');
			end if;
		end if;
		if accion = 'ejecucion' then
			update public.seguimiento_actividades set ejecutada = (p ->> 'valor')::boolean
			where mes_id = seguimiento.id and clave = fila;
		elsif accion = 'valor' then
			select c.* into concepto from public.conceptos_seguimiento_operativo(seguimiento.plantilla_id) c
			where c.id = (p ->> 'conceptoId')::uuid and c.bloque <> 'carpetas'
				and case when fila is null then c.nivel = 'periodo' else c.nivel in ('actividad', 'partida') end;
			if not found then perform public.error_api('IC404', 'Concepto no encontrado'); end if;
			if concepto.nivel = 'partida' then
				-- Una vez por partida, en su primera actividad; lo que hubiera en las demás se retira.
				select a.grupo into partida_fila from public.seguimiento_actividades a
				where a.mes_id = seguimiento.id and a.clave = fila;
				if not exists (select 1
					from public.primeras_de_partida(centro.id, periodo, seguimiento.origen, seguimiento.id) f
					where f.grupo = partida_fila and f.clave = fila) then
					perform public.error_api('IC422',
						format('«%s» se captura una vez por partida, en su primera actividad.', concepto.etiqueta));
				end if;
				delete from public.seguimiento_valores v using public.seguimiento_actividades a
				where v.mes_id = seguimiento.id and v.concepto_id = concepto.id
					and a.mes_id = v.mes_id and a.clave = v.actividad
					and a.grupo = partida_fila and a.clave <> fila;
			end if;
			if valor is not null and not (case concepto.tipo
				when 'casilla' then jsonb_typeof(valor) = 'boolean'
				when 'estado' then valor #>> '{}' in ('pendiente', 'en_proceso', 'hecho')
				when 'cantidad' then case when jsonb_typeof(valor) = 'number' then (valor #>> '{}')::numeric >= 0 else false end
				when 'fecha' then jsonb_typeof(valor) = 'string' and (valor #>> '{}')::date is not null
				when 'enlace' then jsonb_typeof(valor) = 'string' and (valor #>> '{}') ~ '^https://'
				when 'texto' then jsonb_typeof(valor) = 'string'
				else false end) then
				perform public.error_api('IC422', 'El valor no corresponde al tipo de concepto.');
			end if;
			if valor is null or valor = 'false'::jsonb or valor = '"pendiente"'::jsonb then
				delete from public.seguimiento_valores v where v.mes_id = seguimiento.id
					and v.actividad is not distinct from fila and v.concepto_id = concepto.id;
			else
				insert into public.seguimiento_valores (mes_id, actividad, concepto_id, valor)
				values (seguimiento.id, fila, concepto.id, valor)
				on conflict (mes_id, actividad, concepto_id) do update set valor = excluded.valor;
			end if;
		else
			update public.seguimiento_actividades set ejecutada = true
			where mes_id = seguimiento.id and (accion = 'marcarMes' or clave = fila);
			-- Los conceptos por partida, solo en la primera actividad de cada una. Un concepto con
			-- indicador («Cobrada») no es un documento: no se marca en bloque.
			insert into public.seguimiento_valores (mes_id, actividad, concepto_id, valor)
			select seguimiento.id, destinos.clave, c.id,
				case when c.tipo = 'casilla' then 'true'::jsonb else '"hecho"'::jsonb end
			from public.conceptos_seguimiento_operativo(seguimiento.plantilla_id) c
			join lateral (
				select a.clave from public.seguimiento_actividades a where a.mes_id = seguimiento.id
					and (accion = 'marcarMes' or a.clave = fila)
					and (c.nivel = 'actividad' or (c.nivel = 'partida' and exists (select 1
						from public.primeras_de_partida(centro.id, periodo, seguimiento.origen, seguimiento.id) f
						where f.clave = a.clave)))
				union all
				select null::text where c.nivel = 'periodo' and accion = 'marcarMes'
			) destinos on true
			where c.tipo in ('casilla', 'estado') and c.indicador is null
			on conflict (mes_id, actividad, concepto_id) do update set valor = excluded.valor;
		end if;
	else
		perform public.error_api('IC422', 'Operación de seguimiento no válida.');
	end if;
	return '{}'::jsonb;
end
$$;

-- Archivo de la carpeta o, con `adjunto` = «acuse», el acuse de recibido.
create or replace function public.api_archivo_carpeta_seguimiento(p jsonb)
returns jsonb language sql stable as $$
	select case when p ->> 'adjunto' = 'acuse'
		then jsonb_build_object('nombre', c.acuse_archivo_nombre, 'datos', encode(c.acuse_archivo, 'base64'))
		else jsonb_build_object('nombre', c.archivo_nombre, 'datos', encode(c.archivo, 'base64')) end
	from public.seguimiento_carpetas c join public.seguimiento_meses m on m.id = c.mes_id
	where m.sitio_id = (p ->> 'sitioId')::uuid and m.mes = (p ->> 'mes')::date
		and c.concepto_id = (p ->> 'conceptoId')::uuid
		and case when p ->> 'adjunto' = 'acuse' then c.acuse_archivo is not null
			else c.archivo is not null end
$$;

-- El disparador de 0025 protege también lo que este cambio guarda por concepto: no hay tablas nuevas
-- que referencien conceptos (los adicionales no dependen de la plantilla).

-- ---------------------------------------------------------------------------------------------
-- Adicionales (D6) y monto cobrado derivado (D7)
-- ---------------------------------------------------------------------------------------------

-- Trabajos adicionales al contrato del centro de costo. Iguales para todos los centros: no dependen
-- de la plantilla. Administración llena lo pactado; contabilidad, lo cobrado.
create table public.adicionales (
	id uuid primary key,
	sitio_id uuid not null references public.sitios (id) on delete restrict,
	orden_compra text not null check (length(btrim(orden_compra)) between 1 and 100),
	descripcion text check (length(btrim(descripcion)) between 1 and 500),
	fecha_solicitud date,
	periodo_inicio date,
	periodo_fin date,
	monto_pactado numeric(14, 2) check (monto_pactado >= 0),
	monto_cobrado numeric(14, 2) check (monto_cobrado >= 0),
	creado_en timestamptz not null default now(),
	check (periodo_fin >= periodo_inicio)
);
create index adicionales_sitio_idx on public.adicionales (sitio_id);

-- Lo que devuelve depende de lo que el servidor declara visible, como en 0025. Con `verContrato`
-- van además los adicionales y `cobradoTotal`, la suma de la cobranza mensual de todos los años.
create or replace function public.api_obtener_contrato_cobranza(p jsonb)
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
			'id', c.id, 'bloque', c.bloque, 'tipo', c.tipo, 'etiqueta', c.etiqueta,
			'indicador', c.indicador, 'porDefinir', c.por_definir)
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
		'adicionales', coalesce((select jsonb_agg(jsonb_build_object('id', a.id,
			'ordenCompra', a.orden_compra, 'descripcion', a.descripcion,
			'fechaSolicitud', a.fecha_solicitud, 'periodoInicio', a.periodo_inicio,
			'periodoFin', a.periodo_fin, 'montoPactado', a.monto_pactado,
			'montoCobrado', a.monto_cobrado)
			order by a.creado_en, a.id)
			from public.adicionales a where a.sitio_id = centro.id), '[]'::jsonb),
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
				and extract(year from m.mes) = anio), '[]'::jsonb),
		'cobradoTotal', coalesce((select sum(m.monto_cobrado) from public.cobranza_meses m
			where m.sitio_id = centro.id), 0)
	));
end
$$;

create or replace function public.api_guardar_contrato_cobranza(p jsonb)
returns jsonb language plpgsql as $$
declare
	centro public.sitios;
	accion text := p ->> 'accion';
	orden uuid := (p ->> 'id')::uuid;
	enlace text := public.texto_o_nulo(p ->> 'enlace');
	fecha date := (p ->> 'fecha')::date;
	orden_adicional text := public.texto_o_nulo(p ->> 'ordenCompra');
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
		-- El monto cobrado ya no se captura aquí (D7): su valor anterior se conserva tal cual.
		delete from public.contrato_valores v where v.sitio_id = centro.id and v.concepto_id in (
			select c.id from public.plantilla_conceptos c
			where c.plantilla_id = centro.plantilla_id and c.bloque = 'contrato'
				and c.indicador is distinct from 'monto_cobrado');
		insert into public.contrato_valores (sitio_id, concepto_id, valor)
		select centro.id, n.concepto_id, n.valor
		from public.valores_concepto_validados(centro.plantilla_id, 'contrato', p -> 'valores') n
		where not exists (select 1 from public.plantilla_conceptos c
			where c.id = n.concepto_id and c.indicador = 'monto_cobrado');
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
	elsif accion in ('nuevoAdicional', 'editarAdicional') then
		-- Alta y edición no tocan lo cobrado: eso es de `cobroAdicional`.
		if orden_adicional is null or length(orden_adicional) > 100 then
			perform public.error_api('IC422', 'Escriba la orden de compra del adicional (hasta 100 caracteres).');
		end if;
		if length(btrim(p ->> 'descripcion')) > 500 then
			perform public.error_api('IC422', 'La descripción del adicional admite hasta 500 caracteres.');
		end if;
		if (p ->> 'periodoFin')::date < (p ->> 'periodoInicio')::date then
			perform public.error_api('IC422', 'El periodo de ejecución termina antes de empezar.');
		end if;
		if (p ->> 'montoPactado')::numeric not between 0 and 999999999999.99
			or (p ->> 'montoPactado')::numeric <> round((p ->> 'montoPactado')::numeric, 2) then
			perform public.error_api('IC422', 'El monto pactado no es válido.');
		end if;
		if accion = 'nuevoAdicional' then
			insert into public.adicionales (id, sitio_id, orden_compra, descripcion, fecha_solicitud,
				periodo_inicio, periodo_fin, monto_pactado)
			values (orden, centro.id, orden_adicional, public.texto_o_nulo(p ->> 'descripcion'),
				(p ->> 'fechaSolicitud')::date, (p ->> 'periodoInicio')::date,
				(p ->> 'periodoFin')::date, (p ->> 'montoPactado')::numeric)
			on conflict (id) do nothing;
			perform 1 from public.adicionales a where a.id = orden and a.sitio_id = centro.id;
		else
			update public.adicionales a set orden_compra = orden_adicional,
				descripcion = public.texto_o_nulo(p ->> 'descripcion'),
				fecha_solicitud = (p ->> 'fechaSolicitud')::date,
				periodo_inicio = (p ->> 'periodoInicio')::date,
				periodo_fin = (p ->> 'periodoFin')::date,
				monto_pactado = (p ->> 'montoPactado')::numeric
			where a.id = orden and a.sitio_id = centro.id;
		end if;
		if not found then perform public.error_api('IC404', 'Adicional no encontrado'); end if;
	elsif accion = 'quitarAdicional' then
		if exists (select 1 from public.adicionales a
			where a.id = orden and a.sitio_id = centro.id and a.monto_cobrado is not null) then
			perform public.error_api('IC409', 'El adicional ya tiene un cobro registrado; no se puede quitar.');
		end if;
		delete from public.adicionales a where a.id = orden and a.sitio_id = centro.id;
		if not found then perform public.error_api('IC404', 'Adicional no encontrado'); end if;
	elsif accion = 'cobroAdicional' then
		if (p ->> 'montoCobrado')::numeric not between 0 and 999999999999.99
			or (p ->> 'montoCobrado')::numeric <> round((p ->> 'montoCobrado')::numeric, 2) then
			perform public.error_api('IC422', 'El monto cobrado no es válido.');
		end if;
		update public.adicionales a set monto_cobrado = (p ->> 'montoCobrado')::numeric
		where a.id = orden and a.sitio_id = centro.id;
		if not found then perform public.error_api('IC404', 'Adicional no encontrado'); end if;
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

-- ---------------------------------------------------------------------------------------------
-- Resumen de estatus por centro de costo (D8)
-- ---------------------------------------------------------------------------------------------

-- Lo que un centro tiene hecho y pendiente en un mes: la materia prima de los KPI (las reglas están
-- en src/lib/dominio/estatus.ts). Los conceptos «por definir» no cuentan, y un concepto con
-- indicador se mide por su indicador, no como documento. Sin `ver_contrato` no sale nada financiero.
create function public.json_estatus_centro(centro public.sitios, periodo date, hoy date,
	ver_contrato boolean)
returns jsonb language plpgsql stable as $$
declare
	seguimiento public.seguimiento_meses;
	plantilla uuid;
	origen text;
	resultado jsonb;
	datos public.seguimiento_centros;
	cobranza public.cobranza_meses;
	fin date;
begin
	select * into seguimiento from public.seguimiento_meses where sitio_id = centro.id and mes = periodo;
	if seguimiento.plantilla_id is not null then
		plantilla := seguimiento.plantilla_id;
		origen := seguimiento.origen;
	else
		plantilla := centro.plantilla_id;
		select g.origen_actividades into origen from public.plantillas_seguimiento g where g.id = plantilla;
		origen := coalesce(origen, 'ninguno');
	end if;

	with actividades as materialized (
		select a.* from public.actividades_seguimiento(centro.id, periodo, origen, seguimiento.id) a
	), conceptos as materialized (
		select c.* from public.conceptos_seguimiento_operativo(plantilla) c where not c.por_definir
	), valores as materialized (
		select v.actividad, v.concepto_id, v.valor from public.seguimiento_valores v
		where v.mes_id = seguimiento.id
	), hechos as (
		select v.actividad, v.concepto_id from valores v
		where v.valor in ('true'::jsonb, '"hecho"'::jsonb)
	), documentos as (
		-- Por actividad ejecutada, por partida con alguna ejecución y, los del mes, una vez.
		select c.id, c.etiqueta, c.nivel, public.orden_bloque(c.bloque) as orden_bloque, c.orden,
			case c.nivel
				when 'actividad' then (select count(*) from actividades a where a.ejecutada)
				when 'partida' then (select count(distinct a.grupo) from actividades a where a.ejecutada)
				else 1 end as esperados,
			case c.nivel
				when 'actividad' then (select count(*) from actividades a where a.ejecutada
					and exists (select 1 from hechos h where h.actividad = a.clave and h.concepto_id = c.id))
				when 'partida' then (select count(distinct a.grupo) from actividades a where a.ejecutada
					and exists (select 1 from hechos h join actividades b on b.clave = h.actividad
						where b.grupo = a.grupo and h.concepto_id = c.id))
				else (select count(*) from hechos h where h.actividad is null and h.concepto_id = c.id)
				end as hechos
		from conceptos c
		where c.tipo in ('casilla', 'estado') and c.indicador is null
			and c.bloque in ('programa', 'documentos')
	)
	select jsonb_build_object(
		'sitioId', centro.id, 'plantillaId', plantilla, 'origen', origen,
		'mesTerminado', hoy >= (periodo + interval '1 month')::date,
		'actividades', (select jsonb_build_object(
			'programadas', count(*) filter (where a.programada),
			'ejecutadas', count(*) filter (where a.programada and a.ejecutada),
			'cobradas', case when exists (select 1 from conceptos c where c.indicador = 'actividad_cobrada')
				then count(*) filter (where a.programada and a.ejecutada and exists (
					select 1 from hechos h join conceptos c on c.id = h.concepto_id
					where h.actividad = a.clave and c.indicador = 'actividad_cobrada')) end)
			from actividades a),
		'em', case when exists (select 1 from conceptos c
			where c.indicador in ('em_programadas', 'em_realizadas', 'em_cobradas'))
			then (select jsonb_build_object(
				'programadas', max((v.valor #>> '{}')::numeric) filter (where c.indicador = 'em_programadas'),
				'realizadas', max((v.valor #>> '{}')::numeric) filter (where c.indicador = 'em_realizadas'),
				'cobradas', max((v.valor #>> '{}')::numeric) filter (where c.indicador = 'em_cobradas'))
				from conceptos c left join valores v on v.concepto_id = c.id and v.actividad is null
				where c.indicador in ('em_programadas', 'em_realizadas', 'em_cobradas')) end,
		'documentos', (select jsonb_build_object(
			'esperados', coalesce(sum(d.esperados), 0)::integer,
			'hechos', coalesce(sum(d.hechos), 0)::integer,
			'faltantes', coalesce(jsonb_agg(jsonb_build_object('conceptoId', d.id,
				'etiqueta', d.etiqueta, 'nivel', d.nivel, 'faltan', d.esperados - d.hechos)
				order by d.orden_bloque, d.orden)
				filter (where d.esperados > d.hechos), '[]'::jsonb))
			from documentos d),
		'carpetas', coalesce((select jsonb_agg(jsonb_build_object('conceptoId', c.id,
			'etiqueta', c.etiqueta, 'estado', coalesce(k.estado, 'pendiente'), 'porDefinir', c.por_definir)
			order by c.orden)
			from public.plantilla_conceptos c
				left join public.seguimiento_carpetas k on k.mes_id = seguimiento.id and k.concepto_id = c.id
			where c.plantilla_id = plantilla and c.bloque = 'carpetas'), '[]'::jsonb),
		'emergencias', (select count(*) from public.seguimiento_nocturnas n where n.mes_id = seguimiento.id)
	) into resultado;
	if not ver_contrato then return resultado; end if;

	select * into datos from public.seguimiento_centros where sitio_id = centro.id;
	select * into cobranza from public.cobranza_meses m where m.sitio_id = centro.id and m.mes = periodo;
	select max(k.vigencia_fin) into fin from public.contratos k
	join public.contrato_sitios cs on cs.contrato_id = k.id where cs.sitio_id = centro.id;
	return resultado || jsonb_build_object('finanzas', (
		with conceptos as materialized (
			select c.id, c.indicador, v.valor from public.plantilla_conceptos c
				left join public.contrato_valores v on v.concepto_id = c.id and v.sitio_id = centro.id
			where c.plantilla_id = centro.plantilla_id and c.bloque = 'contrato' and not c.por_definir
		)
		select jsonb_build_object(
			'montoContrato', (select (c.valor #>> '{}')::numeric from conceptos c
				where c.indicador = 'monto_contrato'),
			-- Solo la cobranza mensual (D7); lo cobrado de los adicionales va aparte.
			'cobrado', coalesce((select sum(m.monto_cobrado) from public.cobranza_meses m
				where m.sitio_id = centro.id), 0),
			'facturado', (select (c.valor #>> '{}')::numeric from conceptos c
				where c.indicador = 'monto_facturado'),
			'mes', jsonb_build_object('estimacion', coalesce(cobranza.estimacion, false),
				'prefactura', coalesce(cobranza.prefactura, false),
				'factura', coalesce(cobranza.factura, false), 'cobrado', coalesce(cobranza.cobrado, false)),
			'adicionales', (select jsonb_build_object('cantidad', count(*),
				'pactado', coalesce(sum(a.monto_pactado), 0), 'cobrado', coalesce(sum(a.monto_cobrado), 0))
				from public.adicionales a where a.sitio_id = centro.id),
			'contratoVencido', coalesce(fin < hoy, false),
			'cartaFaltante', coalesce(fin < hoy, false) and datos.carta_fecha is null,
			-- Datos que se esperan de un contrato obligatorio; los montos cobrado y facturado van aparte.
			'datosContrato', (select jsonb_build_object(
				'esperados', count(*) filter (where g.modo_contrato = 'obligatorio'),
				'capturados', count(*) filter (where c.valor is not null))
				from conceptos c
					join public.plantillas_seguimiento g on g.id = centro.plantilla_id
				where c.indicador is null or c.indicador not in ('monto_cobrado', 'monto_facturado'))
		)
	));
end
$$;

-- Una fila por centro de costo; `sitioIds` limita al alcance de quien consulta.
create function public.api_estatus_centros(p jsonb)
returns jsonb language sql stable as $$
	select coalesce(jsonb_agg(public.json_estatus_centro(t, (p ->> 'mes')::date, (p ->> 'hoy')::date,
		coalesce((p ->> 'verContrato')::boolean, false)) order by t.clave_normalizada), '[]'::jsonb)
	from public.sitios t
	where p -> 'sitioIds' is null or jsonb_typeof(p -> 'sitioIds') = 'null'
		or t.id in (select x::uuid from jsonb_array_elements_text(p -> 'sitioIds') x)
$$;

-- ---------------------------------------------------------------------------------------------
-- Seguridad: solo el rol de servicio
-- ---------------------------------------------------------------------------------------------

do $$
declare
	tabla text;
begin
	foreach tabla in array array['seguimiento_nocturna_personal', 'adicionales'] loop
		execute format('alter table public.%I enable row level security', tabla);
		if exists (select 1 from pg_roles where rolname = 'service_role') then
			execute format('revoke all on public.%I from public, anon, authenticated', tabla);
			execute format('grant select, insert, update, delete on public.%I to service_role', tabla);
			execute format('create policy servicio_acceso_total on public.%I for all to service_role using (true) with check (true)', tabla);
		end if;
	end loop;
	revoke execute on function public.indicador_valido(text, text, text, text),
		public.validar_carpeta_de_concepto(), public.api_complementar_plantillas(jsonb),
		public.actividades_seguimiento(uuid, date, text, uuid),
		public.primeras_de_partida(uuid, date, text, uuid),
		public.json_estatus_centro(public.sitios, date, date, boolean),
		public.api_estatus_centros(jsonb) from public;
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
