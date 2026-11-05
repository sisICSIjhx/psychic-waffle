<!-- Semáforo de un porcentaje: icono, texto («Bajo la meta», «Cerca de la meta», «En meta») y color.
     Sin datos no se muestra. -->
<script lang="ts">
	import { semaforo, TEXTO_SEMAFORO } from '$lib/dominio/cumplimiento';

	export let valor: number | null;
	export let umbrales: readonly [number, number];

	// Forma además del color: flecha abajo (bajo la meta), rombo (cerca) y círculo con marca (en meta).
	const ICONO = {
		rojo: 'M12 5v14M6 13l6 6 6-6',
		amarillo: 'M12 3l9 9-9 9-9-9z',
		verde: 'M20 6 9 17l-5-5'
	} as const;

	$: estado = semaforo(valor, umbrales);
</script>

{#if estado}
	<span class="semaforo {estado}"
		><svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"><path d={ICONO[estado]} /></svg
		>
		{TEXTO_SEMAFORO[estado]}</span
	>
{/if}

<style>
	.semaforo {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 1px 7px;
		border: 1px solid;
		border-radius: 3px;
		font-size: var(--texto-xs);
		font-weight: 600;
		white-space: nowrap;
	}
	svg {
		width: 12px;
		height: 12px;
	}
	.rojo {
		background: var(--peligro-fondo);
		border-color: var(--peligro-borde);
		color: var(--peligro);
	}
	.amarillo {
		background: var(--alerta-fondo);
		border-color: var(--alerta-borde);
		color: var(--alerta);
	}
	.verde {
		background: var(--exito-fondo);
		border-color: var(--exito-borde);
		color: var(--exito);
	}
</style>
