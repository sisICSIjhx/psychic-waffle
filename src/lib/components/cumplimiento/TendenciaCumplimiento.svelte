<!-- Tendencia mensual del %cumplimiento y del %efectividad con las metas (90 % y 80 %) como
     referencia, en un SVG propio, y una tabla equivalente con los mismos valores. Un mes sin datos
     queda sin punto en la gráfica y con «—» en la tabla. -->
<script lang="ts">
	import { textoPorcentaje } from '$lib/dominio/cumplimiento';
	import { textoMes } from '$lib/dominio/textos';

	export let meses: { mes: string; cumplimiento: number | null; efectividad: number | null }[] = [];

	const ANCHO = 640;
	const ALTO = 220;
	const MARGEN = { izq: 36, der: 12, arr: 12, aba: 28 };
	const META = { cumplimiento: 90, efectividad: 80 };

	$: paso = meses.length > 1 ? (ANCHO - MARGEN.izq - MARGEN.der) / (meses.length - 1) : 0;
	const x = (i: number) => MARGEN.izq + i * paso;
	const y = (valor: number) =>
		MARGEN.arr + ((100 - valor) / 100) * (ALTO - MARGEN.arr - MARGEN.aba);

	/** Tramos de la serie: un mes sin datos corta la línea. */
	function tramos(serie: 'cumplimiento' | 'efectividad'): string[] {
		const resultado: string[] = [];
		let actual: string[] = [];
		meses.forEach((m, i) => {
			const valor = m[serie];
			if (valor === null) {
				if (actual.length) resultado.push(actual.join(' '));
				actual = [];
			} else {
				actual.push(`${x(i)},${y(valor)}`);
			}
		});
		if (actual.length) resultado.push(actual.join(' '));
		return resultado;
	}
</script>

{#if meses.length}
	<figure class="tendencia">
		<svg
			viewBox={`0 0 ${ANCHO} ${ALTO}`}
			role="img"
			aria-label="Tendencia mensual del cumplimiento y la efectividad; los valores están en la tabla siguiente"
		>
			{#each [0, 50, 100] as marca (marca)}
				<line class="guia" x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={y(marca)} y2={y(marca)} />
				<text class="eje" x={MARGEN.izq - 6} y={y(marca) + 4} text-anchor="end">{marca}</text>
			{/each}
			<line
				class="meta cumplimiento"
				x1={MARGEN.izq}
				x2={ANCHO - MARGEN.der}
				y1={y(META.cumplimiento)}
				y2={y(META.cumplimiento)}
			/>
			<line
				class="meta efectividad"
				x1={MARGEN.izq}
				x2={ANCHO - MARGEN.der}
				y1={y(META.efectividad)}
				y2={y(META.efectividad)}
			/>
			{#each tramos('cumplimiento') as puntos (puntos)}
				<polyline class="serie cumplimiento" points={puntos} />
			{/each}
			{#each tramos('efectividad') as puntos (puntos)}
				<polyline class="serie efectividad" points={puntos} />
			{/each}
			{#each meses as m, i (m.mes)}
				{#if m.cumplimiento !== null}
					<circle class="punto cumplimiento" cx={x(i)} cy={y(m.cumplimiento)} r="4" />
				{/if}
				{#if m.efectividad !== null}
					<rect
						class="punto efectividad"
						x={x(i) - 4}
						y={y(m.efectividad) - 4}
						width="8"
						height="8"
					/>
				{/if}
				<text class="eje" x={x(i)} y={ALTO - 8} text-anchor="middle"
					>{textoMes(m.mes, { corto: true }).slice(0, 3)}</text
				>
			{/each}
		</svg>
		<figcaption class="leyenda">
			<span
				><span class="muestra cumplimiento" aria-hidden="true">●</span> Cumplimiento (meta 90 %)</span
			>
			<span
				><span class="muestra efectividad" aria-hidden="true">■</span> Efectividad (meta 80 %)</span
			>
		</figcaption>
	</figure>
	<div class="tabla-desplazable">
		<table>
			<caption class="sr-only">Cumplimiento y efectividad por mes</caption>
			<thead>
				<tr>
					<th scope="col">Mes</th>
					<th scope="col">Cumplimiento</th>
					<th scope="col">Efectividad</th>
				</tr>
			</thead>
			<tbody>
				{#each meses as m (m.mes)}
					<tr>
						<th scope="row">{textoMes(m.mes, { inicial: true })}</th>
						<td>{textoPorcentaje(m.cumplimiento)}</td>
						<td>{textoPorcentaje(m.efectividad)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.tendencia {
		margin: 0 0 12px;
	}
	svg {
		width: 100%;
		height: auto;
		max-width: 720px;
	}
	.guia {
		stroke: var(--border);
	}
	.eje {
		fill: var(--muted);
		font-size: 11px;
	}
	.meta {
		stroke-dasharray: 4 4;
		stroke-width: 1.5;
	}
	.serie {
		fill: none;
		stroke-width: 2.5;
	}
	.cumplimiento {
		stroke: var(--primary);
		fill: var(--primary);
		color: var(--primary);
	}
	.efectividad {
		stroke: var(--warning);
		fill: var(--warning);
		color: var(--warning);
	}
	.serie.cumplimiento,
	.serie.efectividad,
	.meta {
		fill: none;
	}
	.leyenda {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		font-size: 0.85rem;
	}
	.muestra {
		font-weight: 700;
	}
</style>
