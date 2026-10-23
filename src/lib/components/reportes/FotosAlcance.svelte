<!-- Fotos de un alcance: carga múltiple con botón o arrastrando archivos, pie con la numeración
     «Ilustración 2.n.m», tarjetas con barra de acciones, reordenamiento arrastrando (soltar en otra
     columna cambia el espacio), con el menú «Más acciones» o con el asa y el teclado, y vista ampliada.
     En la disposición antes/durante/después hay tres espacios etiquetados. Quitar y reemplazar avisan
     al editor, que aplaza la baja para poder deshacerla. -->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { ordenDeAparicion, pieIlustracion } from '$lib/dominio/documento';
	import {
		ACEPTA_FOTOS,
		moverDeColumna,
		moverPaso,
		reordenarFoto,
		type Momento
	} from '$lib/dominio/fotos';
	import type { Foto } from '$lib/dominio/esquemas';
	import { arrastreFotos, esArrastreDeFoto, TIPO_ARRASTRE_FOTO } from './arrastreFotos';
	import TarjetaFoto from './TarjetaFoto.svelte';
	import VisorFotos from './VisorFotos.svelte';

	export let fotos: Foto[] = [];
	export let posicionAlcance = 1;
	export let tituloAlcance = '';
	export let disposicion: 'cuadricula' | 'antes_durante_despues' = 'cuadricula';
	export let reporteId = '';
	export let soloLectura = false;
	/** Otros alcances del reporte, para mover una foto. */
	export let otrosAlcances: { id: string; etiqueta: string }[] = [];
	/** Avance de la carga en curso de este alcance. */
	export let progreso: { total: number; hechas: number } | null = null;
	/** Fotos quitadas que aún pueden deshacerse: no se muestran ni se numeran. */
	export let ocultas: Record<string, unknown> = {};
	/** Fotos con un reemplazo en curso. */
	export let reemplazando: Record<string, unknown> = {};

	const dispatch = createEventDispatcher<{
		cargar: { archivos: File[]; momento: Momento | null };
		mover: { fotoId: string; alcanceId: string };
		quitar: { fotoId: string; pie: string };
		reemplazar: { fotoId: string; archivo: File; pie: string };
		deshacer: { fotoId: string };
	}>();

	/** Identifica este alcance ante el arrastre interno: solo se reordena dentro del mismo. */
	const origen = {};
	const instrucciones = `instrucciones-fotos-${Math.random().toString(36).slice(2)}`;

	/** Grupo sobre el que se están arrastrando archivos. */
	let sobre: string | null = null;
	/** Lugar en el que caería la foto arrastrada. */
	let insercion: { destinoId: string | null; lado: 'antes' | 'despues'; grupo: string } | null =
		null;
	/** Foto tomada con el asa y el orden previo, para restaurarlo con Esc. */
	let agarre: { fotoId: string; previas: Foto[] } | null = null;
	let anuncio = '';
	let visor: string | null = null;
	let lista: HTMLElement | undefined;
	let raiz: HTMLElement | undefined;

	const ESPACIOS: { momento: Momento; etiqueta: string }[] = [
		{ momento: 'antes', etiqueta: 'ANTES' },
		{ momento: 'durante', etiqueta: 'DURANTE' },
		{ momento: 'despues', etiqueta: 'DESPUÉS' }
	];
	const ETIQUETA: Record<Momento, string> = {
		antes: 'ANTES',
		durante: 'DURANTE',
		despues: 'DESPUÉS'
	};

	const momentoDe = (foto: Foto): Momento => foto.momento ?? 'durante';

	$: visibles = fotos.filter((f) => !ocultas[f.id]);
	$: enOrden = ordenDeAparicion(visibles, disposicion);
	$: numeracion = new Map(enOrden.map((f, i) => [f.id, i + 1]));
	$: grupos =
		disposicion === 'antes_durante_despues'
			? ESPACIOS.map((e) => ({ ...e, fotos: visibles.filter((f) => momentoDe(f) === e.momento) }))
			: [{ momento: null, etiqueta: '', fotos: visibles }];

	const pieDe = (id: string) => pieIlustracion(posicionAlcance, numeracion.get(id) ?? 1);

	function seleccionar(evento: Event, momento: Momento | null) {
		const entrada = evento.currentTarget as HTMLInputElement;
		const archivos = Array.from(entrada.files ?? []);
		entrada.value = '';
		if (archivos.length) dispatch('cargar', { archivos, momento });
	}

	// Archivos arrastrados desde el equipo: se cargan en el grupo en que se sueltan.
	function arrastrar(evento: DragEvent, clave: string) {
		if (esArrastreDeFoto(evento.dataTransfer)) return sobreGrupo(evento, clave);
		if (!evento.dataTransfer?.types.includes('Files')) return;
		evento.preventDefault();
		evento.dataTransfer.dropEffect = 'copy';
		sobre = clave;
	}

	function salir(evento: DragEvent) {
		const zona = evento.currentTarget as HTMLElement;
		if (zona.contains(evento.relatedTarget as Node | null)) return;
		sobre = null;
		insercion = null;
	}

	/** Los archivos soltados siguen el mismo camino que los del botón; el servidor valida cada uno. */
	function soltar(evento: DragEvent, momento: Momento | null, clave: string) {
		if (esArrastreDeFoto(evento.dataTransfer)) return soltarFoto(evento, momento, clave);
		evento.preventDefault();
		sobre = null;
		const archivos = Array.from(evento.dataTransfer?.files ?? []);
		if (archivos.length) dispatch('cargar', { archivos, momento });
	}

	// Arrastre interno para reordenar (D4): solo se acepta dentro del mismo alcance.
	function iniciarArrastre(evento: DragEvent, foto: Foto) {
		if (!evento.dataTransfer) return;
		evento.dataTransfer.setData(TIPO_ARRASTRE_FOTO, foto.id);
		evento.dataTransfer.effectAllowed = 'move';
		arrastreFotos.iniciar(foto.id, origen);
	}

	function terminarArrastre() {
		arrastreFotos.terminar();
		insercion = null;
	}

	function sobreTarjeta(evento: DragEvent, foto: Foto, clave: string) {
		if (!esArrastreDeFoto(evento.dataTransfer) || !arrastreFotos.desde(origen)) return;
		evento.preventDefault();
		evento.stopPropagation();
		evento.dataTransfer!.dropEffect = 'move';
		const tarjeta = evento.currentTarget as HTMLElement;
		const caja = tarjeta.getBoundingClientRect();
		const lado = unaColumna()
			? evento.clientY < caja.top + caja.height / 2
			: evento.clientX < caja.left + caja.width / 2;
		insercion = { destinoId: foto.id, lado: lado ? 'antes' : 'despues', grupo: clave };
	}

	function sobreGrupo(evento: DragEvent, clave: string) {
		if (!arrastreFotos.desde(origen)) return;
		evento.preventDefault();
		evento.dataTransfer!.dropEffect = 'move';
		if (insercion?.grupo !== clave || insercion.destinoId !== null)
			insercion = { destinoId: null, lado: 'despues', grupo: clave };
	}

	function soltarFoto(evento: DragEvent, momento: Momento | null, clave: string) {
		const fotoId = arrastreFotos.desde(origen);
		if (!fotoId) return;
		evento.preventDefault();
		evento.stopPropagation();
		const lugar =
			insercion?.grupo === clave ? insercion : { destinoId: null, lado: 'despues' as const };
		insercion = null;
		arrastreFotos.terminar();
		// Soltar sobre sí misma no la mueve (salvo el cambio de espacio, que aquí no ocurre).
		if (lugar.destinoId !== fotoId) {
			fotos = reordenarFoto(fotos, {
				fotoId,
				destinoId: lugar.destinoId,
				lado: lugar.lado,
				...(disposicion === 'antes_durante_despues' && momento ? { momento } : {})
			});
		}
		anunciarPosicion(fotoId);
	}

	/** La lista muestra una sola columna: el indicador va arriba o abajo. */
	function unaColumna(): boolean {
		const columnas = lista ? getComputedStyle(lista).gridTemplateColumns.split(' ').length : 2;
		return disposicion === 'antes_durante_despues' || columnas < 2;
	}

	// Cada cambio reasigna «fotos» para que el editor (bind:fotos) detecte la modificación.
	function describir(fotoId: string, descripcion: string) {
		fotos = fotos.map((f) => (f.id === fotoId ? { ...f, descripcion } : f));
	}

	function cambiarMomento(foto: Foto, momento: Momento) {
		fotos = reordenarFoto(fotos, { fotoId: foto.id, destinoId: null, lado: 'despues', momento });
		anunciarPosicion(foto.id);
	}

	function paso(foto: Foto, sentido: -1 | 1) {
		fotos = moverPaso(fotos, foto.id, sentido, disposicion, ocultas);
		anunciarPosicion(foto.id);
	}

	async function anunciarPosicion(fotoId: string, prefijo = '') {
		await tick();
		const foto = fotos.find((f) => f.id === fotoId);
		if (!foto) return;
		const grupo = grupos.find((g) => g.fotos.includes(foto));
		if (!grupo) return;
		const espacio = grupo.momento ? `, ${ETIQUETA[grupo.momento]}` : '';
		anuncio = `${prefijo}${pieDe(fotoId)}${espacio}, posición ${grupo.fotos.indexOf(foto) + 1} de ${grupo.fotos.length}`;
	}

	// Modo de agarre con el teclado (D5).
	async function teclaAsa(evento: KeyboardEvent, foto: Foto) {
		const { key } = evento;
		if (key === ' ' || key === 'Enter') {
			evento.preventDefault();
			if (agarre) {
				agarre = null;
				anunciarPosicion(foto.id, 'Se soltó la ');
			} else {
				agarre = { fotoId: foto.id, previas: fotos };
				const grupo = grupos.find((g) => g.fotos.includes(foto));
				const espacio = grupo?.momento ? `, ${ETIQUETA[grupo.momento]}` : '';
				anuncio = `${pieDe(foto.id)} tomada${espacio}, posición ${(grupo?.fotos.indexOf(foto) ?? 0) + 1} de ${grupo?.fotos.length ?? 1}. Use las flechas para moverla, Espacio para soltarla y Esc para cancelar.`;
			}
			return;
		}
		if (key === 'Escape' && agarre) {
			evento.preventDefault();
			fotos = agarre.previas;
			agarre = null;
			await enfocarAsa(foto.id);
			anunciarPosicion(foto.id, 'Se canceló el movimiento. ');
			return;
		}
		if (!agarre || !key.startsWith('Arrow')) return;
		evento.preventDefault();
		const columnas = disposicion === 'antes_durante_despues';
		if (columnas && (key === 'ArrowLeft' || key === 'ArrowRight')) {
			fotos = moverDeColumna(fotos, foto.id, key === 'ArrowLeft' ? -1 : 1, ocultas);
		} else {
			const atras = key === 'ArrowLeft' || key === 'ArrowUp';
			fotos = moverPaso(fotos, foto.id, atras ? -1 : 1, disposicion, ocultas);
		}
		await enfocarAsa(foto.id);
		anunciarPosicion(foto.id);
	}

	/** Al cambiar de columna la tarjeta se vuelve a crear: el foco regresa a su asa. */
	async function enfocarAsa(fotoId: string) {
		const agarrada = agarre;
		agarre = null;
		await tick();
		document.getElementById(`asa-${fotoId}`)?.focus();
		agarre = agarrada;
	}

	function soltarAsa() {
		// enfocarAsa suelta y vuelve a tomar la foto mientras mueve el foco; solo cuenta una salida real.
		if (agarre) agarre = null;
	}

	function quitar(fotoId: string, pie = pieDe(fotoId)) {
		dispatch('quitar', { fotoId, pie });
	}

	async function cerrarVisor(fotoId: string | null) {
		visor = null;
		await tick();
		const destino = fotoId && document.getElementById(`ampliar-${fotoId}`);
		if (destino) destino.focus();
		else raiz?.querySelector<HTMLElement>('.cargar-fotos input')?.focus();
	}
