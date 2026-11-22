<!-- «Qué falta»: cada pendiente es un enlace al lugar donde se resuelve (44 px de alto, con chevrón).
     Un elemento sin `href` se muestra como texto. Sin elementos, el mensaje de `vacio`. -->
<script lang="ts">
	export let elementos: { texto: string; href: string | null }[] = [];
	/** Lo que se dice cuando no falta nada (o todavía no hay datos). */
	export let vacio: string;
</script>

<div class="que-falta">
	<p class="rotulo-grupo" aria-hidden={elementos.length ? 'true' : undefined}>Qué falta</p>
	{#if elementos.length}
		<ul aria-label="Qué falta">
			<!-- Las rutas llegan resueltas por quien arma la lista (elementosQueFalta). -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			{#each elementos as elemento, i (i)}
				<li>
					{#if elemento.href}
						<a href={elemento.href}>
							<span>{elemento.texto}</span>
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
						<span class="texto">{elemento.texto}</span>
					{/if}
				</li>
			{/each}
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</ul>
	{:else}
		<p class="view-note vacio">{vacio}</p>
	{/if}
</div>

<style>
	.que-falta {
		min-width: 0;
	}
	ul {
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
	}
	li + li {
		border-top: 1px solid var(--linea);
	}
	a,
	.texto {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 44px;
		padding: 6px 0;
		font-size: var(--texto-base);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	a {
		border-radius: var(--radio-control);
		color: var(--tinta);
	}
	a:hover {
		color: var(--accion);
	}
	a:hover span {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	a span {
		min-width: 0;
	}
	.texto {
		color: var(--tinta-secundaria);
		font-weight: 400;
	}
	svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		color: var(--tinta-tenue);
	}
	.vacio {
		margin-top: 6px;
		font-size: var(--texto-base);
	}
</style>
