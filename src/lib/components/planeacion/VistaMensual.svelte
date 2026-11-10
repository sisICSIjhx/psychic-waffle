<!-- Vista mensual de la planeación: encabezado con leyenda, navegación entre los meses del periodo y
     dos formatos. «Matriz» (por omisión) muestra las partidas por semanas (MatrizMensual); «Lista» las
     agrupa de lo más urgente a lo ejecutado con estado, documento, avance y acciones (capturar o
     continuar, ver reportes y ajustar). Estilos en planeacion/programa.css. -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		anotacionesCelda,
		detalleCelda,
		ejecutado,
		esperado,
		estadoDocumental,
		ETIQUETA_EJECUCION,
		faltan,
		partidasDelMes,
		textoDocumental,
		type EjecucionDelMes,
		type EstadoEjecucion
	} from '$lib/dominio/cumplimiento';
	import { ETIQUETA_PERIODICIDAD } from '$lib/dominio/captura';
	import type { AvancePrograma, CeldaPrograma } from '$lib/dominio/esquemas';
	import { plural, textoMes, textoOracion } from '$lib/dominio/textos';
	import MatrizMensual from './MatrizMensual.svelte';

	type Partida = AvancePrograma['partidas'][number];

	export let partidas: Partida[] = [];
	export let mes: string;
	export let meses: string[] = [];
	export let hoy: string;
	/** Sin permiso para ajustar el programa no se ofrece «Ajustar». */
	export let puedeAjustar = true;
	export let formato: 'matriz' | 'lista' = 'matriz';
	export let ejecuciones: EjecucionDelMes[] = [];
	/** Consulta de la captura con contrato, sitio, partida, mes y, si aplica, la reprogramación. */
	export let consultaCaptura: (partidaId: string, mes: string, reprogramacion?: string) => string;
	/** Enlace a otro mes de la vista mensual, con los filtros y el formato actuales. */
	export let enlaceMes: (mes: string) => string;
	/** Enlace al mismo mes en el otro formato. */
	export let enlaceFormato: (formato: 'matriz' | 'lista') => string;
	/** Enlace a los reportes emitidos de la partida en el mes (historial filtrado). */
	export let enlaceReportes: (partidaId: string, mes: string) => string;

	const dispatch = createEventDispatcher<{ ajustar: { partida: Partida; celda: CeldaPrograma } }>();

	const ICONOS = {
		calendario:
			'<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
		matriz:
			'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
		lista: '<path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13"/>'
	} as const;
	const FORMATOS = [
		{ valor: 'matriz', texto: 'Matriz', icono: ICONOS.matriz },
		{ valor: 'lista', texto: 'Lista', icono: ICONOS.lista }
	] as const;

	/** Tono de color de cada estado (los de la matriz anual). */
	const TONO: Record<EstadoEjecucion, string> = {
		ejecutado: 'ejecutado',
		extra: 'ejecutado',
		pendiente: 'pendiente',
		programado: 'programado',
		vencido: 'vencido',
		reprogramado: 'reprogramado',
		no_ejecutado: 'neutro',
		sin_programa: 'neutro'
	};
	/** Título de cada grupo de la lista. */
	const GRUPO: Record<EstadoEjecucion, string> = {
		vencido: 'Vencidas',
		pendiente: 'Pendientes',
		programado: 'Programadas',
		reprogramado: 'Reprogramadas',
		no_ejecutado: 'No ejecutadas',
		ejecutado: 'Ejecutadas',
		extra: 'Realizadas sin programar',
		sin_programa: 'Sin programa'
	};

	$: filas = partidasDelMes(partidas, mes, hoy) as {
		partida: Partida;
		celda: CeldaPrograma;
		estado: EstadoEjecucion;
	}[];
	/** Las mismas partidas en el orden del programa, para la matriz. */
	$: enOrden = partidas.filter((p) => filas.some((f) => f.partida.id === p.id));
	/** Grupos consecutivos por estado (partidasDelMes ya ordena por urgencia). */
	$: grupos = filas.reduce<{ estado: EstadoEjecucion; filas: typeof filas }[]>((lista, fila) => {
		const ultimo = lista[lista.length - 1];
		if (ultimo?.estado === fila.estado) ultimo.filas.push(fila);
		else lista.push({ estado: fila.estado, filas: [fila] });
		return lista;
	}, []);
	$: leyenda = (
		formato === 'matriz'
			? ['ejecutado', 'pendiente', 'programado', 'vencido']
			: [...new Set(filas.map((f) => f.estado))]
	) as EstadoEjecucion[];
	$: indice = meses.indexOf(mes);
	$: anterior = indice > 0 ? meses[indice - 1] : null;
	$: siguiente = indice >= 0 && indice < meses.length - 1 ? meses[indice + 1] : null;

	/** Reprogramación que llega a este mes y aún falta por reportar, para «Capturar». */
	const reprogramacionPendiente = (c: CeldaPrograma) =>
		c.ajustes.find(
			(a) => a.tipo === 'reprogramado' && a.mesDestino === c.mes && a.ejecuciones < a.cantidad
		)?.id;
	/** Ejecuciones que tocan en el mes contando lo marcado como no ejecutado. */
	const meta = (c: CeldaPrograma) => esperado(c) + (c.noEjecutado ?? 0);
</script>

