<script lang="ts">
	/**
	 * Paso entre meses (o años) con dos enlaces y el actual al centro: funciona sin JavaScript.
	 * `texto` es lo que se ve («oct») y `nombre` lo que se anuncia («octubre 2026»).
	 */
	interface Paso {
		href: string;
		texto: string;
		nombre: string;
	}

	export let anterior: Paso | null = null;
	export let siguiente: Paso | null = null;
	export let titulo: string;
	/** El mes mostrado es el mes en curso. */
	export let actual = false;
	/** Nombre de la región para lectores de pantalla. */
	export let etiqueta = 'Cambiar de mes';
</script>

<nav class="navegacion-mes" aria-label={etiqueta}>
	<!-- Las rutas llegan resueltas por la página que usa el componente. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	{#if anterior}
		<a class="paso" href={anterior.href} aria-label={`Ir a ${anterior.nombre}`}>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.25"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg
			>
			<span>{anterior.texto}</span>
		</a>
	{:else}
		<span class="paso hueco" aria-hidden="true"></span>
	{/if}
	<p class="titulo" aria-current={actual ? 'date' : undefined}>
		<strong>{titulo}</strong>
		{#if actual}<span class="nota">(mes actual)</span>{/if}
	</p>
	{#if siguiente}
		<a class="paso fin" href={siguiente.href} aria-label={`Ir a ${siguiente.nombre}`}>
			<span>{siguiente.texto}</span>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.25"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg
			>
		</a>
	{:else}
		<span class="paso hueco" aria-hidden="true"></span>
	{/if}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</nav>

<style>
	.navegacion-mes {
		display: grid;
		grid-template-columns: minmax(64px, auto) minmax(0, 1fr) minmax(64px, auto);
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.paso {
		display: inline-flex;
		align-items: center;
		justify-content: flex-start;
		gap: 4px;
		min-width: 44px;
		min-height: 44px;
		padding: 0 10px;
		border: 1px solid var(--linea-fuerte);
		border-radius: var(--radio-control);
		background: var(--superficie);
		color: var(--accion);
		font-size: var(--texto-sm);
		font-weight: 600;
		white-space: nowrap;
	}
	.paso.fin {
		justify-content: flex-end;
	}
	.paso.hueco {
		border-color: transparent;
		background: none;
	}
	a.paso:hover {
		background: var(--accion-suave);
		border-color: var(--accion);
		color: var(--accion-hover);
	}
	svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}
	.titulo {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 0 6px;
		margin: 0;
		min-width: 0;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.titulo strong {
		font-family: var(--fuente-titulos);
		font-size: var(--texto-md);
		font-weight: var(--peso-encabezado);
	}
	.nota {
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
</style>
