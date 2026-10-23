<!-- Vista mensual de la planeación: las partidas con algo que hacer o ya hecho en el mes, de lo más
     urgente a lo ejecutado y con reporte, con «Capturar» o «Continuar borrador», «⋯» para los
     ajustes y la navegación al mes anterior y siguiente dentro del periodo. -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		anotacionesCelda,
		detalleCelda,
		ETIQUETA_EJECUCION,
		faltan,
		partidasDelMes,
		SIMBOLO_EJECUCION,
		textoDocumental
	} from '$lib/dominio/cumplimiento';
	import { ETIQUETA_PERIODICIDAD } from '$lib/dominio/captura';
	import type { AvancePrograma, CeldaPrograma } from '$lib/dominio/esquemas';
	import { textoMes } from '$lib/dominio/textos';

	type Partida = AvancePrograma['partidas'][number];

	export let partidas: Partida[] = [];
	export let mes: string;
	export let meses: string[] = [];
	export let hoy: string;
	/** Consulta de la captura con contrato, sitio, partida, mes y, si aplica, la reprogramación. */
	export let consultaCaptura: (partidaId: string, mes: string, reprogramacion?: string) => string;
	/** Enlace a otro mes de la vista mensual, con los filtros actuales. */
	export let enlaceMes: (mes: string) => string;

	const dispatch = createEventDispatcher<{ ajustar: { partida: Partida; celda: CeldaPrograma } }>();

	$: filas = partidasDelMes(partidas, mes, hoy) as {
		partida: Partida;
		celda: CeldaPrograma;
		estado: keyof typeof ETIQUETA_EJECUCION;
	}[];
	$: indice = meses.indexOf(mes);
	$: anterior = indice > 0 ? meses[indice - 1] : null;
	$: siguiente = indice >= 0 && indice < meses.length - 1 ? meses[indice + 1] : null;
	/** Reprogramación que llega a este mes y aún falta por reportar, para «Capturar». */
	const reprogramacionPendiente = (c: CeldaPrograma) =>
		c.ajustes.find(
			(a) => a.tipo === 'reprogramado' && a.mesDestino === c.mes && a.ejecuciones < a.cantidad
		)?.id;
</script>

<nav class="navegacion-mes" aria-label="Meses del programa">
	<!-- enlaceMes aplica resolve() a la ruta; el mes va en la consulta. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	{#if anterior}
		<a class="boton" href={enlaceMes(anterior)}>‹ {textoMes(anterior, { inicial: true })}</a>
	{/if}
	<h3 class="titulo-mes">{textoMes(mes, { inicial: true })}</h3>
	{#if siguiente}
		<a class="boton" href={enlaceMes(siguiente)}>{textoMes(siguiente, { inicial: true })} ›</a>
	{/if}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</nav>

{#if filas.length === 0}
	<p class="view-note">No hay partidas con trabajo en {textoMes(mes)}.</p>
{:else}
	<ul class="filas">
		{#each filas as { partida, celda, estado } (partida.id)}
			{@const detalle = detalleCelda(celda, hoy)}
			{@const documental = textoDocumental(celda)}
			<li class="fila {estado}">
				<div class="partida">
					<span class="numero">{partida.numero}</span>
					{partida.actividad}
					<span class="view-note">{ETIQUETA_PERIODICIDAD[partida.periodicidad]}</span>
				</div>
				<div class="estado">
					<span class="simbolo" aria-hidden="true">{SIMBOLO_EJECUCION[estado]}</span>
					{ETIQUETA_EJECUCION[estado]}{#if documental}<span class="documental">· {documental}</span
						>{/if}
					{#each anotacionesCelda(celda) as nota (nota)}<span class="anotacion">{nota}</span>{/each}
					{#if detalle}<span class="detalle">{detalle}</span>{/if}
				</div>
				<div class="acciones">
					<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					{#if celda.reportesAbiertos.length}
						<a class="enlace" href={resolve('/reportes/[id]', { id: celda.reportesAbiertos[0].id })}
							>Continuar borrador</a
						>
					{:else if faltan(celda) > 0}
						<a
							class="enlace"
							href={`${resolve('/captura')}?${consultaCaptura(partida.id, celda.mes, reprogramacionPendiente(celda))}`}
							>Capturar</a
						>
					{/if}
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{#if faltan(celda) > 0 || celda.ajustes.length}
						<button
							type="button"
							class="action-btn"
							aria-label={`Ajustes de la partida ${partida.numero} en ${textoMes(celda.mes)}`}
							title="Reprogramar o marcar no ejecutado"
							on:click={() => dispatch('ajustar', { partida, celda })}>⋯</button
						>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.navegacion-mes {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		margin: 8px 0 12px;
	}
	.titulo-mes {
		margin: 0;
		font-size: 1rem;
	}
	.filas {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.fila {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 2fr) auto;
		gap: 8px;
		align-items: center;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-left-width: 4px;
		border-radius: 6px;
	}
	.fila.vencido,
	.fila.no_ejecutado {
		border-left-color: var(--danger);
	}
	.fila.pendiente {
		border-left-color: var(--primary);
	}
	.fila.reprogramado {
		border-left-color: var(--warning);
	}
	.fila.ejecutado {
		border-left-color: var(--success);
	}
	.numero {
		font-weight: 700;
		margin-right: 4px;
	}
	.partida,
	.estado {
		overflow-wrap: anywhere;
	}
	.simbolo {
		font-weight: 700;
	}
	.documental,
	.anotacion,
	.detalle {
		margin-left: 6px;
		font-size: 0.85rem;
	}
	.acciones {
		display: flex;
		gap: 8px;
		align-items: center;
		justify-content: flex-end;
	}
	@media (max-width: 720px) {
		.fila {
			grid-template-columns: minmax(0, 1fr);
		}
		.acciones {
			justify-content: flex-start;
		}
	}
</style>