</script>

<div
	class="fotos-alcance"
	bind:this={raiz}
	class:espacios={disposicion === 'antes_durante_despues'}
>
	{#if !soloLectura}
		<p class="sr-only" id={instrucciones}>
			Espacio o Enter toma la foto; las flechas la mueven{disposicion === 'antes_durante_despues'
				? ' (← y → cambian de espacio)'
				: ''}; Espacio o Enter la suelta y Esc cancela.
		</p>
	{/if}
	{#each grupos as grupo (grupo.momento ?? 'todas')}
		{@const clave = grupo.momento ?? 'todas'}
		<div
			class="grupo-fotos"
			class:zona-soltar={!soloLectura}
			class:arrastrando={sobre === clave}
			class:insertar-final={insercion?.grupo === clave && insercion.destinoId === null}
			role="group"
			aria-label={`Fotos del alcance 2.${posicionAlcance}${grupo.etiqueta ? ` (${grupo.etiqueta})` : ''}`}
			on:dragenter={(e) => !soloLectura && arrastrar(e, clave)}
			on:dragover={(e) => !soloLectura && arrastrar(e, clave)}
			on:dragleave={salir}
			on:drop={(e) => !soloLectura && soltar(e, grupo.momento, clave)}
		>
			{#if grupo.etiqueta}<h4 class="etiqueta-espacio">{grupo.etiqueta}</h4>{/if}
			<ul class="lista-fotos" bind:this={lista}>
				{#each grupo.fotos as foto, i (foto.id)}
					<TarjetaFoto
						{foto}
						pie={pieDe(foto.id)}
						{reporteId}
						{soloLectura}
						{disposicion}
						{otrosAlcances}
						{instrucciones}
						puedeAntes={i > 0}
						puedeDespues={i < grupo.fotos.length - 1}
						reemplazando={!!reemplazando[foto.id]}
						agarrada={agarre?.fotoId === foto.id}
						vertical={disposicion === 'antes_durante_despues'}
						indicador={insercion?.destinoId === foto.id ? insercion.lado : null}
						on:ampliar={() => (visor = foto.id)}
						on:quitar={() => quitar(foto.id)}
						on:reemplazar={(e) =>
							dispatch('reemplazar', {
								fotoId: foto.id,
								archivo: e.detail.archivo,
								pie: pieDe(foto.id)
							})}
						on:paso={(e) => paso(foto, e.detail.paso)}
						on:momento={(e) => cambiarMomento(foto, e.detail.momento)}
						on:moverA={(e) => dispatch('mover', { fotoId: foto.id, alcanceId: e.detail.alcanceId })}
						on:describir={(e) => describir(foto.id, e.detail.descripcion)}
						on:teclaAsa={(e) => teclaAsa(e.detail, foto)}
						on:soltarAsa={soltarAsa}
						on:dragstart={(e) => !soloLectura && iniciarArrastre(e, foto)}
						on:dragend={terminarArrastre}
						on:dragover={(e) => !soloLectura && sobreTarjeta(e, foto, clave)}
						on:drop={(e) =>
							!soloLectura &&
							esArrastreDeFoto(e.dataTransfer) &&
							soltarFoto(e, grupo.momento, clave)}
					/>
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
							accept={ACEPTA_FOTOS}
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
	<p class="sr-only" aria-live="polite">{anuncio}</p>
</div>

{#if visor}
	<VisorFotos
		lista={enOrden}
		fotoId={visor}
		{posicionAlcance}
		{tituloAlcance}
		{reporteId}
		{soloLectura}
		{otrosAlcances}
		{reemplazando}
		{ocultas}
		on:cerrar={(e) => cerrarVisor(e.detail.fotoId)}
		on:quitar={(e) => quitar(e.detail.fotoId, e.detail.pie)}
		on:deshacer
		on:reemplazar
		on:moverA={(e) => dispatch('mover', e.detail)}
		on:describir={(e) => describir(e.detail.fotoId, e.detail.descripcion)}
	/>
{/if}

<style>
	/* min(…, 100%) y min-width: 0 evitan que una foto o un título largo ensanchen la página. */
	.fotos-alcance.espacios {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
	}
	.grupo-fotos {
		min-width: 0;
	}
	.lista-fotos {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
		list-style: none;
		margin: 0 0 8px;
		padding: 0;
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
	.zona-soltar.arrastrando,
	.zona-soltar.insertar-final {
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
