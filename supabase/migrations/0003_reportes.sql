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
