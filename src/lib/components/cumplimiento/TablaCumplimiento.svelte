<!-- Tabla del tablero: una fila por sitio agrupada por contrato, con subtotales y total; con un sitio
     elegido, una fila por partida. Cada sitio lleva a su planeación. -->
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
				<th scope="col">{desglose ? 'Partida' : 'Contrato y sitio'}</th>
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
					{#each c.sitios as s (s.programa.sitio.id)}
						<tr>
							<th scope="row">
								<!-- enlacePlaneacion aplica resolve() a la ruta; contrato y sitio van en la consulta. -->
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a class="enlace" href={enlacePlaneacion(s.programa)}
									>{c.contrato.numero} · {s.programa.sitio.clave} {s.programa.sitio.nombre}</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							</th>
							<CeldasIndicadores indicadores={s.indicadores} />
						</tr>
					{/each}
					{#if c.sitios.length > 1}
						<tr class="subtotal">
							<th scope="row">Subtotal {c.contrato.numero}</th>
							<CeldasIndicadores indicadores={c.subtotal} />
						</tr>
					{/if}
				{/each}
			{/if}
			<tr class="total">
				<th scope="row">Total</th>
				<CeldasIndicadores indicadores={total} />
			</tr>
		</tbody>
	</table>
</div>

<style>
	.tabla th[scope='row'] {
		text-align: left;
		font-weight: 400;
		min-width: 200px;
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
