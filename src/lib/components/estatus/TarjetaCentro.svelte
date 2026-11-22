<!-- Estatus de un centro de costo en un mes: nombre e insignia, «Qué falta», indicadores y accesos.
     Variantes: `tablero` (completa, con «Abrir seguimiento»), `ficha` (dentro de /seguimiento: sin
     botones y con los pendientes como anclas de la página) y `compacta` (selector de centro: toda la
     tarjeta es un enlace). Sin `finanzas` en los datos hay menos filas, nunca huecos. -->
<script lang="ts">
	import type { EstatusCentro, Kpi, Pendiente } from '$lib/dominio/estatus';
	import { plural, textoMes } from '$lib/dominio/textos';
	import BarraKpi from './BarraKpi.svelte';
	import InsigniaEstatus from './InsigniaEstatus.svelte';
	import ListaQueFalta from './ListaQueFalta.svelte';
	import { elementosQueFalta, rutaCobranza, rutaSeguimiento, textoSinPendientes } from './enlaces';
	import { kpiConDatos } from './textos';

	export let centro: { id: string; clave: string; nombre?: string | null; sinPlantilla?: boolean };
	/** Mes consultado, «AAAA-MM». */
	export let mes: string;
	export let estatus: EstatusCentro;
	export let kpis: Kpi[] = [];
	/** Lo que devuelve `queFalta` (hasta cinco y «y N más»). */
	export let falta: Pendiente[] = [];
	/** Atenciones de emergencia del mes. */
	export let emergencias = 0;
	export let variante: 'tablero' | 'ficha' | 'compacta' = 'tablero';
	/** Quien consulta puede abrir «Contrato y cobranza». */
	export let verCobranza = false;
	/** Solo `tablero`: «Abrir seguimiento» como acción principal (la primera tarjeta atrasada). */
	export let principal = false;

	/** Indicadores que se leen de un vistazo; los demás van en «Más indicadores». */
	const SECUNDARIOS = new Set<Kpi['clave']>(['cobro', 'contrato']);

	$: seguimiento = rutaSeguimiento(centro.id, mes);
	$: elementos = elementosQueFalta(falta, {
		centroId: centro.id,
		mes,
		enSeguimiento: variante === 'ficha',
		verCobranza
	});
	$: vacio = centro.sinPlantilla
		? 'Este centro de costo todavía no está configurado para el seguimiento. Avise a administración.'
		: textoSinPendientes(estatus);
	// En el tablero (y en un centro sin datos) no se pintan filas vacías: solo los indicadores que
	// tienen contra qué medirse. La ficha del centro sí dice cuáles están «Sin datos».
	$: visibles = variante === 'ficha' && estatus !== 'sin_datos' ? kpis : kpis.filter(kpiConDatos);
	$: principales = visibles.filter((k) => !SECUNDARIOS.has(k.clave));
	$: secundarios = visibles.filter((k) => SECUNDARIOS.has(k.clave));
	$: nombreCompleto = [centro.clave, centro.nombre].filter(Boolean).join(' · ');
	$: textoEmergencias = `Atenciones de emergencia: ${emergencias}`;
</script>

