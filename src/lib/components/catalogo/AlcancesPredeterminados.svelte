<!-- Biblioteca de alcances predeterminados por proyecto (cliente): alta, edición, activación y
     eliminación. Las partidas copian el texto al agregarlos, así que los cambios de aquí no alteran
     partidas ni reportes ya guardados. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { AlcancePredeterminado, Cliente } from '$lib/dominio/esquemas';
	import { plural } from '$lib/dominio/textos';
	import BotonesSegmentados from '$lib/components/ui/BotonesSegmentados.svelte';
	import Dialogo from '$lib/components/ui/Dialogo.svelte';
	import Aviso from './Aviso.svelte';

	export let clientes: Cliente[] = [];
	export let proyecto: Cliente | null = null;
	export let alcances: AlcancePredeterminado[] = [];
	export let puedeEditar = true;
	export let form: {
		accion?: string;
		mensaje?: string;
		error?: string;
		id?: string | null;
	} | null = null;

	const TIPOS = [
		['alcance', 'Alcance'],
		['nota', 'Nota'],
		['norma', 'Norma o referencia']
	] as const;
	const ETIQUETA_TIPO = Object.fromEntries(TIPOS) as Record<string, string>;

	let editando: string | null = null;
	let porEliminar: AlcancePredeterminado | null = null;
	let dialogoAbierto = false;
	let formularioEliminar: HTMLFormElement | undefined;

	$: opciones = clientes.map((c) => ({ valor: c.clave, texto: c.nombre }));
	$: grupos = agrupar(alcances);
	$: nombresGrupo = [...new Set(alcances.map((a) => a.grupo).filter((g): g is string => !!g))];
	$: activos = alcances.filter((a) => a.activo).length;

	/** La base ya los entrega ordenados por grupo: se cortan donde cambia el grupo. */
	function agrupar(lista: AlcancePredeterminado[]): [string, AlcancePredeterminado[]][] {
		const grupos: [string, AlcancePredeterminado[]][] = [];
		for (const alcance of lista) {
			const clave = alcance.grupo ?? '';
			const ultimo = grupos.at(-1);
			if (ultimo && ultimo[0] === clave) ultimo[1].push(alcance);
			else grupos.push([clave, [alcance]]);
		}
		return grupos;
	}

	function cambiarProyecto(evento: CustomEvent<string>) {
		editando = null;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() ya aplicado; el proyecto va en la consulta.
		goto(`${resolve('/catalogo/alcances')}?proyecto=${encodeURIComponent(evento.detail)}`, {
			keepFocus: true,
			noScroll: true
		});
	}

	// El alta limpia el formulario; la edición se cierra solo si se guardó.
	const alAgregar: SubmitFunction =
		() =>
		async ({ result, update }) =>
			update({ reset: result.type === 'success' });

	const alEditar: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') editando = null;
		};

	function pedirEliminar(alcance: AlcancePredeterminado) {
		porEliminar = alcance;
		dialogoAbierto = true;
	}
</script>

<p class="migas">
	<a class="enlace" href={resolve('/catalogo')}>Catálogo</a> / Alcances predeterminados
</p>

<Aviso {form} />

