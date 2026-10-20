// Implementación Supabase: llama las mismas funciones api_* por rpc con la clave de servicio, que
// solo existe en el servidor. Las migraciones se aplican con la CLI de Supabase (tarea 3.8).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { convertirError, validarFuncion, type ClienteSql } from './cliente.ts';

export function crearClienteSupabase(url: string, claveServicio: string): ClienteSql {
	if (!url || !claveServicio)
		throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
	const supabase: SupabaseClient = createClient(url, claveServicio, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	return {
		async llamar<T>(funcion: string, argumentos: Record<string, unknown> = {}): Promise<T> {
			validarFuncion(funcion);
			const { data, error } = await supabase.rpc(funcion, { p: argumentos });
			if (error) throw convertirError(error);
			return data as T;
		}
	};
}
