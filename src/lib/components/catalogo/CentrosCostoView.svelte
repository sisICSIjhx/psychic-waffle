<!-- Centros de costo (cambio centros-costo-plantillas): clave, nombre, contratos, plantilla y
     personas asignadas. Quien edita el catálogo da de alta centros de costo sin contrato y cambia su
     nombre y su plantilla; la clave de uno existente se corrige desde su contrato, con motivo. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { CentroCosto } from '$lib/dominio/esquemas';
	import { ETIQUETA_MODO_CONTRATO, estadoContratoCentro } from '$lib/dominio/seguimiento';
	import { plural } from '$lib/dominio/textos';
	import Dialogo from '$lib/components/ui/Dialogo.svelte';
	import Aviso from './Aviso.svelte';

	export let centros: CentroCosto[] = [];
	export let plantillas: { id: string; nombre: string }[] = [];
	export let puedeEditar = false;
	export let form: {
		accion?: string;
		mensaje?: string;
		error?: string;
		id?: string | null;
	} | null = null;

	let editando: CentroCosto | null = null;
	let dialogoAbierto = false;
	let formularioEdicion: HTMLFormElement | undefined;

	$: pendientes = centros.filter((c) => estadoContratoCentro(c) === 'pendiente').length;
	$: sinPlantilla = centros.filter((c) => !c.plantilla).length;

	function editar(centro: CentroCosto) {
		editando = centro;
		dialogoAbierto = true;
	}
</script>

<p class="migas">
	<a class="enlace" href={resolve('/catalogo')}>Catálogo</a> / Centros de costo
</p>

<Aviso {form} />

<section class="card" aria-labelledby="titulo-centros">
	<div class="encabezado">
		<h2 id="titulo-centros" class="view-heading">
			{plural(centros.length, 'centro de costo', 'centros de costo')}
		</h2>
		{#if puedeEditar}
			<a class="boton" href={resolve('/catalogo/plantillas')}>Plantillas de seguimiento</a>
		{/if}
	</div>
	{#if pendientes > 0 || (puedeEditar && sinPlantilla > 0)}
		<p class="view-note">
			{#if pendientes > 0}{plural(
					pendientes,
					'centro de costo exige contrato y aún no tiene uno',
					'centros de costo exigen contrato y aún no tienen uno'
				)}.{/if}
			{#if puedeEditar && sinPlantilla > 0}{plural(
					sinPlantilla,
					'centro de costo sin plantilla',
					'centros de costo sin plantilla'
				)}.{/if}
		</p>
	{/if}
	{#if centros.length === 0}
		<p class="view-note">No hay centros de costo que mostrar.</p>
	{:else}
		<div class="tabla-desplazable">
			<table>
				<thead>
					<tr>
						<th>Clave</th>
						<th>Nombre</th>
						<th>Contrato</th>
						<th>Plantilla</th>
						<th>Partidas</th>
						<th>Personas</th>
						{#if puedeEditar}<th><span class="sr-only">Acciones</span></th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each centros as centro (centro.id)}
						{@const estado = estadoContratoCentro(centro)}
						<tr>
							<td class="clave">{centro.clave}</td>
							<td>{centro.nombre || '—'}</td>
							<td>
								{#if estado === 'con_contrato'}
									<ul class="contratos">
										{#each centro.contratos as contrato (contrato.id)}
											<li>
												<a
													class="enlace"
													href={resolve('/catalogo/contratos/[id]', { id: contrato.id })}
													>{contrato.numero}</a
												>
												<span class="view-note">{contrato.cliente}</span>
												{#if contrato.vigente}<span class="status-badge vigente">Vigente</span>{/if}
											</li>
										{/each}
									</ul>
								{:else if estado === 'pendiente'}
									<span class="status-badge warn">Contrato pendiente</span>
								{:else}
									<span class="view-note">Sin contrato</span>
								{/if}
							</td>
							<td>
								{#if centro.plantilla}
									{#if puedeEditar}
										<a
											class="enlace"
											href={resolve('/catalogo/plantillas/[id]', { id: centro.plantilla.id })}
											>{centro.plantilla.nombre}</a
										>
									{:else}
										{centro.plantilla.nombre}
									{/if}
									<span class="view-note bloque"
										>{ETIQUETA_MODO_CONTRATO[centro.plantilla.modoContrato]}</span
									>
								{:else}
									<span class="view-note">Sin plantilla</span>
								{/if}
							</td>
							<td>{centro.partidas}</td>
							<td>{centro.personas}</td>
							{#if puedeEditar}
								<td>
									<button
										class="boton"
										type="button"
										aria-label={`Editar ${centro.clave}`}
										on:click={() => editar(centro)}>Editar</button
									>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

{#if puedeEditar}
	<details class="card" open={centros.length === 0}>
		<summary class="view-heading">Nuevo centro de costo</summary>
		<form method="POST" action="?/guardar" use:enhance class="form-grid">
			<div class="form-group">
				<label for="nuevo-clave">Clave</label>
				<input id="nuevo-clave" name="clave" required autocomplete="off" placeholder="EM-00000" />
			</div>
			<div class="form-group">
				<label for="nuevo-nombre">Nombre</label>
				<input id="nuevo-nombre" name="nombre" autocomplete="off" />
			</div>
			<div class="form-group">
				<label for="nuevo-plantilla">Plantilla de seguimiento</label>
				<select id="nuevo-plantilla" name="plantillaId">
					<option value="">Sin plantilla</option>
					{#each plantillas as plantilla (plantilla.id)}
						<option value={plantilla.id}>{plantilla.nombre}</option>
					{/each}
				</select>
			</div>
			<p class="view-note completo">
				El contrato se registra aparte, en el catálogo de contratos, y se asocia al centro de costo
				desde la ficha del contrato.
			</p>
			<div class="completo">
				<button class="boton primario" type="submit">Registrar centro de costo</button>
			</div>
		</form>
	</details>

	<Dialogo
		id="editar-centro"
		bind:abierto={dialogoAbierto}
		titulo={`Editar ${editando?.clave ?? ''}`}
		textoConfirmar="Guardar"
		on:confirmar={() => formularioEdicion?.requestSubmit()}
	>
		{#if editando}
			{#key editando.id}
				<form
					method="POST"
					action="?/guardar"
					bind:this={formularioEdicion}
					use:enhance={() =>
						async ({ update, result }) => {
							if (result.type === 'success') dialogoAbierto = false;
							await update();
						}}
				>
					<input type="hidden" name="id" value={editando.id} />
					<div class="form-group">
						<label for="editar-nombre">Nombre</label>
						<input id="editar-nombre" name="nombre" value={editando.nombre} autocomplete="off" />
					</div>
					<div class="form-group">
						<label for="editar-plantilla">Plantilla de seguimiento</label>
						<select id="editar-plantilla" name="plantillaId" value={editando.plantilla?.id ?? ''}>
							<option value="">Sin plantilla</option>
							{#each plantillas as plantilla (plantilla.id)}
								<option value={plantilla.id}>{plantilla.nombre}</option>
							{/each}
						</select>
					</div>
				</form>
			{/key}
			<p class="view-note">La clave se corrige desde el contrato, con motivo y bitácora.</p>
		{/if}
	</Dialogo>
{/if}

<style>
	.encabezado {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
	}
	.clave {
		font-weight: 700;
		white-space: nowrap;
	}
	.contratos {
		display: grid;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.contratos li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 8px;
	}
	.bloque {
		display: block;
	}
	.completo {
		grid-column: 1 / -1;
	}
</style>
