<!-- Ajustes de una partida y mes: «Reprogramar» lo que falta a un mes posterior del periodo o marcarlo
     como «No ejecutado», con cantidad, motivo y nota (obligatoria con «Otro»), y la lista de ajustes
     vigentes con «Anular». El error del servidor se muestra dentro del diálogo; al registrar, la
     notificación ofrece «Deshacer» durante 10 s. -->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { faltan as faltanEn } from '$lib/dominio/cumplimiento';
	import {
		ETIQUETA_MOTIVO_AJUSTE,
		MOTIVOS_AJUSTE,
		type Ajuste,
		type CeldaPrograma
	} from '$lib/dominio/esquemas';
	import { textoMes } from '$lib/dominio/textos';
	import BotonesSegmentados from '$lib/components/ui/BotonesSegmentados.svelte';
	import Dialogo from '$lib/components/ui/Dialogo.svelte';

	export let abierto = false;
	export let programaId: string;
	export let partida: { id: string; numero: string; actividad: string };
	export let celda: CeldaPrograma;
	/** Meses del periodo del programa («AAAA-MM-01»). */
	export let meses: string[] = [];
	/** Al registrar o anular, con la respuesta de la acción. */
	export let alEnviar: (accion: 'registrarAjuste' | 'anularAjuste') => SubmitFunction = () => () =>
		undefined;
	/** Error del último envío, para mostrarlo dentro del diálogo. */
	export let error = '';

	const dispatch = createEventDispatcher<{ cancelar: void }>();

	let tipo: 'reprogramado' | 'no_ejecutado' = 'reprogramado';
	let cantidad = 1;
	let mesDestino = '';
	let motivo = '';
	let nota = '';
	let formulario: HTMLFormElement | undefined;

	$: falta = faltanEn(celda);
	$: posteriores = meses.filter((m) => m > celda.mes);
	$: if (!posteriores.includes(mesDestino)) mesDestino = posteriores[0] ?? '';
	$: if (cantidad > falta) cantidad = Math.max(falta, 1);
	$: notaObligatoria = motivo === 'otro';
	$: valido =
		falta > 0 &&
		cantidad >= 1 &&
		cantidad <= falta &&
		motivo !== '' &&
		(!notaObligatoria || nota.trim() !== '') &&
		(tipo === 'no_ejecutado' || mesDestino !== '');
	$: titulo = `Partida ${partida.numero} · ${textoMes(celda.mes, { inicial: true })}`;
	// Sin reprogramación posible no se ofrece la opción.
	$: opciones = [
		...(posteriores.length ? [{ valor: 'reprogramado', texto: 'Reprogramar' }] : []),
		{ valor: 'no_ejecutado', texto: 'No ejecutado' }
	];
	$: if (!posteriores.length) tipo = 'no_ejecutado';

	function confirmar() {
		formulario?.requestSubmit();
	}

	const textoAjuste = (a: Ajuste) =>
		a.tipo === 'reprogramado'
			? a.mesOrigen === celda.mes
				? `${a.cantidad} reprogramado a ${textoMes(a.mesDestino!)}`
				: `${a.cantidad} llega reprogramado desde ${textoMes(a.mesOrigen)}`
			: `${a.cantidad} no ejecutado`;

	export async function reiniciar() {
		tipo = posteriores.length ? 'reprogramado' : 'no_ejecutado';
		cantidad = Math.max(Math.min(falta, 1), 1);
		motivo = '';
		nota = '';
		await tick();
	}
</script>

<Dialogo
	id="ajuste"
	bind:abierto
	{titulo}
	textoConfirmar={tipo === 'reprogramado' ? 'Reprogramar' : 'Marcar no ejecutado'}
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
			action="?/registrarAjuste"
			use:enhance={alEnviar('registrarAjuste')}
			class="formulario"
		>
			<input type="hidden" name="programaId" value={programaId} />
			<input type="hidden" name="partidaId" value={partida.id} />
			<input type="hidden" name="mesOrigen" value={celda.mes} />
			<input type="hidden" name="tipo" value={tipo} />
			<p>Falta{falta === 1 ? '' : 'n'} {falta} en {textoMes(celda.mes)}.</p>
			<BotonesSegmentados
				id="ajuste-tipo"
				etiqueta="Acción"
				{opciones}
				valor={tipo}
				on:change={(e) => (tipo = e.detail as typeof tipo)}
			/>
			<label for="ajuste-cantidad">Cantidad</label>
			<input
				id="ajuste-cantidad"
				name="cantidad"
				type="number"
				min="1"
				max={falta}
				step="1"
				bind:value={cantidad}
			/>
			{#if tipo === 'reprogramado'}
				<label for="ajuste-destino">Mes destino</label>
				<select id="ajuste-destino" name="mesDestino" bind:value={mesDestino}>
					{#each posteriores as mes (mes)}
						<option value={mes}>{textoMes(mes, { inicial: true })}</option>
					{/each}
				</select>
			{/if}
			<label for="ajuste-motivo">Motivo</label>
			<select id="ajuste-motivo" name="motivo" bind:value={motivo}>
				<option value="" disabled>Elija el motivo</option>
				{#each MOTIVOS_AJUSTE as valor (valor)}
					<option value={valor}>{ETIQUETA_MOTIVO_AJUSTE[valor]}</option>
				{/each}
			</select>
			<label for="ajuste-nota"
				>Nota{notaObligatoria ? ' (obligatoria con «Otro»)' : ' (opcional)'}</label
			>
			<input
				id="ajuste-nota"
				name="nota"
				maxlength="500"
				bind:value={nota}
				required={notaObligatoria}
				aria-invalid={notaObligatoria && nota.trim() === '' ? 'true' : undefined}
			/>
		</form>
	{:else}
		<p>No falta nada por ejecutar en {textoMes(celda.mes)}.</p>
	{/if}
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
	{#if celda.ajustes.length}
		<h3 class="subtitulo">Ajustes de este mes</h3>
		<ul class="ajustes">
			{#each celda.ajustes as a (a.id)}
				<li>
					<span
						>{textoAjuste(a)} · {ETIQUETA_MOTIVO_AJUSTE[a.motivo]}{a.nota
							? ` (${a.nota})`
							: ''}</span
					>
					<form method="POST" action="?/anularAjuste" use:enhance={alEnviar('anularAjuste')}>
						<input type="hidden" name="id" value={a.id} />
						<button
							class="boton"
							type="submit"
							disabled={a.bloqueantes > 0}
							aria-describedby={a.bloqueantes || a.borradores ? `nota-ajuste-${a.id}` : undefined}
							>Anular</button
						>
					</form>
					{#if a.bloqueantes > 0}
						<p id={`nota-ajuste-${a.id}`} class="nota">
							No se puede anular: tiene reportes en revisión o emitidos.
						</p>
					{:else if a.borradores > 0}
						<p id={`nota-ajuste-${a.id}`} class="nota">
							Al anularlo, {a.borradores === 1 ? 'su borrador deja' : 'sus borradores dejan'} de estar
							ligado{a.borradores === 1 ? '' : 's'} a la reprogramación.
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</Dialogo>

<style>
	.actividad {
		margin: 0;
		color: var(--muted);
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
	.formulario input,
	.formulario select {
		max-width: 100%;
	}
	.error {
		margin: 8px 0 0;
		color: var(--danger);
	}
	.subtitulo {
		margin: 12px 0 4px;
		font-size: 0.9rem;
	}
	.ajustes {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 6px;
	}
	.ajustes li {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.ajustes form {
		display: inline;
	}
	.nota {
		flex-basis: 100%;
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