<!-- Las rutas salen de enlaces.ts, que ya aplica resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
{#if variante === 'compacta'}
	<a class="card tarjeta-centro compacta" href={seguimiento} data-estatus={estatus}>
		<span class="cabecera">
			<span class="titulos">
				<strong class="clave">{centro.clave}</strong>
				{#if centro.nombre}<span class="view-note nombre">{centro.nombre}</span>{/if}
			</span>
			<InsigniaEstatus {estatus} grande />
		</span>
		<span class="primera">
			{elementos[0]?.texto ?? vacio}
			{#if elementos.length > 1}
				<span class="view-note">· y {plural(elementos.length - 1, 'pendiente')} más</span>
			{/if}
		</span>
	</a>
{:else}
	<article class="card tarjeta-centro {variante}" data-estatus={estatus}>
		<header class="cabecera">
			{#if variante === 'ficha'}
				<div class="titulos">
					<h2 class="view-heading titulo-ficha">Estatus de {textoMes(mes)}</h2>
					<p class="view-note nombre">{nombreCompleto}</p>
				</div>
			{:else}
				<div class="titulos">
					<h3 class="clave">{centro.clave}</h3>
					{#if centro.nombre}<p class="view-note nombre">{centro.nombre}</p>{/if}
				</div>
			{/if}
			<InsigniaEstatus {estatus} grande />
		</header>

		<div class="cuerpo">
			<ListaQueFalta {elementos} {vacio} />

			{#if principales.length || secundarios.length || emergencias > 0}
				<div class="indicadores">
					{#if variante === 'ficha'}<p class="rotulo-grupo">Indicadores</p>{/if}
					{#each principales as kpi (kpi.clave)}
						<BarraKpi {kpi} mostrarDetalle={variante === 'ficha' || kpi.clave === 'cobranza'} />
					{/each}
					{#if emergencias > 0}
						<p class="emergencias">
							<a
								class="enlace"
								href={variante === 'ficha' ? '#emergencias' : `${seguimiento}#emergencias`}
								>{textoEmergencias}</a
							>
						</p>
					{/if}
					{#if secundarios.length}
						<details class="mas">
							<summary>Más indicadores</summary>
							<div class="indicadores">
								{#each secundarios as kpi (kpi.clave)}
									<BarraKpi {kpi} />
								{/each}
							</div>
						</details>
					{/if}
				</div>
			{/if}
		</div>

		{#if variante === 'tablero'}
			<footer class="acciones">
				<a
					class="boton ancho {principal ? 'primario' : 'contorno'}"
					href={seguimiento}
					aria-label={`Abrir seguimiento de ${nombreCompleto}`}>Abrir seguimiento</a
				>
				{#if verCobranza}
					<a
						class="enlace acceso"
						href={rutaCobranza(centro.id)}
						aria-label={`Contrato y cobranza de ${nombreCompleto}`}
					>
						Contrato y cobranza
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.25"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg
						>
					</a>
				{/if}
			</footer>
		{/if}
	</article>
{/if}

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
	.tarjeta-centro {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
		margin-bottom: 0;
	}
	.tarjeta-centro.ficha {
		margin-bottom: 24px;
	}
	.cabecera {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px 12px;
	}
	.titulos {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.clave {
		display: block;
		margin: 0;
		font-size: var(--texto-md);
		font-weight: var(--peso-encabezado);
		overflow-wrap: anywhere;
	}
	.titulo-ficha {
		margin: 0;
	}
	.nombre {
		overflow-wrap: anywhere;
	}
	.cuerpo {
		display: grid;
		gap: 16px;
		min-width: 0;
	}
	.indicadores {
		display: grid;
		align-content: start;
		gap: 10px;
		min-width: 0;
	}
	.emergencias {
		margin: 0;
		font-size: var(--texto-sm);
	}
	.emergencias a,
	.acceso {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 44px;
	}
	.acceso svg {
		width: 16px;
		height: 16px;
	}
	.mas summary {
		min-height: 44px;
		display: flex;
		align-items: center;
		font-size: var(--texto-sm);
		color: var(--tinta-secundaria);
	}
	.acciones {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 16px;
		margin-top: auto;
	}
	/* Compacta: toda la tarjeta es el enlace al seguimiento del centro. */
	.compacta {
		gap: 8px;
		color: var(--tinta);
		transition: box-shadow 0.12s var(--curva-salida);
	}
	.compacta:hover {
		box-shadow: var(--sombra-flotante);
	}
	.compacta:hover .clave {
		color: var(--accion);
	}
	.primera {
		font-size: var(--texto-base);
		overflow-wrap: anywhere;
	}
	/* En escritorio la ficha pone «Qué falta» a la izquierda y los indicadores a la derecha. */
	@media (min-width: 900px) {
		.ficha .cuerpo {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			gap: 16px 40px;
		}
	}
</style>
