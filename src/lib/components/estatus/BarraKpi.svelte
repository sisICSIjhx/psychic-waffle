<!-- Un indicador del centro de costo: nombre, barra y cifra, con el trazo del semáforo junto a la
     cifra. La cifra siempre acompaña a la barra en texto; sin denominador no hay barra. -->
<script lang="ts">
	import { TEXTO_SEMAFORO } from '$lib/dominio/cumplimiento';
	import type { Kpi } from '$lib/dominio/estatus';
	import { cifraDeKpi, kpiConDatos, nombreDeKpi } from './textos';

	export let kpi: Kpi;
	/** Muestra la línea de detalle bajo la barra. */
	export let mostrarDetalle = true;

	// Los mismos trazos de cumplimiento/Semaforo.svelte: flecha abajo, rombo y marca.
	const TRAZO = {
		rojo: 'M12 5v14M6 13l6 6 6-6',
		amarillo: 'M12 3l9 9-9 9-9-9z',
		verde: 'M20 6 9 17l-5-5'
	} as const;

	$: nombre = nombreDeKpi(kpi);
	$: conDatos = kpiConDatos(kpi);
	$: cifra = cifraDeKpi(kpi);
	$: tope = conDatos ? (kpi.esMonto ? 100 : kpi.total) : 1;
	$: avance = conDatos
		? Math.min(tope, Math.max(0, kpi.esMonto ? (kpi.porcentaje ?? 0) : kpi.valor))
		: 0;
</script>

<div class="caja" data-kpi={kpi.clave}>
	<div class="kpi">
		<span class="nombre">{nombre}</span>
		{#if conDatos}
			<progress
				class="barra {kpi.semaforo ?? 'neutro'}"
				max={tope}
				value={avance}
				aria-label={`${nombre}: ${cifra}`}
			></progress>
		{/if}
		<span class="cifra valor" class:tenue={!conDatos}>
			{#if conDatos && kpi.semaforo}
				<svg
					class={kpi.semaforo}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><path d={TRAZO[kpi.semaforo]} /></svg
				><span class="sr-only">{TEXTO_SEMAFORO[kpi.semaforo].toLowerCase()}:</span>
			{/if}
			{cifra}
		</span>
		{#if mostrarDetalle && kpi.detalle}
			<p class="view-note detalle">{kpi.detalle}</p>
		{/if}
	</div>
</div>

<style>
	/* La fila se acomoda según el ancho de donde está (tarjeta o ficha), no el de la ventana. */
	.caja {
		container-type: inline-size;
		min-width: 0;
	}
	/* Estrecho: nombre y cifra arriba y la barra debajo, a todo el ancho. */
	.kpi {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 4px 12px;
		min-width: 0;
	}
	.nombre {
		min-width: 0;
		font-size: var(--texto-sm);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.valor {
		grid-column: 2;
		grid-row: 1;
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
		font-size: var(--texto-sm);
		font-weight: 600;
		white-space: nowrap;
	}
	.valor.tenue {
		color: var(--tinta-tenue);
		font-weight: 400;
	}
	.detalle {
		grid-column: 1 / -1;
		overflow-wrap: anywhere;
	}
	svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}
	svg.rojo {
		color: var(--peligro);
	}
	svg.amarillo {
		color: var(--alerta);
	}
	svg.verde {
		color: var(--exito);
	}
	/* Mismo estilo que la barra de avance de «Mi trabajo»: 8 px sobre pista neutra. */
	.barra {
		--relleno: var(--accion);
		appearance: none;
		display: block;
		grid-column: 1 / -1;
		grid-row: 2;
		width: 100%;
		height: 8px;
		border: none;
		border-radius: 999px;
		overflow: hidden;
		background: var(--neutro-fondo);
		color: var(--relleno);
	}
	.barra.rojo {
		--relleno: var(--peligro);
	}
	.barra.amarillo {
		--relleno: var(--alerta);
	}
	.barra.verde {
		--relleno: var(--exito);
	}
	.barra::-webkit-progress-bar {
		background: var(--neutro-fondo);
	}
	.barra::-webkit-progress-value {
		border-radius: 999px;
		background: var(--relleno);
	}
	.barra::-moz-progress-bar {
		border-radius: 999px;
		background: var(--relleno);
	}
	/* Con sitio, una sola fila: nombre, barra al centro y cifra a la derecha. */
	@container (min-width: 420px) {
		.kpi {
			grid-template-columns: minmax(0, 11rem) minmax(0, 1fr) minmax(4.5rem, auto);
		}
		.valor {
			grid-column: 3;
		}
		.barra {
			grid-column: 2;
			grid-row: 1;
		}
	}
</style>
