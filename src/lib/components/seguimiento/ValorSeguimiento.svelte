<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ESTADOS_SEGUIMIENTO } from '$lib/dominio/seguimiento-operativo';
	import type { SeguimientoOperativo } from '$lib/server/repositorios/seguimiento';
	import CasillaSeguimiento from './CasillaSeguimiento.svelte';

	export let concepto: SeguimientoOperativo['conceptos'][number];
	export let valor: SeguimientoOperativo['valores'][number]['valor'] = null;
	export let actividad: string | null = null;
	export let etiqueta: string;
	export let urlGuardar: string;
	export let plantillaId: string | null;
	export let puedeEditar: boolean;
	export let enviar: SubmitFunction;
</script>

{#if puedeEditar}
	<form method="POST" action={urlGuardar} use:enhance={enviar} class="valor">
		<input type="hidden" name="accion" value="valor" />
		<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
		<input type="hidden" name="actividad" value={actividad ?? ''} />
		<input type="hidden" name="conceptoId" value={concepto.id} />
		<input type="hidden" name="tipo" value={concepto.tipo} />
		{#if concepto.tipo === 'casilla'}
			<CasillaSeguimiento {etiqueta} marcada={valor === true} {puedeEditar} />
		{:else if concepto.tipo === 'estado'}
			<select
				name="valor"
				aria-label={etiqueta}
				value={valor ?? 'pendiente'}
				on:change={(event) => event.currentTarget.form?.requestSubmit()}
			>
				{#each Object.entries(ESTADOS_SEGUIMIENTO) as [estado, texto] (estado)}
					<option value={estado}>{texto}</option>
				{/each}
			</select>
			<noscript><button class="boton compacto">Guardar</button></noscript>
		{:else}
			<input
				type={concepto.tipo === 'cantidad'
					? 'number'
					: concepto.tipo === 'fecha'
						? 'date'
						: concepto.tipo === 'enlace'
							? 'url'
							: 'text'}
				min={concepto.tipo === 'cantidad' ? 0 : undefined}
				step={concepto.tipo === 'cantidad' ? 'any' : undefined}
				maxlength={2048}
				name="valor"
				aria-label={etiqueta}
				value={valor ?? ''}
			/>
			<button class="boton compacto" aria-label={`Guardar ${etiqueta}`}>Guardar</button>
		{/if}
	</form>
{:else if concepto.tipo === 'casilla'}
	<CasillaSeguimiento {etiqueta} marcada={valor === true} {puedeEditar} />
{:else if concepto.tipo === 'estado'}
	{ESTADOS_SEGUIMIENTO[valor as keyof typeof ESTADOS_SEGUIMIENTO] ?? ESTADOS_SEGUIMIENTO.pendiente}
{:else}
	{valor ?? '—'}
{/if}

<style>
	.valor {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	input:not([type='hidden']),
	select {
		min-width: 7rem;
		max-width: 13rem;
	}
</style>
