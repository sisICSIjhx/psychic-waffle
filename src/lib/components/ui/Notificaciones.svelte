<!-- Región de notificaciones de la aplicación (se monta una vez, en el layout). Los lectores de
     pantalla anuncian cada mensaje nuevo. -->
<script lang="ts">
	import { notificaciones } from './notificaciones';
</script>

<div class="notificaciones" role="status" aria-live="polite">
	{#each $notificaciones as notificacion (notificacion.id)}
		<div class="notificacion">
			<span>{notificacion.mensaje}</span>
			{#if notificacion.textoDeshacer}
				<button
					class="boton deshacer"
					type="button"
					on:click={() => notificaciones.deshacer(notificacion.id)}
					>{notificacion.textoDeshacer}</button
				>
			{/if}
		</div>
	{/each}
</div>

<style>
	.notificaciones {
		position: fixed;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 60;
		display: grid;
		gap: 8px;
		width: min(520px, calc(100vw - 32px));
		pointer-events: none;
	}
	.notificacion {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 44px;
		padding: 6px 6px 6px 16px;
		border-radius: var(--radio-flotante);
		background: var(--tinta);
		color: var(--lienzo);
		box-shadow: var(--sombra-flotante);
		animation: entrar 0.18s var(--curva-salida);
		pointer-events: auto;
	}
	/* El fondo de la notificación es el color del texto del tema: el botón invierte también. */
	.deshacer {
		background: transparent;
		color: var(--lienzo);
		border-color: transparent;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.deshacer:hover:not(:disabled) {
		background: color-mix(in srgb, var(--lienzo) 14%, transparent);
		border-color: transparent;
	}
	.deshacer:focus-visible {
		outline-color: var(--lienzo);
	}
	@keyframes entrar {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
