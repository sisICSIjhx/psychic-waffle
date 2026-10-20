<!-- Resultado del ensayo de importación: qué se crearía, actualizaría u omitiría, y confirmación. -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { enhance } from '$app/forms';

	interface FilaResumen {
		numero: string;
		actividad: string;
		accion: 'crear' | 'actualizar' | 'sin_cambios';
		alcances: number;
		mesesProgramados: number;
		cambiaPrograma: boolean;
		estabaPorConfirmar: boolean;
	}

	export let resultado: {
		programa: { accion: 'crear' | 'actualizar' | 'existente' | 'ninguno' };
		resumen: { crear: number; actualizar: number; sinCambios: number };
		partidas: FilaResumen[];
	};
	export let token = '';
	export let nombreArchivo = '';
	export let advertencias: string[] = [];
	export let firmantesPropuestos: {
		funcion: string;
		nombre: string;
		cargo: string;
		empresa: string;
	}[] = [];
	export let encabezado: {
		usuario: string | null;
		estacion: string | null;
		programa: { periodoInicio: string; periodoFin: string } | null;
	} | null = null;

	const dispatch = createEventDispatcher<{
		usarFirmante: { nombre: string; cargo: string; empresa: string };
	}>();

	const ACCIONES = {
		crear: 'Crear',
		actualizar: 'Actualizar',
		sin_cambios: 'Sin cambios'
	} as const;
	const PROGRAMA = {
		crear: 'se creará el programa anual',
		actualizar: 'se actualizará el periodo del programa anual y sus meses',
		existente: 'el programa anual ya existe y se actualizarán sus meses',
		ninguno: 'el archivo no trae programa'
	} as const;

	$: hayCambios = resultado.resumen.crear + resultado.resumen.actualizar > 0;
</script>

<div class="resumen-importacion" aria-live="polite">
	<h3>Ensayo de «{nombreArchivo}»</h3>
	{#if encabezado}
		<p class="view-note">
			{encabezado.usuario ?? 'Usuario sin indicar'} · {encabezado.estacion ??
				'Estación sin indicar'}
			{#if encabezado.programa}· Periodo {encabezado.programa.periodoInicio} a {encabezado.programa
					.periodoFin}{/if}
			· {PROGRAMA[resultado.programa.accion]}.
		</p>
	{/if}
	<p>
		<strong>{resultado.resumen.crear}</strong> por crear,
		<strong>{resultado.resumen.actualizar}</strong> por actualizar y
		<strong>{resultado.resumen.sinCambios}</strong> sin cambios.
	</p>

	{#if advertencias.length}
		<ul class="lista-advertencias">
			{#each advertencias as advertencia (advertencia)}<li>{advertencia}</li>{/each}
		</ul>
	{/if}

	<details>
		<summary>Ver partidas ({resultado.partidas.length})</summary>
		<div class="tabla-desplazable">
			<table>
				<thead>
					<tr
						><th>Partida</th><th>Actividad</th><th>Acción</th><th>Alcances</th><th
							>Meses programados</th
						></tr
					>
				</thead>
				<tbody>
					{#each resultado.partidas as fila (fila.numero)}
						<tr>
							<td>{fila.numero}</td>
							<td>{fila.actividad}</td>
							<td>
								<span class="status-badge accion-{fila.accion}">{ACCIONES[fila.accion]}</span>
								{#if fila.estabaPorConfirmar}<span class="status-badge por-confirmar"
										>reemplaza la derivada</span
									>{/if}
							</td>
							<td>{fila.alcances}</td>
							<td>{fila.mesesProgramados}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>

	{#if firmantesPropuestos.length}
		<div class="firmantes-propuestos">
			<p class="view-note">
				La hoja trae estos firmantes. No se importan: revise cada uno y regístrelo si corresponde.
			</p>
			<ul>
				{#each firmantesPropuestos as propuesto, i (i)}
					<li>
						<span>{propuesto.nombre} · {propuesto.cargo} · {propuesto.empresa}</span>
						<button
							type="button"
							class="action-btn edit"
							on:click={() => dispatch('usarFirmante', propuesto)}
							>Usar en el formulario de firmantes</button
						>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if hayCambios}
		<form method="POST" action="?/importarAplicar" use:enhance>
			<input type="hidden" name="token" value={token} />
			<button class="boton primario" type="submit">Confirmar importación</button>
		</form>
	{:else}
		<p class="aviso aviso-exito">No hay cambios respecto a lo registrado.</p>
	{/if}
</div>
