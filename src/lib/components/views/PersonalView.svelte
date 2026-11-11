<!-- Lista del personal con sede, rol, centros de costo, cuenta y estado; el alta y la edición van a
     /personal/[id]. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Personal } from '$lib/dominio/esquemas';
	import { ETIQUETAS_ROL, nombreCompleto, textoAcceso, textoCentros } from '$lib/dominio/personal';
	import { normalizarBusqueda } from '$lib/dominio/seleccion';
	import { plural } from '$lib/dominio/textos';

	export let personal: Personal[] = [];
	export let puedeEditar = true;

	const filtrosIniciales = { rol: '', sede: '', centro: '', estado: 'activo', acceso: '' };
	const estadosDeAcceso = ['Con cuenta', 'Sin cuenta', 'Contraseña temporal', 'Bloqueada'];

	let consulta = '';
	let filtrosAbiertos = false;
	let filtros = { ...filtrosIniciales };
	let botonFiltros: HTMLButtonElement;

	$: sedes = [...new Set(personal.flatMap((p) => (p.sede ? [p.sede] : [])))].sort((a, b) =>
		a.localeCompare(b, 'es-MX')
	);
	$: centros = [
		...new Map(
			personal.flatMap((p) => p.centrosCosto.map((centro) => [centro.id, centro]))
		).values()
	].sort((a, b) => a.clave.localeCompare(b.clave, 'es-MX'));
	$: cantidadFiltros = Object.entries(filtrosIniciales).filter(
		([clave, valor]) => filtros[clave as keyof typeof filtros] !== valor
	).length;
	$: palabras = normalizarBusqueda(consulta).split(' ').filter(Boolean);
	$: visibles = personal.filter((persona) => {
		if (filtros.estado !== 'todos' && persona.activo !== (filtros.estado === 'activo'))
			return false;
		if (filtros.rol && filtros.rol !== persona.rol) return false;
		if (filtros.sede && filtros.sede !== persona.sede) return false;
		if (filtros.centro && !persona.centrosCosto.some(({ id }) => id === filtros.centro))
			return false;
		if (filtros.acceso && filtros.acceso !== textoAcceso(persona)) return false;
		if (palabras.length === 0) return true;
		const texto = normalizarBusqueda(`${nombreCompleto(persona)} ${persona.correo ?? ''}`);
		return palabras.every((palabra) => texto.includes(palabra));
	});

	function restablecerFiltros() {
		filtros = { ...filtrosIniciales };
		botonFiltros.focus();
	}
</script>

