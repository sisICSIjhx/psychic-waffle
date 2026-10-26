<!-- Programa anual (diseño «Nueva versión programa anual»): encabezado con vistas y exportación,
     filtros, indicadores del ciclo, leyenda, búsqueda y matriz de partidas por mes. Cada celda es una
     tarjeta con el estado de ejecución, el documental y «Visualizar»; elegirla abre un panel con sus
     datos y acciones (capturar o continuar, ajustar y registrar un realizado externo). Vistas mensual
     y semanal aparte (la semanal con la misma matriz). Estilos y tokens --pa-* de ambos temas en
     planeacion/programa.css, bajo el contenedor .programa-anual. -->
<script lang="ts">
	import '$lib/components/planeacion/programa.css';
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ETIQUETA_PERIODICIDAD } from '$lib/dominio/captura';
	import {
		anotacionesCelda,
		conReporteEnRevision,
		detalleCelda,
		ejecutado,
		esperado,
		ETIQUETA_EJECUCION,
		estadoDocumental,
		estadoEjecucion,
		faltan,
		objetivo,
		textoDocumental,
		type EjecucionDelMes,
		type EstadoEjecucion
	} from '$lib/dominio/cumplimiento';
	import { plural, textoMes, textoOracion } from '$lib/dominio/textos';
	import type {
		Ajuste,
		AvancePrograma,
		CeldaPrograma,
		Contrato,
		Programa,
		Sitio
	} from '$lib/dominio/esquemas';
	import type { FiltroPlaneacion, PendienteVencido } from '$lib/dominio/planeacion';
	import Aviso from '$lib/components/catalogo/Aviso.svelte';
	import DialogoAjuste from '$lib/components/planeacion/DialogoAjuste.svelte';
	import VistaMensual from '$lib/components/planeacion/VistaMensual.svelte';
	import VistaSemanal from '$lib/components/planeacion/VistaSemanal.svelte';
	import { llamarAccion } from '$lib/components/reportes/acciones';
	import EncabezadoPagina from '$lib/components/ui/EncabezadoPagina.svelte';
	import { notificaciones } from '$lib/components/ui/notificaciones';

	type Partida = AvancePrograma['partidas'][number];

	export let hoy = '';
	export let contratos: Contrato[] = [];
	export let contrato: Contrato | null = null;
	export let sitios: Sitio[] = [];
	export let sitio: Sitio | null = null;
	export let programas: Programa[] = [];
	export let programa: Programa | null = null;
	export let meses: string[] = [];
	export let partidas: Partida[] = [];
	export let totalPartidas = 0;
	export let vencidos: PendienteVencido[] = [];
	export let filtro: FiltroPlaneacion = {};
	export let vista: 'anual' | 'mensual' | 'semanal' = 'anual';
	export let mesVista: string | null = null;
	export let semana = 1;
	export let ejecucionesMes: EjecucionDelMes[] = [];
	export let form: Record<string, unknown> | null = null;

	/** Trazos de los iconos (24 × 24, línea de 2 px), como en el riel de navegación. */
	const ICONOS = {
		calendario:
			'<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
		calendarioDias:
			'<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
		barras: '<path d="M5 21v-6M12 21V3M19 21V9"/>',
		descargar:
			'<path d="M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
		flecha: '<path d="m6 9 6 6 6-6"/>',
		documento:
			'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
		ubicacion:
			'<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
		cuadricula:
			'<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
		buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
		embudo:
			'<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>',
		ejecutado: '<path d="M20 6 9 17l-5-5"/>',
		pendiente: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
		programado:
			'<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
		vencido:
			'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
		no_ejecutado: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
		cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
		siguiente: '<path d="M5 12h14M13 6l6 6-6 6"/>'
	} as const;

	const VISTAS = [
		{ valor: 'anual', texto: 'Anual', icono: ICONOS.calendario },
		{ valor: 'mensual', texto: 'Mensual', icono: ICONOS.calendarioDias },
		{ valor: 'semanal', texto: 'Semanal', icono: ICONOS.barras }
	] as const;

	/** Estados de la leyenda; «Adicional» (realizado sin programar) se explica en su celda. */
	const LEYENDA: EstadoEjecucion[] = [
		'ejecutado',
		'pendiente',
		'programado',
		'vencido',
		'reprogramado',
		'no_ejecutado'
	];

	/** Indicadores del ciclo: cada celda programada (partida y mes) cuenta una vez. */
	const INDICADORES = [
		{ estado: 'ejecutado', texto: 'Ejecutadas' },
		{ estado: 'pendiente', texto: 'Pendientes' },
		{ estado: 'programado', texto: 'Programadas' },
		{ estado: 'vencido', texto: 'Vencidas' },
		{ estado: 'no_ejecutado', texto: 'No ejecutadas' }
	] as const;

	/** Texto del estado dentro de la tarjeta de la celda (el nombre completo va en el nombre oculto). */
	const ESTADO_CELDA: Record<EstadoEjecucion, string> = {
		...ETIQUETA_EJECUCION,
		extra: 'Adicional'
	};

	/** Tono de color de cada estado de ejecución. */
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

	/** Consulta de una captura nueva con contrato, sitio, partida, mes y, si aplica, la reprogramación. */
	const consultaCaptura = (partidaId: string, mes: string, reprogramacion?: string) =>
		`contrato=${contrato?.id}&sitio=${sitio?.id}&partida=${partidaId}&mes=${mes}${reprogramacion ? `&reprogramacion=${reprogramacion}` : ''}`;

	/** Consulta de los reportes emitidos de la partida en el mes. */
	const consultaHistorial = (partidaId: string, mes: string) =>
		`contrato=${contrato?.id}&sitio=${sitio?.id}&partida=${partidaId}&desde=${mes.slice(0, 7)}&hasta=${mes.slice(0, 7)}&estado=emitido`;

	/** Dirección de la planeación con los filtros actuales y la vista, el mes y la semana dados. */
	function enlaceVista(otra: string, mes?: string | null, numero?: number): string {
		const consulta = [
			contrato ? `contrato=${contrato.id}` : '',
			sitio ? `sitio=${sitio.id}` : '',
			programa ? `programa=${programa.id}` : '',
			filtro.distribucion ? `distribucion=${filtro.distribucion}` : '',
			filtro.periodicidad ? `periodicidad=${filtro.periodicidad}` : '',
			otra !== 'anual' ? `vista=${otra}` : '',
			otra !== 'anual' && mes ? `mes=${mes}` : '',
			otra === 'semanal' && numero ? `semana=${numero}` : ''
		].filter(Boolean);
		return `${resolve('/planeacion')}${consulta.length ? `?${consulta.join('&')}` : ''}`;
	}

	/** Reprogramación que llega a la celda y aún falta por reportar, para «Capturar». */
	const reprogramacionPendiente = (c: CeldaPrograma) =>
		c.ajustes.find(
			(a) => a.tipo === 'reprogramado' && a.mesDestino === c.mes && a.ejecuciones < a.cantidad
		)?.id;

	/** Nombre accesible de la celda: partida, mes, programado, ejecutado y ambos estados. */
	function nombreCelda(p: Partida, c: CeldaPrograma): string {
		const documental = textoDocumental(c);
		const notas = [...anotacionesCelda(c), detalleCelda(c, hoy)].filter(Boolean).join(', ');
		return `Partida ${p.numero}, ${textoMes(c.mes)}: programado ${c.programado ?? 0}, ejecutado ${ejecutado(c)}, ${ETIQUETA_EJECUCION[estadoEjecucion(c, hoy)]}${documental ? `, ${documental}` : ''}${notas ? `, ${notas}` : ''}`;
	}

	/** Segunda línea de la tarjeta: el documento o, si no aplica, la reprogramación de la celda. */
	function documentoCelda(c: CeldaPrograma): string {
		switch (estadoDocumental(c)) {
			case 'con_reporte':
				return 'Con reporte';
			case 'reporte_en_borrador':
				return conReporteEnRevision(c) ? 'En revisión' : 'Borrador';
			case 'sin_reporte':
				return 'Sin reporte';
			default:
				return anotacionesCelda(c)[0] ?? 'Sin documento';
		}
	}

	/**
	 * Por qué el mes tiene esa cantidad programada: semanal y quincenal cuentan las semanas o quincenas
	 * marcadas en el programa anual; diaria, los días del mes; el resto, una ejecución por mes marcado.
	 */
	function explicacionProgramado(p: Partida, c: CeldaPrograma): string {
		const n = c.programado ?? 0;
		const mes = textoMes(c.mes);
		const periodicidad = ETIQUETA_PERIODICIDAD[p.periodicidad];
		let base: string;
		if (p.periodicidad === 'cuando_aplique') {
			base = 'Cuando aplique: no tiene cantidad fija en el programa anual.';
		} else if (n <= 0) {
			base = `${periodicidad}: el programa anual no marca ${mes}.`;
		} else if (p.periodicidad === 'diaria') {
			base = `Diaria: ${plural(n, 'día programado', 'días programados')} en ${mes}, uno por día del mes.`;
		} else if (p.periodicidad === 'semanal') {
			base = `Semanal: el programa anual marca ${plural(n, 'semana', 'semanas')} en ${mes}; una ejecución por semana.`;
		} else if (p.periodicidad === 'quincenal') {
			base = `Quincenal: el programa anual marca ${plural(n, 'quincena', 'quincenas')} en ${mes}; una ejecución por quincena.`;
		} else {
			base = `${periodicidad}: el programa anual marca ${mes} con ${plural(n, 'ejecución', 'ejecuciones')}.`;
		}
		const meta = esperado(c);
		const ajustado = objetivo(c) !== n || (c.noEjecutado ?? 0) > 0;
		return ajustado
			? `${base} Con los ajustes, el mes espera ${plural(meta, 'ejecución', 'ejecuciones')}.`
			: base;
	}

	/** «Visualizar» abre el borrador, el único reporte emitido o la lista de emitidos del mes. */
	function enlaceVisualizar(p: Partida, c: CeldaPrograma): string | null {
		const abierto = c.reportesAbiertos[0];
		if (abierto) return resolve('/reportes/[id]', { id: abierto.id });
		if (c.reportes.length === 1) return resolve('/reportes/[id]', { id: c.reportes[0] });
		if (c.reportes.length > 1) return `${resolve('/historial')}?${consultaHistorial(p.id, c.mes)}`;
		return null;
	}

	$: vencidosPorMes = [...new Set(vencidos.map((v) => v.mes))].map((mes) => ({
		mes,
		pendientes: vencidos.filter((v) => v.mes === mes)
	}));

	// Indicadores del ciclo con los filtros del servidor (no cambian con la búsqueda).
	$: conteo = (() => {
		const cuenta: Record<string, number> = {};
		for (const p of partidas) {
			for (const c of p.celdas) {
				const estado = estadoEjecucion(c, hoy);
				cuenta[estado] = (cuenta[estado] ?? 0) + 1;
			}
		}
		return cuenta;
	})();
	$: totalCeldas = INDICADORES.reduce((suma, i) => suma + (conteo[i.estado] ?? 0), 0);
	const porcentajeDe = (n: number, total: number) => (total ? Math.round((n * 100) / total) : 0);

	/** Años del ciclo con su número de meses, para la primera fila del encabezado. */
	$: anios = meses.reduce<{ anio: string; meses: number }[]>((grupos, mes) => {
		const ultimo = grupos[grupos.length - 1];
		if (ultimo?.anio === mes.slice(0, 4)) ultimo.meses++;
		else grupos.push({ anio: mes.slice(0, 4), meses: 1 });
		return grupos;
	}, []);

	// Búsqueda y filtro por estado en la matriz (en el navegador, sobre las partidas cargadas).
	let busqueda = '';
	let estadoFiltro: EstadoEjecucion | '' = '';
	let menuFiltro: HTMLDetailsElement | undefined;
	const normalizar = (texto: string) =>
		texto
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase();
	$: terminos = normalizar(busqueda.trim()).split(/\s+/).filter(Boolean);
	$: visibles = partidas.filter((p) => {
		const texto = normalizar(`${p.numero} ${p.actividad} ${ETIQUETA_PERIODICIDAD[p.periodicidad]}`);
		const coincide = terminos.every((t) => texto.includes(t));
		const conEstado =
			!estadoFiltro || p.celdas.some((c) => estadoEjecucion(c, hoy) === estadoFiltro);
		return coincide && conEstado;
	});
	function elegirFiltro(valor: EstadoEjecucion | '') {
		estadoFiltro = valor;
		if (menuFiltro) menuFiltro.open = false;
	}
	function limpiarBusqueda() {
		busqueda = '';
		estadoFiltro = '';
	}

	// Lista de vencimientos: la abre el indicador «Vencidas».
	let vencidosAbiertos = false;

	function enviarAlCambiar(evento: Event) {
		(evento.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}

	// Exportación de la matriz visible a CSV (Excel): una columna por mes con estado, documento y R/P.
	let menuExportar: HTMLDetailsElement | undefined;
	function exportarCsv() {
		const campo = (valor: string | number) => `"${String(valor).replace(/"/g, '""')}"`;
		const filas = [
			[
				'Partida',
				'Actividad',
				'Periodicidad',
				...meses.map((m) => textoMes(m)),
				'Realizado / programado'
			],
			...visibles.map((p) => [
				p.numero,
				textoOracion(p.actividad),
				ETIQUETA_PERIODICIDAD[p.periodicidad],
				...p.celdas.map((c) => {
					const estado = estadoEjecucion(c, hoy);
					if (estado === 'sin_programa') return '';
					const documento = textoDocumental(c);
					return `${ETIQUETA_EJECUCION[estado]}${documento ? ` · ${documento}` : ''} · R${c.realizado}/P${c.programado ?? 0}`;
				}),
				`${p.totalRealizado} / ${p.totalProgramado}`
			])
		];
		const csv = `\uFEFF${filas.map((f) => f.map(campo).join(',')).join('\r\n')}`;
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const enlace = document.createElement('a');
		enlace.href = url;
		enlace.download = `programa-anual-${sitio?.clave ?? 'sitio'}-${programa?.periodoInicio.slice(0, 7) ?? ''}.csv`;
		enlace.click();
		URL.revokeObjectURL(url);
		if (menuExportar) menuExportar.open = false;
	}

	// Ajustes: un solo diálogo para la celda elegida en la matriz, la vista mensual o los vencidos.
	let ajuste: { partida: Partida; celda: CeldaPrograma } | null = null;
	let dialogoAbierto = false;
	let errorAjuste = '';
	let dialogo: DialogoAjuste | undefined;

	async function abrirAjuste(partida: Partida, celda: CeldaPrograma) {
		ajuste = { partida, celda };
		errorAjuste = '';
		dialogoAbierto = true;
		await dialogo?.reiniciar();
	}

	function abrirVencido(v: PendienteVencido) {
		const partida = partidas.find((p) => p.id === v.partidaId);
		const celda = partida?.celdas.find((c) => c.mes === v.mes);
		if (partida && celda) abrirAjuste(partida, celda);
	}

	// Mientras el diálogo está abierto, la celda se actualiza con los datos recargados.
	$: if (ajuste) {
		const partida = partidas.find((p) => p.id === ajuste!.partida.id);
		const celda = partida?.celdas.find((c) => c.mes === ajuste!.celda.mes);
		if (partida && celda && celda !== ajuste.celda) ajuste = { partida, celda };
	}

	async function deshacerAjuste(a: Ajuste) {
		const datos = new FormData();
		datos.set('id', a.id);
		const resultado = await llamarAccion('anularAjuste', datos, resolve('/planeacion'));
		if (!resultado.ok) {
			notificaciones.mostrar({ mensaje: String(resultado.datos.error ?? 'No se pudo deshacer.') });
		}
		await invalidateAll();
	}

	const alEnviar =
		(accion: 'registrarAjuste' | 'anularAjuste'): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') {
				errorAjuste = String(result.data?.error ?? 'No se pudo guardar el ajuste.');
				// El diálogo se cerró al confirmar: el error se muestra dentro, de nuevo abierto.
				dialogoAbierto = true;
				return;
			}
			errorAjuste = '';
			await update({ reset: false });
			if (result.type === 'success' && accion === 'registrarAjuste') {
				const registrado = result.data?.ajuste as Ajuste | undefined;
				if (registrado) {
					notificaciones.mostrar({
						mensaje:
							registrado.tipo === 'reprogramado'
								? `Se reprogramó ${plural(registrado.cantidad, 'ejecución', 'ejecuciones')} a ${textoMes(registrado.mesDestino!)}.`
								: `Se marcó ${plural(registrado.cantidad, 'ejecución', 'ejecuciones')} como no ejecutada.`,
						textoDeshacer: 'Deshacer',
						plazo: 10_000,
						alDeshacer: () => deshacerAjuste(registrado)
					});
				}
			}
		};

	$: avisoGeneral = (form?.accion ? null : form) as { mensaje?: string; error?: string } | null;

	/** «Mayo–Septiembre 2026» o, si cambia el año, «Noviembre 2025–Enero 2026». */
	function rangoDeMeses(desde: string, hasta: string): string {
		if (desde === hasta) return textoMes(desde, { inicial: true });
		const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
		const inicio = textoMes(desde, { inicial: true });
		return `${mismoAnio ? inicio.split(' ')[0] : inicio}–${textoMes(hasta, { inicial: true })}`;
	}

	// Celda elegida en la matriz: el panel lateral reúne sus datos y acciones.
	let seleccion: { partidaId: string; mes: string } | null = null;
	$: elegida = (() => {
		if (!seleccion) return null;
		const partida = partidas.find((p) => p.id === seleccion!.partidaId);
		const celda = partida?.celdas.find((c) => c.mes === seleccion!.mes);
		return partida && celda ? { partida, celda } : null;
	})();
	let panel: HTMLElement | undefined;

	async function seleccionar(partida: Partida, celda: CeldaPrograma) {
		const misma = seleccion?.partidaId === partida.id && seleccion.mes === celda.mes;
		seleccion = misma ? null : { partidaId: partida.id, mes: celda.mes };
		if (misma) return;
		await tick();
		panel?.focus();
	}

	async function cerrarPanel() {
		const anterior = seleccion;
		seleccion = null;
		await tick();
		if (anterior) document.getElementById(`celda-${anterior.partidaId}-${anterior.mes}`)?.focus();
	}

	/** La matriz se desplaza a lo ancho con la partida fija; el pie dice hacia dónde hay más meses. */
	let contenedorTabla: HTMLDivElement | undefined;
	let desborda = false;
	let alFinal = false;
	function medirTabla() {
		if (!contenedorTabla) return;
		const { scrollLeft, scrollWidth, clientWidth } = contenedorTabla;
		desborda = scrollWidth > clientWidth + 1;
		alFinal = scrollLeft + clientWidth >= scrollWidth - 1;
	}
	function desplazarTabla() {
		contenedorTabla?.scrollTo({
			left: alFinal ? 0 : contenedorTabla.scrollWidth,
			behavior: 'smooth'
		});
	}
	onMount(() => {
		const observador = new ResizeObserver(medirTabla);
		if (contenedorTabla) observador.observe(contenedorTabla);
		return () => observador.disconnect();
	});
	$: if (contenedorTabla && (elegida || !elegida || visibles)) tick().then(medirTabla);

	// Registro de un realizado hecho fuera del sistema; el panel lo abre con la partida y el mes elegidos.
	let registroAbierto = false;
	let manualPartida = '';
	let manualMes = '';
	async function registrarExterno(partidaId?: string, mes?: string) {
		manualPartida = partidaId ?? partidas[0]?.id ?? '';
		manualMes = mes ?? meses.find((m) => m.slice(0, 7) === hoy.slice(0, 7)) ?? meses[0] ?? '';
		registroAbierto = true;
		await tick();
		document.getElementById('manual-cantidad')?.focus();
	}
