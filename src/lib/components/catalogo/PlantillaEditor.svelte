<!-- Editor de una plantilla de seguimiento (cambio centros-costo-plantillas): modo de contrato, origen
     de las actividades y conceptos de cada bloque, con su tipo y nivel. Cada concepto lleva además
     sus opciones (cambio kpi-estatus-centros, D1): qué indicador alimenta, si está por definir y, en
     los documentos, la carpeta a la que pertenece. Solo ofrece combinaciones válidas
     (dominio/seguimiento.ts); la base las vuelve a comprobar. Los conceptos que ya existían conservan
     su id al guardar. -->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		BLOQUES_SEGUIMIENTO,
		MODOS_CONTRATO,
		ORIGENES_ACTIVIDADES,
		type BloqueSeguimiento,
		type IndicadorConcepto,
		type NivelConcepto,
		type TipoConcepto
	} from '$lib/dominio/constantes';
	import type { PlantillaSeguimiento } from '$lib/dominio/esquemas';
	import {
		AYUDA_BLOQUE,
		ETIQUETA_BLOQUE,
		ETIQUETA_INDICADOR,
		ETIQUETA_MODO_CONTRATO,
		ETIQUETA_NIVEL,
		ETIQUETA_ORIGEN,
		ETIQUETA_TIPO,
		indicadoresDeConcepto,
		nivelesDeBloque,
		tiposDeBloque
	} from '$lib/dominio/seguimiento';
	import Aviso from './Aviso.svelte';

	export let plantilla: PlantillaSeguimiento;
	export let form: { mensaje?: string; error?: string } | null = null;

	interface Fila {
		/** Clave local para el {#each}; los conceptos guardados llevan además su id. */
		clave: number;
		id?: string;
		etiqueta: string;
		tipo: TipoConcepto;
		nivel: NivelConcepto;
		/** Cadena vacía: no alimenta ningún indicador. */
		indicador: IndicadorConcepto | '';
		porDefinir: boolean;
		/** Clave local de la carpeta de un documento; 0 = sin carpeta. */
		carpeta: number;
		/** Lo último que el editor cambió por su cuenta en esta fila (indicador o carpeta quitados). */
		aviso: string;
	}

	let siguiente = 0;
	const nuevaClave = () => ++siguiente;

	let nombre = plantilla.nombre;
	let descripcion = plantilla.descripcion ?? '';
	let modoContrato = plantilla.modoContrato;
	let origenActividades = plantilla.origenActividades;
	let filas: Record<BloqueSeguimiento, Fila[]> = Object.fromEntries(
		BLOQUES_SEGUIMIENTO.map((bloque) => [
			bloque,
			plantilla.conceptos
				.filter((c) => c.bloque === bloque)
				.map((c) => ({
					clave: nuevaClave(),
					id: c.id,
					etiqueta: c.etiqueta,
					tipo: c.tipo,
					nivel: c.nivel,
					indicador: c.indicador ?? '',
					porDefinir: c.porDefinir,
					carpeta: 0,
					aviso: ''
				}))
		])
	) as Record<BloqueSeguimiento, Fila[]>;
	// La carpeta de cada documento, por la clave local de su fila (así sobrevive a un cambio de nombre).
	for (const documento of filas.documentos) {
		const guardado = plantilla.conceptos.find((c) => c.id === documento.id);
		documento.carpeta = filas.carpetas.find((c) => c.id === guardado?.carpetaId)?.clave ?? 0;
	}
	let cambios = false;
	/** Lo que se anuncia a los lectores de pantalla cuando el editor quita algo por su cuenta. */
	let anuncio = '';

	const nombreDe = (fila: Fila) => fila.etiqueta.trim() || 'concepto sin nombre';

	function carpetaDe(fila: Fila, carpetas: Fila[]) {
		const carpeta = carpetas.find((c) => c.clave === fila.carpeta);
		if (!carpeta) return { carpetaId: null };
		// Una carpeta nueva todavía no tiene id: se nombra por su etiqueta (D1).
		return carpeta.id ? { carpetaId: carpeta.id } : { carpeta: carpeta.etiqueta.trim() };
	}

	$: conceptos = BLOQUES_SEGUIMIENTO.flatMap((bloque) =>
		filas[bloque].map((fila) => ({
			id: fila.id,
			bloque,
			etiqueta: fila.etiqueta,
			tipo: fila.tipo,
			nivel: fila.nivel,
			indicador: fila.indicador || null,
			porDefinir: fila.porDefinir,
			...(bloque === 'documentos' ? carpetaDe(fila, filas.carpetas) : {})
		}))
	);
	// Quién usa ya cada indicador: es único por plantilla.
	$: usoIndicador = new Map(
		BLOQUES_SEGUIMIENTO.flatMap((bloque) =>
			filas[bloque].filter((f) => f.indicador).map((f) => [f.indicador, f] as const)
		)
	);
	// Conceptos que nombra el error del servidor («X»), para señalar su fila.
	$: senalados = new Set(
		form?.error ? [...form.error.matchAll(/«([^»]+)»/g)].map(([, nombre]) => nombre.trim()) : []
	);
	$: campoSenalado = !form?.error
		? ''
		: /indicador/i.test(form.error)
			? 'indicador'
			: /carpeta/i.test(form.error)
				? 'carpeta'
				: 'etiqueta';
	const senalada = (fila: Fila, nombres: Set<string>, campo: string, este: string) =>
		campo === este && nombres.has(fila.etiqueta.trim()) ? 'true' : undefined;

	async function agregar(bloque: BloqueSeguimiento) {
		const clave = nuevaClave();
		filas[bloque] = [
			...filas[bloque],
			{
				clave,
				etiqueta: '',
				tipo: tiposDeBloque(bloque)[0],
				nivel: nivelesDeBloque(bloque)[0],
				indicador: '',
				porDefinir: false,
				carpeta: 0,
				aviso: ''
			}
		];
		cambios = true;
		// El foco pasa a la etiqueta del concepto nuevo para escribirla enseguida.
		await tick();
		document.getElementById(`etiqueta-${clave}`)?.focus();
	}

	function quitar(bloque: BloqueSeguimiento, clave: number) {
		const quitada = filas[bloque].find((f) => f.clave === clave);
		filas[bloque] = filas[bloque].filter((f) => f.clave !== clave);
		// Los documentos de una carpeta que se quita vuelven a «Sin carpeta».
		if (bloque === 'carpetas' && quitada) {
			const afectados = filas.documentos.filter((d) => d.carpeta === clave);
			for (const documento of afectados) {
				documento.carpeta = 0;
				documento.aviso = `Volvió a «Sin carpeta» porque se quitó la carpeta «${nombreDe(quitada)}».`;
			}
			if (afectados.length) {
				filas.documentos = filas.documentos;
				anuncio =
					afectados.length === 1
						? `«${nombreDe(afectados[0])}» volvió a «Sin carpeta» porque se quitó la carpeta «${nombreDe(quitada)}».`
						: `${afectados.length} documentos volvieron a «Sin carpeta» porque se quitó la carpeta «${nombreDe(quitada)}».`;
			}
		}
		cambios = true;
	}

	function mover(bloque: BloqueSeguimiento, indice: number, paso: -1 | 1) {
		const lista = [...filas[bloque]];
		const destino = indice + paso;
		if (destino < 0 || destino >= lista.length) return;
		[lista[indice], lista[destino]] = [lista[destino], lista[indice]];
		filas[bloque] = lista;
		cambios = true;
	}

	/** Al cambiar el tipo o el nivel, un indicador que deja de ser válido se quita y se avisa. */
	function revisarIndicador(bloque: BloqueSeguimiento, fila: Fila) {
		if (
			fila.indicador &&
			!indicadoresDeConcepto(bloque, fila.tipo, fila.nivel).includes(fila.indicador)
		) {
			fila.aviso = `Se quitó «${ETIQUETA_INDICADOR[fila.indicador]}» porque ya no corresponde a este tipo y nivel.`;
			anuncio = `Se quitó «${ETIQUETA_INDICADOR[fila.indicador]}» de «${nombreDe(fila)}» porque ya no corresponde a este tipo y nivel.`;
			fila.indicador = '';
		} else {
			fila.aviso = '';
		}
		filas[bloque] = filas[bloque];
	}

	const textoIndicador = (indicador: IndicadorConcepto) =>
		indicador === 'monto_cobrado'
			? `${ETIQUETA_INDICADOR[indicador]} (se calcula con la cobranza)`
			: ETIQUETA_INDICADOR[indicador];

	const guardar: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update({ reset: false });
			if (result.type === 'success') cambios = false;
		};
