<!-- Mi perfil: datos de la cuenta (solo lectura; los corrige el administrador en Personal) y cambio
     de contraseña. Sin inicio de sesión activado no hay cuenta que mostrar. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Aviso from '$lib/components/catalogo/Aviso.svelte';

	export let cuenta: {
		nombre: string;
		correo: string;
		rol: string;
		sede: string | null;
		centrosCosto: string;
		debeCambiar: boolean;
	} | null = null;
	export let largoMinimo = 10;
	export let form: { mensaje?: string; error?: string } | null = null;
</script>

{#if !cuenta}
	<section class="card" aria-labelledby="titulo-perfil">
		<h2 id="titulo-perfil" class="view-heading">Mi perfil</h2>
		<p class="view-note">
			El inicio de sesión no está activado: la aplicación no sabe quién la usa.
			<a class="enlace" href={resolve('/acceso/configurar')}>Activar inicio de sesión</a>
		</p>
	</section>
{:else}
	{#if cuenta.debeCambiar}
		<p class="aviso aviso-alerta" role="status">
			Entró con una contraseña temporal. Cámbiela para usar la aplicación.
		</p>
	{/if}

	<section class="card" aria-labelledby="titulo-perfil">
		<h2 id="titulo-perfil" class="view-heading">Mi cuenta</h2>
		<dl class="datos-cuenta">
			<div>
				<dt>Nombre</dt>
				<dd>{cuenta.nombre}</dd>
			</div>
			<div>
				<dt>Correo</dt>
				<dd>{cuenta.correo}</dd>
			</div>
			<div>
				<dt>Rol</dt>
				<dd>{cuenta.rol}</dd>
			</div>
			<div>
				<dt>Sede</dt>
				<dd>{cuenta.sede ?? '—'}</dd>
			</div>
			<div>
				<dt>Centros de costo</dt>
				<dd>{cuenta.centrosCosto}</dd>
			</div>
		</dl>
		<p class="view-note">Si algún dato no es correcto, pida al administrador que lo corrija.</p>
	</section>

	<section class="card" aria-labelledby="titulo-contrasena">
		<h2 id="titulo-contrasena" class="view-heading">Cambiar contraseña</h2>
		<Aviso {form} />
		<!-- Sin `enhance`: los campos de contraseña se vacían al recargar la página. -->
		<form method="POST" action="?/cambiarContrasena" class="form-contrasena">
			<div class="form-group">
				<label for="actual"
					>{cuenta.debeCambiar ? 'Contraseña temporal' : 'Contraseña actual'}</label
				>
				<input id="actual" name="actual" type="password" autocomplete="current-password" required />
			</div>
			<div class="form-group">
				<label for="nueva">Contraseña nueva</label>
				<input
					id="nueva"
					name="nueva"
					type="password"
					autocomplete="new-password"
					minlength={largoMinimo}
					aria-describedby="nota-nueva"
					required
				/>
				<p id="nota-nueva" class="view-note">
					Al menos {largoMinimo} caracteres. Una frase larga es mejor que una palabra con símbolos.
				</p>
			</div>
			<div class="form-group">
				<label for="confirmacion">Repetir la contraseña nueva</label>
				<input
					id="confirmacion"
					name="confirmacion"
					type="password"
					autocomplete="new-password"
					minlength={largoMinimo}
					required
				/>
			</div>
			<button class="boton primario" type="submit">Cambiar contraseña</button>
		</form>
	</section>
{/if}

<style>
	.datos-cuenta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
		gap: 12px 24px;
		margin: 0 0 12px;
	}
	.datos-cuenta dt {
		color: var(--tinta-secundaria);
		font-size: var(--texto-sm);
	}
	.datos-cuenta dd {
		margin: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.form-contrasena {
		display: grid;
		gap: 12px;
		max-width: 420px;
	}
	.form-contrasena .boton {
		justify-self: start;
	}
</style>
