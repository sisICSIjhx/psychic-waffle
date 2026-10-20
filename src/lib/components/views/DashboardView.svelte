<!-- Panel de control: indicadores del mes, pendientes vencidos y reportes recientes. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { partesMes } from '$lib/dominio/captura';
	import { MESES } from '$lib/dominio/documento';
	import type { ReporteResumen } from '$lib/dominio/esquemas';
	import { fechaEnZona } from '$lib/dominio/fechas';
	import type { PendienteVencido, ResumenMes } from '$lib/dominio/planeacion';

	export let hoy = fechaEnZona();
	export let resumen: ResumenMes = { programadas: 0, cumplidas: 0, pendientes: 0, vencidas: 0 };
	export let programasVigentes = 0;
	export let vencidos: (PendienteVencido & {
		contratoId: string;
		sitioId: string;
		sitio: string;
	})[] = [];
	export let totalVencidos = 0;
	export let borradores = 0;
	export let enRevision = 0;
	export let recientes: ReporteResumen[] = [];

	const ESTADOS = {
		borrador: 'Borrador',
		en_revision: 'En revisión',
		emitido: 'Emitido',
		sustituido: 'Sustituido'
	} as const;

	const textoMes = (mes: string) => {
		const { anio, mes: numero } = partesMes(mes);
		return `${MESES[numero - 1]} ${anio}`;
	};

	$: indicadores = [
		{ valor: resumen.programadas, etiqueta: 'Partidas programadas del mes' },
		{ valor: resumen.cumplidas, etiqueta: 'Realizado del mes' },
		{ valor: resumen.pendientes, etiqueta: 'Pendientes del mes' },
		{ valor: resumen.vencidas, etiqueta: 'Pendientes vencidos' },
		{
			valor: borradores,
			etiqueta: `Borradores abiertos${enRevision ? ` (+${enRevision} en revisión)` : ''}`
		}
	];
</script>

<section aria-labelledby="titulo-indicadores">
	<h2 id="titulo-indicadores" class="view-heading">Indicadores del mes</h2>
	<p class="view-note">
		{textoMes(hoy)} · {programasVigentes === 0
			? 'No hay programas anuales vigentes; impórtelos desde el catálogo.'
			: `${programasVigentes} programa(s) anual(es) vigente(s).`}
	</p>
	<div class="kpi-grid">
		{#each indicadores as indicador (indicador.etiqueta)}
			<div class="card kpi-card">
				<span class="kpi-value">{indicador.valor}</span>
				<span class="kpi-label">{indicador.etiqueta}</span>
			</div>
		{/each}
	</div>
</section>

{#if vencidos.length}
	<section class="card" aria-labelledby="titulo-vencidos">
		<h2 id="titulo-vencidos" class="view-heading">
			Pendientes vencidos{totalVencidos > vencidos.length
				? ` (los ${vencidos.length} más antiguos de ${totalVencidos})`
				: ''}
		</h2>
		<ul class="lista-panel">
			{#each vencidos as v (v.sitioId + v.partidaId + v.mes)}
				<li>
					<strong>{textoMes(v.mes)}</strong> · {v.sitio} · Partida {v.numero}.- {v.actividad}
					<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						class="enlace"
						href={`${resolve('/planeacion')}?contrato=${v.contratoId}&sitio=${v.sitioId}`}
						>Ver en la planeación</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="card" aria-labelledby="titulo-recientes">
	<h2 id="titulo-recientes" class="view-heading">Reportes recientes</h2>
	{#if recientes.length}
		<ul class="lista-panel">
			{#each recientes as r (r.id)}
				<li>
					<a class="enlace" href={resolve('/reportes/[id]', { id: r.id })}>{r.titulo}</a>
					<span class="status-badge estado-{r.estado}">{ESTADOS[r.estado]}</span>
					<span class="view-note">{r.sitioTexto}{r.tags ? ` · ${r.tags}` : ''}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="view-note">
			Aún no hay reportes. Empiece en <a class="enlace" href={resolve('/captura')}>Captura</a>.
		</p>
	{/if}
</section>

<style>
	.lista-panel {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 6px;
	}
</style>
