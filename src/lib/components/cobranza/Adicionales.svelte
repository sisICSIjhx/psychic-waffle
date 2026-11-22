<!-- Adicionales de un centro de costo (cambio kpi-estatus-centros, D6): trabajos fuera del contrato,
     cada uno con su orden de compra. Administración los registra, corrige y quita; contabilidad
     solo llena lo cobrado. Tabla en escritorio y una tarjeta por adicional en teléfono. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { textoMonto } from '$lib/dominio/cobranza';
	import AccionesGuardar from './AccionesGuardar.svelte';
	import CamposAdicional from './CamposAdicional.svelte';
	import {
		textoDia,
		textoPeriodo,
		totalesDeAdicionales,
		type Adicional,
		type ResultadoGuardar
	} from './adicionales';

	export let adicionales: Adicional[];
	/** Contratos del centro en el catálogo: el contrato madre de los adicionales. */
	export let contratos: { id: string; numero: string }[] = [];
	export let puedeEditarContrato = false;
	export let puedeEditarCobranza = false;
	/** Identificador del adicional que se dé de alta (lo genera el servidor en cada carga). */
	export let idNuevo = '';
	export let urlGuardar: string;
	export let enviar: SubmitFunction;
	export let resultado: ResultadoGuardar | null = null;
	export let enviando: string | null = null;
	/** Lo escrito en un alta que falló, para no perderlo al recargar sin JavaScript. */
	export let enviado: Record<string, string> | null = null;

	const ALTA = 'r-adicionales';
	const DE_FILA = /^r-(?:adicional|cobro)-/;

	$: totales = totalesDeAdicionales(adicionales);
	$: ids = new Set(adicionales.map((a) => a.id));
	// El resultado de una fila que ya no existe (se quitó el adicional) se dice en la cabecera.
	$: deCabecera =
		resultado?.ancla === ALTA
			? resultado
			: resultado?.ancla &&
				  DE_FILA.test(resultado.ancla) &&
				  !ids.has(resultado.ancla.replace(DE_FILA, ''))
				? { ...resultado, ancla: ALTA }
				: null;
	$: falloAlta = resultado?.ancla === ALTA && Boolean(resultado.error);
	$: previo = falloAlta ? enviado : null;
	$: madre = contratos.map((c) => c.numero).join(', ');
</script>

