<!-- Cobranza mensual de un año: los cuatro pasos y el monto cobrado de cada mes, en un solo
     formulario. Tabla en escritorio; en teléfono cada mes es un bloque y «Guardar cobranza» queda
     pegado abajo. La suma de los montos es el cobrado del contrato (D7). -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		PASOS_COBRANZA,
		textoMonto,
		totalCobrado,
		type MesCobranza
	} from '$lib/dominio/cobranza';
	import { textoMes } from '$lib/dominio/textos';
	import AccionesGuardar from './AccionesGuardar.svelte';
	import type { ResultadoGuardar } from './adicionales';

	export let anio: number;
	/** Los doce meses del año (`mesesDelAnio`). */
	export let meses: MesCobranza[];
	/** Mes en curso, `AAAA-MM`. */
	export let mesActual: string;
	export let puedeEditar = false;
	export let urlGuardar: string;
	export let enviar: SubmitFunction;
	export let resultado: ResultadoGuardar | null = null;
	export let enviando: string | null = null;

	const ANCLA = 'r-cobranza';
	$: hayMesActual = mesActual.startsWith(`${anio}-`);

	/** `enhance` solo cuando el contenedor es el formulario (quien puede editar). */
	function mejorar(nodo: HTMLElement) {
		if (nodo instanceof HTMLFormElement) return enhance(nodo, enviar);
	}
</script>

