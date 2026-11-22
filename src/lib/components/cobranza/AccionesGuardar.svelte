<!-- Botones de un formulario de /cobranza con su resultado al lado: «Guardando…», «Guardado» o el
     error. Su `id` es el ancla que envía el formulario: sin JavaScript, la página vuelve aquí. -->
<script lang="ts">
	import EstadoGuardado from '$lib/components/ui/EstadoGuardado.svelte';
	import type { ResultadoGuardar } from './adicionales';

	/** Identificador del lugar (`r-contrato`, `r-cobro-<id>`…): el mismo del campo oculto `ancla`. */
	export let ancla: string;
	export let resultado: ResultadoGuardar | null = null;
	/** Ancla del formulario que se está enviando, o null. */
	export let enviando: string | null = null;
	/** El estado va debajo de los botones (celdas estrechas), no a su lado. */
	export let apilado = false;
	/** Solo «Guardado», sin el mensaje de la acción. */
	export let breve = false;

	$: mio = resultado?.ancla === ancla ? resultado : null;
	$: estado = (enviando === ancla ? 'enviando' : mio?.mensaje ? 'guardado' : 'reposo') as
		| 'enviando'
		| 'guardado'
		| 'reposo';
	// «Guardado» ya lo dice el estado; solo se añade lo que aporta algo más.
	$: detalle =
		!breve && estado === 'guardado' && mio?.mensaje && !/^guardad[oa]\.$/i.test(mio.mensaje)
			? mio.mensaje
			: '';
</script>

<div class="acciones-guardar" class:apilado id={ancla}>
	{#if mio?.error && enviando !== ancla}
		<p class="aviso aviso-error" role="alert">{mio.error}</p>
	{/if}
	<slot />
	<div class="estado">
		<EstadoGuardado {estado} />
		{#if detalle}<span class="view-note detalle">{detalle}</span>{/if}
		<slot name="despues" visible={estado === 'guardado'} />
	</div>
</div>

<style>
	.acciones-guardar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		min-width: 0;
		/* Sin JavaScript la página vuelve a este punto: que quede a media pantalla, con el formulario a
		   la vista. */
		scroll-margin-top: 40vh;
	}
	.aviso {
		flex-basis: 100%;
		margin-bottom: 0;
	}
	.estado {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		min-width: 0;
	}
	.apilado .estado {
		flex-basis: 100%;
	}
	.detalle {
		color: var(--tinta-secundaria);
	}
</style>
