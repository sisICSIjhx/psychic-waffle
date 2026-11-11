<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ESTADOS_CARPETA } from '$lib/dominio/seguimiento-operativo';
	import { textoFechaCorta } from '$lib/dominio/equipos';
	import type { SeguimientoOperativo } from '$lib/server/repositorios/seguimiento';

	export let concepto: SeguimientoOperativo['conceptos'][number];
	export let carpeta: SeguimientoOperativo['carpetas'][number] | undefined;
	export let personal: SeguimientoOperativo['personal'];
	export let urlGuardar: string;
	export let urlArchivo: string;
	export let plantillaId: string | null;
	export let puedeEditar: boolean;
	export let enviar: SubmitFunction;

	$: estado = carpeta?.estado ?? 'pendiente';
	$: entregaInactiva = carpeta?.entregaId && !personal.some((p) => p.id === carpeta?.entregaId);
</script>

<article class="carpeta" aria-labelledby={`carpeta-${concepto.id}`}>
	<div class="encabezado">
		<h3 id={`carpeta-${concepto.id}`}>{concepto.etiqueta}</h3>
		<span class="status-badge" class:entregada={estado === 'entregada'}
			>{ESTADOS_CARPETA[estado]}</span
		>
	</div>
	{#if carpeta}
		<dl>
			<div>
				<dt>Entrega</dt>
				<dd>{carpeta.entregaNombre ?? '—'}</dd>
			</div>
			<div>
				<dt>Recibe</dt>
				<dd>{carpeta.recibe ?? '—'}</dd>
			</div>
			<div>
				<dt>Fecha de entrega</dt>
				<dd>{textoFechaCorta(carpeta.fecha)}</dd>
			</div>
		</dl>
		<!-- El enlace de SharePoint es externo y la descarga llega resuelta por la página. -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		{#if carpeta.enlace}
			<a class="enlace" href={carpeta.enlace} target="_blank" rel="noopener noreferrer"
				>Abrir en SharePoint</a
			>
		{:else if carpeta.archivoNombre}
			<a class="enlace" href={urlArchivo} download>{carpeta.archivoNombre}</a>
		{/if}
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}
	{#if puedeEditar}
		<details>
			<summary>{carpeta ? 'Editar entrega' : 'Registrar entrega'}</summary>
			{#key carpeta?.version}
				<form method="POST" action={urlGuardar} enctype="multipart/form-data" use:enhance={enviar}>
					<input type="hidden" name="accion" value="carpeta" />
					<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
					<input type="hidden" name="conceptoId" value={concepto.id} />
					<input type="hidden" name="version" value={carpeta?.version ?? 0} />
					<div class="campos">
						<div class="form-group">
							<label for={`estado-${concepto.id}`}>Estado</label>
							<select id={`estado-${concepto.id}`} name="estado" value={estado}>
								{#each Object.entries(ESTADOS_CARPETA) as [valor, texto] (valor)}
									<option value={valor}>{texto}</option>
								{/each}
							</select>
						</div>
						<div class="form-group">
							<label for={`entrega-${concepto.id}`}>Quién entrega</label>
							<select
								id={`entrega-${concepto.id}`}
								name="entregaId"
								value={carpeta?.entregaId ?? ''}
							>
								<option value="">Seleccione del personal</option>
								{#if entregaInactiva}
									<option value={carpeta?.entregaId}>{carpeta?.entregaNombre}</option>
								{/if}
								{#each personal as persona (persona.id)}
									<option value={persona.id}>{persona.nombre}</option>
								{/each}
							</select>
						</div>
						<label class="form-group">
							Quién recibe
							<input name="recibe" maxlength="200" value={carpeta?.recibe ?? ''} />
						</label>
						<label class="form-group">
							Fecha de entrega
							<input type="date" name="fecha" value={carpeta?.fecha ?? ''} />
						</label>
						<label class="form-group">
							Enlace de SharePoint
							<input type="url" name="enlace" maxlength="2048" value={carpeta?.enlace ?? ''} />
						</label>
						<label class="form-group">
							Archivo (hasta 8 MiB)
							<input type="file" name="archivo" />
						</label>
					</div>
					<p class="view-note">Para subir un archivo, deja vacío el enlace.</p>
					{#if carpeta?.archivoNombre}
						<label class="quitar"
							><input type="checkbox" name="quitarArchivo" /> Quitar archivo actual</label
						>
					{/if}
					<button class="boton primario">Guardar entrega</button>
				</form>
			{/key}
		</details>
	{/if}
</article>

<style>
	.carpeta {
		border: 1px solid var(--linea);
		border-radius: 0.75rem;
		padding: 1rem;
		min-width: 0;
	}
	.encabezado,
	dl {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 1.5rem;
		align-items: baseline;
	}
	.entregada {
		color: var(--exito);
		background: var(--exito-fondo);
	}
	dl {
		margin: 0.6rem 0;
	}
	dt {
		font-size: 0.82rem;
	}
	dd {
		margin: 0;
	}
	summary {
		cursor: pointer;
		margin: 0.75rem 0;
	}
	.campos {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
		gap: 0.65rem;
	}
	.quitar {
		display: block;
		margin-bottom: 0.65rem;
	}
	.enlace {
		overflow-wrap: anywhere;
	}
</style>
