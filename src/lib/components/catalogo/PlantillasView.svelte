<!-- Plantillas de seguimiento (cambio centros-costo-plantillas): qué bloques aplica cada una, qué
     centros de costo la usan, y las acciones nueva, duplicar y eliminar (solo si nadie la usa). -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PlantillaSeguimiento } from '$lib/dominio/esquemas';
	import {
		ETIQUETA_BLOQUE,
		ETIQUETA_MODO_CONTRATO,
		ETIQUETA_ORIGEN,
		bloquesAplicados
	} from '$lib/dominio/seguimiento';
	import { plural } from '$lib/dominio/textos';
	import Dialogo from '$lib/components/ui/Dialogo.svelte';
	import Aviso from './Aviso.svelte';

	export let plantillas: PlantillaSeguimiento[] = [];
	export let form: { accion?: string; mensaje?: string; error?: string } | null = null;

	let porDuplicar: PlantillaSeguimiento | null = null;
	let porEliminar: PlantillaSeguimiento | null = null;
	let dialogoDuplicar = false;
	let dialogoEliminar = false;
	let nombreCopia = '';
	let formularioDuplicar: HTMLFormElement | undefined;
	let formularioEliminar: HTMLFormElement | undefined;

	function duplicar(plantilla: PlantillaSeguimiento) {
		porDuplicar = plantilla;
		nombreCopia = `${plantilla.nombre} (copia)`;
		dialogoDuplicar = true;
	}

	function eliminar(plantilla: PlantillaSeguimiento) {
		porEliminar = plantilla;
		dialogoEliminar = true;
	}
</script>

<p class="migas">
	<a class="enlace" href={resolve('/catalogo')}>Catálogo</a> /
	<a class="enlace" href={resolve('/catalogo/centros-costo')}>Centros de costo</a> / Plantillas
</p>

<Aviso {form} />

<section class="card" aria-labelledby="titulo-plantillas">
	<h2 id="titulo-plantillas" class="view-heading">
		{plural(plantillas.length, 'plantilla', 'plantillas')}
	</h2>
	<p class="view-note">
		Cada plantilla dice qué lleva el seguimiento de un centro de costo. Varios centros pueden
		compartirla: un cambio aquí les aplica a todos. La carta de finalización, la cobranza y las
		atenciones nocturnas aplican siempre y no se configuran.
	</p>
	{#if plantillas.length === 0}
		<p class="view-note">Aún no hay plantillas.</p>
	{:else}
		<ul class="lista">
			{#each plantillas as plantilla (plantilla.id)}
				<li class="plantilla">
					<div class="cabeza">
						<a
							class="enlace nombre"
							href={resolve('/catalogo/plantillas/[id]', { id: plantilla.id })}
							>{plantilla.nombre}</a
						>
						<div class="acciones">
							<button class="boton" type="button" on:click={() => duplicar(plantilla)}
								>Duplicar</button
							>
							<button
								class="boton peligro"
								type="button"
								disabled={plantilla.centros.length > 0}
								title={plantilla.centros.length > 0
									? 'Quite antes la plantilla de sus centros de costo'
									: undefined}
								on:click={() => eliminar(plantilla)}>Eliminar</button
							>
						</div>
					</div>
					{#if plantilla.descripcion}<p class="view-note">{plantilla.descripcion}</p>{/if}
					<p class="datos">
						<span>{ETIQUETA_MODO_CONTRATO[plantilla.modoContrato]}</span>
						<span>Actividades: {ETIQUETA_ORIGEN[plantilla.origenActividades].toLowerCase()}</span>
						<span>{plural(plantilla.conceptos.length, 'concepto', 'conceptos')}</span>
					</p>
					<p class="bloques">
						{#each bloquesAplicados(plantilla.conceptos) as bloque (bloque)}
							<span class="status-badge">{ETIQUETA_BLOQUE[bloque]}</span>
						{:else}
							<span class="view-note">Sin conceptos</span>
						{/each}
					</p>
					<p class="view-note">
						{#if plantilla.centros.length === 0}
							Ningún centro de costo la usa.
						{:else}
							La usan: {plantilla.centros.map((c) => c.clave).join(', ')}.
						{/if}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<details class="card" open={plantillas.length === 0}>
	<summary class="view-heading">Nueva plantilla</summary>
	<form method="POST" action="?/crear" use:enhance class="nueva">
		<div class="form-group">
			<label for="nueva-nombre">Nombre</label>
			<input id="nueva-nombre" name="nombre" required autocomplete="off" />
		</div>
		<button class="boton primario" type="submit">Crear y configurar</button>
	</form>
</details>

<form method="POST" action="?/duplicar" use:enhance bind:this={formularioDuplicar} hidden>
	<input type="hidden" name="id" value={porDuplicar?.id ?? ''} />
	<input type="hidden" name="nombre" value={nombreCopia} />
</form>
<Dialogo
	id="duplicar-plantilla"
	bind:abierto={dialogoDuplicar}
	titulo="Duplicar plantilla"
	textoConfirmar="Duplicar"
	confirmarDeshabilitado={nombreCopia.trim() === ''}
	on:confirmar={() => formularioDuplicar?.requestSubmit()}
>
	<p>La copia lleva los mismos conceptos; ningún centro de costo cambia de plantilla.</p>
	<div class="form-group">
		<label for="nombre-copia">Nombre de la copia</label>
		<input id="nombre-copia" bind:value={nombreCopia} autocomplete="off" />
	</div>
</Dialogo>

<form method="POST" action="?/eliminar" use:enhance bind:this={formularioEliminar} hidden>
	<input type="hidden" name="id" value={porEliminar?.id ?? ''} />
</form>
<Dialogo
	id="eliminar-plantilla"
	bind:abierto={dialogoEliminar}
	titulo="¿Eliminar la plantilla?"
	textoConfirmar="Eliminar"
	on:confirmar={() => {
		dialogoEliminar = false;
		formularioEliminar?.requestSubmit();
	}}
>
	<p>«{porEliminar?.nombre}» y sus conceptos se eliminan. No se puede deshacer.</p>
</Dialogo>

<style>
	.lista {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.plantilla {
		display: grid;
		gap: 6px;
		padding: 14px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-control);
	}
	.plantilla p {
		margin: 0;
	}
	.cabeza {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.nombre {
		font-weight: 700;
	}
	.acciones {
		display: flex;
		gap: 8px;
	}
	.datos {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		color: var(--tinta-secundaria);
		font-size: var(--texto-sm);
	}
	.bloques {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.nueva {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
	}
	.nueva .form-group {
		flex: 1 1 260px;
		margin: 0;
	}
</style>
