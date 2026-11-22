<!-- Un concepto de la plantilla (contrato u orden de compra): campo de captura o su valor en consulta.
     El formulario que lo contiene envía `tipo:<id>` y `valor:<id>`. Con `soloLectura` el concepto se
     muestra dentro del formulario como dato calculado y no se envía (el monto cobrado, D7). -->
<script lang="ts">
	import { textoMonto, type ValorConcepto } from '$lib/dominio/cobranza';
	import type { TipoConcepto } from '$lib/dominio/constantes';
	import { textoFechaCorta } from '$lib/dominio/equipos';
	import { ESTADOS_SEGUIMIENTO } from '$lib/dominio/seguimiento-operativo';

	export let concepto: { id: string; tipo: TipoConcepto; etiqueta: string; porDefinir?: boolean };
	export let valor: ValorConcepto = null;
	export let editable = false;
	/** Dato que no se captura aquí: se ve con su etiqueta y una nota, sin campo. */
	export let soloLectura = false;
	/** Explica de dónde sale un dato de solo lectura. */
	export let nota = '';
	/** Insignia neutra junto al valor de solo lectura («Captura anterior»). */
	export let insignia = '';
	/** Distingue los campos del mismo concepto en formularios distintos (cada orden de compra). */
	export let prefijo = 'concepto';

	$: id = `${prefijo}-${concepto.id}`;
	$: nombre = `valor:${concepto.id}`;
</script>

{#if soloLectura}
	<div class="form-group lectura">
		<span class="etiqueta-campo">{concepto.etiqueta}</span>
		<p class="valor">
			<span class="cifra">
				{#if concepto.tipo === 'monto' && typeof valor === 'number'}
					{textoMonto(valor)}
				{:else if valor === null || valor === false}
					—
				{:else}
					{valor}
				{/if}
			</span>
			{#if insignia}<span class="status-badge">{insignia}</span>{/if}
		</p>
		{#if nota}<p class="view-note">{nota}</p>{/if}
	</div>
{:else if editable}
	<input type="hidden" name={`tipo:${concepto.id}`} value={concepto.tipo} />
	{#if concepto.tipo === 'casilla'}
		<label class="casilla" for={id}>
			<input {id} type="checkbox" name={nombre} checked={valor === true} />
			{concepto.etiqueta}
			{#if concepto.porDefinir}<span class="status-badge por-definir">Por definir</span>{/if}
		</label>
	{:else}
		<div class="form-group">
			<label for={id}>
				{concepto.etiqueta}
				{#if concepto.porDefinir}<span class="status-badge por-definir">Por definir</span>{/if}
			</label>
			{#if concepto.tipo === 'estado'}
				<select {id} name={nombre} value={valor ?? 'pendiente'}>
					{#each Object.entries(ESTADOS_SEGUIMIENTO) as [estado, texto] (estado)}
						<option value={estado}>{texto}</option>
					{/each}
				</select>
			{:else if concepto.tipo === 'monto'}
				<input
					{id}
					type="number"
					name={nombre}
					min="0"
					max="999999999999.99"
					step="0.01"
					inputmode="decimal"
					value={valor ?? ''}
				/>
			{:else if concepto.tipo === 'cantidad'}
				<input
					{id}
					type="number"
					name={nombre}
					min="0"
					step="any"
					inputmode="decimal"
					value={valor ?? ''}
				/>
			{:else if concepto.tipo === 'fecha'}
				<input {id} type="date" name={nombre} value={valor ?? ''} />
			{:else if concepto.tipo === 'enlace'}
				<input
					{id}
					type="url"
					name={nombre}
					maxlength="2048"
					placeholder="https://…sharepoint.com/…"
					value={valor ?? ''}
				/>
			{:else}
				<input
					{id}
					type="text"
					name={nombre}
					maxlength="500"
					autocomplete="off"
					value={valor ?? ''}
				/>
			{/if}
		</div>
	{/if}
{:else if valor === null || valor === false}
	<span class="vacio">{concepto.tipo === 'casilla' ? 'No' : '—'}</span>
{:else if concepto.tipo === 'casilla'}
	Sí
{:else if concepto.tipo === 'monto' && typeof valor === 'number'}
	{textoMonto(valor)}
{:else if concepto.tipo === 'fecha' && typeof valor === 'string'}
	{textoFechaCorta(valor)}
{:else if concepto.tipo === 'estado'}
	{ESTADOS_SEGUIMIENTO[valor as keyof typeof ESTADOS_SEGUIMIENTO] ?? valor}
{:else if concepto.tipo === 'enlace' && typeof valor === 'string'}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- enlace externo de SharePoint -->
	<a class="enlace" href={valor} target="_blank" rel="noopener noreferrer">Abrir en SharePoint</a>
{:else}
	{valor}
{/if}

<style>
	.form-group {
		margin: 0;
		min-width: 0;
	}
	.casilla {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		align-self: end;
		min-height: 2.75rem;
	}
	.vacio {
		color: var(--tinta-secundaria);
	}
	.lectura .valor {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		min-height: var(--alto-control);
		margin: 0;
		font-size: var(--texto-campo);
		font-weight: 600;
	}
	label .status-badge {
		margin-left: 6px;
	}
</style>
