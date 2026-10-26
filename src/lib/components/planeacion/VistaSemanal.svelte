<!-- Vista semanal de la planeación: en rediseño. La matriz por semanas del mes vive en la vista
     mensual; este aviso lleva a ella mientras llega el diseño nuevo de la semanal. -->
<script lang="ts">
	/** Enlace a la vista mensual con los filtros actuales. */
	export let enlaceMensual: string;
</script>

<section class="cabecera-matriz aviso-semanal" aria-labelledby="titulo-semanal">
	<div>
		<h2 id="titulo-semanal" class="titulo-matriz">Vista semanal en rediseño</h2>
		<p class="subtitulo-matriz">
			Mientras tanto, la vista mensual muestra cada partida por semanas del mes.
		</p>
	</div>
	<!-- enlaceMensual ya trae resolve() aplicado a la ruta. -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="boton-programa" href={enlaceMensual}>Ir a la vista mensual</a>
</section>
