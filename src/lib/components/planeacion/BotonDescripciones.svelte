<!-- Botón de la cabecera «Partida»: muestra completas o recortadas las descripciones de todas las
     partidas de la matriz (descripciones.ts). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		alternarDescripciones,
		cargarDescripciones,
		descripcionesCompletas
	} from './descripciones';

	const EXPANDIR = '<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>';
	const CONTRAER = '<path d="m7 20 5-5 5 5M7 4l5 5 5-5"/>';

	onMount(cargarDescripciones);
	$: texto = $descripcionesCompletas
		? 'Recortar las descripciones de las partidas'
		: 'Mostrar las descripciones completas de las partidas';
</script>

<button
	type="button"
	class="boton-descripciones"
	aria-pressed={$descripcionesCompletas}
	aria-label="Mostrar descripciones completas"
	title={texto}
	on:click={alternarDescripciones}
	><svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
		{@html $descripcionesCompletas ? CONTRAER : EXPANDIR}</svg
	></button
>
