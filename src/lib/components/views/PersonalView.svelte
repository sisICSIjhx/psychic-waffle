<!-- Lista del personal con rol, proyectos y estado; el alta y la edición van a /personal/[id]. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Personal } from '$lib/dominio/esquemas';
	import { ETIQUETAS_ROL, nombreCompleto, textoProyectos } from '$lib/dominio/personal';
	import { plural } from '$lib/dominio/textos';

	export let personal: Personal[] = [];
	export let puedeEditar = true;

	let verInactivos = false;

	$: inactivos = personal.filter((p) => !p.activo).length;
	$: visibles = verInactivos ? personal : personal.filter((p) => p.activo);
</script>

{#if puedeEditar}
	<div class="toolbar">
		<a class="boton primario" href={resolve('/personal/[id]', { id: 'nuevo' })}>Dar de alta</a>
	</div>
{/if}

<section class="card" aria-labelledby="titulo-personal">
	<h2 id="titulo-personal" class="view-heading">
		{plural(personal.length - inactivos, 'persona activa', 'personas activas')}
	</h2>
	{#if inactivos > 0}
		<label class="casilla-sola">
			<input type="checkbox" bind:checked={verInactivos} />
			Mostrar {plural(inactivos, 'persona dada de baja', 'personas dadas de baja')}
		</label>
	{/if}
	{#if personal.length === 0}
		<p class="view-note">
			Aún no hay personal registrado.
			{puedeEditar ? 'Use «Dar de alta» para registrar a la primera persona.' : ''}
		</p>
	{:else if visibles.length === 0}
		<p class="view-note">Todo el personal está dado de baja.</p>
	{:else}
		<div class="tabla-desplazable">
			<table>
				<thead>
					<tr>
						<th>Nombre</th>
						<th>Rol</th>
						<th>Proyectos</th>
						<th>Estado</th>
						{#if puedeEditar}<th><span class="sr-only">Acciones</span></th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each visibles as persona (persona.id)}
						<tr>
							<td>{nombreCompleto(persona)}</td>
							<td>{ETIQUETAS_ROL[persona.rol]}</td>
							<td>{textoProyectos(persona)}</td>
							<td>
								{#if persona.activo}
									<span class="status-badge ok">Activo</span>
								{:else}
									<span class="status-badge warn">Inactivo</span>
								{/if}
							</td>
							{#if puedeEditar}
								<td
									><a class="enlace" href={resolve('/personal/[id]', { id: persona.id })}>Editar</a
									></td
								>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
