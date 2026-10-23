<!-- «Historial de cambios» del contrato: registros de la bitácora del contrato, sus firmantes y sus
     sitios (también los hechos desde otro contrato que comparte el sitio), del más reciente al más
     antiguo, en páginas de 20 que funcionan sin JavaScript (?cambios=N). -->
<script lang="ts">
	import {
		describirCambio,
		ETIQUETA_ACCION,
		ETIQUETA_CAMPO,
		ETIQUETA_ENTIDAD,
		fechaHoraLocal,
		resumenEfectos
	} from '$lib/dominio/bitacora';
	import type { PaginaCambios } from '$lib/dominio/esquemas';

	export let cambios: PaginaCambios;
	export let abierto = false;
	/** Enlace a una página del historial que conserva el resto de la dirección. */
	export let enlacePagina: (pagina: number) => string = (pagina) => `?cambios=${pagina}`;

	$: paginas = Math.max(1, Math.ceil(cambios.total / cambios.tamano));

	function que(fila: PaginaCambios['filas'][number]): string {
		const campos = fila.cambios.map((c) => ETIQUETA_CAMPO[c.campo] ?? c.campo);
		const entidad = ETIQUETA_ENTIDAD[fila.entidad] ?? fila.entidad;
		return fila.accion === 'editar'
			? `${entidad} · ${campos.join(', ')}`
			: `${entidad} · ${ETIQUETA_ACCION[fila.accion] ?? fila.accion}`;
	}
</script>

<details class="historial" open={abierto}>
	<summary>Historial de cambios ({cambios.total})</summary>
	{#if cambios.total === 0}
		<p class="view-note">Sin cambios registrados.</p>
	{:else}
		<div class="tabla-desplazable">
			<table>
				<thead>
					<tr>
						<th>Fecha</th>
						<th>Qué cambió</th>
						<th>Antes → después</th>
						<th>Motivo</th>
						<th>Usuario</th>
						<th>Efectos</th>
					</tr>
				</thead>
				<tbody>
					{#each cambios.filas as fila (fila.id)}
						<tr>
							<td class="fecha">{fechaHoraLocal(fila.realizadoEn)}</td>
							<td>{que(fila)}</td>
							<td>
								<ul class="lista">
									{#each fila.cambios as cambio (cambio.campo)}<li>
											{describirCambio(cambio)}
										</li>{/each}
								</ul>
							</td>
							<td>{fila.motivo ?? '—'}</td>
							<td>{fila.usuarioTexto ?? '—'}</td>
							<td>
								{resumenEfectos(fila.efectos).join(', ') || '—'}{fila.origen === 'script'
									? ' (desde un script)'
									: ''}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if paginas > 1}
			<nav class="paginas" aria-label="Páginas del historial">
				<!-- enlacePagina ya aplica resolve() a la ruta; la página va en la consulta. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				{#if cambios.pagina > 1}
					<a class="enlace" href={enlacePagina(cambios.pagina - 1)}>Más recientes</a>
				{/if}
				<span>Página {cambios.pagina} de {paginas}</span>
				{#if cambios.pagina < paginas}
					<a class="enlace" href={enlacePagina(cambios.pagina + 1)}>Anteriores</a>
				{/if}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</nav>
		{/if}
	{/if}
</details>

<style>
	.historial summary {
		cursor: pointer;
		font-weight: 600;
	}
	.lista {
		margin: 0;
		padding-left: 16px;
		overflow-wrap: anywhere;
	}
	.fecha {
		white-space: nowrap;
	}
	.paginas {
		display: flex;
		gap: 12px;
		align-items: center;
		margin-top: 8px;
		font-size: 0.9rem;
	}
</style>