<section class="cabecera-matriz" aria-labelledby="titulo-mensual">
	<div class="titulo-con-icono">
		<span class="icono-indicador e-total"
			><svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
				{@html ICONOS.calendario}</svg
			></span
		>
		<div>
			<h2 id="titulo-mensual" class="titulo-matriz">
				Programa mensual · {textoMes(mes, { inicial: true })}
			</h2>
			<p class="subtitulo-matriz">
				{filas.length} de {plural(partidas.length, 'partida')} con trabajo en el mes · {formato ===
				'matriz'
					? 'por semanas de lunes a domingo'
					: 'de lo más urgente a lo ejecutado'}
			</p>
		</div>
	</div>
	<ul class="leyenda" aria-label="Leyenda de la vista mensual">
		{#each leyenda as estado (estado)}
			<li class="e-{TONO[estado]}"><span class="punto"></span>{ETIQUETA_EJECUCION[estado]}</li>
		{/each}
	</ul>
</section>

<div class="barra-mensual">
	<nav class="navegacion-meses" aria-label="Meses del programa">
		<!-- enlaceMes aplica resolve() a la ruta; el mes va en la consulta. -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		{#if anterior}
			<a class="boton-programa" href={enlaceMes(anterior)}
				>‹ <span class="sr-only">Mes anterior:</span> {textoMes(anterior, { inicial: true })}</a
			>
		{/if}
		<p class="mes-semanal">{textoMes(mes, { inicial: true })}</p>
		{#if siguiente}
			<a class="boton-programa" href={enlaceMes(siguiente)}
				><span class="sr-only">Mes siguiente:</span> {textoMes(siguiente, { inicial: true })} ›</a
			>
		{/if}
	</nav>
	<nav class="selector-vista" aria-label="Formato de la vista mensual">
		{#each FORMATOS as f (f.valor)}
			<a
				class="opcion-vista"
				href={enlaceFormato(f.valor)}
				aria-current={formato === f.valor ? 'page' : undefined}
				><svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
					{@html f.icono}</svg
				>{f.texto}</a
			>
		{/each}
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</nav>
</div>

{#if formato === 'matriz'}
	<MatrizMensual
		partidas={enOrden}
		{mes}
		{hoy}
		{ejecuciones}
		titulo="titulo-mensual"
		{enlaceReportes}
	/>
{:else if filas.length === 0}
	<p class="sin-resultados lista-vacia">No hay partidas con trabajo en {textoMes(mes)}.</p>
{:else}
	<section class="lista-mensual" aria-labelledby="titulo-mensual">
		{#each grupos as grupo (grupo.estado)}
			<h3 class="grupo-lista e-{TONO[grupo.estado]}">
				<span class="punto"></span>{GRUPO[grupo.estado]}
				<span class="cuenta-grupo">{grupo.filas.length}</span>
			</h3>
			<ul class="filas">
				{#each grupo.filas as { partida, celda, estado } (partida.id)}
					{@const notas = [...anotacionesCelda(celda), detalleCelda(celda, hoy)].filter(Boolean)}
					{@const total = meta(celda)}
					{@const hechas = Math.min(ejecutado(celda), total)}
					{@const documental = estadoDocumental(celda)}
					<li class="fila-lista">
						<span class="numero">{partida.numero}</span>
						<div class="partida-lista">
							<p class="actividad-lista">{textoOracion(partida.actividad)}</p>
							<p class="meta-lista">
								<span class="insignia-periodicidad"
									>{ETIQUETA_PERIODICIDAD[partida.periodicidad]}</span
								>
								{#if notas.length}<span>{notas.join(' · ')}</span>{/if}
							</p>
						</div>
						<div class="estado-lista">
							<span class="pastilla e-{TONO[estado]}"
								><span class="punto"></span>{ETIQUETA_EJECUCION[estado]}</span
							>
							<span class="documento-lista {documental}"
								>{textoDocumental(celda) || 'Sin documento'}</span
							>
						</div>
						<div class="avance-lista e-{TONO[estado]}">
							{#if total > 0}
								<span class="cifra-avance">{hechas} de {total}</span>
								<span class="barra" aria-hidden="true"
									><span style:width="{Math.round((hechas * 100) / total)}%"></span></span
								>
							{:else}
								<span class="cifra-avance">—</span>
							{/if}
						</div>
						<div class="acciones-lista">
							<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							{#if celda.reportesAbiertos.length}
								<a
									class="boton primario"
									href={resolve('/reportes/[id]', { id: celda.reportesAbiertos[0].id })}
									>Continuar borrador</a
								>
							{:else if faltan(celda) > 0}
								<a
									class="boton primario"
									href={`${resolve('/captura')}?${consultaCaptura(partida.id, celda.mes, reprogramacionPendiente(celda))}`}
									aria-label={`Capturar partida ${partida.numero} de ${textoMes(celda.mes)}`}
									>Capturar</a
								>
							{/if}
							{#if celda.reportes.length}
								<a
									class="boton contorno"
									href={enlaceReportes(partida.id, celda.mes)}
									aria-label={`Ver ${plural(celda.reportes.length, 'reporte emitido', 'reportes emitidos')} de la partida ${partida.numero} en ${textoMes(celda.mes)}`}
									>Ver {celda.reportes.length === 1 ? 'reporte' : 'reportes'}</a
								>
							{/if}
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{#if puedeAjustar && (faltan(celda) > 0 || celda.ajustes.length)}
								<button
									type="button"
									class="boton contorno"
									aria-label={`Ajustes de la partida ${partida.numero} en ${textoMes(celda.mes)}`}
									title="Reprogramar o marcar no ejecutado"
									on:click={() => dispatch('ajustar', { partida, celda })}>Ajustar</button
								>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/each}
	</section>
{/if}
