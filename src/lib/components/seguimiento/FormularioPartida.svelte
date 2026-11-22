<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { textoMes } from '$lib/dominio/textos';
	import { alGuardar, resultadoDe, ultimoDiaDelMes, type EstadoCaptura } from './captura';

	/** Alta de una partida escrita a mano, con las veces que se ejecuta en el mes. */
	/** Identificador de la partida nueva: lo genera la carga, así repetir el envío no la duplica. */
	export let id: string;
	/** El centro tiene programa anual: la partida queda «Fuera del programa». */
	export let fueraDelPrograma: boolean;
	export let mes: string;
	export let urlGuardar: string;
	export let plantillaId: string | null;
	export let enviar: SubmitFunction;
	export let captura: EstadoCaptura;

	const ANCLA = 'nueva-partida';

	$: resultado = resultadoDe(captura, ANCLA);
	let abierto = false;
	$: if (resultado.error) abierto = true;
	const alAgregar = alGuardar(enviar, () => (abierto = false));
</script>

<details class="nueva" id={ANCLA} bind:open={abierto}>
	<summary class="resumen-boton boton contorno">
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.25"
			stroke-linecap="round"
			aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
		>
		{fueraDelPrograma ? 'Agregar una partida que no está en el programa' : 'Agregar partida'}
	</summary>
	<form method="POST" action={`${urlGuardar}#${ANCLA}`} use:enhance={alAgregar} class="formulario">
		<input type="hidden" name="ancla" value={ANCLA} />
		<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
		<input type="hidden" name="id" value={id} />
		{#if resultado.error}
			<p class="aviso aviso-error" role="alert">{resultado.error}</p>
		{/if}
		<div class="form-group">
			<label for="nueva-partida-nombre">Nombre de la partida</label>
			<input
				id="nueva-partida-nombre"
				name="nombre"
				required
				maxlength="250"
				autocomplete="off"
				aria-describedby="nueva-partida-nombre-ayuda"
			/>
			<p class="view-note" id="nueva-partida-nombre-ayuda">
				Escríbalo como aparece en la orden de trabajo.
			</p>
		</div>
		<div class="par">
			<div class="form-group">
				<label for="nueva-partida-veces">Veces en el mes</label>
				<input
					id="nueva-partida-veces"
					name="veces"
					type="number"
					min="1"
					max="31"
					step="1"
					value="1"
					required
					inputmode="numeric"
					aria-describedby="nueva-partida-veces-ayuda"
				/>
				<p class="view-note" id="nueva-partida-veces-ayuda">
					Cuántas veces se ejecuta en {textoMes(mes)}.
				</p>
			</div>
			<div class="form-group">
				<label for="nueva-partida-fecha">Fecha prevista (opcional)</label>
				<input
					id="nueva-partida-fecha"
					name="fecha"
					type="date"
					min={`${mes}-01`}
					max={ultimoDiaDelMes(mes)}
				/>
			</div>
		</div>
		<button class="boton primario enviar" name="accion" value="nuevaActividad"
			>Agregar partida</button
		>
	</form>
</details>

<style>
	.nueva {
		margin-top: 16px;
		scroll-margin-top: 16px;
	}
	.nueva > summary {
		display: flex;
		width: 100%;
		min-height: 44px;
		list-style: none;
		white-space: normal;
		text-align: center;
	}
	.nueva > summary::-webkit-details-marker {
		display: none;
	}
	.nueva > summary svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}
	.formulario {
		display: grid;
		max-width: 36rem;
		margin-top: 12px;
		padding: 16px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-panel);
		background: var(--superficie-alta);
	}
	.par {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
		gap: 0 16px;
	}
	.enviar {
		min-height: 44px;
	}
	@media (min-width: 769px) {
		.nueva > summary {
			display: inline-flex;
			width: auto;
		}
		.enviar {
			justify-self: start;
		}
	}
</style>