<section class="card cobranza" id="cobranza" aria-labelledby="titulo-cobranza">
	<div class="encabezado">
		<h2 class="view-heading" id="titulo-cobranza" tabindex="-1">Cobranza {anio}</h2>
		<p class="total">
			Cobrado en el año: <strong class="cifra">{textoMonto(totalCobrado(meses))}</strong>
		</p>
	</div>
	<p class="view-note">
		{#if puedeEditar}
			Marque los pasos de cada mes y escriba lo cobrado. La suma es el monto cobrado del contrato.
		{:else}
			La llena contabilidad. La suma es el monto cobrado del contrato.
		{/if}
		{#if hayMesActual}
			<a class="enlace" href={`#mes-${mesActual.slice(5, 7)}`}>Ir al mes actual</a>
		{/if}
	</p>

	<!-- En consulta no hay formulario: la misma tabla va en un contenedor sin envío. -->
	<svelte:element
		this={puedeEditar ? 'form' : 'div'}
		method={puedeEditar ? 'POST' : undefined}
		action={puedeEditar ? `${urlGuardar}#${ANCLA}` : undefined}
		use:mejorar
	>
		{#if puedeEditar}<input type="hidden" name="ancla" value={ANCLA} />{/if}
		<!-- Entre el ancho de teléfono y el de escritorio la tabla puede no caber: se desplaza ella, no la página. -->
		<div class="tabla-desplazable">
			<!-- Roles explícitos: al apilarse (display: block) algunos navegadores pierden la semántica de tabla. -->
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<table class="tabla-apilable meses" role="table">
				<thead role="rowgroup">
					<tr role="row">
						<th role="columnheader" scope="col">Mes</th>
						{#each PASOS_COBRANZA as [paso, etiqueta] (paso)}
							<th role="columnheader" scope="col">{etiqueta}</th>
						{/each}
						<th role="columnheader" scope="col">Monto cobrado</th>
					</tr>
				</thead>
				<tbody role="rowgroup">
					{#each meses as mes (mes.mes)}
						{@const mm = mes.mes.slice(5, 7)}
						{@const nombre = textoMes(mes.mes.slice(0, 7), { inicial: true })}
						{@const esActual = mes.mes.startsWith(mesActual)}
						<tr role="row" id={`mes-${mm}`} class:actual={esActual}>
							<th role="rowheader" scope="row" class="mes">
								{nombre}
								{#if esActual}<span class="status-badge">Mes actual</span>{/if}
							</th>
							{#each PASOS_COBRANZA as [paso, etiqueta] (paso)}
								<td role="cell" class="paso">
									{#if puedeEditar}
										<label>
											<input
												type="checkbox"
												name={`${paso}-${mm}`}
												checked={mes[paso]}
												aria-label={`${etiqueta} · ${nombre}`}
											/>
											<span class="etiqueta-celda">{etiqueta}</span>
										</label>
									{:else}
										<span class="consulta" class:hecho={mes[paso]}>
											<svg
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2.25"
												stroke-linecap="round"
												stroke-linejoin="round"
												aria-hidden="true"
												><path d={mes[paso] ? 'M20 6 9 17l-5-5' : 'M6 12h12'} /></svg
											>
											<span class="etiqueta-celda">{etiqueta}:</span>
											{mes[paso] ? 'Hecho' : 'Pendiente'}
										</span>
									{/if}
								</td>
							{/each}
							<td role="cell" class="monto">
								{#if puedeEditar}
									<label class="etiqueta-celda" for={`monto-${mm}`}>Monto cobrado</label>
									<input
										id={`monto-${mm}`}
										type="number"
										name={`monto-${mm}`}
										min="0"
										max="999999999999.99"
										step="0.01"
										inputmode="decimal"
										value={mes.montoCobrado ?? ''}
										aria-label={`Monto cobrado · ${nombre}`}
									/>
								{:else}
									<span class="etiqueta-celda">Monto cobrado</span>
									{#if mes.montoCobrado === null}
										<span class="tenue">—</span>
									{:else}
										{textoMonto(mes.montoCobrado)}
									{/if}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if puedeEditar}
			<div class="barra-guardar">
				<AccionesGuardar ancla={ANCLA} {resultado} {enviando}>
					<button class="boton primario ancho" name="accion" value="cobranza"
						>Guardar cobranza</button
					>
					<svelte:fragment slot="despues" let:visible>
						{#if visible}
							<a class="enlace" href="#resumen">Ver cómo quedó el estatus</a>
						{/if}
					</svelte:fragment>
				</AccionesGuardar>
			</div>
		{/if}
	</svelte:element>
</section>

<style>
	.cobranza {
		min-width: 0;
		scroll-margin-top: 12px;
	}
	.encabezado {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
	}
	.encabezado h2 {
		margin: 0;
	}
	.total {
		margin: 0;
	}
	.cobranza > .view-note {
		margin: 4px 0 12px;
	}
	.cobranza > .view-note .enlace {
		display: inline-block;
		margin-left: 4px;
		white-space: nowrap;
	}
	.meses tbody tr {
		scroll-margin-top: 12px;
	}
	.mes {
		font-weight: 600;
		white-space: nowrap;
	}
	.mes .status-badge {
		margin-left: 6px;
	}
	.meses tbody tr.actual > * {
		background: var(--accion-suave);
	}
	.monto {
		font-variant-numeric: tabular-nums;
	}
	.monto input {
		width: 100%;
		min-width: 8rem;
		max-width: 12rem;
	}
	.consulta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--tinta-tenue);
	}
	.consulta.hecho {
		color: var(--exito);
		font-weight: 600;
	}
	.consulta svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}
	.consulta .etiqueta-celda {
		color: inherit;
		font-size: inherit;
		font-weight: inherit;
	}
	.tenue {
		color: var(--tinta-tenue);
	}
	.barra-guardar {
		margin-top: 16px;
	}
	@media (max-width: 768px) {
		/* Cada mes, un bloque: nombre, los cuatro pasos en dos columnas y el monto a todo el ancho. */
		.meses tbody tr {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0 12px;
			padding: 12px 8px;
		}
		.meses tbody tr.actual {
			border-radius: var(--radio-control);
			background: var(--accion-suave);
		}
		.meses tbody tr.actual > * {
			background: none;
		}
		.meses .mes,
		.meses .monto {
			grid-column: 1 / -1;
		}
		.mes {
			font-size: var(--texto-md);
			font-weight: 700;
		}
		.paso label {
			display: flex;
			width: 100%;
			min-height: 44px;
		}
		.paso input {
			width: 20px;
			height: 20px;
		}
		.paso label .etiqueta-celda {
			color: var(--tinta);
			font-size: var(--texto-base);
		}
		.consulta {
			min-height: 32px;
		}
		.monto input {
			max-width: none;
			min-height: 44px;
		}
		/* Dentro de .main (el contenedor que se desplaza): pegada abajo mientras se llenan los meses. El
		   desplazamiento negativo cubre el relleno inferior de .main, para que nada asome bajo la barra. */
		.barra-guardar {
			position: sticky;
			bottom: calc(var(--relleno-main, 20px) * -1);
			z-index: 1;
			margin: 12px -16px -16px;
			padding: 12px 16px max(12px, env(safe-area-inset-bottom));
			border-top: 1px solid var(--linea);
			border-radius: 0 0 var(--radio-panel) var(--radio-panel);
			background: var(--superficie);
			box-shadow: var(--sombra-barra);
		}
		.barra-guardar .enlace,
		.cobranza > .view-note .enlace {
			display: inline-flex;
			align-items: center;
			min-height: 44px;
		}
	}
</style>
