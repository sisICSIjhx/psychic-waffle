<!-- Activación del inicio de sesión: la primera cuenta, de un administrador. Fuera del armazón. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<section class="card tarjeta-acceso" aria-labelledby="titulo-activar">
	<p class="marca-acceso">ICSI <span>Reportes</span></p>
	<h1 id="titulo-activar" class="view-heading">Activar el inicio de sesión</h1>
	<p class="view-note">
		Hoy cualquiera con acceso a esta dirección puede ver y cambiar todo. Al crear la cuenta de un
		administrador, la aplicación empieza a pedir correo y contraseña a todas las personas. Después
		podrá generar las contraseñas de los demás desde Personal.
	</p>

	{#if form?.error}
		<p class="aviso aviso-error" role="alert">{form.error}</p>
	{/if}

	{#if data.candidatos.length === 0}
		<p class="aviso aviso-alerta" role="status">
			Primero registre en <a class="enlace" href={resolve('/personal')}>Personal</a> a una persona activa
			con rol administrador y correo.
		</p>
	{:else}
		<form method="POST" action="?/activar">
			<div class="form-group">
				<label for="personalId">Administrador</label>
				<select id="personalId" name="personalId" required>
					{#each data.candidatos as candidato (candidato.id)}
						<option value={candidato.id} selected={candidato.id === form?.personalId}
							>{candidato.nombre} · {candidato.correo}</option
						>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="contrasena">Contraseña</label>
				<input
					id="contrasena"
					name="contrasena"
					type="password"
					autocomplete="new-password"
					minlength={data.largoMinimo}
					aria-describedby="nota-contrasena"
					required
				/>
				<p id="nota-contrasena" class="view-note">
					Al menos {data.largoMinimo} caracteres. Una frase larga es mejor que una palabra con símbolos.
				</p>
			</div>
			<div class="form-group">
				<label for="confirmacion">Repetir la contraseña</label>
				<input
					id="confirmacion"
					name="confirmacion"
					type="password"
					autocomplete="new-password"
					minlength={data.largoMinimo}
					required
				/>
			</div>
			<button class="boton primario" type="submit">Activar y entrar</button>
		</form>
	{/if}

	<p class="view-note">
		<a class="enlace" href={resolve('/')}>Volver a la aplicación sin activarlo</a>
	</p>
</section>
