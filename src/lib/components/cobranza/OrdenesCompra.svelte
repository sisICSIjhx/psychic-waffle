<!-- Órdenes de compra del contrato, con los conceptos que define la plantilla. Tabla en escritorio y
     una tarjeta por orden en teléfono; cada orden se corrige en su propio formulario. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ValorConcepto } from '$lib/dominio/cobranza';
	import type { TipoConcepto } from '$lib/dominio/constantes';
	import AccionesGuardar from './AccionesGuardar.svelte';
	import CampoConcepto from './CampoConcepto.svelte';
	import type { ResultadoGuardar } from './adicionales';

	interface Concepto {
		id: string;
		tipo: TipoConcepto;
		etiqueta: string;
		porDefinir?: boolean;
	}

	export let conceptos: Concepto[];
	export let ordenes: { id: string; valores: { conceptoId: string; valor: ValorConcepto }[] }[];
	export let puedeEditar = false;
	/** Identificador de la orden que se dé de alta (lo genera el servidor en cada carga). */
	export let idNueva = '';
	export let urlGuardar: string;
	export let enviar: SubmitFunction;
	export let resultado: ResultadoGuardar | null = null;
	export let enviando: string | null = null;

	const ALTA = 'r-ordenes';
	const DE_FILA = /^r-orden-/;

	$: ids = new Set(ordenes.map((o) => o.id));
	// El resultado de una orden que ya no existe (se quitó) se dice junto al alta.
	$: deCabecera =
		resultado?.ancla === ALTA
			? resultado
			: resultado?.ancla &&
				  DE_FILA.test(resultado.ancla) &&
				  !ids.has(resultado.ancla.replace(DE_FILA, ''))
				? { ...resultado, ancla: ALTA }
				: null;
	$: falloAlta = resultado?.ancla === ALTA && Boolean(resultado.error);

	const mapa = (valores: { conceptoId: string; valor: ValorConcepto }[]) =>
		new Map(valores.map((v) => [v.conceptoId, v.valor]));
</script>

{#if puedeEditar}
	<AccionesGuardar ancla={ALTA} resultado={deCabecera} {enviando} />
{/if}

{#if ordenes.length}
	<div class="tabla-desplazable">
		<!-- Roles explícitos: al apilarse (display: block) algunos navegadores pierden la semántica de tabla. -->
		<!-- svelte-ignore a11y_no_redundant_roles -->
		<table class="tabla-apilable lista" role="table">
			<thead role="rowgroup">
				<tr role="row">
					<th role="columnheader" scope="col">Orden</th>
					{#each conceptos as concepto (concepto.id)}
						<th role="columnheader" scope="col">{concepto.etiqueta}</th>
					{/each}
				</tr>
			</thead>
			{#each ordenes as orden, i (orden.id)}
				{@const valores = mapa(orden.valores)}
				<tbody role="rowgroup" class:con-edicion={puedeEditar}>
					<tr role="row">
						<th role="rowheader" scope="row" class="orden">Orden {i + 1}</th>
						{#each conceptos as concepto (concepto.id)}
							<td role="cell">
								<span class="etiqueta-celda">{concepto.etiqueta}</span>
								<CampoConcepto {concepto} valor={valores.get(concepto.id) ?? null} />
							</td>
						{/each}
					</tr>
					{#if puedeEditar}
						<tr role="row" class="fila-edicion">
							<td role="cell" colspan={conceptos.length + 1}>
								<details class="edicion" open={resultado?.ancla === `r-orden-${orden.id}`}>
									<summary class="resumen-boton boton fantasma">
										Editar<span class="sr-only"> la orden {i + 1}</span>
									</summary>
									<form
										method="POST"
										action={`${urlGuardar}#r-orden-${orden.id}`}
										use:enhance={enviar}
									>
										<input type="hidden" name="id" value={orden.id} />
										<input type="hidden" name="ancla" value={`r-orden-${orden.id}`} />
										<div class="campos">
											{#each conceptos as concepto (concepto.id)}
												<CampoConcepto
													{concepto}
													valor={valores.get(concepto.id) ?? null}
													prefijo={`orden-${orden.id}`}
													editable
												/>
											{/each}
										</div>
										<AccionesGuardar ancla={`r-orden-${orden.id}`} {resultado} {enviando}>
											<button class="boton primario ancho" name="accion" value="editarOrden"
												>Guardar cambios</button
											>
											<button
												class="boton peligro ancho"
												name="accion"
												value="quitarOrden"
												formaction={`${urlGuardar}#ordenes`}
												formnovalidate>Quitar orden</button
											>
										</AccionesGuardar>
									</form>
								</details>
							</td>
						</tr>
					{/if}
				</tbody>
			{/each}
		</table>
	</div>
{:else}
	<p class="vacio">Sin órdenes de compra registradas.</p>
{/if}

{#if puedeEditar}
	{#key idNueva}
		<details class="alta" open={ordenes.length === 0 || falloAlta}>
			<summary class="resumen-boton boton contorno ancho">Agregar orden de compra</summary>
			<form method="POST" action={`${urlGuardar}#${ALTA}`} use:enhance={enviar}>
				<input type="hidden" name="id" value={idNueva} />
				<input type="hidden" name="ancla" value={ALTA} />
				<div class="campos">
					{#each conceptos as concepto (concepto.id)}
						<CampoConcepto {concepto} prefijo="orden-nueva" editable />
					{/each}
				</div>
				<button class="boton primario ancho" name="accion" value="nuevaOrden">Agregar orden</button>
			</form>
		</details>
	{/key}
{/if}

<style>
	.vacio {
		margin: 0 0 12px;
		color: var(--tinta-secundaria);
	}
	.lista {
		margin-bottom: 12px;
	}
	.orden {
		font-weight: 700;
		white-space: nowrap;
	}
	.lista td {
		overflow-wrap: anywhere;
	}
	.campos {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		gap: 12px 16px;
		margin-bottom: 12px;
	}
	/* Varias secciones de cuerpo: la línea entre órdenes va en la última fila de cada una. */
	.lista tbody tr:last-child > * {
		border-bottom: 1px solid var(--linea);
	}
	.lista tbody.con-edicion tr:first-child > * {
		border-bottom: none;
	}
	.lista .fila-edicion > td {
		padding-top: 0;
	}
	.lista tbody tr.fila-edicion:hover > td {
		background: none;
	}
	.edicion > summary.resumen-boton {
		min-height: 32px;
		padding-inline: 10px;
		font-size: var(--texto-sm);
		color: var(--accion);
	}
	.alta > form,
	.edicion > form {
		padding: 16px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-control);
		background: var(--superficie-alta);
	}
	@media (max-width: 768px) {
		.alta > form,
		.edicion > form {
			padding: 12px;
		}
		/* Una tarjeta por orden de compra. */
		.lista tbody {
			margin-bottom: 12px;
			padding: 4px 12px;
			border: 1px solid var(--linea);
			border-radius: var(--radio-control);
		}
		.lista tbody tr {
			padding: 6px 0;
			border-bottom: none;
		}
		.lista tbody tr:last-child > *,
		.lista tbody tr > * {
			border-bottom: none;
		}
		.orden {
			font-size: var(--texto-md);
		}
		.edicion .boton {
			min-height: 44px;
		}
		.edicion > summary.resumen-boton {
			min-height: 44px;
			font-size: var(--texto-base);
		}
	}
</style>
