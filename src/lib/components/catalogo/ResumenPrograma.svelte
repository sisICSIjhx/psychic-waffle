<!-- Ensayo de la importación de un programa anual sin catálogo: periodo, cambios por partida
     («antes → después»), advertencias y partidas del sitio que el libro no trae. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { ETIQUETA_PERIODICIDAD } from '$lib/dominio/captura';
	import { textoMes } from '$lib/dominio/textos';

	interface FilaPrograma {
		numero: string;
		actividad: string;
		accion: 'crear' | 'actualizar' | 'sin_cambios';
		periodicidadAntes: string | null;
		periodicidad: string;
		cantidadAntes: number | null;
		cantidadAnual: number | null;
		meses: { mes: string; cantidad: number }[];
		totalProgramado: number;
		realizados: { mes: string; cantidad: number }[];
		cambiaPrograma: boolean;
		estabaPorConfirmar: boolean;
		quedaPorConfirmar: boolean;
		tieneReportes: boolean;
	}

	export let resultado: {
		programa: {
			accion: 'crear' | 'actualizar' | 'existente';
			periodoInicio: string;
			periodoFin: string;
		};
		resumen: { crear: number; actualizar: number; sinCambios: number };
		partidas: FilaPrograma[];
		noIncluidas: { numero: string; actividad: string }[];
	};
	export let token = '';
	export let nombreArchivo = '';
	export let sitio = '';
	export let advertencias: {
		partida: string | null;
		mes: string | null;
		fila: number | null;
		texto: string;
	}[] = [];

	const ACCIONES = {
		crear: 'Crear',
		actualizar: 'Actualizar',
		sin_cambios: 'Sin cambios'
	} as const;
	const PROGRAMA = {
		crear: 'se creará el programa anual',
		actualizar: 'se actualizará el periodo del programa anual',
		existente: 'el programa anual ya existe'
	} as const;

	const periodicidad = (valor: string | null) =>
		valor ? (ETIQUETA_PERIODICIDAD[valor as keyof typeof ETIQUETA_PERIODICIDAD] ?? valor) : '—';
	const deLaPartida = (lista: typeof advertencias, numero: string) =>
		lista.filter((a) => a.partida === numero);
	const cantidad = (valor: number | null) => (valor === null ? '—' : String(valor));

	$: generales = advertencias.filter((a) => a.partida === null);
	$: totalProgramado = resultado.partidas.reduce((s, p) => s + p.totalProgramado, 0);
	$: hayCambios =
		resultado.resumen.crear + resultado.resumen.actualizar > 0 ||
		resultado.programa.accion !== 'existente';
</script>

<div class="resumen-importacion" aria-live="polite">
	<h3>Ensayo del programa «{nombreArchivo}»</h3>
	<p class="view-note">
		Sitio {sitio} · Periodo {textoMes(resultado.programa.periodoInicio)} a {textoMes(
			resultado.programa.periodoFin
		)} · {PROGRAMA[resultado.programa.accion]}.
	</p>
	<p>
		<strong>{resultado.resumen.crear}</strong> por crear,
		<strong>{resultado.resumen.actualizar}</strong> por actualizar y
		<strong>{resultado.resumen.sinCambios}</strong> sin cambios · {totalProgramado} programados en el
		año.
	</p>

	{#if generales.length}
		<ul class="lista-advertencias">
			{#each generales as advertencia, i (i)}<li>{advertencia.texto}</li>{/each}
		</ul>
	{/if}

	<details open={resultado.resumen.crear + resultado.resumen.actualizar > 0}>
		<summary>Ver partidas ({resultado.partidas.length})</summary>
		<div class="tabla-desplazable">
			<table>
				<thead>
					<tr>
						<th>Partida</th>
						<th>Actividad</th>
						<th>Acción</th>
						<th>Periodicidad</th>
						<th>Cantidad anual</th>
						<th>Programado</th>
						<th>Realizados</th>
						<th>Advertencias</th>
					</tr>
				</thead>
				<tbody>
					{#each resultado.partidas as fila (fila.numero)}
						<tr>
							<td>{fila.numero}</td>
							<td>{fila.actividad}</td>
							<td>
								<span class="status-badge accion-{fila.accion}">{ACCIONES[fila.accion]}</span>
								{#if fila.quedaPorConfirmar}<span class="status-badge por-confirmar"
										>por confirmar</span
									>{/if}
							</td>
							<td>
								{#if fila.periodicidadAntes !== fila.periodicidad}
									{periodicidad(fila.periodicidadAntes)} → {periodicidad(fila.periodicidad)}
								{:else}{periodicidad(fila.periodicidad)}{/if}
							</td>
							<td>
								{#if fila.cantidadAntes !== fila.cantidadAnual}
									{cantidad(fila.cantidadAntes)} → {cantidad(fila.cantidadAnual)}
								{:else}{cantidad(fila.cantidadAnual)}{/if}
							</td>
							<td>{fila.totalProgramado} en {fila.meses.length} meses</td>
							<td>
								{fila.realizados.length
									? fila.realizados.map((r) => textoMes(r.mes)).join(', ')
									: '—'}
							</td>
							<td>
								{#each deLaPartida(advertencias, fila.numero) as advertencia, i (i)}
									<span class="advertencia-fila">{advertencia.texto.replace(/^[^:]*: /, '')}</span>
								{:else}—{/each}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>

	{#if resultado.noIncluidas.length}
		<p class="view-note">
			El libro no trae {resultado.noIncluidas.length === 1
				? 'esta partida del sitio, que no cambia'
				: 'estas partidas del sitio, que no cambian'}:
			{resultado.noIncluidas.map((p) => `${p.numero} ${p.actividad}`).join('; ')}.
		</p>
	{/if}

	{#if hayCambios}
		<form method="POST" action="?/importarAplicar" use:enhance>
			<input type="hidden" name="token" value={token} />
			<button class="boton primario" type="submit">Confirmar importación del programa</button>
		</form>
	{:else}
		<p class="aviso aviso-exito">No hay cambios respecto a lo registrado.</p>
	{/if}
</div>

<style>
	.advertencia-fila {
		display: block;
		font-size: 0.85rem;
	}
	.advertencia-fila + .advertencia-fila {
		margin-top: 4px;
	}
</style>
