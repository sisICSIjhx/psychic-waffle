<!-- Confirmación de una corrección del catálogo: cada dato antes → después, el impacto en los
     reportes, la casilla para actualizar también los borradores (solo si hay borradores afectados) y
     el motivo obligatorio. «Confirmar» envía la misma corrección a ?/aplicarCambio; Esc y «Cancelar»
     cierran sin guardar y el foco vuelve a quien abrió el diálogo. -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		datoDelCambio,
		describirCambio,
		MOTIVO_MAXIMO,
		resumenImpacto,
		validarMotivo
	} from '$lib/dominio/bitacora';
	import type { ResultadoEdicion } from '$lib/dominio/esquemas';
	import Dialogo from '$lib/components/ui/Dialogo.svelte';

	export let abierto = false;
	/** Campos de la corrección tal como se ensayó (incluye `tipo`). */
	export let campos: Record<string, string> = {};
	export let resultado: ResultadoEdicion | null = null;
	/** Al terminar el envío, con la respuesta de la acción. */
	export let alAplicar: SubmitFunction = () => undefined;

	const dispatch = createEventDispatcher<{ cancelar: void }>();

	const TITULOS: Record<string, string> = {
		contrato: 'Confirmar la corrección del contrato',
		sitio: 'Confirmar la corrección del sitio',
		quitarSitio: 'Confirmar que se quita el sitio del contrato',
		corregirFirmante: 'Confirmar la corrección del firmante',
		cambiarFirmante: 'Confirmar el cambio de firmante'
	};

	let motivo = '';
	let actualizarBorradores = true;
	let formulario: HTMLFormElement | undefined;

	// Cada ensayo nuevo empieza con el motivo vacío y la casilla marcada.
	$: if (resultado) reiniciar();
	$: tipo = campos.tipo ?? '';
	$: validacion = validarMotivo(motivo);
	$: largo = motivo.trim().length;
	$: impacto = resultado
		? resumenImpacto(resultado.impacto, datoDelCambio(tipo, resultado.cambios))
		: [];

	function reiniciar() {
		motivo = '';
		actualizarBorradores = true;
	}

	function confirmar() {
		formulario?.requestSubmit();
	}
</script>

<Dialogo
	id="cambio-catalogo"
	bind:abierto
	titulo={TITULOS[tipo] ?? 'Confirmar el cambio'}
	textoConfirmar="Confirmar"
	confirmarDeshabilitado={!validacion.valido}
	on:confirmar={confirmar}
	on:cancelar={() => dispatch('cancelar')}
>
	{#if resultado}
		<form bind:this={formulario} method="POST" action="?/aplicarCambio" use:enhance={alAplicar}>
			{#each Object.entries(campos) as [campo, valor] (campo)}
				<input type="hidden" name={campo} value={valor} />
			{/each}
			<h3 class="subtitulo">Cambios</h3>
			<ul class="lista">
				{#each resultado.cambios as cambio (cambio.campo)}
					<li>{describirCambio(cambio)}</li>
				{/each}
			</ul>
			{#if impacto.length}
				<h3 class="subtitulo">Impacto en los reportes</h3>
				<ul class="lista">
					{#each impacto as frase (frase)}<li>{frase}</li>{/each}
				</ul>
			{/if}
			{#if resultado.impacto.borradores > 0}
				<label class="casilla">
					<input type="checkbox" name="actualizarBorradores" bind:checked={actualizarBorradores} />
					Actualizar también los borradores
				</label>
			{/if}
			<label class="etiqueta" for="cambio-motivo">Motivo del cambio (obligatorio)</label>
			<textarea
				id="cambio-motivo"
				name="motivo"
				rows="3"
				maxlength={MOTIVO_MAXIMO + 50}
				aria-describedby="cambio-motivo-ayuda"
				bind:value={motivo}
			></textarea>
			<p id="cambio-motivo-ayuda" class="ayuda" class:error={motivo !== '' && !validacion.valido}>
				{largo}/{MOTIVO_MAXIMO}{validacion.valido ? '' : ` · ${validacion.mensaje}`}
			</p>
		</form>
	{/if}
</Dialogo>

<style>
	.subtitulo {
		margin: 8px 0 4px;
		font-size: 0.9rem;
	}
	.lista {
		margin: 0;
		padding-left: 20px;
		overflow-wrap: anywhere;
	}
	.casilla {
		display: flex;
		gap: 8px;
		align-items: center;
		margin: 12px 0 4px;
	}
	.etiqueta {
		display: block;
		margin-top: 12px;
		font-weight: 600;
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		margin-top: 4px;
	}
	.ayuda {
		margin: 4px 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.ayuda.error {
		color: var(--danger);
	}
</style>