</script>

<!-- Esc cierra el panel de la celda (si no hay un diálogo abierto encima). -->
<svelte:window
	on:keydown={(e) => e.key === 'Escape' && elegida && !dialogoAbierto && cerrarPanel()}
/>

<div class="programa-anual">
	<EncabezadoPagina
		ceja={`Programa / ${VISTAS.find((v) => v.valor === vista)?.texto ?? 'Anual'}`}
		titulo="Programa anual"
		descripcion="Consulte y gestione el avance de sus partidas por contrato, sitio y periodo."
	>
		<svelte:fragment slot="acciones">
			{#if programa}
				<div class="acciones-programa">
					<nav class="selector-vista" aria-label="Vista de la planeación">
						<!-- enlaceVista aplica resolve() a la ruta; los filtros van en la consulta. -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						{#each VISTAS as v (v.valor)}
							<a
								class="opcion-vista"
								href={enlaceVista(v.valor, mesVista, semana)}
								aria-current={vista === v.valor ? 'page' : undefined}
								><svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
									><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
									{@html v.icono}</svg
								>{v.texto}</a
							>
						{/each}
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</nav>
					{#if vista === 'anual'}
						<details class="menu-desplegable menu-exportar" bind:this={menuExportar}>
							<summary class="boton-programa"
								><svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
									><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
									{@html ICONOS.descargar}</svg
								>
								Exportar
								<svg
									class="flecha"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
									><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
									{@html ICONOS.flecha}</svg
								></summary
							>
							<div class="opciones-menu">
								<button type="button" class="opcion-menu" on:click={exportarCsv}
									>Matriz en CSV (Excel)</button
								>
								<p class="nota-menu">Partidas visibles con estado, documento y R/P de cada mes.</p>
							</div>
						</details>
					{/if}
				</div>
			{/if}
		</svelte:fragment>
	</EncabezadoPagina>

	{#if contratos.length === 0}
		<p class="view-note">
			No hay contratos. Regístrelos e importe su programa en el
			<a class="enlace" href={resolve('/catalogo')}>catálogo</a>.
		</p>
	{:else}
		<form method="GET" class="filtros" aria-label="Programa y filtros">
			<div class="filtro">
				<label for="contrato">Contrato</label>
				<div class="control con-icono">
					<svg
						class="icono-campo"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
						{@html ICONOS.documento}</svg
					>
					<select id="contrato" name="contrato" on:change={enviarAlCambiar}>
						{#each contratos as c (c.id)}
							<option value={c.id} selected={c.id === contrato?.id}
								>{c.cliente?.nombre ?? ''} · {c.numero}</option
							>
						{/each}
					</select>
				</div>
			</div>
			<div class="filtro">
				<label for="sitio">Sitio</label>
				<div class="control con-icono">
					<svg
						class="icono-campo"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
						{@html ICONOS.ubicacion}</svg
					>
					<select id="sitio" name="sitio" on:change={enviarAlCambiar}>
						{#each sitios as s (s.id)}
							<option value={s.id} selected={s.id === sitio?.id}>{s.clave} · {s.nombre}</option>
						{/each}
					</select>
				</div>
			</div>
			{#if programas.length > 1}
				<div class="filtro">
					<label for="programa">Programa</label>
					<div class="control">
						<select id="programa" name="programa" on:change={enviarAlCambiar}>
							{#each programas as p (p.id)}
								<option value={p.id} selected={p.id === programa?.id}
									>{p.periodoInicio} a {p.periodoFin}</option
								>
							{/each}
						</select>
					</div>
				</div>
			{/if}
			<div class="filtro">
				<label for="distribucion"
					><svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
						{@html ICONOS.cuadricula}</svg
					>Distribución</label
				>
				<div class="control">
					<select id="distribucion" name="distribucion" on:change={enviarAlCambiar}>
						<option value="">Todas</option>
						<option value="produccion" selected={filtro.distribucion === 'produccion'}
							>Producción</option
						>
						<option value="mantenimiento" selected={filtro.distribucion === 'mantenimiento'}
							>Mantenimiento</option
						>
					</select>
				</div>
			</div>
			<div class="filtro">
				<label for="periodicidad"
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
					>Periodicidad</label
				>
				<div class="control">
					<select id="periodicidad" name="periodicidad" on:change={enviarAlCambiar}>
						<option value="">Todas</option>
						{#each Object.entries(ETIQUETA_PERIODICIDAD) as [valor, etiqueta] (valor)}
							<option value={valor} selected={filtro.periodicidad === valor}>{etiqueta}</option>
						{/each}
					</select>
				</div>
			</div>
			{#if vista !== 'anual'}<input type="hidden" name="vista" value={vista} />{/if}
			{#if vista !== 'anual' && mesVista}<input type="hidden" name="mes" value={mesVista} />{/if}
			<noscript><button class="boton" type="submit">Filtrar</button></noscript>
		</form>
	{/if}

	{#if contrato && sitio && !programa}
		<p class="aviso aviso-alerta">
			{sitio.clave}
			{sitio.nombre} no tiene programa anual. Impórtelo con el catálogo de Excel en el
			<a class="enlace" href={resolve('/catalogo/contratos/[id]', { id: contrato.id })}>contrato</a
			>.
		</p>
	{/if}

	{#if programa}
		{#if vista === 'mensual' && mesVista}
			<section class="card" aria-labelledby="titulo-mensual">
				<h2 id="titulo-mensual" class="view-heading">Vista mensual</h2>
				<VistaMensual
					{partidas}
					mes={mesVista}
					{meses}
					{hoy}
					{consultaCaptura}
					enlaceMes={(mes) => enlaceVista('mensual', mes)}
					on:ajustar={(e) => abrirAjuste(e.detail.partida, e.detail.celda)}
				/>
			</section>
		{:else if vista === 'semanal' && mesVista}
			<VistaSemanal
				{partidas}
				mes={mesVista}
				{meses}
				{hoy}
				ejecuciones={ejecucionesMes}
				enlaceSemana={(mes, numero) => enlaceVista('semanal', mes, numero)}
				enlaceReportes={(partidaId, mes) =>
					`${resolve('/historial')}?${consultaHistorial(partidaId, mes)}`}
			/>
		{:else}
			<section class="indicadores" aria-label="Indicadores del ciclo">
				<div
					class="indicador e-total"
					title="Cada celda programada (partida y mes) del ciclo cuenta una vez"
				>
					<div class="cuerpo-indicador">
						<span class="icono-indicador"
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
						<div class="datos-indicador">
							<span class="etiqueta-indicador">Total programado</span>
							<span class="cifra-indicador"
								>{totalCeldas} <span class="sufijo-indicador">en el ciclo</span></span
							>
						</div>
					</div>
					<span class="barra" aria-hidden="true"><span style:width="100%"></span></span>
				</div>
				{#each INDICADORES as indicador (indicador.estado)}
					{@const cantidad = conteo[indicador.estado] ?? 0}
					{@const porcentaje = porcentajeDe(cantidad, totalCeldas)}
					{#if indicador.estado === 'vencido' && vencidos.length}
						<button
							type="button"
							class="indicador e-{TONO[indicador.estado]} interactivo"
							aria-expanded={vencidosAbiertos}
							aria-controls="lista-vencidos"
							on:click={() => (vencidosAbiertos = !vencidosAbiertos)}
						>
							<span class="cuerpo-indicador">
								<span class="icono-indicador"
									><svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
										><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
										{@html ICONOS[indicador.estado]}</svg
									></span
								>
								<span class="datos-indicador">
									<span class="etiqueta-indicador">{indicador.texto}</span>
									<span class="cifra-indicador"
										>{cantidad} <span class="porcentaje">{porcentaje}%</span></span
									>
								</span>
								<svg
									class="flecha-indicador"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
									><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
									{@html ICONOS.flecha}</svg
								>
							</span>
							<span class="sr-only">: ver {plural(vencidos.length, 'vencimiento')}</span>
							<span class="barra" aria-hidden="true"><span style:width="{porcentaje}%"></span></span
							>
						</button>
					{:else}
						<div class="indicador e-{TONO[indicador.estado]}">
							<div class="cuerpo-indicador">
								<span class="icono-indicador"
									><svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
										><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
										{@html ICONOS[indicador.estado]}</svg
									></span
								>
								<div class="datos-indicador">
									<span class="etiqueta-indicador">{indicador.texto}</span>
									<span class="cifra-indicador"
										>{cantidad} <span class="porcentaje">{porcentaje}%</span></span
									>
								</div>
							</div>
							<span class="barra" aria-hidden="true"><span style:width="{porcentaje}%"></span></span
							>
						</div>
					{/if}
				{/each}
			</section>

			{#if vencidos.length && vencidosAbiertos}
				<section class="vencidos" id="lista-vencidos" aria-labelledby="titulo-vencidos">
					<div class="cabecera-vencidos">
						<h2 id="titulo-vencidos" class="titulo-vencidos">
							{plural(vencidos.length, 'vencimiento')} · {rangoDeMeses(
								vencidosPorMes[0].mes,
								vencidosPorMes[vencidosPorMes.length - 1].mes
							)}
						</h2>
						<button class="cerrar-panel" type="button" on:click={() => (vencidosAbiertos = false)}
							>Cerrar <svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								aria-hidden="true"
								><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
								{@html ICONOS.cerrar}</svg
							></button
						>
					</div>
					{#each vencidosPorMes as grupo (grupo.mes)}
						<h3 class="mes-vencido">
							{textoMes(grupo.mes, { inicial: true })} ({grupo.pendientes.length})
						</h3>
						<ul class="lista-vencidos">
							{#each grupo.pendientes as v (v.partidaId)}
								<li>
									<span class="texto-vencido"
										>Partida {v.numero}.- {textoOracion(v.actividad)}
										{v.faltan > 1 ? `(faltan ${v.faltan})` : ''}</span
									>
									<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
									<!-- eslint-disable svelte/no-navigation-without-resolve -->
									<a
										class="enlace"
										href={`${resolve('/captura')}?${consultaCaptura(v.partidaId, v.mes)}`}
										>Capturar</a
									>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
									<button
										type="button"
										class="enlace-accion"
										on:click={() => abrirVencido(v)}
										aria-label={`Reprogramar o marcar no ejecutada la partida ${v.numero} de ${textoMes(v.mes)}`}
										>Reprogramar o no ejecutado</button
									>
								</li>
							{/each}
						</ul>
					{/each}
				</section>
			{/if}

			<section class="cabecera-matriz" aria-labelledby="titulo-matriz">
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
						<h2 id="titulo-matriz" class="titulo-matriz">Programado (P) y realizado (R)</h2>
						<p class="subtitulo-matriz">
							{visibles.length} de {plural(totalPartidas, 'partida')} · {textoMes(
								programa.periodoInicio
							)} a {textoMes(programa.periodoFin)}
						</p>
					</div>
				</div>
				<ul class="leyenda" aria-label="Leyenda de la matriz">
					{#each LEYENDA as estado (estado)}
						<li class="e-{TONO[estado]}">
							<span class="punto"></span>{ETIQUETA_EJECUCION[estado]}
						</li>
					{/each}
				</ul>
			</section>

			<div class="barra-busqueda">
				<div class="campo-busqueda">
					<svg
						class="icono-campo"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
						{@html ICONOS.buscar}</svg
					>
					<input
						type="search"
						bind:value={busqueda}
						placeholder="Buscar por número de partida o actividad…"
						aria-label="Buscar partidas"
					/>
				</div>
				<details class="menu-desplegable menu-filtro" bind:this={menuFiltro}>
					<summary
						class="boton-programa boton-icono"
						class:activo={!!estadoFiltro}
						aria-label={estadoFiltro
							? `Filtrar por estado: ${ETIQUETA_EJECUCION[estadoFiltro]}`
							: 'Filtrar por estado'}
						title="Filtrar por estado"
						><svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
							{@html ICONOS.embudo}</svg
						></summary
					>
					<div class="opciones-menu" role="group" aria-label="Mostrar partidas con">
						<p class="nota-menu">Mostrar partidas con al menos un mes:</p>
						<button
							type="button"
							class="opcion-menu"
							aria-pressed={estadoFiltro === ''}
							on:click={() => elegirFiltro('')}>Todas las partidas</button
						>
						{#each LEYENDA as estado (estado)}
							<button
								type="button"
								class="opcion-menu e-{TONO[estado]}"
								aria-pressed={estadoFiltro === estado}
								on:click={() => elegirFiltro(estado)}
								><span class="punto"></span>{ETIQUETA_EJECUCION[estado]}</button
							>
						{/each}
					</div>
				</details>
			</div>

			<div class="espacio-programa" class:con-panel={!!elegida}>
				<section class="matriz-programa" aria-label="Matriz del programa">
					<p class="sr-only" aria-live="polite">
						{elegida
							? `Selección: Partida ${elegida.partida.numero} / ${textoMes(elegida.celda.mes, { inicial: true, corto: true })}`
							: 'Elija una celda para ver sus acciones'}
					</p>
					<div
						class="tabla-desplazable"
						bind:this={contenedorTabla}
						on:scroll={medirTabla}
						role="region"
						aria-labelledby="titulo-matriz"
						tabindex="-1"
					>
						<table class="matriz">
							<thead>
								<tr class="fila-anios">
									<th scope="col" rowspan="2" class="columna-numero">#</th>
									<th scope="col" rowspan="2" class="columna-partida">Partida</th>
									<th scope="col" rowspan="2" class="columna-periodicidad">Periodicidad</th>
									{#each anios as grupo, i (grupo.anio)}
										<th
											scope="colgroup"
											colspan={grupo.meses}
											class="anio"
											class:anio-actual={grupo.anio === hoy.slice(0, 4)}
											class:anio-par={i % 2 === 1}>{grupo.anio}</th
										>
									{/each}
									<th scope="col" rowspan="2" class="columna-total">Total</th>
								</tr>
								<tr class="fila-meses">
									{#each meses as mes (mes)}
										<th
											scope="col"
											class="columna-mes"
											class:mes-actual={mes.slice(0, 7) === hoy.slice(0, 7)}
											><span aria-hidden="true">{textoMes(mes, { corto: true }).slice(0, 3)}</span
											><span class="sr-only">{textoMes(mes)}</span></th
										>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each visibles as p (p.id)}
									<tr class:fila-elegida={elegida?.partida.id === p.id}>
										<td class="columna-numero">{p.numero}</td>
										<th scope="row" class="columna-partida">{textoOracion(p.actividad)}</th>
										<td class="columna-periodicidad"
											><span class="insignia-periodicidad"
												>{ETIQUETA_PERIODICIDAD[p.periodicidad]}</span
											></td
										>
										{#each p.celdas as celda (celda.mes)}
											{@const estado = estadoEjecucion(celda, hoy)}
											{@const documental = estadoDocumental(celda)}
											{@const elegidaAqui =
												elegida?.partida.id === p.id && elegida.celda.mes === celda.mes}
											{@const enlace = enlaceVisualizar(p, celda)}
											{@const meta = esperado(celda) + (celda.noEjecutado ?? 0)}
											<td
												class="celda {estado}"
												class:mes-actual={celda.mes.slice(0, 7) === hoy.slice(0, 7)}
												class:elegida={elegidaAqui}
											>
												{#if estado !== 'sin_programa' || celda.ajustes.length || celda.realizado > 0}
													<div class="tarjeta-celda e-{TONO[estado]}">
														<button
															id={`celda-${p.id}-${celda.mes}`}
															type="button"
															class="boton-celda"
															aria-pressed={elegidaAqui}
															title={[...anotacionesCelda(celda), detalleCelda(celda, hoy)]
																.filter(Boolean)
																.join(' · ') || ETIQUETA_EJECUCION[estado]}
															on:click={() => seleccionar(p, celda)}
														>
															<span class="sr-only">{nombreCelda(p, celda)}</span>
															<span class="linea-celda estado" aria-hidden="true"
																><span class="punto"></span><span class="texto-linea"
																	>{ESTADO_CELDA[estado]}</span
																>{#if meta > 1}<span class="cuenta"
																		>{Math.min(ejecutado(celda), meta)}/{meta}</span
																	>{/if}</span
															>
															<span
																class="linea-celda documento {documental}"
																class:alerta={documental === 'sin_reporte' && estado === 'vencido'}
																aria-hidden="true"
																><span class="punto"></span><span class="texto-linea"
																	>{documentoCelda(celda)}</span
																></span
															>
														</button>
														{#if enlace}
															<!-- enlaceVisualizar aplica resolve() a la ruta; los filtros van en la consulta. -->
															<!-- eslint-disable svelte/no-navigation-without-resolve -->
															<a
																class="linea-celda visualizar"
																href={enlace}
																aria-label={`Visualizar ${celda.reportesAbiertos.length || celda.reportes.length === 1 ? 'el reporte' : 'los reportes'} de la partida ${p.numero} de ${textoMes(celda.mes)}`}
																><svg
																	viewBox="0 0 24 24"
																	fill="none"
																	stroke="currentColor"
																	stroke-width="2"
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	aria-hidden="true"
																	><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
																	{@html ICONOS.documento}</svg
																>Visualizar</a
															>
															<!-- eslint-enable svelte/no-navigation-without-resolve -->
														{:else}
															<span class="linea-celda visualizar inactivo" aria-hidden="true"
																><svg
																	viewBox="0 0 24 24"
																	fill="none"
																	stroke="currentColor"
																	stroke-width="2"
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
																	{@html ICONOS.documento}</svg
																>Visualizar</span
															>
														{/if}
													</div>
												{:else}
													<span class="vacio" aria-hidden="true">—</span>
												{/if}
											</td>
										{/each}
										<td class="total">
											{p.totalRealizado} / {p.totalProgramado}
											{#if p.diferencia !== null && p.diferencia !== 0}
												<span
													class="status-badge por-confirmar"
													title="La suma de los meses no coincide con la cantidad anual"
													>Dif. {p.diferencia > 0 ? '+' : ''}{p.diferencia}</span
												>
											{/if}
										</td>
									</tr>
								{:else}
									<tr>
										<td class="sin-resultados" colspan={meses.length + 4}>
											Ninguna partida coincide con la búsqueda o el filtro.
											<button class="enlace-accion" type="button" on:click={limpiarBusqueda}
												>Mostrar todas</button
											>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					{#if desborda}
						<div class="pie-matriz">
							<span>Partida fija · desplace la tabla para ver todos los meses.</span>
							<button class="enlace-accion" type="button" on:click={desplazarTabla}
								>{alFinal ? 'Ir al inicio del ciclo' : 'Ir al final del ciclo'}
								<svg
									class:invertida={alFinal}
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
									><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
									{@html ICONOS.siguiente}</svg
								></button
							>
						</div>
					{/if}
				</section>

				{#if elegida}
					{@const { partida: p, celda } = elegida}
					{@const estado = estadoEjecucion(celda, hoy)}
					{@const falta = faltan(celda)}
					{@const borrador = celda.reportesAbiertos[0]}
					{@const notas = [...anotacionesCelda(celda), detalleCelda(celda, hoy)].filter(Boolean)}
					<aside class="panel-celda" aria-labelledby="titulo-panel" tabindex="-1" bind:this={panel}>
						<div class="cabecera-panel">
							<p class="ceja">
								Selección · Partida {p.numero} / {textoMes(celda.mes, { inicial: true })}
							</p>
							<button class="cerrar-panel" type="button" on:click={cerrarPanel}
								>Cerrar <svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									aria-hidden="true"
									><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
									{@html ICONOS.cerrar}</svg
								></button
							>
						</div>
						<h3 id="titulo-panel" class="titulo-panel">{textoOracion(p.actividad)}</h3>
						<p class="periodicidad-panel">
							<span class="sr-only">Periodicidad:</span>
							<span class="insignia-periodicidad">{ETIQUETA_PERIODICIDAD[p.periodicidad]}</span>
						</p>
						<dl class="datos-panel">
							<div>
								<dt>Programado</dt>
								<dd class="cifra grande" aria-describedby="explicacion-programado">
									{celda.programado ?? 0}
								</dd>
							</div>
							<div>
								<dt>Realizado</dt>
								<dd class="cifra grande">{celda.realizado}</dd>
							</div>
							<div>
								<dt>Ejecución</dt>
								<dd class="estado-panel e-{TONO[estado]}">
									<span class="punto" aria-hidden="true"></span>
									{ETIQUETA_EJECUCION[estado]}
								</dd>
							</div>
							<div>
								<dt>Documento</dt>
								<dd>{textoDocumental(celda) || '—'}</dd>
							</div>
						</dl>
						<p id="explicacion-programado" class="explicacion-programado">
							{explicacionProgramado(p, celda)}
						</p>
						{#if notas.length}<p class="nota-panel">{notas.join(' · ')}</p>{/if}
						<div class="acciones-panel">
							<!-- resolve() se aplica a la ruta; los filtros van en la consulta. -->
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							{#if borrador}
								<a class="boton primario" href={resolve('/reportes/[id]', { id: borrador.id })}
									>Continuar reporte</a
								>
								<p class="nota-panel">
									Continuar abre el {borrador.estado === 'en_revision'
										? 'reporte en revisión'
										: 'borrador'}
									de {textoMes(celda.mes)}; no registra ejecución.
								</p>
							{:else if falta > 0}
								<a
									class="boton primario"
									href={`${resolve('/captura')}?${consultaCaptura(p.id, celda.mes, reprogramacionPendiente(celda))}`}
									aria-label={`Capturar partida ${p.numero} de ${textoMes(celda.mes)}`}
									>Capturar reporte</a
								>
							{/if}
							{#if celda.reportes.length}
								<a
									class="enlace"
									href={`${resolve('/historial')}?${consultaHistorial(p.id, celda.mes)}`}
									aria-label={`Ver ${plural(celda.reportes.length, 'reporte emitido', 'reportes emitidos')} de la partida ${p.numero} en ${textoMes(celda.mes)}`}
									>Ver {plural(celda.reportes.length, 'reporte emitido', 'reportes emitidos')}</a
								>
							{/if}
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{#if falta > 0 || celda.ajustes.length}
								<button
									type="button"
									class="boton contorno"
									aria-label={`Ajustes de la partida ${p.numero} en ${textoMes(celda.mes)}`}
									on:click={() => abrirAjuste(p, celda)}>Ajustar programa</button
								>
								<p class="nota-panel">Al ajustar: reprogramar o marcar no ejecutado.</p>
							{/if}
							<button
								class="enlace-accion"
								type="button"
								on:click={() => registrarExterno(p.id, celda.mes)}
								>Registrar realizado externo <svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
									><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
									{@html ICONOS.siguiente}</svg
								></button
							>
						</div>
					</aside>
				{/if}
			</div>
		{/if}

		<section class="registro-externo" aria-labelledby="titulo-manual">
			<details bind:open={registroAbierto}>
				<summary id="titulo-manual"
					>Registrar realizado externo <svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><!-- eslint-disable-next-line svelte/no-at-html-tags -- trazos constantes del icono -->
						{@html ICONOS.siguiente}</svg
					></summary
				>
				<div class="card cuerpo-registro">
					<p class="view-note">
						Para trabajos documentados con un reporte anterior (por ejemplo, en Word). Cuenta en el
						realizado sin crear un reporte emitido.
					</p>
					<Aviso form={avisoGeneral} />
					<form method="POST" action="?/registrarRealizado" use:enhance class="form-grid">
						<input type="hidden" name="programaId" value={programa.id} />
						<div class="form-group">
							<label for="manual-partida">Partida</label>
							<select id="manual-partida" name="partidaId" required bind:value={manualPartida}>
								{#each partidas as p (p.id)}
									<option value={p.id}>{p.numero}.- {textoOracion(p.actividad)}</option>
								{/each}
							</select>
						</div>
						<div class="form-group">
							<label for="manual-mes">Mes</label>
							<select id="manual-mes" name="mes" required bind:value={manualMes}>
								{#each meses as mes (mes)}
									<option value={mes}>{textoMes(mes, { inicial: true })}</option>
								{/each}
							</select>
						</div>
						<div class="form-group">
							<label for="manual-cantidad">Cantidad</label>
							<input
								id="manual-cantidad"
								name="cantidad"
								type="number"
								min="1"
								step="1"
								value="1"
							/>
						</div>
						<div class="form-group">
							<label for="manual-nota">Nota (obligatoria)</label>
							<input id="manual-nota" name="nota" required placeholder="Reporte Word de mayo" />
						</div>
						<div class="form-group acciones-formulario">
							<button class="boton primario" type="submit">Registrar</button>
						</div>
					</form>
				</div>
			</details>
			<p class="nota-registro">No crea un reporte emitido.</p>
		</section>

		{#if ajuste}
			<DialogoAjuste
				bind:this={dialogo}
				bind:abierto={dialogoAbierto}
				programaId={programa.id}
				partida={ajuste.partida}
				celda={ajuste.celda}
				{meses}
				{alEnviar}
				error={errorAjuste}
				on:cancelar={() => (errorAjuste = '')}
			/>
		{/if}
	{/if}
</div>
