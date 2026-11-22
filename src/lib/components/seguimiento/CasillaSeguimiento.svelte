<script lang="ts">
	/**
	 * Casilla que se guarda al tocarla: un botón de envío con el nombre a la vista. Va dentro del
	 * formulario de su valor; envía el estado contrario al actual.
	 */
	/** Lo que se lee en la casilla: el nombre del documento o «Ejecutada». */
	export let etiqueta: string;
	/** Se suma al nombre accesible para distinguir casillas repetidas («Partida X, ejecución 1»). */
	export let contexto = '';
	export let marcada: boolean;
	export let puedeEditar: boolean;
	export let porDefinir = false;
	export let ancha = false;
	/** Campo que envía la casilla; por omisión `valor` con el estado contrario al actual. */
	export let nombreCampo = 'valor';
	export let valorCampo: string | null = null;

	$: nombre = contexto ? `${etiqueta} · ${contexto}` : etiqueta;
</script>

{#if puedeEditar}
	<button
		type="submit"
		role="checkbox"
		aria-checked={marcada}
		aria-label={porDefinir ? `${nombre} (por definir)` : nombre}
		name={nombreCampo}
		value={valorCampo ?? String(!marcada)}
		class="casilla"
		class:marcada
		class:ancha
	>
		<span class="recuadro" aria-hidden="true">
			{#if marcada}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg
				>
			{/if}
		</span>
		<span class="texto">{etiqueta}</span>
		{#if porDefinir}<span class="status-badge por-definir info">Por definir</span>{/if}
	</button>
{:else}
	<span class="lectura" class:marcada>
		<span aria-hidden="true">{marcada ? '✓' : '—'}</span>
		<span class="texto">{etiqueta}</span>
		<span class="sr-only"
			>{contexto ? `· ${contexto} ` : ''}· {marcada ? 'Hecho' : 'Pendiente'}</span
		>
		{#if porDefinir}<span class="status-badge por-definir info">Por definir</span>{/if}
	</span>
{/if}

<style>
	.casilla {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 44px;
		padding: 8px 14px;
		border: 1px solid var(--borde-campo);
		border-radius: var(--radio-control);
		background: var(--campo-fondo);
		color: var(--tinta);
		font-weight: 600;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.12s var(--curva-salida),
			border-color 0.12s var(--curva-salida);
	}
	.casilla:hover {
		border-color: var(--tinta-tenue);
	}
	.casilla.marcada {
		border-color: var(--exito);
		background: var(--exito-fondo);
		color: var(--exito);
	}
	.casilla.ancha {
		justify-content: flex-start;
	}
	.recuadro {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		border: 1.5px solid var(--borde-campo);
		border-radius: 5px;
		background: var(--campo-fondo);
	}
	.marcada .recuadro {
		border-color: var(--exito);
		background: var(--exito);
		color: var(--exito-fondo);
	}
	.recuadro svg {
		width: 14px;
		height: 14px;
	}
	.texto {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.status-badge {
		margin-left: auto;
	}
	/* Mientras se guarda, la casilla avisa sin cambiar todavía de estado. */
	:global(form[aria-busy='true']) .casilla,
	.casilla:global([aria-busy='true']) {
		border-style: dashed;
		cursor: progress;
	}
	.lectura {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
		color: var(--tinta-secundaria);
	}
	.lectura.marcada {
		color: var(--exito);
		font-weight: 600;
	}
</style>
