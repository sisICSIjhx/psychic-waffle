-- 0010_documento_version.sql
-- Corrección de la revisión de la fase 5: el documento se registra con la versión del reporte con la
-- que se generó. Si el reporte cambió mientras se generaba (p. ej. un autoguardado), se rechaza con
-- un conflicto en lugar de asociar el contenido anterior a la versión nueva.

create or replace function public.api_registrar_documento(p jsonb)
returns jsonb
language plpgsql
as $$
declare
	actual public.reportes;
	fila public.documentos_generados;
begin
	select * into actual from public.reportes where id = (p ->> 'reporteId')::uuid for update;
	if actual.id is null then
		perform public.error_api('IC404', 'Reporte no encontrado', jsonb_build_object('id', p ->> 'reporteId'));
	end if;
	if p ? 'reporteVersion' and actual.version <> (p ->> 'reporteVersion')::integer then
		perform public.error_api('IC409', 'El reporte cambió mientras se generaba el documento',
			jsonb_build_object('motivo', 'version', 'versionActual', actual.version));
	end if;
	insert into public.documentos_generados (reporte_id, reporte_version, version_plantilla, ruta,
		nombre_archivo, bytes)
	values (actual.id, actual.version, p ->> 'versionPlantilla', p ->> 'ruta', p ->> 'nombreArchivo',
		(p ->> 'bytes')::integer)
	returning * into fila;
	return jsonb_build_object('id', fila.id, 'reporteId', fila.reporte_id, 'reporteVersion', fila.reporte_version,
		'versionPlantilla', fila.version_plantilla, 'ruta', fila.ruta, 'nombreArchivo', fila.nombre_archivo,
		'bytes', fila.bytes, 'generadoEn', fila.generado_en);
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
