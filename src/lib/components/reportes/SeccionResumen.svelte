<!-- Sección que viene del catálogo y casi no cambia: se muestra como resumen de lectura con
     «Editar». Se abre sola mientras tenga datos pendientes, y sus campos solo se montan abierta. -->
<script lang="ts">
	import { plural } from '$lib/dominio/textos';

	/** `id` de la sección; el título usa `<id>-titulo` y los campos `<id>-campos`. */
	export let id: string;
	export let titulo: string;
	export let pendientes = 0;
	export let editable = true;
	export let abierta = false;

	$: conCampos = editable && (abierta || pendientes > 0);
</script>

<section {id} class="card seccion-resumen" aria-labelledby={`${id}-titulo`}>
	<div class="cabecera-seccion">
		<h2 id={`${id}-titulo`} class="view-heading" tabindex="-1">{titulo}</h2>
		{#if pendientes > 0}
			<span class="pendientes-seccion"
				><span aria-hidden="true">!</span> {plural(pendientes, 'pendiente')}</span
			>
		{:else if editable}
			<button
				class="boton"
				type="button"
				aria-expanded={abierta}
				aria-controls={abierta ? `${id}-campos` : undefined}
				on:click={() => (abierta = !abierta)}>{abierta ? 'Listo' : 'Editar'}</button
			>
		{/if}
	</div>
	{#if conCampos}
		<div id={`${id}-campos`}><slot /></div>
	{:else}
		<div class="resumen-seccion"><slot name="resumen" /></div>
	{/if}
</section>

<style>
	.cabecera-seccion {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 12px;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}
	.cabecera-seccion .view-heading {
		margin: 0;
	}
	.pendientes-seccion {
		color: var(--danger);
		font-size: 0.85rem;
		font-weight: 600;
	}
	.resumen-seccion {
		color: var(--text);
		font-size: 0.9rem;
	}
</style>
