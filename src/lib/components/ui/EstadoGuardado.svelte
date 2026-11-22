<script lang="ts">
	/** Resultado de guardar junto a donde se hizo el cambio: ocupa siempre una línea, sin saltos. */
	export let estado: 'reposo' | 'enviando' | 'guardado' = 'reposo';
	/** Lo que se dice al terminar; por omisión, «Guardado». */
	export let mensaje = 'Guardado';
</script>

<p class="estado-guardado" class:guardado={estado === 'guardado'} role="status">
	{#if estado === 'enviando'}
		Guardando…
	{:else if estado === 'guardado'}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.25"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg
		>
		<span>{mensaje}</span>
	{/if}
</p>

<style>
	.estado-guardado {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 20px;
		margin: 0;
		color: var(--tinta-secundaria);
		font-size: var(--texto-sm);
		font-weight: 600;
		line-height: 20px;
	}
	.guardado {
		color: var(--exito);
	}
	svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}
</style>
