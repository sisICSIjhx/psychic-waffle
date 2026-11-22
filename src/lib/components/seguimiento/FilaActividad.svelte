<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import EstadoGuardado from '$lib/components/ui/EstadoGuardado.svelte';
	import type {
		ActividadSeguimiento,
		ConceptoSeguimientoOperativo
	} from '$lib/server/repositorios/seguimiento';
	import {
		claveValor,
		esDocumento,
		resultadoDe,
		textoBreve,
		textoDiaMes,
		valorHecho,
		type EstadoCaptura,
		type MapaValores
	} from './captura';
	import CasillaSeguimiento from './CasillaSeguimiento.svelte';
	import ValorSeguimiento from './ValorSeguimiento.svelte';

	/** Una ejecución de la partida: marcarla ejecutada y sus documentos. */
	export let actividad: ActividadSeguimiento;
	/** «Ejecución 1 de 3»; con una sola ejecución, «Ejecución». */
	export let titulo: string;
	/** Para los nombres accesibles: «Partida X, ejecución 1». */
	export let contexto: string;
	/** Documentos que se marcan en cada ejecución. */
	export let conceptos: ConceptoSeguimientoOperativo[];
	/** Documentos de la partida, si esta es su primera ejecución: «Marcar todo hecho» también los marca. */
	export let conceptosPartida: ConceptoSeguimientoOperativo[] = [];
	export let valores: MapaValores;
	export let hoy: string;
	/** Ancla propia de la fila: el resultado de guardar aparece junto a ella. */
	export let ancla: string;
	export let urlGuardar: string;
	export let plantillaId: string | null;
	export let puedeEditar: boolean;
	export let enviar: SubmitFunction;
	export let captura: EstadoCaptura;

	$: resultado = resultadoDe(captura, ancla);
	const valorDe = (valores: MapaValores, clave: string, concepto: ConceptoSeguimientoOperativo) =>
		valores.get(claveValor(clave, concepto.id)) ?? null;
	$: casillas = conceptos.filter((c) => c.tipo === 'casilla');
	$: campos = conceptos.filter((c) => c.tipo !== 'casilla');
	$: faltaAlgo =
		!actividad.ejecutada ||
		[...conceptos, ...conceptosPartida].some(
			(c) => esDocumento(c) && !valorHecho(c, valorDe(valores, actividad.clave, c))
		);
</script>

