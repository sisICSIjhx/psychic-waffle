<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import EstadoGuardado from '$lib/components/ui/EstadoGuardado.svelte';
	import SelectorPersonas from '$lib/components/ui/SelectorPersonas.svelte';
	import { textoHorario } from '$lib/dominio/seguimiento-operativo';
	import { textoMes } from '$lib/dominio/textos';
	import type {
		AtencionEmergencia,
		SeguimientoOperativo
	} from '$lib/server/repositorios/seguimiento';
	import {
		resultadoDe,
		textoBreve,
		textoDiaMes,
		ultimoDiaDelMes,
		type EstadoCaptura
	} from './captura';

	/** Atenciones de emergencia del mes: la lista y el alta con horario y quién asistió. */
	export let atenciones: AtencionEmergencia[];
	export let personal: SeguimientoOperativo['personal'];
	export let fechaSugerida: string;
	export let mes: string;
	/** Identificador de la atención nueva: lo genera la carga, así repetir el envío no la duplica. */
	export let idNueva: string;
	export let urlGuardar: string;
	export let plantillaId: string | null;
	export let puedeEditar: boolean;
	export let enviar: SubmitFunction;
	export let captura: EstadoCaptura;

	const ANCLA = 'emergencias';

	$: resultado = resultadoDe(captura, ANCLA);
	// Abierto solo si falló el alta; al registrar, el formulario se rehace cerrado.
	let abierto = false;
	$: if (idNueva) abierto = false;
	$: fallaAlta = Boolean(resultado.error) && captura.accion === 'nuevaNocturna';
	$: if (fallaAlta) abierto = true;
</script>

<section class="card seccion" id={ANCLA} aria-labelledby="titulo-emergencias">
	<div class="encabezado">
		<h2 class="view-heading" id="titulo-emergencias" tabindex="-1">Atenciones de emergencia</h2>
		{#if puedeEditar}
			<EstadoGuardado estado={resultado.fase} mensaje={textoBreve(resultado.mensaje)} />
		{/if}
	</div>
	{#if resultado.error && !fallaAlta}
		<p class="aviso aviso-error" role="alert">{resultado.error}</p>
	{/if}

	{#if atenciones.length}
		<ul class="lista">
			{#each atenciones as atencion (atencion.id)}
				{@const horario = textoHorario(atencion.horaInicio, atencion.horaFin)}
				<li>
					<div class="datos">
						<p class="cuando">
							<time datetime={atencion.fecha}>{textoDiaMes(atencion.fecha)}</time>
							<span class="horario">{horario || 'Sin horario'}</span>
						</p>
						{#if atencion.asistentes.length}
							<p class="quien">
								<span class="sr-only">Asistieron: </span>{atencion.asistentes
									.map((a) => a.nombre)
									.join(', ')}
							</p>
						{/if}
						{#if atencion.descripcion}<p class="que">{atencion.descripcion}</p>{/if}
					</div>
					{#if puedeEditar}
						<form method="POST" action={`${urlGuardar}#${ANCLA}`} use:enhance={enviar}>
							<input type="hidden" name="ancla" value={ANCLA} />
							<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
							<input type="hidden" name="id" value={atencion.id} />
							<button
								class="boton peligro quitar"
								name="accion"
								value="quitarNocturna"
								aria-label={`Quitar la atención del ${textoDiaMes(atencion.fecha)}${horario ? `, ${horario}` : ''}`}
								>Quitar</button
							>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="view-note vacio">
			Sin atenciones de emergencia en {textoMes(mes)}.{puedeEditar
				? ' Si atendió una, regístrela aquí.'
				: ''}
		</p>
	{/if}

	{#if puedeEditar}
		{#key idNueva}
			<details class="alta" bind:open={abierto}>
				<summary class="resumen-boton boton primario">Registrar atención de emergencia</summary>
				<form
					method="POST"
					action={`${urlGuardar}#${ANCLA}`}
					use:enhance={enviar}
					class="formulario"
				>
					<input type="hidden" name="ancla" value={ANCLA} />
					<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
					<input type="hidden" name="id" value={idNueva} />
					<div class="form-group">
						<label for="emergencia-fecha">Fecha</label>
						<input
							id="emergencia-fecha"
							type="date"
							name="fecha"
							required
							min={`${mes}-01`}
							max={ultimoDiaDelMes(mes)}
							value={fechaSugerida}
						/>
					</div>
					<div class="horas">
						<div class="form-group">
							<label for="emergencia-inicio">Hora de inicio (opcional)</label>
							<input id="emergencia-inicio" type="time" name="horaInicio" />
						</div>
						<div class="form-group">
							<label for="emergencia-fin">Hora de fin (opcional)</label>
							<input
								id="emergencia-fin"
								type="time"
								name="horaFin"
								aria-describedby="emergencia-fin-ayuda"
							/>
						</div>
						<p class="view-note ayuda" id="emergencia-fin-ayuda">
							Si terminó después de medianoche, escriba la hora tal cual.
						</p>
					</div>
					<SelectorPersonas
						id="emergencia-asistentes"
						leyenda="Quién asistió (opcional)"
						nombre="asistentes"
						personas={personal}
					/>
					<div class="form-group">
						<label for="emergencia-descripcion">Qué se atendió (opcional)</label>
						<textarea id="emergencia-descripcion" name="descripcion" maxlength="1000" rows="3"
						></textarea>
					</div>
					{#if fallaAlta}
						<p class="aviso aviso-error" role="alert">{resultado.error}</p>
					{/if}
					<button class="boton primario enviar" name="accion" value="nuevaNocturna"
						>Registrar atención</button
					>
				</form>
			</details>
		{/key}
	{/if}
</section>

<style>
	.seccion {
		scroll-margin-top: 16px;
		min-width: 0;
	}
	.encabezado {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
		margin-bottom: 12px;
	}
	.encabezado .view-heading {
		margin: 0;
	}
	.lista {
		margin: 0 0 16px;
		padding: 0;
		list-style: none;
	}
	.lista li {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px 16px;
		padding-block: 12px;
		border-bottom: 1px solid var(--linea);
	}
	.datos {
		display: grid;
		gap: 2px;
		flex: 1 1 0;
		min-width: 0;
	}
	.datos p {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.cuando {
		display: flex;
		flex-wrap: wrap;
		gap: 0 10px;
		align-items: baseline;
	}
	time {
		font-weight: 700;
	}
	.horario {
		font-variant-numeric: tabular-nums;
		color: var(--tinta-secundaria);
	}
	.quien {
		font-weight: 600;
	}
	.que {
		color: var(--tinta-secundaria);
	}
	.quitar {
		min-height: 44px;
	}
	.vacio {
		margin-bottom: 16px;
	}
	.alta > summary {
		display: flex;
		width: 100%;
		min-height: 44px;
		list-style: none;
		white-space: normal;
		text-align: center;
	}
	.alta > summary::-webkit-details-marker {
		display: none;
	}
	.formulario {
		display: grid;
		max-width: 36rem;
		margin-top: 12px;
		padding: 16px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-panel);
		background: var(--superficie-alta);
		min-width: 0;
	}
	.horas {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 12px;
		align-items: end;
	}
	.horas .form-group {
		margin-bottom: 6px;
		min-width: 0;
	}
	.horas .ayuda {
		grid-column: 1 / -1;
		margin-bottom: 16px;
	}
	.formulario .aviso {
		margin-bottom: 12px;
	}
	.enviar {
		min-height: 44px;
	}
	@media (min-width: 769px) {
		.alta > summary {
			display: inline-flex;
			width: auto;
		}
		.enviar {
			justify-self: start;
		}
	}
</style>
