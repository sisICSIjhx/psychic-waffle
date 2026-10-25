-- 0014_listar_reportes_orden_estable.sql
-- Corrección de la revisión de Codex (fase C, ronda 1): el historial se pagina con OFFSET y el orden
-- por periodo y fecha de actualización no era total; con empates en el límite de una página,
-- PostgreSQL podía devolverlos en distinto orden entre consultas y listarTodos duplicar u omitir
-- filas. Se desempata por id. Misma firma y resultado que 0013.

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
			select jsonb_agg(fila order by orden_periodo desc, orden_actualizado desc, orden_id)
			from (
				select f.periodo_mes as orden_periodo, f.actualizado_en as orden_actualizado, f.id as orden_id,
					jsonb_build_object(
						'id', f.id, 'partidaId', f.partida_id, 'sitioId', f.sitio_id,
						'titulo', f.titulo, 'clienteClave', f.cliente_clave, 'usuario', f.usuario,
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
				order by f.periodo_mes desc, f.actualizado_en desc, f.id
				offset ((select numero from pagina) - 1) * (select tamano from pagina)
				limit (select tamano from pagina)
			) paginadas
		), '[]'::jsonb)
	)
$$;