</script>

<p class="migas">
	<a class="enlace" href={resolve('/catalogo')}>Catálogo</a> /
	<a class="enlace" href={resolve('/catalogo/plantillas')}>Plantillas</a> / {plantilla.nombre}
</p>

<Aviso {form} />
<p class="sr-only" role="status">{anuncio}</p>

<form method="POST" action="?/guardar" use:enhance={guardar} on:input={() => (cambios = true)}>
	<input type="hidden" name="conceptos" value={JSON.stringify(conceptos)} />

	<section class="card" aria-labelledby="titulo-generales">
		<h2 id="titulo-generales" class="view-heading">Datos generales</h2>
		<div class="form-grid">
			<div class="form-group">
				<label for="nombre">Nombre</label>
				<input id="nombre" name="nombre" bind:value={nombre} required autocomplete="off" />
			</div>
			<div class="form-group">
				<label for="descripcion">Descripción (opcional)</label>
				<input id="descripcion" name="descripcion" bind:value={descripcion} autocomplete="off" />
			</div>
			<div class="form-group">
				<label for="modoContrato">Contrato</label>
				<select id="modoContrato" name="modoContrato" bind:value={modoContrato}>
					{#each MODOS_CONTRATO as modo (modo)}
						<option value={modo}>{ETIQUETA_MODO_CONTRATO[modo]}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="origenActividades">Actividades del mes</label>
				<select id="origenActividades" name="origenActividades" bind:value={origenActividades}>
					{#each ORIGENES_ACTIVIDADES as origen (origen)}
						<option value={origen}>{ETIQUETA_ORIGEN[origen]}</option>
					{/each}
				</select>
			</div>
		</div>
		{#if plantilla.centros.length > 0}
			<p class="view-note">
				La usan {plantilla.centros.map((c) => c.clave).join(', ')}: los cambios les aplican a todos.
			</p>
		{/if}
	</section>

	{#each BLOQUES_SEGUIMIENTO as bloque (bloque)}
		<section class="card bloque" aria-labelledby={`titulo-${bloque}`}>
			<div class="encabezado">
				<h2 id={`titulo-${bloque}`} class="view-heading">{ETIQUETA_BLOQUE[bloque]}</h2>
				<span class="view-note"
					>{filas[bloque].length === 0
						? 'No aplica'
						: filas[bloque].length === 1
							? '1 concepto'
							: `${filas[bloque].length} conceptos`}</span
				>
			</div>
			<p class="view-note">{AYUDA_BLOQUE[bloque]}</p>
			{#if filas[bloque].length > 0}
				<ol class="conceptos">
					{#each filas[bloque] as fila, indice (fila.clave)}
						{@const indicadores = indicadoresDeConcepto(bloque, fila.tipo, fila.nivel)}
						<li class="concepto">
							<div class="form-group etiqueta">
								<label for={`etiqueta-${fila.clave}`}>
									Concepto
									{#if fila.porDefinir}<span class="status-badge por-definir">Por definir</span
										>{/if}
								</label>
								<input
									id={`etiqueta-${fila.clave}`}
									bind:value={fila.etiqueta}
									required
									autocomplete="off"
									aria-invalid={senalada(fila, senalados, campoSenalado, 'etiqueta')}
								/>
							</div>
							<div class="form-group">
								<label for={`tipo-${fila.clave}`}>Tipo</label>
								<select
									id={`tipo-${fila.clave}`}
									bind:value={fila.tipo}
									disabled={tiposDeBloque(bloque).length === 1}
									on:change={() => revisarIndicador(bloque, fila)}
								>
									{#each tiposDeBloque(bloque) as tipo (tipo)}
										<option value={tipo}>{ETIQUETA_TIPO[tipo]}</option>
									{/each}
								</select>
							</div>
							<div class="form-group">
								<label for={`nivel-${fila.clave}`}>Se registra</label>
								<select
									id={`nivel-${fila.clave}`}
									bind:value={fila.nivel}
									disabled={nivelesDeBloque(bloque).length === 1}
									aria-describedby={fila.nivel === 'partida'
										? `ayuda-nivel-${fila.clave}`
										: undefined}
									on:change={() => revisarIndicador(bloque, fila)}
								>
									{#each nivelesDeBloque(bloque) as nivel (nivel)}
										<option value={nivel}>{ETIQUETA_NIVEL[nivel]}</option>
									{/each}
								</select>
								{#if fila.nivel === 'partida'}
									<span class="view-note" id={`ayuda-nivel-${fila.clave}`}
										>Una vez por partida en el mes, aunque se ejecute varias veces.</span
									>
								{/if}
							</div>
							<div class="botones">
								<button
									class="boton"
									type="button"
									aria-label={`Subir ${fila.etiqueta || 'concepto'}`}
									disabled={indice === 0}
									on:click={() => mover(bloque, indice, -1)}>↑</button
								>
								<button
									class="boton"
									type="button"
									aria-label={`Bajar ${fila.etiqueta || 'concepto'}`}
									disabled={indice === filas[bloque].length - 1}
									on:click={() => mover(bloque, indice, 1)}>↓</button
								>
								<button
									class="boton peligro"
									type="button"
									aria-label={`Quitar ${fila.etiqueta || 'concepto'}`}
									on:click={() => quitar(bloque, fila.clave)}>Quitar</button
								>
							</div>
							<div class="opciones">
								{#if bloque === 'documentos' && filas.carpetas.length > 0}
									<div class="form-group opcion">
										<label for={`carpeta-${fila.clave}`}>Carpeta</label>
										<select
											id={`carpeta-${fila.clave}`}
											bind:value={fila.carpeta}
											aria-invalid={senalada(fila, senalados, campoSenalado, 'carpeta')}
											on:change={() => (fila.aviso = '')}
										>
											<option value={0}>Sin carpeta</option>
											{#each filas.carpetas as carpeta (carpeta.clave)}
												<option value={carpeta.clave}
													>{carpeta.etiqueta.trim() || 'Carpeta sin nombre'}</option
												>
											{/each}
										</select>
									</div>
								{/if}
								{#if indicadores.length > 0}
									<div class="form-group opcion">
										<label for={`indicador-${fila.clave}`}>Qué mide</label>
										<select
											id={`indicador-${fila.clave}`}
											bind:value={fila.indicador}
											aria-invalid={senalada(fila, senalados, campoSenalado, 'indicador')}
											on:change={() => (fila.aviso = '')}
										>
											<option value="">No alimenta ningún indicador</option>
											{#each indicadores as indicador (indicador)}
												{@const otra = usoIndicador.get(indicador)}
												{@const ocupado = Boolean(otra) && otra !== fila}
												<option value={indicador} disabled={ocupado}
													>{textoIndicador(indicador)}{ocupado && otra
														? ` (ya lo usa «${nombreDe(otra)}»)`
														: ''}</option
												>
											{/each}
										</select>
									</div>
								{/if}
								<label class="por-definir">
									<input
										type="checkbox"
										bind:checked={fila.porDefinir}
										aria-label={`Por definir: ${nombreDe(fila)}`}
									/>
									Por definir
								</label>
								{#if fila.aviso}<p class="view-note aviso-fila">{fila.aviso}</p>{/if}
							</div>
						</li>
					{/each}
				</ol>
				<p class="view-note ayuda-opciones">
					«Por definir»: se puede llenar, pero no cuenta en los indicadores ni en «Qué falta».
					{#if bloque === 'documentos' && filas.carpetas.length > 0}
						«Carpeta»: el documento cuenta en el avance de esa carpeta.
					{/if}
				</p>
			{/if}
			<div>
				<button class="boton" type="button" on:click={() => agregar(bloque)}
					>Agregar concepto</button
				>
			</div>
		</section>
	{/each}

	<div class="toolbar barra-guardar">
		<button class="boton primario" type="submit">Guardar plantilla</button>
		{#if cambios}<span class="view-note" role="status">Hay cambios sin guardar.</span>{/if}
		<a class="boton" href={resolve('/catalogo/plantillas')}>Volver a las plantillas</a>
	</div>
</form>

<style>
	.encabezado {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 12px;
	}
	.bloque > p {
		margin-top: 0;
	}
	.conceptos {
		display: grid;
		gap: 8px;
		margin: 0 0 12px;
		padding: 0;
		list-style: none;
	}
	.concepto {
		display: grid;
		grid-template-columns: minmax(160px, 2fr) minmax(190px, 1.2fr) minmax(140px, 1fr) auto;
		align-items: start;
		gap: 8px 12px;
		padding: 10px 12px;
		border: 1px solid var(--linea);
		border-radius: var(--radio-control);
	}
	.concepto .form-group {
		margin: 0;
		min-width: 0;
	}
	.concepto select {
		white-space: nowrap;
	}
	/* Etiquetas de la misma altura, lleven o no la insignia: los campos de la fila quedan alineados. */
	.concepto .form-group > label {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 24px;
	}
	.botones {
		display: flex;
		gap: 6px;
		/* Alineados con los campos, bajo la altura de su etiqueta. */
		margin-top: 30px;
	}
	/* Segunda línea de la fila: carpeta, indicador y «por definir». */
	.opciones {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 8px 16px;
		padding-top: 8px;
		border-top: 1px dashed var(--linea);
	}
	.opcion {
		flex: 0 1 18rem;
	}
	.por-definir {
		min-height: var(--alto-control);
		font-size: var(--texto-sm);
		font-weight: 600;
	}
	.aviso-fila {
		flex-basis: 100%;
		color: var(--alerta);
	}
	.ayuda-opciones {
		margin: 0 0 12px;
	}
	.barra-guardar {
		align-items: center;
	}
	@media (max-width: 768px) {
		.concepto {
			grid-template-columns: 1fr;
		}
		.botones {
			margin-top: 0;
		}
		.opciones {
			flex-direction: column;
			align-items: stretch;
		}
		.opcion {
			flex: none;
		}
	}
</style>
