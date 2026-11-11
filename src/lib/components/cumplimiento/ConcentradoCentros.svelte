<!-- Concentrado: una fila por centro de costo con lo ejecutado contra lo planeado y los accesos a su
     seguimiento, a su tablero de cumplimiento y a su contrato y cobranza. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ETIQUETA_FUENTE,
		motivoSinAvance,
		resumenConcentrado,
		type FilaConcentrado
	} from '$lib/dominio/concentrado';
	import { textoPorcentaje, UMBRALES } from '$lib/dominio/cumplimiento';
	import Semaforo from './Semaforo.svelte';

	export let filas: FilaConcentrado[] = [];
	/** Mes de corte, «AAAA-MM-01». */
	export let corte: string;
	/** Quien consulta puede abrir «Contrato y cobranza». */
	export let verCobranza = false;

	$: mes = corte.slice(0, 7);
	$: resumen = resumenConcentrado(filas);
	const nombre = (fila: FilaConcentrado) =>
		[fila.centro.clave, fila.centro.nombre].filter(Boolean).join(' · ');
</script>

{#if filas.length === 0}
	<p class="view-note">No hay centros de costo disponibles para tu cuenta.</p>
{:else}
	<p class="view-note">
		{filas.length}
		{filas.length === 1 ? 'centro de costo' : 'centros de costo'}: {resumen.verde} en meta, {resumen.amarillo}
		cerca de la meta, {resumen.rojo} bajo la meta y {resumen.sinDatos} sin avance que medir.
	</p>
	<div class="tabla-desplazable">
		<table class="tabla">
			<thead>
				<tr>
					<th scope="col">Centro de costo</th>
					<th scope="col">Contrato</th>
					<th scope="col">Planeado</th>
					<th scope="col">Ejecutado</th>
					<th scope="col">Avance</th>
					<th scope="col">Origen del avance</th>
					<th scope="col">Detalle</th>
				</tr>
			</thead>
			<tbody>
				<!-- Cada enlace aplica resolve() a su ruta; el centro y el mes van en la consulta. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				{#each filas as fila (fila.centro.id)}
					<tr>
						<th scope="row">
							<a
								class="enlace"
								href={`${resolve('/seguimiento')}?centro=${fila.centro.id}&mes=${mes}`}
								>{nombre(fila)}</a
							>
						</th>
						<td>
							{fila.centro.contratos.map((c) => c.numero).join(', ') || '—'}
						</td>
						<td class="numero">{fila.fuente ? fila.planeado : '—'}</td>
						<td class="numero">{fila.fuente ? fila.ejecutado : '—'}</td>
						<td class="avance">
							<strong>{textoPorcentaje(fila.avance)}</strong>
							<Semaforo valor={fila.avance} umbrales={UMBRALES.cumplimiento} />
						</td>
						<td class="origen"
							>{fila.fuente ? ETIQUETA_FUENTE[fila.fuente] : motivoSinAvance(fila)}</td
						>
						<td class="detalle">
							{#if fila.contratoId}
								<a
									class="enlace"
									href={`${resolve('/cumplimiento')}?contrato=${fila.contratoId}&sitio=${fila.centro.id}&corte=${mes}`}
									aria-label={`Cumplimiento de ${nombre(fila)}`}>Cumplimiento</a
								>
							{/if}
							{#if verCobranza}
								<a
									class="enlace"
									href={`${resolve('/cobranza')}?centro=${fila.centro.id}`}
									aria-label={`Contrato y cobranza de ${nombre(fila)}`}>Contrato y cobranza</a
								>
							{/if}
						</td>
					</tr>
				{/each}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</tbody>
		</table>
	</div>
{/if}

<style>
	.tabla th[scope='row'] {
		text-align: left;
		font-weight: 600;
		min-width: 200px;
	}
	.numero {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.avance {
		white-space: nowrap;
	}
	.avance strong {
		display: inline-block;
		min-width: 3.25rem;
		font-variant-numeric: tabular-nums;
	}
	.origen {
		color: var(--tinta-secundaria);
	}
	.detalle {
		white-space: nowrap;
	}
	.detalle a + a {
		margin-left: 0.75rem;
	}
</style>
