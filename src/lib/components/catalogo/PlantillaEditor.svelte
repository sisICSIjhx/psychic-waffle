<!-- Editor de una plantilla de seguimiento (cambio centros-costo-plantillas): modo de contrato, origen
     de las actividades y conceptos de cada bloque, con su tipo y nivel. Solo ofrece combinaciones
     válidas (dominio/seguimiento.ts); la base las vuelve a comprobar. Los conceptos que ya existían
     conservan su id al guardar. -->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		BLOQUES_SEGUIMIENTO,
		MODOS_CONTRATO,
		ORIGENES_ACTIVIDADES,
		type BloqueSeguimiento,
		type NivelConcepto,
		type TipoConcepto
	} from '$lib/dominio/constantes';
	import type { PlantillaSeguimiento } from '$lib/dominio/esquemas';
	import {
		AYUDA_BLOQUE,
		ETIQUETA_BLOQUE,
		ETIQUETA_MODO_CONTRATO,
		ETIQUETA_NIVEL,
		ETIQUETA_ORIGEN,
		ETIQUETA_TIPO,
		nivelesDeBloque,
		tiposDeBloque
	} from '$lib/dominio/seguimiento';
	import Aviso from './Aviso.svelte';

	export let plantilla: PlantillaSeguimiento;
	export let form: { mensaje?: string; error?: string } | null = null;

	interface Fila {
		/** Clave local para el {#each}; los conceptos guardados llevan además su id. */
		clave: number;
		id?: string;
		etiqueta: string;
		tipo: TipoConcepto;
		nivel: NivelConcepto;
	}

	let siguiente = 0;
	const nuevaClave = () => ++siguiente;

	let nombre = plantilla.nombre;
	let descripcion = plantilla.descripcion ?? '';
	let modoContrato = plantilla.modoContrato;
	let origenActividades = plantilla.origenActividades;
	let filas: Record<BloqueSeguimiento, Fila[]> = Object.fromEntries(
		BLOQUES_SEGUIMIENTO.map((bloque) => [
			bloque,
			plantilla.conceptos
				.filter((c) => c.bloque === bloque)
				.map((c) => ({
					clave: nuevaClave(),
					id: c.id,
					etiqueta: c.etiqueta,
					tipo: c.tipo,
					nivel: c.nivel
				}))
		])
	) as Record<BloqueSeguimiento, Fila[]>;
	let cambios = false;

	$: conceptos = BLOQUES_SEGUIMIENTO.flatMap((bloque) =>
		filas[bloque].map(({ id, etiqueta, tipo, nivel }) => ({ id, bloque, etiqueta, tipo, nivel }))
	);

	async function agregar(bloque: BloqueSeguimiento) {
		const clave = nuevaClave();
		filas[bloque] = [
			...filas[bloque],
			{
				clave,
				etiqueta: '',
				tipo: tiposDeBloque(bloque)[0],
				nivel: nivelesDeBloque(bloque)[0]
			}
		];
		cambios = true;
		// El foco pasa a la etiqueta del concepto nuevo para escribirla enseguida.
		await tick();
		document.getElementById(`etiqueta-${clave}`)?.focus();
	}

	function quitar(bloque: BloqueSeguimiento, clave: number) {
		filas[bloque] = filas[bloque].filter((f) => f.clave !== clave);
		cambios = true;
	}

	function mover(bloque: BloqueSeguimiento, indice: number, paso: -1 | 1) {
		const lista = [...filas[bloque]];
		const destino = indice + paso;
		if (destino < 0 || destino >= lista.length) return;
		[lista[indice], lista[destino]] = [lista[destino], lista[indice]];
		filas[bloque] = lista;
		cambios = true;
	}

	const guardar: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update({ reset: false });
			if (result.type === 'success') cambios = false;
		};
</script>

<p class="migas">
	<a class="enlace" href={resolve('/catalogo')}>Catálogo</a> /
	<a class="enlace" href={resolve('/catalogo/plantillas')}>Plantillas</a> / {plantilla.nombre}
</p>

<Aviso {form} />

