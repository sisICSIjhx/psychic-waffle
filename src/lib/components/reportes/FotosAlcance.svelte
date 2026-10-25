<!-- Fotos de un alcance: carga múltiple con botón o arrastrando archivos, pie con la numeración
     «Ilustración 2.n.m», reordenamiento, cambio de alcance y, en la disposición antes/durante/después,
     tres espacios etiquetados. Quitar avisa al editor, que aplaza la baja para poder deshacerla. -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { ordenDeAparicion, pieIlustracion } from '$lib/dominio/documento';
	import type { Foto } from '$lib/dominio/esquemas';

	type Momento = 'antes' | 'durante' | 'despues';

	export let fotos: Foto[] = [];
	export let posicionAlcance = 1;
	export let disposicion: 'cuadricula' | 'antes_durante_despues' = 'cuadricula';
	export let reporteId = '';
	export let soloLectura = false;
	/** Otros alcances del reporte, para mover una foto. */
	export let otrosAlcances: { id: string; etiqueta: string }[] = [];
	/** Avance de la carga en curso de este alcance. */
	export let progreso: { total: number; hechas: number } | null = null;
	/** Fotos quitadas que aún pueden deshacerse: no se muestran ni se numeran. */
	export let ocultas: Record<string, unknown> = {};

	const dispatch = createEventDispatcher<{
		cargar: { archivos: File[]; momento: Momento | null };
		mover: { fotoId: string; alcanceId: string };
		quitar: { fotoId: string; pie: string };
	}>();

	/** Grupo sobre el que se están arrastrando archivos. */
	let sobre: string | null = null;

	const ACEPTA = '.jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif';
	const ESPACIOS: { momento: Momento; etiqueta: string }[] = [
		{ momento: 'antes', etiqueta: 'ANTES' },
		{ momento: 'durante', etiqueta: 'DURANTE' },
		{ momento: 'despues', etiqueta: 'DESPUÉS' }
	];

	const momentoDe = (foto: Foto): Momento => foto.momento ?? 'durante';

	$: visibles = fotos.filter((f) => !ocultas[f.id]);
	$: numeracion = new Map(ordenDeAparicion(visibles, disposicion).map((f, i) => [f.id, i + 1]));
	$: grupos =
		disposicion === 'antes_durante_despues'
			? ESPACIOS.map((e) => ({ ...e, fotos: visibles.filter((f) => momentoDe(f) === e.momento) }))
			: [{ momento: null, etiqueta: '', fotos: visibles }];

	function seleccionar(evento: Event, momento: Momento | null) {
		const entrada = evento.currentTarget as HTMLInputElement;
		const archivos = Array.from(entrada.files ?? []);
		entrada.value = '';
		if (archivos.length) dispatch('cargar', { archivos, momento });
	}

	function arrastrar(evento: DragEvent, clave: string) {
		if (!evento.dataTransfer?.types.includes('Files')) return;
		evento.preventDefault();
		evento.dataTransfer.dropEffect = 'copy';
		sobre = clave;
	}

	function salir(evento: DragEvent) {
		const zona = evento.currentTarget as HTMLElement;
		if (!zona.contains(evento.relatedTarget as Node | null)) sobre = null;
	}

	/** Los archivos soltados siguen el mismo camino que los del botón; el servidor valida cada uno. */
	function soltar(evento: DragEvent, momento: Momento | null) {
		evento.preventDefault();
		sobre = null;
		const archivos = Array.from(evento.dataTransfer?.files ?? []);
		if (archivos.length) dispatch('cargar', { archivos, momento });
	}

	/** Intercambia la foto con la anterior o la siguiente visible de su mismo grupo. */
	function mover(foto: Foto, paso: -1 | 1) {
		const grupo = disposicion === 'antes_durante_despues' ? momentoDe(foto) : null;
		const indices = fotos
			.map((f, i) => ({ f, i }))
			.filter(({ f }) => !ocultas[f.id] && (grupo === null || momentoDe(f) === grupo))
			.map(({ i }) => i);
		const posicion = indices.indexOf(fotos.indexOf(foto));
		const destino = indices[posicion + paso];
		if (destino === undefined) return;
		const nuevas = [...fotos];
		[nuevas[indices[posicion]], nuevas[destino]] = [nuevas[destino], nuevas[indices[posicion]]];
		fotos = nuevas;
	}

	// Cada cambio reasigna «fotos» para que el editor (bind:fotos) detecte la modificación.
	function describir(foto: Foto, descripcion: string) {
		fotos = fotos.map((f) => (f.id === foto.id ? { ...f, descripcion } : f));
	}

	function cambiarMomento(foto: Foto, momento: Momento) {
		fotos = fotos.map((f) => (f.id === foto.id ? { ...f, momento } : f));
	}

	function quitar(foto: Foto) {
		dispatch('quitar', {
			fotoId: foto.id,
			pie: pieIlustracion(posicionAlcance, numeracion.get(foto.id) ?? 1)
		});
	}
</script>

