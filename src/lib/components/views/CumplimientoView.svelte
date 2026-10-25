<!-- Tablero de cumplimiento del programa: filtros y mes de corte en la dirección, indicadores con
     semáforo, tabla por contrato y sitio (por partida con un sitio elegido), tendencia mensual y
     reportes que faltan. Los datos son los de hoy: no hay instantáneas históricas. -->
<script lang="ts">
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
	import { textoMes } from '$lib/dominio/textos';
	import IndicadoresCumplimiento from '$lib/components/cumplimiento/IndicadoresCumplimiento.svelte';
	import ReportesQueFaltan from '$lib/components/cumplimiento/ReportesQueFaltan.svelte';
	import TablaCumplimiento from '$lib/components/cumplimiento/TablaCumplimiento.svelte';
	import TendenciaCumplimiento from '$lib/components/cumplimiento/TendenciaCumplimiento.svelte';

	export let hoy: string;
	export let corte: string;
	export let corteLimitado = false;
	export let clientes: Cliente[] = [];
	export let cliente: Cliente | null = null;
	export let contratos: Contrato[] = [];
	export let contrato: Contrato | null = null;
	export let sitios: Sitio[] = [];
	export let sitio: Sitio | null = null;
	export let periodicidad: string | null = null;
	export let programas: CumplimientoPrograma[] = [];

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

<section class="card" aria-labelledby="titulo-cumplimiento">
	<h2 id="titulo-cumplimiento" class="view-heading">Cumplimiento del programa</h2>
	<form method="GET" class="filtros">
		<div class="form-group">
			<label for="filtro-cliente">Cliente</label>
			<select id="filtro-cliente" name="cliente" on:change={enviarAlCambiar}>
				<option value="">Todos</option>
				{#each clientes as c (c.id)}
					<option value={c.clave} selected={c.id === cliente?.id}>{c.nombre}</option>
				{/each}
			</select>
		</div>
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
			<label for="filtro-sitio">Sitio</label>
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
			{desglose ? `Por partida · ${sitio?.clave ?? ''}` : 'Por contrato y sitio'}
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

<style>
	.filtros {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
	}
</style>
