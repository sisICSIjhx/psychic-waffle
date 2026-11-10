<!-- Inicio de sesión con correo y contraseña. Se muestra fuera del armazón (sin menú ni cabecera). -->
<script lang="ts">
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<section class="card tarjeta-acceso" aria-labelledby="titulo-acceso">
	<p class="marca-acceso">ICSI <span>Reportes</span></p>
	<h1 id="titulo-acceso" class="view-heading">Iniciar sesión</h1>

	{#if form?.error}
		<p class="aviso aviso-error" role="alert">{form.error}</p>
	{/if}

	<!-- Sin `enhance`: al entrar, la página se carga completa con la sesión nueva. -->
	<form method="POST" action="?/entrar">
		<input type="hidden" name="destino" value={form?.destino ?? data.destino} />
		<div class="form-group">
			<label for="correo">Correo</label>
			<!-- El foco inicial va al correo: la página no tiene otro propósito que este formulario. -->
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="correo"
				name="correo"
				type="email"
				autocomplete="username"
				value={form?.correo ?? ''}
				required
				autofocus
			/>
		</div>
		<div class="form-group">
			<label for="contrasena">Contraseña</label>
			<input
				id="contrasena"
				name="contrasena"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>
		<button class="boton primario" type="submit">Entrar</button>
	</form>

	<p class="view-note">
		Si olvidó su contraseña, pida al administrador que le genere una temporal.
	</p>
</section>
