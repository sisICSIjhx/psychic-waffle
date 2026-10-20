<!-- Mensaje de resultado de una acción de formulario (éxito o error). -->
<script lang="ts">
	export let form: { mensaje?: string; error?: string } | null = null;
</script>

{#if form?.error}
	<p class="aviso aviso-error" role="alert">{form.error}</p>
{:else if form?.mensaje}
	<p class="aviso aviso-exito" role="status">{form.mensaje}</p>
{/if}
