<!-- Encabezado de una página: ceja con la ruta, título, descripción opcional y acciones a la derecha. -->
<script lang="ts">
	export let titulo: string;
	export let ceja: string | null = null;
	export let descripcion: string | null = null;
</script>

<header class="encabezado-pagina">
	<div class="titulos">
		{#if ceja}<p class="ceja">{ceja}</p>{/if}
		<h1 class="titulo-pagina">{titulo}</h1>
		{#if descripcion}<p class="descripcion-pagina">{descripcion}</p>{/if}
	</div>
	{#if $$slots.acciones}
		<div class="acciones-pagina"><slot name="acciones" /></div>
	{/if}
</header>
