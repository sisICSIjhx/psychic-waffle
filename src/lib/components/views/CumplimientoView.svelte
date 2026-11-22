<!-- Tablero de estatus de los centros de costo y cumplimiento del programa anual. Sin contrato
     elegido, primero el estatus de cada centro (tarjetas) y debajo, plegable, el programa anual:
     filtros en la dirección, indicadores con semáforo, tabla por contrato y centro de costo,
     tendencia mensual y reportes que faltan. Con un contrato elegido la página es su detalle (por
     partida con un centro). Los datos son los de hoy: no hay instantáneas históricas. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ETIQUETA_PERIODICIDAD } from '$lib/dominio/captura';
	import {
		desglosePorPartida,
		reportesQueFaltan,
		tablaCumplimiento,
		tendencia,
		type ProgramaCumplimiento
	} from '$lib/dominio/cumplimiento';
	import type { Cliente, Contrato, CumplimientoPrograma, Sitio } from '$lib/dominio/esquemas';
	import type { EstatusCentro } from '$lib/dominio/estatus';
	import { textoMes } from '$lib/dominio/textos';
	import ConcentradoCentros from '$lib/components/cumplimiento/ConcentradoCentros.svelte';
	import IndicadoresCumplimiento from '$lib/components/cumplimiento/IndicadoresCumplimiento.svelte';
	import ReportesQueFaltan from '$lib/components/cumplimiento/ReportesQueFaltan.svelte';
	import TablaCumplimiento from '$lib/components/cumplimiento/TablaCumplimiento.svelte';
	import TendenciaCumplimiento from '$lib/components/cumplimiento/TendenciaCumplimiento.svelte';
	import type { TarjetaTablero } from '$lib/components/cumplimiento/tablero';

	export let hoy: string;
	export let corte: string;
	export let corteLimitado = false;
	export let cliente: Cliente | null = null;
	export let contratos: Contrato[] = [];
	export let contrato: Contrato | null = null;
	export let sitios: Sitio[] = [];
	export let sitio: Sitio | null = null;
	export let periodicidad: string | null = null;
	export let programas: CumplimientoPrograma[] = [];
	/**
	 * Tablero de estatus: tarjetas de los centros de costo (ya ordenadas) y los filtros de la
	 * dirección; null con un contrato elegido (la página es su detalle).
	 */
	export let concentrado: {
		tarjetas: TarjetaTablero[];
		estatus: EstatusCentro | null;
		busqueda: string;
	} | null = null;
	/** Quien consulta puede abrir «Contrato y cobranza» (capacidad `verContrato`). */
	export let verCobranza = false;
	/** Hay una navegación en curso a esta misma página. */
	export let cargando = false;

	// «Cumplimiento del programa anual» va plegado en teléfono y abierto en escritorio; un filtro
	// del programa en la dirección lo deja abierto también sin JavaScript.
	let programaAbierto = periodicidad !== null;
	onMount(() => {
		if (window.matchMedia('(min-width: 769px)').matches) programaAbierto = true;
	});
	function alAlternar(evento: Event) {
		if (evento.currentTarget instanceof HTMLDetailsElement) {
			programaAbierto = evento.currentTarget.open;
		}
	}

	$: lista = programas as unknown as ProgramaCumplimiento[];
	$: tabla = tablaCumplimiento(lista, corte, hoy, periodicidad);
	$: desglose =
		sitio && lista.length === 1 ? desglosePorPartida(lista[0], corte, hoy, periodicidad) : null;
	$: meses = tendencia(lista, corte, hoy, periodicidad);
	$: faltan = reportesQueFaltan(lista, corte, hoy, periodicidad);
	$: mesesCorte = mesesHasta(hoy);

	/** Los 18 meses anteriores al en curso, para elegir el corte. */
	function mesesHasta(fecha: string): string[] {
		const lista: string[] = [];
		let anio = Number(fecha.slice(0, 4));
		let mes = Number(fecha.slice(5, 7));
		for (let i = 0; i < 18; i++) {
			lista.push(`${anio}-${String(mes).padStart(2, '0')}-01`);
			mes--;
			if (mes === 0) {
				mes = 12;
				anio--;
			}
		}
		return lista;
	}

	const enlacePlaneacion = (p: ProgramaCumplimiento) =>
		`${resolve('/planeacion')}?contrato=${p.contrato.id}&sitio=${p.sitio.id}`;

	function enviarAlCambiar(evento: Event) {
		(evento.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}
</script>

{#if concentrado}
	<ConcentradoCentros
		tarjetas={concentrado.tarjetas}
		estatus={concentrado.estatus}
		busqueda={concentrado.busqueda}
		{corte}
		{hoy}
		{periodicidad}
		{verCobranza}
		{cargando}
	/>
{:else}
	<p class="volver">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() va en la ruta; el corte, en la consulta -->
		<a class="enlace" href={`${resolve('/cumplimiento')}?corte=${corte.slice(0, 7)}`}
			>Ver el estatus de los centros de costo</a
		>
	</p>
{/if}

<!-- Un solo marcado para los dos casos: plegable bajo el tablero, o a la vista en el detalle. -->
<svelte:element
	this={concentrado ? 'details' : 'div'}
	id="programa-anual"
	class="programa-anual"
	open={concentrado ? programaAbierto : undefined}
	on:toggle={alAlternar}
>
	{#if concentrado}
		<summary class="view-heading">Cumplimiento del programa anual</summary>
	{/if}
	<section class="card" aria-labelledby="titulo-cumplimiento">
		<h2 id="titulo-cumplimiento" class="view-heading">Filtros</h2>
		<form method="GET" class="filtros">
			{#if cliente}<input type="hidden" name="cliente" value={cliente.clave} />{/if}
			{#if concentrado}
				<!-- El mes se elige arriba, en el tablero; aquí solo viaja con los filtros del programa. -->
				<input type="hidden" name="corte" value={corte.slice(0, 7)} />
				{#if concentrado.estatus}
					<input type="hidden" name="estatus" value={concentrado.estatus} />
				{/if}
				{#if concentrado.busqueda}<input type="hidden" name="q" value={concentrado.busqueda} />{/if}
			{/if}
			<div class="form-group">
				<label for="filtro-contrato">Contrato</label>
				<select id="filtro-contrato" name="contrato" on:change={enviarAlCambiar}>
					<option value="">Todos</option>
					{#each contratos as k (k.id)}
						<option value={k.id} selected={k.id === contrato?.id}>{k.numero}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="filtro-sitio">Centro de costo</label>
				<select id="filtro-sitio" name="sitio" on:change={enviarAlCambiar} disabled={!contrato}>
					<option value="">Todos</option>
					{#each sitios as s (s.id)}
						<option value={s.id} selected={s.id === sitio?.id}>{s.clave} {s.nombre}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="filtro-periodicidad">Periodicidad</label>
				<select id="filtro-periodicidad" name="periodicidad" on:change={enviarAlCambiar}>
					<option value="">Todas</option>
					{#each Object.entries(ETIQUETA_PERIODICIDAD) as [valor, etiqueta] (valor)}
						<option value={valor} selected={periodicidad === valor}>{etiqueta}</option>
					{/each}
				</select>
			</div>
			{#if !concentrado}
				<div class="form-group">
					<label for="filtro-corte">Mes de corte</label>
					<select id="filtro-corte" name="corte" on:change={enviarAlCambiar}>
						{#each mesesCorte as m (m)}
							<option value={m.slice(0, 7)} selected={m === corte}
								>{textoMes(m, { inicial: true })}</option
							>
						{/each}
					</select>
				</div>
			{/if}
			<noscript><button class="boton" type="submit">Filtrar</button></noscript>
		</form>
		<p class="view-note">
			Datos al día de hoy, con los meses del programa hasta {textoMes(corte)}.
			{#if corteLimitado}El mes de corte no puede ser posterior al mes en curso: se usa {textoMes(
					corte
				)}.{/if}
		</p>
	</section>

	{#if lista.length === 0}
		<section class="card">
			<p>
				No hay programas que contengan {textoMes(corte)} con estos filtros. Revise la
				<a class="enlace" href={resolve('/planeacion')}>planeación</a> o el
				<a class="enlace" href={resolve('/catalogo')}>catálogo</a>.
			</p>
		</section>
	{:else}
		<section class="card" aria-labelledby="titulo-indicadores">
			<h2 id="titulo-indicadores" class="view-heading">Indicadores a {textoMes(corte)}</h2>
			<IndicadoresCumplimiento indicadores={tabla.total} />
		</section>

		<section class="card" aria-labelledby="titulo-tabla">
			<h2 id="titulo-tabla" class="view-heading">
				{desglose ? `Por partida · ${sitio?.clave ?? ''}` : 'Por contrato y centro de costo'}
			</h2>
			<TablaCumplimiento
				contratos={tabla.contratos}
				total={tabla.total}
				{desglose}
				{enlacePlaneacion}
			/>
		</section>

		<section class="card" aria-labelledby="titulo-tendencia">
			<h2 id="titulo-tendencia" class="view-heading">Tendencia mensual</h2>
			<TendenciaCumplimiento {meses} />
		</section>

		<section class="card" aria-labelledby="titulo-faltan">
			<h2 id="titulo-faltan" class="view-heading">Reportes que faltan</h2>
			<ReportesQueFaltan
				abiertos={faltan.abiertos}
				vencidos={faltan.vencidos}
				ejecutadosSinReporte={faltan.ejecutadosSinReporte}
			/>
		</section>
	{/if}
</svelte:element>

<style>
	.volver {
		margin: 0 0 12px;
	}
	.volver a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}
	details.programa-anual > summary {
		margin-bottom: 12px;
		padding-block: 13px;
		border-top: 1px solid var(--linea-fuerte);
		border-radius: 0;
	}
	.filtros {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
	}
</style>
