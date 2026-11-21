<!-- «Marcar ejecutado» de una partida y mes sin reporte todavía (cambio marcar-ejecutado): cantidad
     (hasta lo que falta), fecha de ejecución obligatoria dentro del mes y no posterior a hoy, y nota
     opcional. El reporte emitido del mismo mes absorbe la marca. El error del servidor se muestra
     dentro del diálogo; al registrar, la notificación ofrece «Deshacer» durante 10 s. -->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { faltan as faltanEn } from '$lib/dominio/cumplimiento';
	import type { CeldaPrograma } from '$lib/dominio/esquemas';
	import { textoMes } from '$lib/dominio/textos';
	import Dialogo from '$lib/components/ui/Dialogo.svelte';

	export let abierto = false;
	export let programaId: string;
	export let partida: { id: string; numero: string; actividad: string };
	export let celda: CeldaPrograma;
	/** Fecha de hoy («AAAA-MM-DD»), tope de la fecha de ejecución. */
	export let hoy: string;
	export let alEnviar: SubmitFunction = () => undefined;
	/** Error del último envío, para mostrarlo dentro del diálogo. */
	export let error = '';

	const dispatch = createEventDispatcher<{ cancelar: void }>();

	let cantidad = 1;
	let fecha = '';
	let nota = '';
	let formulario: HTMLFormElement | undefined;

	$: falta = faltanEn(celda);
	$: if (cantidad > falta) cantidad = Math.max(falta, 1);
	$: primerDia = celda.mes;
	$: ultimoDia = (() => {
		const [anio, mes] = celda.mes.split('-').map(Number);
		const fin = `${celda.mes.slice(0, 8)}${String(new Date(Date.UTC(anio, mes, 0)).getUTCDate()).padStart(2, '0')}`;
		return fin < hoy ? fin : hoy;
	})();
	$: fechaValida = fecha !== '' && fecha >= primerDia && fecha <= ultimoDia;
	$: valido = falta > 0 && cantidad >= 1 && cantidad <= falta && fechaValida;
	$: titulo = `Partida ${partida.numero} · ${textoMes(celda.mes, { inicial: true })}`;

	function confirmar() {
		formulario?.requestSubmit();
	}

	export async function reiniciar() {
		cantidad = Math.max(falta, 1);
		fecha = '';
		nota = '';
		await tick();
	}
</script>

<Dialogo
	id="ejecutado"
	bind:abierto
	{titulo}
	textoConfirmar="Marcar ejecutado"
	confirmarDeshabilitado={!valido}
	conConfirmar={falta > 0}
	on:confirmar={confirmar}
	on:cancelar={() => dispatch('cancelar')}
>
	<p class="actividad">{partida.actividad}</p>
	{#if falta > 0}
		<form
			bind:this={formulario}
			method="POST"
			action="?/marcarEjecutado"
			use:enhance={alEnviar}
			class="formulario"
		>
			<input type="hidden" name="programaId" value={programaId} />
			<input type="hidden" name="partidaId" value={partida.id} />
			<input type="hidden" name="mes" value={celda.mes} />
			<p>
				Registra que el trabajo ya se hizo aunque su reporte no esté emitido. Cuando se emita el
				reporte de {textoMes(celda.mes)}, la marca queda cubierta y no cuenta dos veces.
			</p>
			{#if falta > 1}
				<label for="ejecutado-cantidad">Cantidad ejecutada (faltan {falta})</label>
				<input
					id="ejecutado-cantidad"
					name="cantidad"
					type="number"
					min="1"
					max={falta}
					step="1"
					bind:value={cantidad}
				/>
			{:else}
				<input type="hidden" name="cantidad" value="1" />
			{/if}
			<label for="ejecutado-fecha">Fecha de ejecución</label>
			<input
				id="ejecutado-fecha"
				name="fecha"
				type="date"
				min={primerDia}
				max={ultimoDia}
				bind:value={fecha}
				required
				aria-invalid={fecha !== '' && !fechaValida ? 'true' : undefined}
			/>
			<label for="ejecutado-nota">Nota (opcional)</label>
			<input id="ejecutado-nota" name="nota" maxlength="500" bind:value={nota} />
		</form>
	{:else}
		<p>No falta nada por ejecutar en {textoMes(celda.mes)}.</p>
	{/if}
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
</Dialogo>

<style>
	.actividad {
		margin: 0;
		color: var(--tinta-tenue);
		overflow-wrap: anywhere;
	}
	.formulario {
		display: grid;
		gap: 6px;
	}
	.formulario p {
		margin: 0 0 4px;
	}
	.formulario label {
		margin-top: 6px;
		font-weight: 600;
	}
	.formulario input {
		max-width: 100%;
	}
	.error {
		margin: 8px 0 0;
		color: var(--peligro);
	}
</style>
