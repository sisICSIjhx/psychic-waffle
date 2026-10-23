// Permisos de las acciones de edición del contrato: sin permiso se responde 403 sin abrir la base.
import { describe, expect, it, vi } from 'vitest';

const datos = vi.fn();
vi.mock('$lib/server/datos', () => ({ datos, almacenamiento: () => '' }));

const { actions } = await import('./+page.server');

const capturista = {
	autenticacion: true,
	usuario: { id: '00000000-0000-4000-8000-000000000001', nombre: 'Ficticia', rol: 'capturista' }
} as const;

function evento(campos: Record<string, string>) {
	const formulario = new FormData();
	for (const [campo, valor] of Object.entries(campos)) formulario.set(campo, valor);
	return {
		request: new Request('http://localhost/catalogo/contratos/x', {
			method: 'POST',
			body: formulario
		}),
		params: { id: '00000000-0000-4000-8000-000000000002' },
		locals: capturista
	} as never;
}

describe('acciones del contrato sin permiso', () => {
	it.each(['ensayarCambio', 'aplicarCambio', 'registrarFirmante', 'asociarSitio'] as const)(
		'%s responde 403 sin llamar a la base',
		async (accion) => {
			const resultado = await actions[accion](
				evento({ tipo: 'contrato', motivo: 'Motivo suficiente', usuarioId: 'otro' })
			);
			expect(resultado).toMatchObject({
				status: 403,
				data: { error: 'No tiene permiso para editar el catálogo.' }
			});
			expect(datos).not.toHaveBeenCalled();
		}
	);
});
