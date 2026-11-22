<!-- «Capturar actividad» (cambio capturar-actividad): centro de costo, actividad del programa anual
     vigente con búsqueda, si se realizó o no, fecha opcional (hoy si se deja vacía) y, si se realizó,
     las personas que fueron (opcional). Un centro sin programa anual enlaza a su seguimiento. Los
     datos se piden a `/actividades` al abrir y al elegir el centro. -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ETIQUETA_PERIODICIDAD } from '$lib/dominio/captura';
	import {
		errorFechaActividad,
		faltanEnFecha,
		fechaEfectiva,
		mesDeFecha,
		type CentroActividad,
		type PartidaActividad,
		type PersonaActividad
	} from '$lib/dominio/actividades';
	import { textoMes } from '$lib/dominio/textos';
	import BotonesSegmentados from '$lib/components/ui/BotonesSegmentados.svelte';
	import Dialogo from '$lib/components/ui/Dialogo.svelte';
	import SelectorBusqueda, {
		type OpcionSelector
	} from '$lib/components/ui/SelectorBusqueda.svelte';
	import SelectorPersonas from '$lib/components/ui/SelectorPersonas.svelte';
	import { notificaciones } from '$lib/components/ui/notificaciones';

	export let abierto = false;

	const REALIZADA = [
		{ valor: 'si', texto: 'Sí' },
		{ valor: 'no', texto: 'No' }
	];

	let cargado = false;
	let cargando = false;
	let errorCarga = '';
	let hoy = '';
	let centros: CentroActividad[] = [];
	let personal: PersonaActividad[] = [];

	let centroId = '';
	let partidas: PartidaActividad[] = [];
	let cargandoPartidas = false;
	let partidaId: string | null = null;
	let realizada = '';
	let fecha = '';
	let enviando = false;
	let errorEnvio = '';
	/** Cambia para reiniciar el selector de actividad y el de personas. */
	let vuelta = 0;
	let formulario: HTMLFormElement | undefined;

	// La barra superior monta la ventana la primera vez que se pide: los datos se piden entonces.
	onMount(cargar);

	async function cargar() {
		cargando = true;
		errorCarga = '';
		try {
			const respuesta = await fetch(resolve('/actividades'));
			if (!respuesta.ok) throw new Error();
			({ hoy, centros, personal } = await respuesta.json());
			cargado = true;
			if (centros.length === 1) await elegirCentro(centros[0].id);
		} catch {
			errorCarga = 'No se pudieron cargar los centros de costo. Intente de nuevo.';
		} finally {
			cargando = false;
		}
	}

	async function elegirCentro(id: string) {
		centroId = id;
		partidas = [];
		partidaId = null;
		errorEnvio = '';
		vuelta++;
		if (!centros.find((c) => c.id === id)?.programa) return;
		cargandoPartidas = true;
		try {
			const respuesta = await fetch(`${resolve('/actividades')}?centro=${encodeURIComponent(id)}`);
			if (!respuesta.ok) throw new Error();
			if (centroId === id) partidas = (await respuesta.json()).partidas;
		} catch {
			errorEnvio = 'No se pudieron cargar las actividades del centro de costo.';
		} finally {
			cargandoPartidas = false;
		}
	}

	$: centro = centros.find((c) => c.id === centroId) ?? null;
	$: programa = centro?.programa ?? null;
	$: fechaUsada = fechaEfectiva(fecha, hoy);
	$: mesUsado = hoy ? mesDeFecha(fechaUsada) : '';
	$: errorFecha = programa && hoy ? errorFechaActividad(fechaUsada, hoy, programa) : null;
	$: partida = partidas.find((p) => p.id === partidaId) ?? null;
	$: pendiente = partida && mesUsado ? faltanEnFecha(partida, fechaUsada) : 0;
	$: opciones = partidas.map(
		(p): OpcionSelector => ({
			valor: p.id,
			texto: `${p.numero}.- ${p.actividad}`,
			grupo: (p.faltan[mesUsado] ?? 0) > 0 ? 'pendiente' : 'resto',
			detalle: ETIQUETA_PERIODICIDAD[p.periodicidad],
			insignia: (p.faltan[mesUsado] ?? 0) > 0 ? `Faltan ${p.faltan[mesUsado]}` : undefined
		})
	);
	$: grupos = mesUsado
		? [
				{ clave: 'pendiente', titulo: `Con pendiente en ${textoMes(mesUsado)}` },
				{ clave: 'resto', titulo: `Sin pendiente en ${textoMes(mesUsado)}` }
			]
		: [];
	// Primero quienes tienen asignado el centro elegido.
	$: personas = [...personal]
		.sort((a, b) => Number(b.centroIds.includes(centroId)) - Number(a.centroIds.includes(centroId)))
		.map(({ id, nombre }) => ({ id, nombre }));
	$: valido =
		!!programa &&
		!!partida &&
		(realizada === 'si' || realizada === 'no') &&
		!errorFecha &&
		pendiente > 0 &&
		!enviando;
	$: rutaSeguimiento = centro
		? `${resolve('/seguimiento')}?centro=${centro.id}&mes=${hoy.slice(0, 7)}-01`
		: '';

	async function registrar() {
		if (!valido || !programa || !partida) return;
		enviando = true;
		errorEnvio = '';
		const personalIds =
			realizada === 'si' && formulario
				? new FormData(formulario).getAll('personas').map(String)
				: [];
		try {
			const respuesta = await fetch(resolve('/actividades'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					programaId: programa.id,
					partidaId: partida.id,
					realizada: realizada === 'si',
					fecha: fecha || null,
					personalIds
				})
			});
			const resultado = await respuesta.json().catch(() => ({}));
			if (!respuesta.ok) {
				errorEnvio = resultado.error ?? resultado.message ?? 'No se pudo registrar la actividad.';
				return;
			}
			notificaciones.mostrar({
				mensaje: `Partida ${partida.numero} · ${textoMes(resultado.mes ?? mesUsado)}: ${
					realizada === 'si' ? 'registrada como realizada' : 'registrada como no realizada'
				}.`
			});
			reiniciar();
			abierto = false;
			// El programa, el tablero y «Mi trabajo» reflejan la captura; las partidas también.
			elegirCentro(centroId);
			await invalidateAll();
		} catch {
			errorEnvio = 'No se pudo registrar la actividad. Revise la conexión e intente de nuevo.';
		} finally {
			enviando = false;
		}
	}

	function reiniciar() {
		partidaId = null;
		realizada = '';
		fecha = '';
		errorEnvio = '';
		vuelta++;
	}

	async function cancelar() {
		reiniciar();
		await tick();
	}
