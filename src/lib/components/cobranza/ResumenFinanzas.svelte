<!-- Resumen financiero de un centro de costo: estatus del mes en curso, monto del contrato, cobrado
     (suma de la cobranza mensual, D7), por cobrar y adicionales. Solo se usa con `verContrato`. -->
<script lang="ts">
	import BarraKpi from '$lib/components/estatus/BarraKpi.svelte';
	import InsigniaEstatus from '$lib/components/estatus/InsigniaEstatus.svelte';
	import { rutaSeguimiento } from '$lib/components/estatus/enlaces';
	import { PASOS_COBRANZA, textoMonto, type PasoCobranza } from '$lib/dominio/cobranza';
	import type { EstatusCentro, Kpi } from '$lib/dominio/estatus';
	import { textoMes } from '$lib/dominio/textos';
	import { totalesDeAdicionales, type Adicional } from './adicionales';

	export let centro: { id: string; clave: string; nombre?: string | null };
	/** Mes en curso, «AAAA-MM»: el del estatus y el de los pasos de cobranza. */
	export let mes: string;
	/** null si el centro todavía no tiene resumen de estatus. */
	export let estatus: EstatusCentro | null = null;
	export let kpiCobranza: Kpi | null = null;
	/** Pasos de la cobranza del mes en curso. */
	export let pasos: Record<PasoCobranza, boolean> | null = null;
	/** null: la plantilla no lo define o no se ha capturado. */
	export let montoContrato: number | null = null;
	/** Suma de la cobranza mensual de todos los años. */
	export let cobrado = 0;
	/** Valor capturado a mano antes de que el cobrado se calculara; solo sin cobranza mensual. */
	export let capturaAnterior: number | null = null;
	export let adicionales: Adicional[] = [];
	/** Quien consulta puede capturar el monto del contrato (enlace «Capturarlo»). */
	export let puedeCapturarMonto = false;

	$: totales = totalesDeAdicionales(adicionales);
	$: cobradoVisible = capturaAnterior ?? cobrado;
	$: porCobrar =
		montoContrato === null
			? null
			: Math.max(0, Math.round((montoContrato - cobradoVisible) * 100) / 100);
	$: nombreMes = textoMes(mes);
</script>

<section class="card resumen" id="resumen" aria-labelledby="titulo-resumen">
	<div class="encabezado">
		<h2 class="view-heading" id="titulo-resumen" tabindex="-1">Resumen</h2>
		{#if estatus}<InsigniaEstatus {estatus} grande />{/if}
	</div>
	<div class="contexto">
		<p class="view-note centro">
			{centro.clave}{centro.nombre ? ` · ${centro.nombre}` : ''}{estatus
				? ` · Estatus de ${nombreMes}`
				: ''}
		</p>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- la ruta sale de enlaces.ts, que ya aplica resolve() -->
		<a class="enlace seguimiento" href={rutaSeguimiento(centro.id, mes)}
			>Ver seguimiento del centro</a
		>
	</div>

	<dl class="cifras">
		<div>
			<dt>Monto del contrato</dt>
			<dd>
				{#if montoContrato === null}
					<span class="sin-dato">Sin monto del contrato</span>
					{#if puedeCapturarMonto}<a class="enlace" href="#contrato">Capturarlo</a>{/if}
				{:else}
					<span class="cifra monto">{textoMonto(montoContrato)}</span>
				{/if}
			</dd>
		</div>
		<div>
			<dt>Cobrado del contrato</dt>
			<dd>
				<span class="cifra monto">{textoMonto(cobradoVisible)}</span>
				{#if capturaAnterior !== null}<span class="status-badge">Captura anterior</span>{/if}
				<span class="view-note">Suma de la cobranza mensual. Lo llena contabilidad.</span>
			</dd>
		</div>
		{#if porCobrar !== null}
			<div>
				<dt>Por cobrar</dt>
				<dd><span class="cifra monto">{textoMonto(porCobrar)}</span></dd>
			</div>
		{/if}
		<div>
			<dt>Adicionales</dt>
			<dd>
				{#if totales.cantidad === 0}
					<span class="sin-dato">Sin adicionales</span>
				{:else}
					<span class="cifra monto">{totales.cantidad}</span>
					<span class="view-note cifra"
						>Pactado {textoMonto(totales.pactado)} · cobrado {textoMonto(totales.cobrado)}</span
					>
				{/if}
			</dd>
		</div>
	</dl>

	{#if kpiCobranza || pasos}
		<div class="cobranza">
			{#if kpiCobranza}
				<BarraKpi kpi={kpiCobranza} mostrarDetalle={false} />
				{#if montoContrato === null}
					<p class="view-note">
						La barra aparece cuando se captura el monto del contrato: mide lo cobrado contra ese
						monto.
					</p>
				{/if}
			{/if}
			{#if pasos}
				<div class="pasos">
					<span class="rotulo-grupo" id="rotulo-pasos">Cobranza de {nombreMes}</span>
					<ul aria-labelledby="rotulo-pasos">
						{#each PASOS_COBRANZA as [paso, etiqueta] (paso)}
							<li class:hecho={pasos[paso]}>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.25"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"><path d={pasos[paso] ? 'M20 6 9 17l-5-5' : 'M6 12h12'} /></svg
								>
								{etiqueta}<span class="sr-only">: {pasos[paso] ? 'hecho' : 'pendiente'}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.resumen {
		min-width: 0;
		scroll-margin-top: 12px;
	}
	/* Título e insignia en la misma línea, también en teléfono: el estatus es lo primero que se ve. */
	.encabezado {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
	}
	.encabezado h2 {
		margin: 0;
	}
	.contexto {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0 16px;
		margin-bottom: 12px;
	}
	.centro {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.seguimiento {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}
	.cifras {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
		gap: 16px 24px;
		margin: 0;
	}
	.cifras > div {
		display: grid;
		align-content: start;
		gap: 4px;
		min-width: 0;
	}
	dt {
		color: var(--tinta-secundaria);
		font-size: var(--texto-xs);
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	dd {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 8px;
		margin: 0;
		min-width: 0;
	}
	.monto {
		font-family: var(--fuente-titulos);
		font-size: var(--texto-lg);
		font-weight: var(--peso-encabezado);
		overflow-wrap: anywhere;
	}
	dd .view-note {
		flex-basis: 100%;
	}
	.sin-dato {
		color: var(--tinta-tenue);
	}
	.cobranza {
		display: grid;
		gap: 10px;
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--linea);
	}
	.pasos {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 16px;
	}
	.pasos ul {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.pasos li {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--tinta-tenue);
		font-size: var(--texto-sm);
	}
	.pasos li.hecho {
		color: var(--exito);
		font-weight: 600;
	}
	.pasos svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}
	@media (max-width: 768px) {
		/* Cifras en dos columnas: caben las cuatro en la primera pantalla. */
		.cifras {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px 16px;
		}
		.monto {
			font-size: var(--texto-md);
		}
	}
</style>