<div class="fila" class:ejecutada={actividad.ejecutada} id={ancla}>
	<div class="cabecera">
		<h4 tabindex="-1">
			{titulo}
			{#if actividad.fecha}<span class="fecha"> · {textoDiaMes(actividad.fecha)}</span>{/if}
		</h4>
		{#if actividad.fecha === hoy}<span class="status-badge">Hoy</span>{/if}
		{#if !actividad.programada}
			<span class="status-badge warn">Ya no está en el programa</span>
		{/if}
		{#if puedeEditar}
			<span class="estado">
				<EstadoGuardado estado={resultado.fase} mensaje={textoBreve(resultado.mensaje)} />
			</span>
		{/if}
	</div>
	{#if resultado.error}
		<p class="aviso aviso-error" role="alert">{resultado.error}</p>
	{/if}

	<!-- Un solo formulario por ejecución: cada botón dice qué marca (`marca` = «ejecucion:true»,
	     «<documento>:false» o «fila»). Así una partida diaria no multiplica formularios. -->
	{#if puedeEditar}
		<form
			method="POST"
			action={`${urlGuardar}#${ancla}`}
			use:enhance={enviar}
			class="marcas"
			data-por-boton
		>
			<input type="hidden" name="ancla" value={ancla} />
			<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
			<input type="hidden" name="actividad" value={actividad.clave} />
			<div class="ejecucion">
				{#if actividad.ejecutada}
					<CasillaSeguimiento
						etiqueta="Ejecutada"
						{contexto}
						marcada
						nombreCampo="marca"
						valorCampo="ejecucion:false"
						{puedeEditar}
						ancha
					/>
				{:else}
					<button
						class="boton primario marcar"
						name="marca"
						value="ejecucion:true"
						aria-label={`Marcar ejecutada · ${contexto}`}>Marcar ejecutada</button
					>
				{/if}
			</div>
			{#if casillas.length}
				<div class="documentos">
					{#each casillas as concepto (concepto.id)}
						{@const marcada = valorDe(valores, actividad.clave, concepto) === true}
						<CasillaSeguimiento
							etiqueta={concepto.etiqueta}
							{contexto}
							{marcada}
							porDefinir={concepto.porDefinir}
							nombreCampo="marca"
							valorCampo={`${concepto.id}:${!marcada}`}
							{puedeEditar}
						/>
					{/each}
				</div>
			{/if}
			{#if faltaAlgo}
				<div class="todo">
					<button
						class="boton fantasma"
						name="marca"
						value="fila"
						aria-label={`Marcar ejecutada y todos sus documentos · ${contexto}`}
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.25"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"><path d="M18 6 7 17l-4-4" /><path d="m22 10-7.5 7.5L13 16" /></svg
						>
						Marcar todo hecho
					</button>
				</div>
			{/if}
		</form>
	{:else}
		<div class="marcas">
			<div class="ejecucion">
				<CasillaSeguimiento
					etiqueta={actividad.ejecutada ? 'Ejecutada' : 'Sin ejecutar'}
					{contexto}
					marcada={actividad.ejecutada}
					{puedeEditar}
				/>
			</div>
			{#if casillas.length}
				<div class="documentos">
					{#each casillas as concepto (concepto.id)}
						<CasillaSeguimiento
							etiqueta={concepto.etiqueta}
							{contexto}
							marcada={valorDe(valores, actividad.clave, concepto) === true}
							porDefinir={concepto.porDefinir}
							{puedeEditar}
						/>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Lo que no es casilla (un estado, una cantidad, una fecha) lleva su propio campo y «Guardar». -->
	{#if campos.length}
		<div class="campos">
			{#each campos as concepto (concepto.id)}
				<ValorSeguimiento
					{concepto}
					valor={valorDe(valores, actividad.clave, concepto)}
					actividad={actividad.clave}
					{contexto}
					{ancla}
					{urlGuardar}
					{plantillaId}
					{puedeEditar}
					{enviar}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.fila {
		display: grid;
		gap: 10px;
		padding-block: 14px;
		border-top: 1px solid var(--linea);
		scroll-margin-top: 16px;
		min-width: 0;
	}
	.cabecera {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		min-width: 0;
	}
	h4 {
		margin: 0;
		font-family: var(--fuente);
		font-size: var(--texto-base);
		font-weight: 700;
		color: var(--tinta);
	}
	.fecha {
		font-weight: 600;
		color: var(--tinta-secundaria);
		font-variant-numeric: tabular-nums;
	}
	.estado {
		margin-left: auto;
	}
	.aviso {
		margin: 0;
	}
	.marcas {
		display: contents;
	}
	.ejecucion {
		display: flex;
	}
	.marcar {
		width: 100%;
		min-height: 44px;
	}
	.documentos {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
		gap: 8px;
		min-width: 0;
	}
	.campos {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
		gap: 12px 16px;
		min-width: 0;
	}
	.todo {
		display: flex;
		justify-content: flex-start;
	}
	.todo .boton {
		min-height: 44px;
		padding-inline: 8px;
		white-space: normal;
		text-align: left;
	}

	/* Escritorio: una línea por ejecución, con los documentos alineados entre filas. */
	@media (min-width: 1100px) {
		.fila {
			/* La última columna es fija para que los documentos queden alineados entre filas. */
			grid-template-columns: minmax(150px, 1fr) 200px minmax(0, 3fr) 176px;
			align-items: start;
			gap: 10px 16px;
		}
		.cabecera {
			grid-area: 1 / 1;
			min-height: 44px;
		}
		.ejecucion {
			grid-area: 1 / 2;
		}
		.documentos {
			grid-area: 1 / 3;
		}
		.todo {
			grid-area: 1 / 4;
		}
		.aviso {
			grid-column: 1 / -1;
			grid-row: 2;
		}
		.estado {
			margin-left: 0;
			flex-basis: 100%;
		}
		.campos {
			grid-column: 2 / -1;
		}
	}
</style>