{#if !proyecto}
	<section class="card">
		<p class="view-note">
			Aún no hay proyectos. Registre primero un cliente en el
			<a class="enlace" href={resolve('/catalogo')}>catálogo</a>.
		</p>
	</section>
{:else}
	<section class="card" aria-labelledby="titulo-proyecto">
		<h2 id="titulo-proyecto" class="view-heading">Proyecto</h2>
		<BotonesSegmentados
			id="proyecto-alcances"
			etiqueta="Proyecto"
			{opciones}
			valor={proyecto.clave}
			on:change={cambiarProyecto}
		/>
		<p class="view-note">
			En el editor de cada partida del proyecto, «Agregar predeterminados» copia los activos. Editar
			o eliminar uno aquí no cambia las partidas ya guardadas.
		</p>
	</section>

	{#if puedeEditar}
		<section class="card" aria-labelledby="titulo-nuevo-alcance">
			<h2 id="titulo-nuevo-alcance" class="view-heading">Nuevo alcance de {proyecto.nombre}</h2>
			<form method="POST" action="?/guardar" use:enhance={alAgregar}>
				<input type="hidden" name="clienteId" value={proyecto.id} />
				<div class="form-grid">
					<div class="form-group">
						<label for="nuevo-tipo">Tipo</label>
						<select id="nuevo-tipo" name="tipo">
							{#each TIPOS as [valor, etiqueta] (valor)}<option value={valor}>{etiqueta}</option
								>{/each}
						</select>
					</div>
					<div class="form-group">
						<label for="nuevo-grupo">Grupo (opcional)</label>
						<input
							id="nuevo-grupo"
							name="grupo"
							list="grupos-alcance"
							placeholder="Instrumentación"
							autocomplete="off"
						/>
					</div>
				</div>
				<div class="form-group">
					<label for="nuevo-texto">Texto</label>
					<textarea id="nuevo-texto" name="texto" rows="2" required></textarea>
				</div>
				<button class="boton primario" type="submit">Agregar alcance</button>
			</form>
			<datalist id="grupos-alcance">
				{#each nombresGrupo as grupo (grupo)}<option value={grupo}></option>{/each}
			</datalist>
		</section>
	{/if}

	<section class="card" aria-labelledby="titulo-biblioteca">
		<h2 id="titulo-biblioteca" class="view-heading">
			Biblioteca · {plural(alcances.length, 'alcance')}
			{#if alcances.length !== activos}<span class="resumen">({activos} activos)</span>{/if}
		</h2>
		{#if alcances.length === 0}
			<p class="view-note">
				{proyecto.nombre} aún no tiene alcances predeterminados.
				{puedeEditar ? 'Agregue el primero en «Nuevo alcance».' : ''}
			</p>
		{/if}
		{#each grupos as [grupo, lista] (grupo)}
			<h3 class="subtitulo">{grupo || 'Sin grupo'}</h3>
			<ul class="biblioteca">
				{#each lista as alcance (alcance.id)}
					<li class:inactivo={!alcance.activo}>
						{#if editando === alcance.id}
							<form method="POST" action="?/guardar" class="edicion" use:enhance={alEditar}>
								<input type="hidden" name="id" value={alcance.id} />
								<div class="form-grid">
									<div class="form-group">
										<label for="tipo-{alcance.id}">Tipo</label>
										<select id="tipo-{alcance.id}" name="tipo" value={alcance.tipo}>
											{#each TIPOS as [valor, etiqueta] (valor)}<option value={valor}
													>{etiqueta}</option
												>{/each}
										</select>
									</div>
									<div class="form-group">
										<label for="grupo-{alcance.id}">Grupo (opcional)</label>
										<input
											id="grupo-{alcance.id}"
											name="grupo"
											list="grupos-alcance"
											value={alcance.grupo ?? ''}
											autocomplete="off"
										/>
									</div>
								</div>
								<div class="form-group">
									<label for="texto-{alcance.id}">Texto</label>
									<textarea id="texto-{alcance.id}" name="texto" rows="2" required
										>{alcance.texto}</textarea
									>
								</div>
								<div class="acciones">
									<button class="boton primario compacto" type="submit">Guardar</button>
									<button class="boton compacto" type="button" on:click={() => (editando = null)}
										>Cancelar</button
									>
								</div>
							</form>
						{:else}
							<div class="renglon">
								<span class="status-badge tipo-{alcance.tipo}">{ETIQUETA_TIPO[alcance.tipo]}</span>
								<p class="texto">{alcance.texto}</p>
								{#if !alcance.activo}<span class="status-badge warn">Inactivo</span>{/if}
							</div>
							{#if puedeEditar}
								<div class="acciones">
									<button
										class="boton fantasma compacto"
										type="button"
										on:click={() => (editando = alcance.id)}>Editar</button
									>
									<form method="POST" action="?/alternar" use:enhance>
										<input type="hidden" name="id" value={alcance.id} />
										<input type="hidden" name="tipo" value={alcance.tipo} />
										<input type="hidden" name="grupo" value={alcance.grupo ?? ''} />
										<input type="hidden" name="texto" value={alcance.texto} />
										<input type="hidden" name="activo" value={String(!alcance.activo)} />
										<button class="boton fantasma compacto" type="submit"
											>{alcance.activo ? 'Desactivar' : 'Activar'}</button
										>
									</form>
									<button
										class="boton fantasma peligro compacto"
										type="button"
										on:click={() => pedirEliminar(alcance)}>Eliminar</button
									>
								</div>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/each}
	</section>

	<form bind:this={formularioEliminar} method="POST" action="?/eliminar" use:enhance hidden>
		<input type="hidden" name="id" value={porEliminar?.id ?? ''} />
	</form>
	<Dialogo
		id="eliminar-alcance"
		bind:abierto={dialogoAbierto}
		titulo="¿Eliminar el alcance predeterminado?"
		textoConfirmar="Eliminar"
		on:confirmar={() => formularioEliminar?.requestSubmit()}
	>
		<p>«{porEliminar?.texto}»</p>
		<p>
			Las partidas que ya lo tienen conservan su copia. Si solo quiere dejar de ofrecerlo, use
			«Desactivar».
		</p>
	</Dialogo>
{/if}

<style>
	.resumen {
		color: var(--tinta-secundaria);
		font-weight: 400;
	}
	.biblioteca {
		display: grid;
		gap: 8px;
		margin: 0 0 16px;
		padding: 0;
		list-style: none;
	}
	.biblioteca li {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px 16px;
		padding: 12px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-control);
	}
	.biblioteca li.inactivo .texto {
		color: var(--tinta-secundaria);
	}
	.renglon {
		display: flex;
		flex: 1 1 320px;
		align-items: baseline;
		gap: 12px;
		min-width: 0;
	}
	.texto {
		flex: 1;
		margin: 0;
		overflow-wrap: anywhere;
		white-space: pre-line;
	}
	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.edicion {
		flex: 1 1 100%;
	}
	.status-badge {
		flex: none;
	}
</style>
