<script lang="ts">
	import NavegacionMes from '$lib/components/ui/NavegacionMes.svelte';

	/**
	 * Dónde se está trabajando: centro de costo y mes. Formulario GET que se envía al cambiar el
	 * centro; sin JavaScript muestra «Consultar».
	 */
	interface Paso {
		href: string;
		texto: string;
		nombre: string;
	}

	/** Ruta de la página, ya resuelta. */
	export let ruta: string;
	export let centros: { id: string; clave: string; nombre?: string | null }[];
	export let centroId: string;
	/** Nombre del parámetro del periodo («mes» o «anio») y su valor actual. */
	export let parametro = 'mes';
	export let valor: string;
	/** Lo que recibe `NavegacionMes`. */
	export let periodo: {
		anterior: Paso | null;
		siguiente: Paso | null;
		titulo: string;
		actual?: boolean;
		etiqueta?: string;
	};

	const nombreDe = (centro: { clave: string; nombre?: string | null }) =>
		centro.nombre ? `${centro.clave} · ${centro.nombre}` : centro.clave;

	$: unico = centros.length === 1 ? centros[0] : null;
</script>

<div class="barra-contexto">
	{#if unico}
		<p class="centro-unico">
			<span class="etiqueta">Centro de costo</span>
			<strong>{nombreDe(unico)}</strong>
		</p>
	{:else}
		<form method="GET" action={ruta} class="centro" data-sveltekit-keepfocus>
			<label for="contexto-centro">Centro de costo</label>
			<div class="control">
				<select
					id="contexto-centro"
					name="centro"
					value={centroId}
					on:change={(evento) => evento.currentTarget.form?.requestSubmit()}
				>
					{#each centros as opcion (opcion.id)}
						<option value={opcion.id}>{nombreDe(opcion)}</option>
					{/each}
				</select>
				<input type="hidden" name={parametro} value={valor} />
				<noscript><button class="boton">Consultar</button></noscript>
			</div>
		</form>
	{/if}
	<div class="periodo">
		<NavegacionMes {...periodo} />
	</div>
</div>

<style>
	.barra-contexto {
		display: grid;
		gap: 12px;
		margin-bottom: 16px;
		min-width: 0;
	}
	.centro,
	.centro-unico {
		display: grid;
		gap: 6px;
		margin: 0;
		min-width: 0;
	}
	label,
	.etiqueta {
		font-size: var(--texto-sm);
		font-weight: 600;
		color: var(--tinta);
	}
	.centro-unico strong {
		font-size: var(--texto-md);
		overflow-wrap: anywhere;
	}
	.control {
		display: flex;
		gap: 8px;
		min-width: 0;
	}
	select {
		flex: 1 1 auto;
		width: 100%;
		min-width: 0;
		min-height: 44px;
		text-overflow: ellipsis;
	}
	.control :global(.boton) {
		min-height: 44px;
	}
	@media (min-width: 900px) {
		.barra-contexto {
			grid-template-columns: minmax(0, 26rem) minmax(0, 22rem);
			align-items: end;
			justify-content: space-between;
			gap: 16px 32px;
			margin-bottom: 24px;
		}
	}
</style>
