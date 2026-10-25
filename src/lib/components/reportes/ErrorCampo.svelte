<!-- Error de un campo, junto a él. El campo lo enlaza con aria-describedby={id}. -->
<script lang="ts">
	export let id: string;
	export let mensaje = '';
</script>

{#if mensaje}
	<p {id} class="error-campo">
		<svg
			class="icono"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.25"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" /></svg
		>{mensaje}
	</p>
{/if}

<style>
	.error-campo {
		display: flex;
		gap: 6px;
		align-items: flex-start;
		margin: 4px 0 0;
		color: var(--peligro);
		font-size: var(--texto-sm);
		font-weight: 500;
	}
	.icono {
		flex-shrink: 0;
		width: 14px;
		height: 14px;
		margin-top: 2px;
	}
</style>
