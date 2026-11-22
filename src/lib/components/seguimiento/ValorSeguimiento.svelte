<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ESTADOS_SEGUIMIENTO } from '$lib/dominio/seguimiento-operativo';
	import type { ConceptoSeguimientoOperativo } from '$lib/server/repositorios/seguimiento';
	import type { ValorCapturado } from './captura';
	import CasillaSeguimiento from './CasillaSeguimiento.svelte';

	/** Un dato del seguimiento con su propio formulario: casilla, estado o campo con «Guardar». */
	export let concepto: ConceptoSeguimientoOperativo;
	export let valor: ValorCapturado = null;
	export let actividad: string | null = null;
	/** Dónde está el dato («Partida X, ejecución 1»): distingue los nombres repetidos. */
	export let contexto = '';
	/** Tarjeta donde se muestra el resultado de guardar. */
	export let ancla: string;
	export let urlGuardar: string;
	export let plantillaId: string | null;
	export let puedeEditar: boolean;
	export let enviar: SubmitFunction;

	$: id = `valor-${actividad ?? 'mes'}-${concepto.id}`.replace(/[^\w-]/g, '-');
	$: nombre = contexto ? `${concepto.etiqueta} · ${contexto}` : concepto.etiqueta;
	$: texto =
		concepto.tipo === 'estado'
			? (ESTADOS_SEGUIMIENTO[valor as keyof typeof ESTADOS_SEGUIMIENTO] ??
				ESTADOS_SEGUIMIENTO.pendiente)
			: valor === null || valor === ''
				? '—'
				: String(valor);
</script>

{#if concepto.tipo === 'casilla'}
	{#if puedeEditar}
		<form method="POST" action={`${urlGuardar}#${ancla}`} use:enhance={enviar} class="de-casilla">
			<input type="hidden" name="accion" value="valor" />
			<input type="hidden" name="ancla" value={ancla} />
			<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
			<input type="hidden" name="actividad" value={actividad ?? ''} />
			<input type="hidden" name="conceptoId" value={concepto.id} />
			<input type="hidden" name="tipo" value={concepto.tipo} />
			<CasillaSeguimiento
				etiqueta={concepto.etiqueta}
				{contexto}
				marcada={valor === true}
				porDefinir={concepto.porDefinir}
				{puedeEditar}
			/>
		</form>
	{:else}
		<CasillaSeguimiento
			etiqueta={concepto.etiqueta}
			{contexto}
			marcada={valor === true}
			porDefinir={concepto.porDefinir}
			{puedeEditar}
		/>
	{/if}
{:else if puedeEditar}
	<form method="POST" action={`${urlGuardar}#${ancla}`} use:enhance={enviar} class="de-campo">
		<input type="hidden" name="accion" value="valor" />
		<input type="hidden" name="ancla" value={ancla} />
		<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
		<input type="hidden" name="actividad" value={actividad ?? ''} />
		<input type="hidden" name="conceptoId" value={concepto.id} />
		<input type="hidden" name="tipo" value={concepto.tipo} />
		<label for={id}>
			{concepto.etiqueta}
			{#if contexto}<span class="sr-only"> · {contexto}</span>{/if}
			{#if concepto.porDefinir}<span class="status-badge por-definir info">Por definir</span>{/if}
		</label>
		<div class="control">
			{#if concepto.tipo === 'estado'}
				<select
					{id}
					name="valor"
					value={valor ?? 'pendiente'}
					on:change={(evento) => evento.currentTarget.form?.requestSubmit()}
				>
					{#each Object.entries(ESTADOS_SEGUIMIENTO) as [estado, etiqueta] (estado)}
						<option value={estado}>{etiqueta}</option>
					{/each}
				</select>
				<noscript><button class="boton">Guardar</button></noscript>
			{:else}
				<input
					{id}
					type={concepto.tipo === 'cantidad'
						? 'number'
						: concepto.tipo === 'fecha'
							? 'date'
							: concepto.tipo === 'enlace'
								? 'url'
								: 'text'}
					min={concepto.tipo === 'cantidad' ? 0 : undefined}
					step={concepto.tipo === 'cantidad' ? 'any' : undefined}
					inputmode={concepto.tipo === 'cantidad' ? 'numeric' : undefined}
					enterkeyhint="done"
					autocomplete="off"
					maxlength={2048}
					name="valor"
					value={valor ?? ''}
				/>
				<button class="boton" aria-label={`Guardar ${nombre}`}>Guardar</button>
			{/if}
		</div>
	</form>
{:else}
	<p class="lectura">
		<span class="nombre">
			{concepto.etiqueta}
			{#if concepto.porDefinir}<span class="status-badge por-definir info">Por definir</span>{/if}
		</span>
		<span class="cifra">{texto}</span>
	</p>
{/if}

<style>
	.de-casilla {
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
	}
	.de-campo {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	label,
	.nombre {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		font-size: var(--texto-sm);
		font-weight: 600;
		color: var(--tinta);
	}
	.control {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.control input,
	.control select {
		flex: 1 1 auto;
		width: 100%;
		min-width: 0;
		min-height: 44px;
	}
	.control .boton {
		min-height: 44px;
	}
	.lectura {
		display: grid;
		gap: 2px;
		margin: 0;
		min-width: 0;
	}
	.lectura .cifra {
		overflow-wrap: anywhere;
	}
</style>