<form method="POST" action="?/guardar" use:enhance={guardar} on:input={() => (cambios = true)}>
	<input type="hidden" name="conceptos" value={JSON.stringify(conceptos)} />

	<section class="card" aria-labelledby="titulo-generales">
		<h2 id="titulo-generales" class="view-heading">Datos generales</h2>
		<div class="form-grid">
			<div class="form-group">
				<label for="nombre">Nombre</label>
				<input id="nombre" name="nombre" bind:value={nombre} required autocomplete="off" />
			</div>
			<div class="form-group">
				<label for="descripcion">Descripción (opcional)</label>
				<input id="descripcion" name="descripcion" bind:value={descripcion} autocomplete="off" />
			</div>
			<div class="form-group">
				<label for="modoContrato">Contrato</label>
				<select id="modoContrato" name="modoContrato" bind:value={modoContrato}>
					{#each MODOS_CONTRATO as modo (modo)}
						<option value={modo}>{ETIQUETA_MODO_CONTRATO[modo]}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="origenActividades">Actividades del mes</label>
				<select id="origenActividades" name="origenActividades" bind:value={origenActividades}>
					{#each ORIGENES_ACTIVIDADES as origen (origen)}
						<option value={origen}>{ETIQUETA_ORIGEN[origen]}</option>
					{/each}
				</select>
			</div>
		</div>
		{#if plantilla.centros.length > 0}
			<p class="view-note">
				La usan {plantilla.centros.map((c) => c.clave).join(', ')}: los cambios les aplican a todos.
			</p>
		{/if}
	</section>

	{#each BLOQUES_SEGUIMIENTO as bloque (bloque)}
		<section class="card bloque" aria-labelledby={`titulo-${bloque}`}>
			<div class="encabezado">
				<h2 id={`titulo-${bloque}`} class="view-heading">{ETIQUETA_BLOQUE[bloque]}</h2>
				<span class="view-note"
					>{filas[bloque].length === 0 ? 'No aplica' : `${filas[bloque].length} conceptos`}</span
				>
			</div>
			<p class="view-note">{AYUDA_BLOQUE[bloque]}</p>
			{#if filas[bloque].length > 0}
				<ol class="conceptos">
					{#each filas[bloque] as fila, indice (fila.clave)}
						<li class="concepto">
							<div class="form-group etiqueta">
								<label for={`etiqueta-${fila.clave}`}>Concepto</label>
								<input
									id={`etiqueta-${fila.clave}`}
									bind:value={fila.etiqueta}
									required
									autocomplete="off"
								/>
							</div>
							<div class="form-group">
								<label for={`tipo-${fila.clave}`}>Tipo</label>
								<select
									id={`tipo-${fila.clave}`}
									bind:value={fila.tipo}
									disabled={tiposDeBloque(bloque).length === 1}
								>
									{#each tiposDeBloque(bloque) as tipo (tipo)}
										<option value={tipo}>{ETIQUETA_TIPO[tipo]}</option>
									{/each}
								</select>
							</div>
							<div class="form-group">
								<label for={`nivel-${fila.clave}`}>Se registra</label>
								<select
									id={`nivel-${fila.clave}`}
									bind:value={fila.nivel}
									disabled={nivelesDeBloque(bloque).length === 1}
								>
									{#each nivelesDeBloque(bloque) as nivel (nivel)}
										<option value={nivel}>{ETIQUETA_NIVEL[nivel]}</option>
									{/each}
								</select>
							</div>
							<div class="botones">
								<button
									class="boton"
									type="button"
									aria-label={`Subir ${fila.etiqueta || 'concepto'}`}
									disabled={indice === 0}
									on:click={() => mover(bloque, indice, -1)}>↑</button
								>
								<button
									class="boton"
									type="button"
									aria-label={`Bajar ${fila.etiqueta || 'concepto'}`}
									disabled={indice === filas[bloque].length - 1}
									on:click={() => mover(bloque, indice, 1)}>↓</button
								>
								<button
									class="boton peligro"
									type="button"
									aria-label={`Quitar ${fila.etiqueta || 'concepto'}`}
									on:click={() => quitar(bloque, fila.clave)}>Quitar</button
								>
							</div>
						</li>
					{/each}
				</ol>
			{/if}
			<div>
				<button class="boton" type="button" on:click={() => agregar(bloque)}
					>Agregar concepto</button
				>
			</div>
		</section>
	{/each}

	<div class="toolbar barra-guardar">
		<button class="boton primario" type="submit">Guardar plantilla</button>
		{#if cambios}<span class="view-note" role="status">Hay cambios sin guardar.</span>{/if}
		<a class="boton" href={resolve('/catalogo/plantillas')}>Volver a las plantillas</a>
	</div>
</form>

<style>
	.encabezado {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 12px;
	}
	.bloque > p {
		margin-top: 0;
	}
	.conceptos {
		display: grid;
		gap: 8px;
		margin: 0 0 12px;
		padding: 0;
		list-style: none;
	}
	.concepto {
		display: grid;
		grid-template-columns: minmax(160px, 2fr) minmax(190px, 1.2fr) minmax(140px, 1fr) auto;
		align-items: start;
		gap: 8px 12px;
		padding: 10px 12px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-control);
	}
	.concepto .form-group {
		margin: 0;
	}
	.concepto select {
		white-space: nowrap;
	}
	.botones {
		display: flex;
		gap: 6px;
		/* Alineados con los campos, bajo la altura de sus etiquetas. */
		align-self: end;
	}
	.barra-guardar {
		align-items: center;
	}
	@media (max-width: 768px) {
		.concepto {
			grid-template-columns: 1fr;
		}
	}
</style>