{#if puedeEditar}
	<div class="toolbar">
		<a class="boton primario" href={resolve('/personal/[id]', { id: 'nuevo' })}>Dar de alta</a>
	</div>
{/if}

<div class="busqueda-personal" role="search" aria-label="Buscar personal">
	<div class="campo-busqueda">
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
		>
			<circle cx="10.5" cy="10.5" r="6.5" />
			<path d="m16 16 4 4" />
		</svg>
		<input
			type="search"
			aria-label="Buscar por nombre o correo"
			placeholder="Buscar por nombre o correo"
			bind:value={consulta}
		/>
	</div>
	<button
		type="button"
		class="boton abrir-filtros"
		aria-expanded={filtrosAbiertos}
		aria-controls="filtros-personal"
		bind:this={botonFiltros}
		on:click={() => (filtrosAbiertos = !filtrosAbiertos)}
	>
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linejoin="round"
		>
			<path d="M3 4h18l-7 8v7l-4 2v-9z" />
		</svg>
		Filtros avanzados
		{#if cantidadFiltros > 0}
			<span class="cantidad-filtros">
				{cantidadFiltros}<span class="sr-only">
					{cantidadFiltros === 1 ? 'filtro activo' : 'filtros activos'}</span
				>
			</span>
		{/if}
	</button>
</div>

<div id="filtros-personal" hidden={!filtrosAbiertos}>
	<fieldset class="filtros-personal">
		<legend class="sr-only">Filtros avanzados de personal</legend>
		<div class="campos-filtro">
			<label class="form-group">
				Rol
				<select bind:value={filtros.rol}>
					<option value="">Todos los roles</option>
					{#each Object.entries(ETIQUETAS_ROL) as [rol, etiqueta] (rol)}
						<option value={rol}>{etiqueta}</option>
					{/each}
				</select>
			</label>
			<label class="form-group">
				Sede
				<select bind:value={filtros.sede}>
					<option value="">Todas las sedes</option>
					{#each sedes as sede (sede)}
						<option value={sede}>{sede}</option>
					{/each}
				</select>
			</label>
			<label class="form-group">
				Centro de costo asignado
				<select bind:value={filtros.centro}>
					<option value="">Cualquier centro de costo</option>
					{#each centros as centro (centro.id)}
						<option value={centro.id}>{centro.clave}</option>
					{/each}
				</select>
			</label>
			<label class="form-group">
				Estado
				<select bind:value={filtros.estado}>
					<option value="activo">Activos</option>
					<option value="inactivo">Inactivos</option>
					<option value="todos">Todos los estados</option>
				</select>
			</label>
			<label class="form-group">
				Acceso
				<select bind:value={filtros.acceso}>
					<option value="">Cualquier acceso</option>
					{#each estadosDeAcceso as estado (estado)}
						<option value={estado}>{estado}</option>
					{/each}
				</select>
			</label>
		</div>
		{#if cantidadFiltros > 0}
			<button type="button" class="boton fantasma restablecer" on:click={restablecerFiltros}
				>Restablecer filtros</button
			>
		{/if}
	</fieldset>
</div>

<section class="card" aria-labelledby="titulo-personal">
	<h2 id="titulo-personal" class="view-heading" aria-live="polite">
		{filtros.estado === 'activo'
			? plural(visibles.length, 'persona activa', 'personas activas')
			: plural(visibles.length, 'persona', 'personas')}
	</h2>
	{#if personal.length === 0}
		<p class="view-note">
			Aún no hay personal registrado.
			{puedeEditar ? 'Use «Dar de alta» para registrar a la primera persona.' : ''}
		</p>
	{:else if visibles.length === 0}
		<p class="view-note">
			{cantidadFiltros > 0 || palabras.length > 0
				? 'Ninguna persona coincide con la búsqueda o los filtros.'
				: 'Todo el personal está dado de baja.'}
		</p>
	{:else}
		<div class="tabla-desplazable">
			<table>
				<thead>
					<tr>
						<th>Nombre</th>
						<th>Sede</th>
						<th>Rol</th>
						<th>Centros de costo</th>
						<th>Acceso</th>
						<th>Estado</th>
						{#if puedeEditar}<th><span class="sr-only">Acciones</span></th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each visibles as persona (persona.id)}
						<tr>
							<td>{nombreCompleto(persona)}</td>
							<td>{persona.sede ?? '—'}</td>
							<td>{ETIQUETAS_ROL[persona.rol]}</td>
							<td>{textoCentros(persona)}</td>
							<td>{textoAcceso(persona)}</td>
							<td>
								{#if persona.activo}
									<span class="status-badge ok">Activo</span>
								{:else}
									<span class="status-badge warn">Inactivo</span>
								{/if}
							</td>
							{#if puedeEditar}
								<td
									><a class="enlace" href={resolve('/personal/[id]', { id: persona.id })}>Editar</a
									></td
								>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.busqueda-personal {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 16px;
	}
	.campo-busqueda {
		position: relative;
		flex: 1 1 240px;
		min-width: 0;
	}
	.campo-busqueda svg {
		position: absolute;
		inset-inline-start: 12px;
		top: 50%;
		width: 22px;
		height: 22px;
		transform: translateY(-50%);
		color: var(--tinta-tenue);
		pointer-events: none;
	}
	.campo-busqueda input {
		width: 100%;
		min-height: 48px;
		padding-inline-start: 44px;
	}
	.abrir-filtros {
		min-height: 48px;
		gap: 8px;
	}
	.abrir-filtros[aria-expanded='true'] {
		border-color: var(--accion);
	}
	.cantidad-filtros {
		display: grid;
		place-items: center;
		min-width: 21px;
		height: 21px;
		border-radius: 999px;
		background: var(--lienzo);
		color: var(--tinta-secundaria);
		font-size: var(--texto-sm);
	}
	.filtros-personal {
		margin: 0 0 16px;
		padding: 16px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-control);
		background: var(--superficie);
	}
	.campos-filtro {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 175px), 1fr));
		gap: 12px;
	}
	.campos-filtro .form-group {
		margin: 0;
	}
	.filtros-personal select {
		width: 100%;
		min-width: 0;
	}
	.restablecer {
		display: flex;
		margin: 12px 0 0 auto;
	}
</style>
