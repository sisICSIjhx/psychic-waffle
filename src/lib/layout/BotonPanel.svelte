<script lang="ts">
	export let abierto: boolean;

	$: etiqueta = abierto ? 'Colapsar panel lateral' : 'Expandir panel lateral';
</script>

<button
	id="control-panel-lateral"
	type="button"
	aria-label={etiqueta}
	aria-expanded={abierto}
	aria-controls="menu-principal"
	title={etiqueta}
	on:click
>
	<svg
		aria-hidden="true"
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"
	>
		<rect x="2.5" y="3.5" width="19" height="17" rx="1.5" />
		<path d={abierto ? 'M9.5 3.5v17' : 'M6.5 3.5v17'} />
		{#if abierto}
			<g fill="currentColor" stroke="none">
				<circle cx="6" cy="8" r="1" />
				<circle cx="6" cy="12" r="1" />
				<circle cx="6" cy="16" r="1" />
			</g>
		{/if}
	</svg>
</button>

<style>
	button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: var(--radio-control);
		background: transparent;
		color: var(--tinta-secundaria);
		cursor: pointer;
	}
	button:hover {
		background: var(--superficie-hover);
		color: var(--tinta);
	}
	@media (max-width: 768px) {
		button {
			width: 44px;
			height: 44px;
			margin-inline-start: -2px;
		}
	}
</style>