<div class="fotos-alcance" class:espacios={disposicion === 'antes_durante_despues'}>
	{#each grupos as grupo (grupo.momento ?? 'todas')}
		{@const clave = grupo.momento ?? 'todas'}
		<div
			class="grupo-fotos"
			class:zona-soltar={!soloLectura}
			class:arrastrando={sobre === clave}
			role="group"
			aria-label={`Fotos del alcance 2.${posicionAlcance}${grupo.etiqueta ? ` (${grupo.etiqueta})` : ''}`}
			on:dragenter={(e) => !soloLectura && arrastrar(e, clave)}
			on:dragover={(e) => !soloLectura && arrastrar(e, clave)}
			on:dragleave={salir}
			on:drop={(e) => !soloLectura && soltar(e, grupo.momento)}
		>
			{#if grupo.etiqueta}<h4 class="etiqueta-espacio">{grupo.etiqueta}</h4>{/if}
			<ul class="lista-fotos">
				{#each grupo.fotos as foto, i (foto.id)}
					{@const numero = numeracion.get(foto.id) ?? 0}
					<li class="foto">
						<!-- Sin reporte (p. ej. en pruebas) no se pide la imagen al servidor. -->
						{#if reporteId}
							<img
								src={`/reportes/${reporteId}/fotos/${foto.id}`}
								alt={foto.descripcion || `Foto ${numero} del alcance ${posicionAlcance}`}
								loading="lazy"
							/>
						{/if}
						<p class="pie">{pieIlustracion(posicionAlcance, numero)}</p>
						<label class="sr-only" for={`pie-${foto.id}`}
							>Descripción de la {pieIlustracion(posicionAlcance, numero)}</label
						>
						<input
							id={`pie-${foto.id}`}
							placeholder="Descripción del pie (opcional)"
							value={foto.descripcion}
							disabled={soloLectura}
							on:input={(e) => describir(foto, (e.currentTarget as HTMLInputElement).value)}
						/>
						{#if !soloLectura}
							<div class="acciones-foto">
								<button
									type="button"
									class="action-btn"
									disabled={i === 0}
									aria-label={`Subir la ${pieIlustracion(posicionAlcance, numero)}`}
									on:click={() => mover(foto, -1)}>↑</button
								>
								<button
									type="button"
									class="action-btn"
									disabled={i === grupo.fotos.length - 1}
									aria-label={`Bajar la ${pieIlustracion(posicionAlcance, numero)}`}
									on:click={() => mover(foto, 1)}>↓</button
								>
								{#if disposicion === 'antes_durante_despues'}
									<select
										aria-label={`Espacio de la ${pieIlustracion(posicionAlcance, numero)}`}
										value={momentoDe(foto)}
										on:change={(e) =>
											cambiarMomento(foto, (e.currentTarget as HTMLSelectElement).value as Momento)}
									>
										{#each ESPACIOS as espacio (espacio.momento)}
											<option value={espacio.momento}>{espacio.etiqueta}</option>
										{/each}
									</select>
								{/if}
								{#if otrosAlcances.length}
									<select
										aria-label={`Mover la ${pieIlustracion(posicionAlcance, numero)} a otro alcance`}
										value=""
										on:change={(e) => {
											const alcanceId = (e.currentTarget as HTMLSelectElement).value;
											if (alcanceId) dispatch('mover', { fotoId: foto.id, alcanceId });
										}}
									>
										<option value="">Mover a…</option>
										{#each otrosAlcances as otro (otro.id)}
											<option value={otro.id}>{otro.etiqueta}</option>
										{/each}
									</select>
								{/if}
								<button
									type="button"
									class="action-btn delete"
									aria-label={`Quitar la ${pieIlustracion(posicionAlcance, numero)}`}
									on:click={() => quitar(foto)}>Quitar</button
								>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
			{#if !soloLectura}
				<div class="agregar">
					<label class="boton cargar-fotos">
						Agregar fotos{grupo.etiqueta ? ` (${grupo.etiqueta})` : ''}
						<input
							class="sr-only"
							type="file"
							multiple
							accept={ACEPTA}
							on:change={(e) => seleccionar(e, grupo.momento)}
						/>
					</label>
					<span class="pista">o arrástrelas aquí</span>
				</div>
			{/if}
		</div>
	{/each}
	{#if progreso}
		<div class="progreso" role="status">
			<span>Cargando {Math.min(progreso.hechas + 1, progreso.total)} de {progreso.total}…</span>
			<progress max={progreso.total} value={progreso.hechas}></progress>
		</div>
	{/if}
</div>

<style>
	/* min(…, 100%) y min-width: 0 evitan que una foto o la lista «Mover a…» ensanchen la página. */
	.fotos-alcance.espacios {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
	}
	.grupo-fotos {
		min-width: 0;
	}
	.lista-fotos {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
		list-style: none;
		margin: 0 0 8px;
		padding: 0;
	}
	.foto {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 6px;
		min-width: 0;
	}
	.foto input,
	.acciones-foto select {
		min-width: 0;
		max-width: 100%;
	}
	.acciones-foto select {
		flex: 1 1 100px;
	}
	.foto img {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: contain;
		background: var(--surface-2);
		border-radius: 4px;
	}
	.pie {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.acciones-foto {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.etiqueta-espacio {
		margin: 0 0 6px;
		font-size: 0.85rem;
		letter-spacing: 0.04em;
	}
	.cargar-fotos {
		display: inline-flex;
		cursor: pointer;
	}
	.zona-soltar {
		border: 2px dashed transparent;
		border-radius: 8px;
		padding: 4px;
		transition: border-color 0.15s;
	}
	.zona-soltar:hover {
		border-color: var(--border);
	}
	.zona-soltar.arrastrando {
		border-color: var(--primary);
		background: var(--primary-soft);
	}
	.agregar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.pista {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.progreso {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-top: 8px;
		font-size: 0.9rem;
	}
	.progreso progress {
		flex: 1 1 160px;
		accent-color: var(--primary);
	}
</style>