<section class="card adicionales" id="adicionales" aria-labelledby="titulo-adicionales">
	<div class="encabezado">
		<h2 class="view-heading" id="titulo-adicionales" tabindex="-1">Adicionales</h2>
		{#if adicionales.length}
			<span class="view-note cifra"
				>{adicionales.length === 1 ? '1 registrado' : `${adicionales.length} registrados`}</span
			>
		{/if}
	</div>
	<p class="view-note">
		Trabajos fuera del contrato, cada uno con su orden de compra.
		{#if madre}Contrato: {madre}.{/if}
	</p>

	{#if puedeEditarContrato || puedeEditarCobranza}
		<AccionesGuardar ancla={ALTA} resultado={deCabecera} {enviando} />
	{/if}

	{#if adicionales.length === 0}
		<p class="vacio">
			Sin adicionales registrados.
			{#if puedeEditarContrato}Registre el primero con su orden de compra.{/if}
		</p>
	{/if}

	{#if puedeEditarContrato}
		{#key idNuevo}
			<details class="alta" open={adicionales.length === 0 || falloAlta}>
				<summary class="resumen-boton boton primario ancho">Registrar adicional</summary>
				<form method="POST" action={`${urlGuardar}#${ALTA}`} use:enhance={enviar}>
					<input type="hidden" name="id" value={idNuevo} />
					<input type="hidden" name="ancla" value={ALTA} />
					<CamposAdicional
						prefijo="adicional-nuevo"
						ordenCompra={previo?.ordenCompra ?? ''}
						descripcion={previo?.descripcion ?? ''}
						fechaSolicitud={previo?.fechaSolicitud ?? ''}
						periodoInicio={previo?.periodoInicio ?? ''}
						periodoFin={previo?.periodoFin ?? ''}
						montoPactado={previo?.montoPactado ?? ''}
					/>
					<p class="view-note ayuda">Lo cobrado lo registra contabilidad.</p>
					<button class="boton primario ancho" name="accion" value="nuevoAdicional"
						>Registrar adicional</button
					>
				</form>
			</details>
		{/key}
	{/if}

	{#if adicionales.length}
		<!-- Entre el ancho de teléfono y el de escritorio la tabla puede no caber: se desplaza ella, no la página. -->
		<div class="tabla-desplazable">
			<!-- Roles explícitos: al apilarse (display: block) algunos navegadores pierden la semántica de tabla. -->
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<table class="tabla-apilable lista" role="table">
				<thead role="rowgroup">
					<tr role="row">
						<th role="columnheader" scope="col">Orden de compra</th>
						<th role="columnheader" scope="col">Descripción</th>
						<th role="columnheader" scope="col">Solicitado</th>
						<th role="columnheader" scope="col">Ejecución</th>
						<th role="columnheader" scope="col" class="monto">Pactado</th>
						<th role="columnheader" scope="col" class="monto">Cobrado</th>
					</tr>
				</thead>
				{#each adicionales as adicional (adicional.id)}
					{@const periodo = textoPeriodo(adicional.periodoInicio, adicional.periodoFin)}
					<tbody role="rowgroup" class:con-edicion={puedeEditarContrato}>
						<tr role="row">
							<th role="rowheader" scope="row" class="orden">{adicional.ordenCompra}</th>
							<td role="cell" class:vacia={!adicional.descripcion}>
								<span class="etiqueta-celda">Descripción</span>
								{adicional.descripcion ?? '—'}
							</td>
							<td role="cell" class="fecha" class:vacia={!adicional.fechaSolicitud}>
								<span class="etiqueta-celda">Solicitado</span>
								{adicional.fechaSolicitud ? textoDia(adicional.fechaSolicitud) : '—'}
							</td>
							<td role="cell" class="fecha" class:vacia={!periodo}>
								<span class="etiqueta-celda">Ejecución</span>
								{periodo || '—'}
							</td>
							<td role="cell" class="monto">
								<span class="etiqueta-celda">Pactado</span>
								{#if adicional.montoPactado === null}
									<span class="tenue">Sin monto</span>
								{:else}
									{textoMonto(adicional.montoPactado)}
								{/if}
							</td>
							<td role="cell" class="monto">
								{#if puedeEditarCobranza}
									<form
										method="POST"
										action={`${urlGuardar}#r-cobro-${adicional.id}`}
										use:enhance={enviar}
										class="cobro"
									>
										<input type="hidden" name="id" value={adicional.id} />
										<input type="hidden" name="ancla" value={`r-cobro-${adicional.id}`} />
										<label class="etiqueta-celda" for={`cobro-${adicional.id}`}>Monto cobrado</label
										>
										<input
											id={`cobro-${adicional.id}`}
											type="number"
											name="montoCobrado"
											min="0"
											max="999999999999.99"
											step="0.01"
											inputmode="decimal"
											enterkeyhint="done"
											value={adicional.montoCobrado ?? ''}
											aria-label={`Monto cobrado · orden ${adicional.ordenCompra}`}
										/>
										<AccionesGuardar
											ancla={`r-cobro-${adicional.id}`}
											{resultado}
											{enviando}
											apilado
											breve
										>
											<button class="boton contorno ancho" name="accion" value="cobroAdicional"
												>Guardar cobro</button
											>
										</AccionesGuardar>
									</form>
								{:else}
									<span class="etiqueta-celda">Cobrado</span>
									{#if adicional.montoCobrado === null}
										<span class="tenue">Sin cobro</span>
									{:else}
										{textoMonto(adicional.montoCobrado)}
									{/if}
								{/if}
							</td>
						</tr>
						{#if puedeEditarContrato}
							<tr role="row" class="fila-edicion">
								<td role="cell" colspan="6">
									<details
										class="edicion"
										open={resultado?.ancla === `r-adicional-${adicional.id}`}
									>
										<summary class="resumen-boton boton fantasma">
											Editar<span class="sr-only"> el adicional {adicional.ordenCompra}</span>
										</summary>
										<form
											method="POST"
											action={`${urlGuardar}#r-adicional-${adicional.id}`}
											use:enhance={enviar}
										>
											<input type="hidden" name="id" value={adicional.id} />
											<input type="hidden" name="ancla" value={`r-adicional-${adicional.id}`} />
											<CamposAdicional
												prefijo={`adicional-${adicional.id}`}
												ordenCompra={adicional.ordenCompra}
												descripcion={adicional.descripcion ?? ''}
												fechaSolicitud={adicional.fechaSolicitud ?? ''}
												periodoInicio={adicional.periodoInicio ?? ''}
												periodoFin={adicional.periodoFin ?? ''}
												montoPactado={adicional.montoPactado === null
													? ''
													: String(adicional.montoPactado)}
											/>
											<AccionesGuardar ancla={`r-adicional-${adicional.id}`} {resultado} {enviando}>
												<button class="boton primario ancho" name="accion" value="editarAdicional"
													>Guardar cambios</button
												>
												{#if adicional.montoCobrado === null}
													<button
														class="boton peligro ancho"
														name="accion"
														value="quitarAdicional"
														formaction={`${urlGuardar}#adicionales`}
														formnovalidate>Quitar adicional</button
													>
												{/if}
											</AccionesGuardar>
											{#if adicional.montoCobrado !== null}
												<p class="view-note ayuda">
													No se puede quitar porque ya tiene un cobro registrado. Contabilidad debe
													borrar el cobro primero.
												</p>
											{/if}
										</form>
									</details>
								</td>
							</tr>
						{/if}
					</tbody>
				{/each}
				<tfoot role="rowgroup">
					<tr role="row">
						<th role="rowheader" scope="row" colspan="4">Total</th>
						<td role="cell" class="monto">
							<span class="etiqueta-celda">Pactado</span>
							{textoMonto(totales.pactado)}
						</td>
						<td role="cell" class="monto">
							<span class="etiqueta-celda">Cobrado</span>
							{textoMonto(totales.cobrado)}
						</td>
					</tr>
				</tfoot>
			</table>
		</div>
	{/if}
</section>

<style>
	.adicionales {
		min-width: 0;
		scroll-margin-top: 12px;
	}
	.encabezado {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 12px;
	}
	.encabezado h2 {
		margin: 0;
	}
	.adicionales > .view-note {
		margin: 4px 0 8px;
	}
	.vacio {
		margin: 8px 0 12px;
		color: var(--tinta-secundaria);
	}
	.ayuda {
		margin: 0 0 12px;
	}
	.alta {
		margin-block: 8px 4px;
	}
	/* Abierto, el resumen deja de competir con el botón que registra. */
	.alta[open] > summary.primario {
		background: transparent;
		border-color: var(--linea-fuerte);
		box-shadow: none;
		color: var(--accion);
	}
	.alta > form {
		padding: 16px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-control);
		background: var(--superficie-alta);
	}
	.lista {
		margin-top: 12px;
	}
	.orden {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.fecha,
	.monto {
		white-space: nowrap;
	}
	.monto {
		font-variant-numeric: tabular-nums;
	}
	.tenue {
		color: var(--tinta-tenue);
	}
	/* Varias secciones de cuerpo: la línea entre adicionales va en la última fila de cada una. */
	.lista tbody tr:last-child > * {
		border-bottom: 1px solid var(--linea);
	}
	.lista tbody.con-edicion tr:first-child > * {
		border-bottom: none;
	}
	.lista .fila-edicion > td {
		padding-top: 0;
		white-space: normal;
	}
	.lista tbody tr.fila-edicion:hover > td {
		background: none;
	}
	.lista tfoot th,
	.lista tfoot td {
		border-bottom: none;
		font-weight: 700;
	}
	/* Campo y botón en una línea si caben; el estado, debajo del botón, sin mover la fila al guardar. */
	.cobro {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 8px;
	}
	.cobro input {
		width: 9.5rem;
	}
	.edicion > summary.resumen-boton {
		min-height: 32px;
		padding-inline: 10px;
		font-size: var(--texto-sm);
		color: var(--accion);
	}
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
		/* Una tarjeta por adicional, con la orden de compra como título. */
		.lista tbody {
			margin-bottom: 12px;
			padding: 4px 12px;
			border: 1px solid var(--linea);
			border-radius: var(--radio-control);
		}
		.lista tbody tr,
		.lista tfoot tr {
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
		.lista .vacia {
			display: none;
		}
		.fecha,
		.monto {
			white-space: normal;
		}
		.cobro {
			display: grid;
			gap: 6px;
		}
		.cobro input {
			width: 100%;
			min-height: 44px;
		}
		.cobro .boton,
		.edicion .boton {
			min-height: 44px;
		}
		.edicion > summary.resumen-boton {
			min-height: 44px;
			font-size: var(--texto-base);
		}
		.lista tfoot tr {
			display: flex;
			flex-wrap: wrap;
			gap: 4px 24px;
			padding: 8px 12px;
		}
		.lista tfoot th {
			flex-basis: 100%;
		}
	}
</style>
