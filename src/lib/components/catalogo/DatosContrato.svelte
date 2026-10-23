<!-- Datos del contrato con «Editar» para corregir número, descripción y vigencia. El cliente no cambia
     (una renovación se registra como contrato nuevo). «Revisar cambios» envía a ?/ensayarCambio; si
     el cálculo detecta un error se muestra junto al campo y no se abre la confirmación. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { textoFueraDeVigencia, valorCambio } from '$lib/dominio/bitacora';
	import type { Contrato } from '$lib/dominio/esquemas';
	import ErrorCampo from '$lib/components/reportes/ErrorCampo.svelte';

	export let contrato: Contrato;
	export let puedeEditar = true;
	/** Error del último ensayo de este contrato: { motivo, error, detalle }. */
	export let error: {
		motivo?: string | null;
		error?: string;
		detalle?: Record<string, unknown>;
	} | null = null;

	let editando = false;
	let valores = desde(contrato);
	let sinCambios = false;
	let version = contrato.actualizadoEn;

	// Al recargar el contrato tras guardar (versión nueva), se vuelve a la lectura.
	$: if (contrato.actualizadoEn !== version) {
		version = contrato.actualizadoEn;
		valores = desde(contrato);
		editando = false;
	}
	$: errorNumero = error?.motivo === 'contrato_duplicado' ? (error.error ?? '') : '';
	$: fuera =
		error?.motivo === 'vigencia_con_datos_fuera'
			? textoFueraDeVigencia(
					(error.detalle?.fuera as { tipo: string; sitio: string | null; meses: string[] }[]) ?? []
				)
			: [];
	$: errorGeneral = error && !errorNumero && !fuera.length ? (error.error ?? '') : '';

	function desde(k: Contrato) {
		return {
			numero: k.numero,
			descripcion: k.descripcion ?? '',
			vigenciaInicio: k.vigenciaInicio,
			vigenciaFin: k.vigenciaFin
		};
	}

	function abrir() {
		valores = desde(contrato);
		sinCambios = false;
		editando = true;
	}

	// Sin diferencias no se consulta al servidor: se avisa junto al formulario.
	const revisar: SubmitFunction = ({ cancel }) => {
		const original = desde(contrato);
		sinCambios =
			valores.numero.trim() === original.numero &&
			valores.descripcion.trim() === original.descripcion &&
			valores.vigenciaInicio === original.vigenciaInicio &&
			valores.vigenciaFin === original.vigenciaFin;
		if (sinCambios) cancel();
		return async ({ update }) => update({ reset: false });
	};
</script>

<section class="card" aria-labelledby="titulo-contrato">
	<h2 id="titulo-contrato" class="view-heading">
		{contrato.cliente?.razonSocial ?? ''} · Contrato {contrato.numero}
	</h2>
	{#if !editando}
		<dl class="datos">
			<dt>Cliente</dt>
			<dd>{contrato.cliente?.razonSocial ?? '—'}</dd>
			<dt>Número</dt>
			<dd>{contrato.numero}</dd>
			<dt>Descripción</dt>
			<dd>{contrato.descripcion || '—'}</dd>
			<dt>Vigencia</dt>
			<dd>
				Del {valorCambio(contrato.vigenciaInicio)} al {valorCambio(contrato.vigenciaFin)}
				{#if contrato.vigente}<span class="status-badge vigente">Vigente</span>{/if}
			</dd>
		</dl>
		{#if puedeEditar}
			<button type="button" class="boton" on:click={abrir}>Editar datos del contrato</button>
		{/if}
	{:else}
		<form method="POST" action="?/ensayarCambio" use:enhance={revisar} class="form-grid">
			<input type="hidden" name="tipo" value="contrato" />
			<input type="hidden" name="actualizadoEn" value={contrato.actualizadoEn} />
			<div class="form-group fijo">
				<span class="etiqueta-campo">Cliente</span>
				<p class="valor-fijo">{contrato.cliente?.razonSocial ?? '—'}</p>
				<p class="nota">
					El cliente no cambia: una renovación u orden de compra nueva se registra como contrato
					nuevo.
				</p>
			</div>
			<div class="form-group">
				<label for="contrato-numero">Número</label>
				<input
					id="contrato-numero"
					name="numero"
					required
					bind:value={valores.numero}
					aria-invalid={errorNumero ? 'true' : undefined}
					aria-describedby={errorNumero ? 'error-contrato-numero' : undefined}
				/>
				<ErrorCampo id="error-contrato-numero" mensaje={errorNumero} />
			</div>
			<div class="form-group">
				<label for="contrato-descripcion">Descripción (opcional)</label>
				<input id="contrato-descripcion" name="descripcion" bind:value={valores.descripcion} />
			</div>
			<div class="form-group">
				<label for="contrato-inicio">Inicio de la vigencia</label>
				<input
					id="contrato-inicio"
					name="vigenciaInicio"
					type="date"
					required
					bind:value={valores.vigenciaInicio}
					aria-describedby={fuera.length ? 'error-contrato-vigencia' : undefined}
				/>
			</div>
			<div class="form-group">
				<label for="contrato-fin">Fin de la vigencia</label>
				<input
					id="contrato-fin"
					name="vigenciaFin"
					type="date"
					required
					bind:value={valores.vigenciaFin}
					aria-describedby={fuera.length ? 'error-contrato-vigencia' : undefined}
				/>
			</div>
			{#if fuera.length}
				<div id="error-contrato-vigencia" class="fuera" role="alert">
					<p>La vigencia deja fuera:</p>
					<ul>
						{#each fuera as linea (linea)}<li>{linea}</li>{/each}
					</ul>
				</div>
			{/if}
			{#if sinCambios}
				<p class="aviso-formulario" role="status">No hay cambios que guardar.</p>
			{:else if errorGeneral}
				<p class="aviso-formulario error" role="alert">{errorGeneral}</p>
			{/if}
			<div class="form-group acciones-formulario">
				<button class="boton primario" type="submit">Revisar cambios</button>
				<button class="boton" type="button" on:click={() => (editando = false)}>Cancelar</button>
			</div>
		</form>
	{/if}
</section>

<style>
	.datos {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 4px 16px;
		margin: 0 0 12px;
	}
	.datos dt {
		font-weight: 600;
	}
	.datos dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.fijo {
		grid-column: 1 / -1;
	}
	.valor-fijo {
		margin: 0;
		font-weight: 600;
	}
	.nota {
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.fuera,
	.aviso-formulario {
		grid-column: 1 / -1;
		margin: 0;
		font-size: 0.9rem;
	}
	.fuera {
		color: var(--danger);
	}
	.fuera p,
	.fuera ul {
		margin: 0;
	}
	.aviso-formulario.error {
		color: var(--danger);
	}
</style>
