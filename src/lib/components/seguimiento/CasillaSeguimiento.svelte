<script lang="ts">
	export let etiqueta: string;
	export let marcada: boolean;
	export let puedeEditar: boolean;
</script>

{#if puedeEditar}
	<button
		type="submit"
		role="checkbox"
		aria-checked={marcada}
		aria-label={etiqueta}
		name="valor"
		value={String(!marcada)}
		class:marcada
	>
		<span aria-hidden="true">{marcada ? '✓' : ''}</span>
	</button>
{:else}
	<span class="estado">
		<span class="sr-only">{etiqueta} · {marcada ? 'Hecho' : 'Pendiente'}</span>
		<span aria-hidden="true">{marcada ? '✓' : '—'}</span>
	</span>
{/if}

<style>
	button,
	.estado {
		display: inline-grid;
		place-items: center;
		min-width: 2rem;
		min-height: 2rem;
		font-weight: 700;
	}

	button {
		cursor: pointer;
		border: 1px solid var(--borde-campo);
		border-radius: 0.45rem;
	}

	button.marcada {
		color: var(--exito);
		background: var(--exito-fondo);
	}
</style>
