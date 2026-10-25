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
		padding: 8px 8px 8px 16px;
		border-radius: 10px;
		background: var(--text);
		color: var(--bg);
		box-shadow: var(--shadow);
		pointer-events: auto;
	}
	/* El fondo de la notificación es el color del texto del tema: el botón invierte también. */
	.deshacer {
		background: var(--bg);
		color: var(--text);
		border-color: var(--bg);
		font-weight: 600;
	}
</style>
