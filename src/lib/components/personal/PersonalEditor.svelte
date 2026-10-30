<!-- Alta y edición de una persona: nombre dividido, fecha de nacimiento, correo opcional, rol y
     proyectos (clientes). El administrador accede a todos los proyectos; la baja es lógica. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ROLES_PERSONAL, type Cliente, type Personal } from '$lib/dominio/esquemas';
	import { fechaEnZona } from '$lib/dominio/fechas';
	import {
		DESCRIPCIONES_ROL,
		ETIQUETAS_ROL,
		nombreCompleto,
		requiereProyectos
	} from '$lib/dominio/personal';
	import Aviso from '$lib/components/catalogo/Aviso.svelte';

	export let persona: Personal | null = null;
	export let clientes: Cliente[] = [];
	export let form: { mensaje?: string; error?: string } | null = null;

	let rol: Personal['rol'] = persona?.rol ?? 'reporteador';
	let proyectos: string[] = (persona?.proyectos ?? []).map((p) => p.id);
	let activo = persona?.activo ?? true;

	$: conProyectos = requiereProyectos(rol);

	// Sin reinicio tras guardar: el formulario conserva lo capturado.
	const conservarCampos: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });
</script>

<p class="migas">
	<a class="enlace" href={resolve('/personal')}>Personal</a> /
	{persona ? nombreCompleto(persona) : 'Nueva persona'}
</p>

<Aviso {form} />

<form method="POST" action="?/guardar" use:enhance={conservarCampos}>
	<section class="card" aria-labelledby="titulo-datos-persona">
		<h2 id="titulo-datos-persona" class="view-heading">Datos personales</h2>
		<div class="form-grid">
			<div class="form-group">
				<label for="nombre">Nombre(s)</label>
				<input
					id="nombre"
					name="nombre"
					value={persona?.nombre ?? ''}
					autocomplete="off"
					required
				/>
			</div>
			<div class="form-group">
				<label for="apellidoPaterno">Apellido paterno</label>
				<input
					id="apellidoPaterno"
					name="apellidoPaterno"
					value={persona?.apellidoPaterno ?? ''}
					autocomplete="off"
					required
				/>
			</div>
			<div class="form-group">
				<label for="apellidoMaterno">Apellido materno (opcional)</label>
				<input
					id="apellidoMaterno"
					name="apellidoMaterno"
					value={persona?.apellidoMaterno ?? ''}
					autocomplete="off"
				/>
			</div>
			<div class="form-group">
				<label for="fechaNacimiento">Fecha de nacimiento</label>
				<input
					id="fechaNacimiento"
					name="fechaNacimiento"
					type="date"
					min="1900-01-01"
					max={fechaEnZona()}
					value={persona?.fechaNacimiento ?? ''}
					required
				/>
			</div>
			<div class="form-group">
				<label for="correo">Correo (opcional)</label>
				<input
					id="correo"
					name="correo"
					type="email"
					value={persona?.correo ?? ''}
					autocomplete="off"
					aria-describedby="nota-correo"
				/>
				<p id="nota-correo" class="view-note">Servirá para iniciar sesión cuando se active.</p>
			</div>
		</div>
	</section>

	<section class="card" aria-labelledby="titulo-acceso">
		<h2 id="titulo-acceso" class="view-heading">Rol y acceso</h2>
		<fieldset class="roles">
			<legend>Rol</legend>
			{#each ROLES_PERSONAL as opcion (opcion)}
				<label class="rol" class:elegido={rol === opcion}>
					<input type="radio" name="rol" value={opcion} bind:group={rol} />
					<span>
						<strong>{ETIQUETAS_ROL[opcion]}</strong>
						<span class="descripcion">{DESCRIPCIONES_ROL[opcion]}</span>
					</span>
				</label>
			{/each}
		</fieldset>

		<fieldset class="casillas" disabled={!conProyectos} aria-describedby="nota-proyectos">
			<legend>Proyectos</legend>
			{#each clientes as cliente (cliente.id)}
				<label>
					<input
						type="checkbox"
						name="clienteIds"
						value={cliente.id}
						bind:group={proyectos}
						disabled={!conProyectos}
					/>
					{cliente.nombre}
				</label>
			{/each}
		</fieldset>
		<p id="nota-proyectos" class="view-note">
			{#if !conProyectos}
				El administrador tiene acceso a todos los proyectos.
			{:else if clientes.length === 0}
				No hay proyectos: registre primero un cliente en el
				<a class="enlace" href={resolve('/catalogo')}>catálogo</a>.
			{:else}
				Elija al menos un proyecto.
			{/if}
		</p>

		{#if persona}
			<fieldset class="casillas">
				<legend>Estado</legend>
				<label>
					<input type="checkbox" name="activo" bind:checked={activo} />
					Activo
				</label>
			</fieldset>
			{#if !activo}
				<p class="view-note">
					Al guardar, la persona queda dada de baja. Sus datos se conservan y puede reactivarse.
				</p>
			{/if}
		{/if}
	</section>

	<div class="toolbar">
		<button class="boton primario" type="submit"
			>{persona ? 'Guardar cambios' : 'Registrar persona'}</button
		>
		<a class="boton" href={resolve('/personal')}>Volver a la lista</a>
	</div>
</form>

<style>
	.roles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 8px;
		margin: 0 0 16px;
		padding: 0;
		border: 0;
	}
	.roles legend {
		margin-bottom: 8px;
		font-weight: 600;
	}
	.rol {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 12px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-control);
		cursor: pointer;
	}
	.rol.elegido {
		border-color: var(--accion);
		background: var(--accion-suave);
	}
	.rol input {
		margin-top: 4px;
	}
	.rol > span {
		display: grid;
		gap: 2px;
	}
	.descripcion {
		color: var(--tinta-secundaria);
		font-size: var(--texto-sm);
	}
</style>
