<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import EstadoGuardado from '$lib/components/ui/EstadoGuardado.svelte';
	import { textoMes, textoOracion } from '$lib/dominio/textos';
	import type { ConceptoSeguimientoOperativo } from '$lib/server/repositorios/seguimiento';
	import {
		alGuardar,
		anclaDePartida,
		avanceDePartida,
		claveValor,
		esDocumento,
		resultadoDe,
		textoBreve,
		ultimoDiaDelMes,
		valorHecho,
		type EstadoCaptura,
		type MapaValores,
		type Partida
	} from './captura';
	import FilaActividad from './FilaActividad.svelte';
	import ValorSeguimiento from './ValorSeguimiento.svelte';

	/** Una partida del mes: sus documentos de una vez al mes y cada una de sus ejecuciones. */
	export let partida: Partida;
	/** Documentos que se marcan una vez por partida. */
	export let conceptosPartida: ConceptoSeguimientoOperativo[];
	/** Documentos que se marcan en cada ejecución. */
	export let conceptosActividad: ConceptoSeguimientoOperativo[];
	export let valores: MapaValores;
	/** Escrita a mano en un centro con programa anual. */
	export let fueraDelPrograma = false;
	/** Abierta o cerrada al cargar; por omisión, abierta si le falta algo. */
	export let abiertaAlCargar: boolean | null = null;
	export let mes: string;
	export let hoy: string;
	export let urlGuardar: string;
	export let plantillaId: string | null;
	export let puedeEditar: boolean;
	export let enviar: SubmitFunction;
	export let captura: EstadoCaptura;

	/** Con más ejecuciones que estas, las que ya están completas al cargar se pliegan aparte. */
	const MAX_SIN_PLEGAR = 6;

	$: ancla = anclaDePartida(partida.grupo);
	$: nombre = textoOracion(partida.partida);
	$: resultado = resultadoDe(captura, ancla);
	$: ({ programadas, ejecutadas, faltanDocumentos, completa } = avanceDePartida(
		partida,
		[...conceptosPartida, ...conceptosActividad],
		valores
	));
	$: resumen = completa
		? 'Completa'
		: [
				programadas === 1
					? ejecutadas
						? 'Ejecutada'
						: 'Sin ejecutar'
					: `${ejecutadas} de ${programadas} ejecutadas`,
				faltanDocumentos === 1
					? 'falta 1 documento'
					: faltanDocumentos > 1
						? `faltan ${faltanDocumentos} documentos`
						: ''
			]
				.filter(Boolean)
				.join(' · ');
	$: primera = partida.actividades[0];
	$: conValores =
		partida.actividades.some((a) => a.ejecutada) ||
		partida.actividades.some((a) =>
			[...valores].some(
				([clave, valor]) => clave.startsWith(`${a.clave}/`) && valor !== null && valor !== false
			)
		);
	$: varias = partida.actividades.length > 1;
	$: ultimoDia = ultimoDiaDelMes(mes);

	// Abierta si le falta algo. Se decide al cargar: no se cierra sola al marcar lo último.
	let abierta =
		abiertaAlCargar ??
		!avanceDePartida(partida, [...conceptosPartida, ...conceptosActividad], valores).completa;
	// En una partida de muchas ejecuciones (diaria, semanal), las ya completas al cargar van plegadas
	// al final para que lo pendiente quede a la vista. Tampoco reacciona al guardar.
	const plegadas = new Set(
		partida.actividades.length > MAX_SIN_PLEGAR
			? partida.actividades
					.filter(
						(a) =>
							a.ejecutada &&
							[...conceptosActividad, ...(a.clave === partida.primera ? conceptosPartida : [])]
								.filter(esDocumento)
								.every((c) => valorHecho(c, valores.get(claveValor(a.clave, c.id)) ?? null))
					)
					.map((a) => a.clave)
			: []
	);
	$: filas = partida.actividades.map((actividad, indice) => ({ actividad, indice }));
	$: grupos = [
		{ plegado: false, filas: filas.filter((f) => !plegadas.has(f.actividad.clave)) },
		{ plegado: true, filas: filas.filter((f) => plegadas.has(f.actividad.clave)) }
	];
	// Una partida recién agregada se abre para que se pueda marcar enseguida.
	$: recienAgregada =
		captura.accion === 'nuevaActividad' && captura.ancla === ancla && Boolean(captura.mensaje);
	$: if (recienAgregada) abierta = true;
	let editando = false;
	const alEditar = alGuardar(enviar, () => (editando = false));

	function tituloDe(indice: number): string {
		return varias ? `Ejecución ${indice + 1} de ${partida.actividades.length}` : 'Ejecución';
	}
	function contextoDe(indice: number): string {
		return varias ? `${nombre}, ejecución ${indice + 1}` : nombre;
	}
