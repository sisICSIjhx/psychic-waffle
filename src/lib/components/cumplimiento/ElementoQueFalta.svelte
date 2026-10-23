<!-- Un reporte que falta: sitio, partida, actividad, mes y cantidad, con «Capturar» o «Continuar
     borrador». -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ReporteQueFalta } from '$lib/dominio/cumplimiento';
	import { textoMes } from '$lib/dominio/textos';

	export let reporte: ReporteQueFalta;

	$: consulta = `contrato=${reporte.contratoId}&sitio=${reporte.sitioId}&partida=${reporte.partidaId}&mes=${reporte.mes}`;
</script>

<span class="datos">
	{reporte.sitio} · Partida {reporte.numero}.- {reporte.actividad} · {textoMes(reporte.mes)}
	{reporte.cantidad > 1 ? `(${reporte.cantidad})` : ''}
</span>
{#if reporte.reporteId}
	<a class="enlace" href={resolve('/reportes/[id]', { id: reporte.reporteId })}
		>Continuar borrador</a
	>
{:else}
	<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a class="enlace" href={`${resolve('/captura')}?${consulta}`}>Capturar</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{/if}

<style>
	.datos {
		overflow-wrap: anywhere;
		margin-right: 8px;
	}
</style>
