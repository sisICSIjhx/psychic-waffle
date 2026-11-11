<!-- Alta y edición de una persona: nombre dividido, sede, correo (su usuario para iniciar sesión),
     rol y centros de costo. Administrador, mesa directiva y contabilidad abarcan todos los centros
     de costo; la baja es lógica. En una persona ya registrada, «Acceso al sistema» genera su
     contraseña temporal o le quita la cuenta. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ROLES_PERSONAL } from '$lib/dominio/constantes';
	import type { CentroCosto, Personal } from '$lib/dominio/esquemas';
	import { fechaEnZona } from '$lib/dominio/fechas';
	import {
		DESCRIPCIONES_ROL,
		ETIQUETAS_ROL,
		nombreCompleto,
		requiereCentros,
		textoAcceso
	} from '$lib/dominio/personal';
	import Aviso from '$lib/components/catalogo/Aviso.svelte';

	export let persona: Personal | null = null;
	export let centros: CentroCosto[] = [];
	export let form: {
		mensaje?: string;
		error?: string;
		/** Contraseña temporal recién generada: se muestra solo en esta respuesta. */
		temporal?: string;
		mensajeAcceso?: string;
		errorAcceso?: string;
	} | null = null;
	/** Las cuentas se administran cuando el inicio de sesión ya está activado. */
	export let sesionActivada = false;

	// Estado local enlazado con bind:value. Con `value={…}` sin enlace, al recargar la página el
	// primer cambio de rol que habilita o deshabilita los centros de costo borraba lo escrito: Svelte
	// reaplica el valor inicial de todos los campos que comparten efecto con ese cambio.
	let nombre = persona?.nombre ?? '';
	let apellidoPaterno = persona?.apellidoPaterno ?? '';
	let apellidoMaterno = persona?.apellidoMaterno ?? '';
	let fechaNacimiento = persona?.fechaNacimiento ?? '';
	let sede = persona?.sede ?? '';
	let correo = persona?.correo ?? '';
	let rol: Personal['rol'] = persona?.rol ?? 'reporteador';
	let asignados: string[] = (persona?.centrosCosto ?? []).map((c) => c.id);
	let activo = persona?.activo ?? true;

	$: conCentros = requiereCentros(rol);

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
				<input id="nombre" name="nombre" bind:value={nombre} autocomplete="off" required />
			</div>
			<div class="form-group">
				<label for="apellidoPaterno">Apellido paterno</label>
				<input
					id="apellidoPaterno"
					name="apellidoPaterno"
					bind:value={apellidoPaterno}
					autocomplete="off"
					required
				/>
			</div>
			<div class="form-group">
				<label for="apellidoMaterno">Apellido materno (opcional)</label>
				<input
					id="apellidoMaterno"
					name="apellidoMaterno"
					bind:value={apellidoMaterno}
					autocomplete="off"
				/>
			</div>
			<div class="form-group">
				<label for="fechaNacimiento">Fecha de nacimiento (opcional)</label>
				<input
					id="fechaNacimiento"
					name="fechaNacimiento"
					type="date"
					min="1900-01-01"
					max={fechaEnZona()}
					bind:value={fechaNacimiento}
				/>
			</div>
			<div class="form-group">
				<label for="sede">Sede (opcional)</label>
				<input id="sede" name="sede" bind:value={sede} autocomplete="off" />
			</div>
			<div class="form-group">
				<label for="correo">Correo (opcional)</label>
				<input
					id="correo"
					name="correo"
					type="email"
					bind:value={correo}
					autocomplete="off"
					aria-describedby="nota-correo"
				/>
				<p id="nota-correo" class="view-note">Es su usuario para iniciar sesión.</p>
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

		<fieldset class="casillas centros" disabled={!conCentros} aria-describedby="nota-centros">
			<legend>Centros de costo</legend>
			{#each centros as centro (centro.id)}
				<label>
					<input
						type="checkbox"
						name="centroCostoIds"
						value={centro.id}
						bind:group={asignados}
						disabled={!conCentros}
					/>
					<span
						><strong>{centro.clave}</strong>{#if centro.nombre}
							· {centro.nombre}{/if}</span
					>
				</label>
			{/each}
		</fieldset>
		<p id="nota-centros" class="view-note">
			{#if !conCentros}
				Este rol abarca todos los centros de costo.
			{:else if centros.length === 0}
				No hay centros de costo: regístrelos primero en el
				<a class="enlace" href={resolve('/catalogo/centros-costo')}>catálogo</a>.
			{:else}
				Con el inicio de sesión activado, la persona solo ve y captura lo de los centros de costo
				elegidos; sin ninguno, no verá trabajo.
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

{#if persona}
	<section class="card" aria-labelledby="titulo-cuenta">
		<h2 id="titulo-cuenta" class="view-heading">Acceso al sistema</h2>
		<p class="estado-cuenta">
			<span class="status-badge {persona.acceso ? 'ok' : 'warn'}">{textoAcceso(persona)}</span>
			{#if persona.acceso?.ultimoAccesoEn}
				<span class="view-note"
					>Último acceso: {new Date(persona.acceso.ultimoAccesoEn).toLocaleString('es-MX')}</span
				>
			{:else if persona.acceso}
				<span class="view-note">Aún no ha entrado.</span>
			{/if}
		</p>

		{#if form?.errorAcceso}
			<p class="aviso aviso-error" role="alert">{form.errorAcceso}</p>
		{:else if form?.mensajeAcceso}
			<p class="aviso aviso-exito" role="status">{form.mensajeAcceso}</p>
		{/if}
		{#if form?.temporal}
			<div class="aviso aviso-exito temporal" role="status">
				<p>
					Contraseña temporal de {nombreCompleto(persona)}:
					<code>{form.temporal}</code>
				</p>
				<p>
					Cópiela ahora: no se vuelve a mostrar. Al entrar con ella, la persona tendrá que elegir la
					suya.
				</p>
			</div>
		{/if}

		{#if !sesionActivada}
			<p class="view-note">
				El inicio de sesión no está activado.
				<a class="enlace" href={resolve('/acceso/configurar')}>Actívelo</a> para dar cuentas al personal.
			</p>
		{:else if !persona.activo}
			<p class="view-note">La persona está dada de baja: no puede tener cuenta.</p>
		{:else if !persona.correo}
			<p class="view-note">Registre primero su correo: es su usuario para iniciar sesión.</p>
		{:else}
			<div class="toolbar">
				<form method="POST" action="?/generarContrasena" use:enhance>
					<button class="boton" type="submit"
						>{persona.acceso
							? 'Generar otra contraseña temporal'
							: 'Generar contraseña temporal'}</button
					>
				</form>
				{#if persona.acceso}
					<form method="POST" action="?/quitarAcceso" use:enhance>
						<button class="boton peligro" type="submit">Quitar acceso</button>
					</form>
				{/if}
			</div>
			{#if persona.acceso}
				<p class="view-note">
					Generar otra contraseña sustituye a la actual y cierra las sesiones abiertas de la
					persona.
				</p>
			{/if}
		{/if}
	</section>
{/if}

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
	.centros {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 6px 16px;
	}
	.centros legend {
		grid-column: 1 / -1;
	}
	.estado-cuenta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin: 0 0 12px;
	}
	.estado-cuenta .view-note {
		margin: 0;
	}
	.temporal p {
		margin: 0;
	}
	.temporal p + p {
		margin-top: 6px;
	}
	.temporal code {
		padding: 2px 8px;
		border-radius: var(--radio-control);
		background: var(--superficie);
		font-size: var(--texto-md);
		font-weight: 700;
		letter-spacing: 0.04em;
		user-select: all;
	}
</style>
