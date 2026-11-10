<!-- Tabla del tablero: una fila por centro de costo con la celda del contrato combinada, subtotales
     y total; con un centro de costo elegido, una fila por partida. Cada centro lleva a su planeación. -->
<script lang="ts">
	import type { FilaContrato, Indicadores, ProgramaCumplimiento } from '$lib/dominio/cumplimiento';
	import CeldasIndicadores from './CeldasIndicadores.svelte';

	export let contratos: FilaContrato[] = [];
	export let total: Indicadores;
	/** Desglose por partida cuando hay un sitio elegido. */
	export let desglose:
		| { partida: { id: string; numero: string; actividad: string }; indicadores: Indicadores }[]
		| null = null;
	/** Dirección de la planeación de un contrato y sitio. */
	export let enlacePlaneacion: (p: ProgramaCumplimiento) => string;
</script>

<div class="tabla-desplazable">
	<table class="tabla">
		<thead>
			<tr>
				{#if desglose}
					<th scope="col">Partida</th>
				{:else}
					<th scope="col">Contrato</th>
					<th scope="col">Centro de costo</th>
				{/if}
				<th scope="col"><abbr title="Programado">PR</abbr></th>
				<th scope="col"><abbr title="Ejecutado">E</abbr></th>
				<th scope="col"><abbr title="Reprogramado">R</abbr></th>
				<th scope="col"><abbr title="No ejecutado">N</abbr></th>
				<th scope="col"><abbr title="Pendiente">P</abbr></th>
				<th scope="col">Extras</th>
				<th scope="col">Cumplimiento</th>
				<th scope="col">Efectividad</th>
				<th scope="col">Con reporte</th>
			</tr>
		</thead>
		<tbody>
			{#if desglose}
				{#each desglose as fila (fila.partida.id)}
					<tr>
						<th scope="row"
							><span class="numero">{fila.partida.numero}</span> {fila.partida.actividad}</th
						>
						<CeldasIndicadores indicadores={fila.indicadores} />
					</tr>
				{/each}
			{:else}
				{#each contratos as c (c.contrato.id)}
					{#each c.sitios as s, i (s.programa.sitio.id)}
						<tr>
							{#if i === 0}
								<th scope="rowgroup" class="contrato" rowspan={c.sitios.length}
									>{c.contrato.numero}</th
								>
							{/if}
							<th scope="row">
								<!-- enlacePlaneacion aplica resolve() a la ruta; contrato y sitio van en la consulta. -->
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a class="enlace" href={enlacePlaneacion(s.programa)}
									>{s.programa.sitio.clave} {s.programa.sitio.nombre}</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							</th>
							<CeldasIndicadores indicadores={s.indicadores} />
						</tr>
					{/each}
					{#if c.sitios.length > 1}
						<tr class="subtotal">
							<th scope="row" colspan="2">Subtotal {c.contrato.numero}</th>
							<CeldasIndicadores indicadores={c.subtotal} />
						</tr>
					{/if}
				{/each}
			{/if}
			<tr class="total">
				<th scope="row" colspan={desglose ? 1 : 2}>Total</th>
				<CeldasIndicadores indicadores={total} />
			</tr>
		</tbody>
	</table>
</div>

<style>
	.tabla th[scope='row'],
	.tabla th.contrato {
		text-align: left;
		font-weight: 400;
	}
	.tabla th[scope='row'] {
		min-width: 200px;
	}
	.tabla th.contrato {
		font-weight: 600;
		vertical-align: top;
	}
	.subtotal,
	.total,
	.subtotal th,
	.total th {
		font-weight: 700;
	}
	.numero {
		font-weight: 700;
		margin-right: 4px;
	}
	abbr {
		text-decoration: none;
	}
</style>
