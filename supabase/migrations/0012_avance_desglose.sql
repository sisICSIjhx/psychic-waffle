-- 0012_avance_desglose.sql
-- Corrección de la revisión de la fase 6 (ronda 2): cada celda del avance separa las ejecuciones que
-- vienen de reportes emitidos (varios reportes por TAG cuentan una) de lo realizado sin reporte
-- (marcas R del Excel y realizados capturados a mano), para no inferirlo restando documentos.

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
						'realizadoSinReporte', coalesce(v.cantidad_manual, 0)
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

-- Las funciones nuevas siguen la política de 0004: solo el rol de servicio las ejecuta.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'service_role') then
		revoke execute on all functions in schema public from public, anon, authenticated;
		grant execute on all functions in schema public to service_role;
	end if;
end
$$;
