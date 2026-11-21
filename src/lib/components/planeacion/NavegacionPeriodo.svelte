<!-- Navegación entre periodos (meses de la vista mensual o semanas de la semanal): un solo control con
     el periodo mostrado al centro (en azul si contiene la fecha de hoy) y, a los lados, el anterior y
     el siguiente en letra menor y tenue con flechas de chevrón. Cada enlace lleva su nombre completo para lectores de pantalla. Estilos en
     planeacion/programa.css (.navegacion-periodo). -->
<script lang="ts">
	interface Paso {
		href: string;
		/** Texto visible y breve («oct», «9–15 nov»). */
		texto: string;
		/** Nombre accesible completo («Mes anterior: Octubre 2026»). */
		nombre: string;
	}

	/** Nombre de la navegación («Meses del programa»). */
	export let etiqueta: string;
	export let anterior: Paso | null = null;
	export let siguiente: Paso | null = null;
	/** Periodo actual («Noviembre 2026», «Semana 47»). */
	export let titulo: string;
	/** Dato secundario del periodo actual («16–22 nov 2026»). */
	export let detalle = '';
	/** El periodo mostrado contiene la fecha de hoy: se resalta en el azul de las vistas. */
	export let esHoy = false;

	const CHEVRON_IZQUIERDA = '<path d="m15 18-6-6 6-6"/>';
	const CHEVRON_DERECHA = '<path d="m9 18 6-6-6-6"/>';
</script>

<nav class="navegacion-periodo" aria-label={etiqueta}>
	<!-- Los enlaces llegan resueltos (resolve() y la consulta) desde la vista. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	{#if anterior}
		<a class="paso-periodo" href={anterior.href} aria-label={anterior.nombre}
			><svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
				{@html CHEVRON_IZQUIERDA}</svg
			><span>{anterior.texto}</span></a
		>
	{:else}
		<span class="paso-periodo vacio" aria-hidden="true"></span>
	{/if}
	<p class="periodo-actual" class:es-hoy={esHoy} aria-current={esHoy ? 'date' : undefined}>
		<!-- El espacio entre título y detalle evita que el lector de pantalla los lea juntos. -->
		<span class="titulo-periodo">{titulo}</span>
		{#if detalle}<span class="detalle-periodo">{detalle}</span>{/if}
	</p>
	{#if siguiente}
		<a class="paso-periodo" href={siguiente.href} aria-label={siguiente.nombre}
			><span>{siguiente.texto}</span><svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
				{@html CHEVRON_DERECHA}</svg
			></a
		>
	{:else}
		<span class="paso-periodo vacio" aria-hidden="true"></span>
	{/if}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</nav>