</script>

<Dialogo
	id="actividad"
	bind:abierto
	titulo="Capturar actividad"
	textoConfirmar={enviando ? 'Registrando…' : 'Registrar'}
	confirmarDeshabilitado={!valido}
	conConfirmar={!!programa}
	cerrarAlConfirmar={false}
	on:confirmar={registrar}
	on:cancelar={cancelar}
>
	{#if cargando}
		<p role="status">Cargando centros de costo…</p>
	{:else if errorCarga}
		<p class="error" role="alert">{errorCarga}</p>
		<button class="boton" type="button" on:click={cargar}>Reintentar</button>
	{:else if cargado}
		<form bind:this={formulario} class="formulario" on:submit|preventDefault={registrar} novalidate>
			<label for="actividad-centro">Centro de costo</label>
			<select
				id="actividad-centro"
				value={centroId}
				on:change={(e) => elegirCentro(e.currentTarget.value)}
			>
				<option value="" disabled>Elija el centro de costo</option>
				{#each centros as c (c.id)}
					<option value={c.id}>{c.clave}{c.nombre ? ` · ${c.nombre}` : ''}</option>
				{/each}
			</select>

			{#if centro && !programa}
				<p class="aviso">
					{centro.clave} aún no tiene programa anual. Por ahora, sus actividades se capturan en el seguimiento.
				</p>
				<!-- rutaSeguimiento aplica resolve() a la ruta; el centro y el mes van en la consulta. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a class="enlace" href={rutaSeguimiento} on:click={() => (abierto = false)}
					>Ir al seguimiento de {centro.clave}</a
				>
			{:else if programa}
				{#if cargandoPartidas}
					<p role="status">Cargando actividades…</p>
				{:else}
					<div class="campo">
						{#key `${centroId}-${vuelta}`}
							<SelectorBusqueda
								id="actividad-partida"
								etiqueta="Actividad"
								placeholder="Escriba el número o el nombre"
								{opciones}
								{grupos}
								bind:valor={partidaId}
							/>
						{/key}
					</div>
				{/if}

				<!-- El grupo ya se llama «¿Se realizó?»; el texto visible no se repite al lector. -->
				<span class="etiqueta" aria-hidden="true">¿Se realizó?</span>
				<BotonesSegmentados
					id="actividad-realizada"
					etiqueta="¿Se realizó?"
					opciones={REALIZADA}
					bind:valor={realizada}
				/>

				<label for="actividad-fecha">Fecha (opcional)</label>
				<input
					id="actividad-fecha"
					type="date"
					min={programa.periodoInicio}
					max={hoy < programa.periodoFin ? hoy : programa.periodoFin}
					bind:value={fecha}
					aria-describedby="actividad-fecha-nota"
					aria-invalid={errorFecha ? 'true' : undefined}
				/>
				<p id="actividad-fecha-nota" class="nota">
					{#if errorFecha}
						<span class="error">{errorFecha}</span>
					{:else if fecha}
						Se registra en {textoMes(mesUsado)}.
					{:else}
						Si la deja vacía, se registra con la fecha de hoy.
					{/if}
				</p>

				{#if partida && !errorFecha && pendiente === 0}
					<p class="aviso" role="status">
						En {textoMes(mesUsado)} no falta nada por ejecutar de la partida {partida.numero}.
					</p>
				{/if}

				{#if realizada === 'si'}
					{#key `${centroId}-${vuelta}`}
						<SelectorPersonas
							id="actividad-personas"
							leyenda="Personas que la realizaron (opcional)"
							nombre="personas"
							{personas}
						/>
					{/key}
				{/if}
			{/if}
			{#if errorEnvio}
				<p class="error" role="alert">{errorEnvio}</p>
			{/if}
		</form>
	{/if}
</Dialogo>

<style>
	.formulario {
		display: grid;
		gap: 6px;
	}
	.formulario label,
	.etiqueta {
		margin-top: 8px;
		color: var(--tinta);
		font-weight: 600;
	}
	.formulario select,
	.formulario input[type='date'] {
		max-width: 100%;
	}
	.campo {
		margin-top: 8px;
	}
	.nota {
		margin: 0;
		color: var(--tinta-tenue);
		font-size: var(--texto-xs);
	}
	.aviso {
		margin: 8px 0 0;
		padding: 8px 12px;
		border-radius: var(--radio-control);
		background: var(--superficie-alta);
		color: var(--tinta-secundaria);
	}
	.error {
		margin: 8px 0 0;
		color: var(--peligro);
	}
	.nota .error {
		margin: 0;
	}
</style>
