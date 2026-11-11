<!-- Un concepto de la plantilla (contrato u orden de compra): campo de captura o su valor en consulta.
     El formulario que lo contiene envía `tipo:<id>` y `valor:<id>`. -->
<script lang="ts">
	import { textoMonto, type ValorConcepto } from '$lib/dominio/cobranza';
	import type { TipoConcepto } from '$lib/dominio/constantes';
	import { textoFechaCorta } from '$lib/dominio/equipos';
	import { ESTADOS_SEGUIMIENTO } from '$lib/dominio/seguimiento-operativo';

	export let concepto: { id: string; tipo: TipoConcepto; etiqueta: string };
	export let valor: ValorConcepto = null;
	export let editable = false;
	/** Distingue los campos del mismo concepto en formularios distintos (cada orden de compra). */
	export let prefijo = 'concepto';

	$: id = `${prefijo}-${concepto.id}`;
	$: nombre = `valor:${concepto.id}`;
</script>

{#if editable}
	<input type="hidden" name={`tipo:${concepto.id}`} value={concepto.tipo} />
	{#if concepto.tipo === 'casilla'}
		<label class="casilla" for={id}>
			<input {id} type="checkbox" name={nombre} checked={valor === true} />
			{concepto.etiqueta}
		</label>
	{:else}
		<div class="form-group">
			<label for={id}>{concepto.etiqueta}</label>
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
				<input {id} type="number" name={nombre} min="0" step="any" value={valor ?? ''} />
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
				<input {id} type="text" name={nombre} maxlength="500" value={valor ?? ''} />
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
	<a href={valor} target="_blank" rel="noopener noreferrer">Abrir en SharePoint</a>
{:else}
	{valor}
{/if}

<style>
	.form-group {
		margin: 0;
	}
	.casilla {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		align-self: end;
		min-height: 2.5rem;
	}
	.vacio {
		color: var(--tinta-secundaria);
	}
</style>
