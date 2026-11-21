<!-- Nombre de la partida en la columna fija de las matrices: recortado a tres líneas con «…» para que
     todas las filas midan lo mismo. Un clic lo despliega completo (y otro lo recorta); con
     «Mostrar descripciones completas» (BotonDescripciones) se ven todos completos. -->
<script lang="ts">
	import { descripcionesCompletas } from './descripciones';

	export let texto: string;

	let abierta = false;
	$: completa = $descripcionesCompletas || abierta;
</script>

<button
	type="button"
	class="nombre-partida"
	class:completa
	aria-expanded={completa}
	title={completa ? undefined : texto}
	on:click={() => (abierta = !abierta)}><span class="texto-partida">{texto}</span></button
>
