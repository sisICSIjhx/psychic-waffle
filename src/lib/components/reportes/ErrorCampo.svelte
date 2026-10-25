<!-- Error de un campo, junto a él. El campo lo enlaza con aria-describedby={id}. -->
<script lang="ts">
	export let id: string;
	export let mensaje = '';
</script>

{#if mensaje}
	<p {id} class="error-campo"><span class="icono" aria-hidden="true">!</span>{mensaje}</p>
{/if}

<style>
	.error-campo {
		display: flex;
		gap: 6px;
		align-items: baseline;
		margin: 4px 0 0;
		color: var(--danger);
		font-size: 0.85rem;
		font-weight: 500;
	}
	.icono {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--danger);
		color: var(--surface);
		font-size: 0.7rem;
		font-weight: 700;
	}
</style>
