import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { datos } from '$lib/server/datos';
import { centroDeSeguimiento, mesDeSeguimiento } from '$lib/server/seguimiento';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const sitioId = centroDeSeguimiento(locals, url.searchParams.get('centro'));
	const mes = mesDeSeguimiento(url.searchParams.get('mes'));
	const concepto = z.uuid().safeParse(params.concepto);
	if (!concepto.success) error(404, 'No encontrado');
	const archivo = await (await datos()).seguimiento.archivo(sitioId, mes, concepto.data);
	if (!archivo) error(404, 'No encontrado');
	const nombre = encodeURIComponent(Buffer.from(archivo.nombre).toString('utf8')).replace(
		/['()*]/g,
		(c) => `%${c.charCodeAt(0).toString(16)}`
	);
	return new Response(Uint8Array.from(Buffer.from(archivo.datos, 'base64')), {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': `attachment; filename*=UTF-8''${nombre}`,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