</script>

<article class="partida" class:completa>
	<details bind:open={abierta}>
		<summary>
			<span class="titulo">
				<h3 id={ancla} tabindex="-1">{nombre}</h3>
				<span class="notas">
					{#if completa}
						<span class="status-badge ok">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg
							>
							Completa
						</span>
					{:else}
						<span class="view-note">{resumen}</span>
					{/if}
					{#if fueraDelPrograma}<span class="status-badge">Fuera del programa</span>{/if}
				</span>
			</span>
			<svg
				class="chevron"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.25"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
			>
		</summary>

		<div class="contenido">
			{#if puedeEditar}
				<div class="estado">
					<EstadoGuardado estado={resultado.fase} mensaje={textoBreve(resultado.mensaje)} />
				</div>
			{/if}
			{#if resultado.error}
				<p class="aviso aviso-error" role="alert">{resultado.error}</p>
			{/if}

			{#if conceptosPartida.length}
				<div class="de-partida">
					<p class="rotulo-grupo">De la partida · una vez al mes</p>
					<div class="documentos">
						{#each conceptosPartida as concepto (concepto.id)}
							<div class="documento" class:campo={concepto.tipo !== 'casilla'}>
								<ValorSeguimiento
									{concepto}
									valor={valores.get(`${partida.primera}/${concepto.id}`) ?? null}
									actividad={partida.primera}
									contexto={nombre}
									{ancla}
									{urlGuardar}
									{plantillaId}
									{puedeEditar}
									{enviar}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#each grupos as grupo (grupo.plegado)}
				{#if grupo.filas.length}
					<svelte:element this={grupo.plegado ? 'details' : 'div'} class:hechas={grupo.plegado}>
						{#if grupo.plegado}
							<summary>
								{grupo.filas.length === 1
									? 'Ver 1 ejecución ya completa'
									: `Ver ${grupo.filas.length} ejecuciones ya completas`}
							</summary>
						{/if}
						{#each grupo.filas as { actividad, indice } (actividad.clave)}
							<FilaActividad
								{actividad}
								titulo={tituloDe(indice)}
								contexto={contextoDe(indice)}
								conceptos={conceptosActividad}
								conceptosPartida={actividad.clave === partida.primera ? conceptosPartida : []}
								{valores}
								{hoy}
								ancla={`${ancla}-e${indice + 1}`}
								{urlGuardar}
								{plantillaId}
								{puedeEditar}
								{enviar}
								{captura}
							/>
						{/each}
					</svelte:element>
				{/if}
			{/each}

			{#if puedeEditar && partida.manual}
				<details class="editar" bind:open={editando}>
					<summary class="resumen-boton boton fantasma">Editar partida</summary>
					{#key `${primera.nombre}/${primera.fecha}`}
						<form
							method="POST"
							action={`${urlGuardar}#${ancla}`}
							use:enhance={alEditar}
							class="formulario"
						>
							<input type="hidden" name="ancla" value={ancla} />
							<input type="hidden" name="plantillaId" value={plantillaId ?? ''} />
							<input type="hidden" name="actividad" value={primera.clave} />
							<div class="form-group">
								<label for={`${ancla}-nombre`}>Nombre de la partida</label>
								<input
									id={`${ancla}-nombre`}
									name="nombre"
									required
									maxlength="250"
									autocomplete="off"
									value={partida.partida}
								/>
							</div>
							<div class="form-group">
								<label for={`${ancla}-fecha`}>
									{varias
										? 'Fecha prevista de la ejecución 1 (opcional)'
										: 'Fecha prevista (opcional)'}
								</label>
								<input
									id={`${ancla}-fecha`}
									name="fecha"
									type="date"
									min={`${mes}-01`}
									max={ultimoDia}
									value={primera.fecha ?? ''}
								/>
							</div>
							<div class="acciones">
								<button class="boton primario" name="accion" value="editarActividad"
									>Guardar cambios</button
								>
								{#if !conValores}
									<button class="boton peligro" name="accion" value="quitarActividad" formnovalidate
										>Quitar partida</button
									>
								{/if}
							</div>
							{#if conValores}
								<p class="view-note">
									No se puede quitar porque ya tiene ejecuciones o documentos marcados. Desmárquelos
									primero.
								</p>
							{:else}
								<p class="view-note">
									Al quitarla se borra de {textoMes(mes)}; no se puede deshacer.
								</p>
							{/if}
						</form>
					{/key}
				</details>
			{/if}
		</div>
	</details>
</article>

<style>
	.partida {
		border: 1px solid var(--linea-fuerte);
		border-radius: var(--radio-panel);
		background: var(--superficie);
		min-width: 0;
	}
	.partida.completa {
		border-color: var(--linea);
		background: var(--superficie-alta);
	}
	.partida > details > summary {
		display: flex;
		align-items: flex-start;
		gap: 8px 12px;
		min-height: 44px;
		padding: 12px 14px;
		list-style: none;
		border-radius: var(--radio-panel);
		font-weight: 400;
		color: var(--tinta);
	}
	.partida > details > summary::-webkit-details-marker {
		display: none;
	}
	.titulo {
		display: grid;
		gap: 4px;
		flex: 1 1 0;
		min-width: 0;
	}
	.partida h3 {
		display: block;
		margin: 0;
		font-size: var(--texto-md);
		font-weight: var(--peso-encabezado);
		overflow-wrap: anywhere;
	}
	.notas {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
	}
	.status-badge svg {
		width: 12px;
		height: 12px;
	}
	.chevron {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		margin-top: 2px;
		color: var(--tinta-secundaria);
		transition: transform 0.15s var(--curva-salida);
	}
	details[open] > summary .chevron {
		transform: rotate(180deg);
	}
	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}
	.contenido {
		padding: 0 14px 6px;
		min-width: 0;
	}
	.estado {
		display: flex;
		justify-content: flex-end;
		min-height: 20px;
	}
	.aviso {
		margin: 6px 0 10px;
	}
	.de-partida {
		display: grid;
		gap: 8px;
		padding-block: 6px 14px;
	}
	.documentos {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
		gap: 8px;
	}
	.documento {
		display: flex;
		min-width: 0;
	}
	.documento.campo {
		display: block;
		grid-column: 1 / -1;
	}
	.hechas {
		border-top: 1px solid var(--linea);
	}
	.hechas > summary {
		display: flex;
		align-items: center;
		min-height: 44px;
		color: var(--tinta-secundaria);
	}
	.editar {
		padding-block: 8px;
		border-top: 1px solid var(--linea);
	}
	.editar > summary {
		display: inline-flex;
		min-height: 44px;
		list-style: none;
	}
	.editar > summary::-webkit-details-marker {
		display: none;
	}
	.formulario {
		display: grid;
		gap: 4px;
		max-width: 32rem;
		padding-top: 10px;
	}
	.formulario .form-group {
		margin-bottom: 10px;
	}
	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.acciones .boton {
		min-height: 44px;
	}
	@media (max-width: 768px) {
		.acciones .boton {
			flex: 1 1 100%;
		}
	}
</style>
