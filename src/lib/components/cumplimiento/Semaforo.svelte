<!-- Semáforo de un porcentaje: icono, texto («Bajo la meta», «Cerca de la meta», «En meta») y color.
     Sin datos no se muestra. -->
<script lang="ts">
	import { semaforo, TEXTO_SEMAFORO } from '$lib/dominio/cumplimiento';

	export let valor: number | null;
	export let umbrales: readonly [number, number];

	const ICONO = { rojo: '▼', amarillo: '◆', verde: '●' } as const;

	$: estado = semaforo(valor, umbrales);
</script>

{#if estado}
	<span class="semaforo {estado}"
		><span aria-hidden="true">{ICONO[estado]}</span> {TEXTO_SEMAFORO[estado]}</span
	>
{/if}

<style>
	.semaforo {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 1px 8px;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.rojo {
		background: var(--danger-bg);
		color: var(--danger);
	}
	.amarillo {
		background: var(--warning-bg);
		color: var(--warning);
	}
	.verde {
		background: var(--success-bg);
		color: var(--success);
	}
</style>
