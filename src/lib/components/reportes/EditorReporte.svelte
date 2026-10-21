<!-- Editor del reporte FOR-ICSI-RMT-01: encabezado, TAG, firmantes, alcances con fotos y
     verificación, herramientas y conclusiones. Autoguarda tras una pausa con concurrencia optimista
     (un conflicto de versión detiene el guardado sin sobrescribir) y controla los estados. Una barra
     fija resume contexto, guardado y pendientes; el índice lleva a cada sección. -->
<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		aGuardado,
		completitudPorSeccion,
		destinoDeObservacion,
		ETIQUETA_OCURRENCIA,
		rangoDelPeriodo,
		validarParaRevision,
		type Observacion
	} from '$lib/dominio/captura';
	import {
		TEXTO_ESTADO_VERIFICACION,
		textoTags,
		type EstadoVerificacion
	} from '$lib/dominio/documento';
	import type { Equipo, Foto, Reporte, ReporteGuardado } from '$lib/dominio/esquemas';
	import { fechaEnZona } from '$lib/dominio/fechas';
	import { plural, textoHaceTiempo, textoMes, textoRango } from '$lib/dominio/textos';
	import BotonesSegmentados from '$lib/components/ui/BotonesSegmentados.svelte';
	import Dialogo from '$lib/components/ui/Dialogo.svelte';
	import { notificaciones, PLAZO_DESHACER } from '$lib/components/ui/notificaciones';
	import { llamarAccion, type EnviarAccion, type ResultadoAccion } from './acciones';
	import ErrorCampo from './ErrorCampo.svelte';
	import FotosAlcance from './FotosAlcance.svelte';
	import IndiceSecciones from './IndiceSecciones.svelte';
	import InsigniaEstado from './InsigniaEstado.svelte';
	import SeccionResumen from './SeccionResumen.svelte';

	export let reporte: Reporte;
	export let equiposPartida: Equipo[] = [];
	export let catalogoCambiado = false;
	export let partidaPorConfirmar = false;
	/** Pausa del autoguardado tras el último cambio, en milisegundos. */
	export let espera = 1500;
	export let enviar: EnviarAccion = llamarAccion;
	/** Fecha de hoy («AAAA-MM-DD») en la zona del negocio, para el atajo «Hoy». */
	export let hoy = fechaEnZona();
	/** Tiempo para deshacer una foto o un alcance quitados, en milisegundos. */
	export let plazoDeshacer = PLAZO_DESHACER;

	type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'conflicto' | 'error';
	type Momento = 'antes' | 'durante' | 'despues';
	type EntradaIndice = { id: string; texto: string; pendientes: number; nivel: 0 | 1 };

	const seccion = (id: string, texto: string, pendientes: number): EntradaIndice => ({
		id,
		texto,
		pendientes,
		nivel: 0
	});

	const FUNCIONES = [
		{ clave: 'elaboro', etiqueta: 'Elaboró' },
		{ clave: 'aprobo', etiqueta: 'Aprobó' },
		{ clave: 'recibio', etiqueta: 'Recibió' }
	] as const;
	/** Datos que vienen del contrato y la partida; no se editan en el reporte. */
	const DATOS_CONTRATO = [
		{ campo: 'usuario', clave: 'usuario', etiqueta: 'Usuario' },
		{ campo: 'contratoTexto', clave: 'contrato', etiqueta: 'No. contrato / OC' },
		{ campo: 'sitioTexto', clave: 'sitio', etiqueta: 'Sitio' },
		{ campo: 'periodicidad', clave: 'periodicidad', etiqueta: 'Periodicidad' }
	] as const;
	const TEXTO_GUARDADO: Record<EstadoGuardado, string> = {
		guardado: 'Guardado',
		pendiente: 'Cambios sin guardar',
		guardando: 'Guardando…',
		conflicto: 'Versión desactualizada',
		error: 'No se guardó'
	};
	const ENFOCABLE =
		'input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), [tabindex]';
	/** «Pendiente» se representa sin opción elegida. */
	const OPCIONES_VERIFICACION = (['ok', 'no_aplica', 'con_observacion'] as const).map((valor) => ({
		valor,
		texto: TEXTO_ESTADO_VERIFICACION[valor]
	}));

	/**
	 * El reporte sin lo quitado que todavía puede deshacerse. Es lo que se ve, se numera y se valida;
	 * lo que se autoguarda sigue incluyéndolo hasta que la baja se aplica.
	 */
	function conBajas(r: Reporte, quitados: Record<string, number>): Reporte {
		if (!Object.keys(quitados).length) return r;
		return {
			...r,
			alcances: r.alcances
				.filter((a) => !quitados[a.id])
				.map((a) => ({ ...a, fotos: a.fotos.filter((f) => !quitados[f.id]) }))
		};
	}

	/** Completa los firmantes que falten para poder editarlos. */
	function normalizar(r: Reporte): Reporte {
		const vacio = { nombre: '', cargo: '', empresa: '' };
		return {
			...r,
			firmantes: {
				elaboro: r.firmantes.elaboro ?? { ...vacio },
				aprobo: r.firmantes.aprobo ?? { ...vacio },
				recibio: r.firmantes.recibio ?? { ...vacio }
			}
		};
	}

	/** Lo que se envía al guardar; las filas de herramientas sin descripción no se envían. */
	function paraGuardar(r: Reporte): ReporteGuardado {
		const guardado = aGuardado(r);
		return {
			...guardado,
			fechaEjecucion: guardado.fechaEjecucion || null,
			herramientas: guardado.herramientas
				.filter((h) => h.descripcion.trim())
				.map((h) => ({ cantidad: h.cantidad?.trim() || null, descripcion: h.descripcion.trim() }))
		};
	}

	const huella = (r: Reporte) => JSON.stringify({ ...paraGuardar(r), version: 0 });

	/** Errores a la vista: los de campos que ya se dejaron o, tras intentar enviar, todos. */
	function erroresVisibles(
		lista: Observacion[],
		r: Reporte,
		vistos: Record<string, boolean>,
		todos: boolean
	): Record<string, string> {
		const errores: Record<string, string> = {};
		for (const observacion of lista) {
			const destino = destinoDeObservacion(observacion, r);
			if (!destino || errores[destino.campoId]) continue;
			if (todos || vistos[destino.campoId]) errores[destino.campoId] = observacion.mensaje;
		}
		return errores;
	}

	/** `aria-describedby` de un campo: su error (si está a la vista) y sus textos de ayuda. */
	function describir(errores: Record<string, string>, campoId: string, ...ayudas: string[]) {
		const ids = [...(errores[campoId] ? [`error-${campoId}`] : []), ...ayudas];
		return ids.length ? ids.join(' ') : undefined;
	}

	reporte = normalizar(reporte);
	let ultimaHuella = huella(reporte);
	/** Contenido que falló al guardarse: no se reintenta solo hasta que cambie o se pida. */
	let huellaFallida: string | null = null;
	let estadoGuardado: EstadoGuardado = 'guardado';
	let guardadoEn: number | null = null;
	let ahora = Date.now();
	let mensaje = '';
	let observacionesServidor: Observacion[] = [];
	let rechazadas: { nombre: string; motivo: string }[] = [];
	/** Avance de las cargas de fotos en curso, por alcance. */
	let cargas: Record<string, { total: number; hechas: number }> = {};
	/** Alcances y fotos quitados que aún pueden deshacerse, con su notificación. */
	let bajas: Record<string, number> = {};
	let dialogoEmision = false;
	let ocupado = false;
	let confirmarOmitirTabla = false;
	let mostrarResumen = false;
	let intentoEnvio = false;
	let tocados: Record<string, boolean> = {};
	let abiertas = { firmas: false, objetivo: false };
	let tituloResumen: HTMLElement | undefined;
	let temporizador: ReturnType<typeof setTimeout> | null = null;
	let cola: Promise<unknown> = Promise.resolve();

	// Mientras cambia el estado o se aplica el catálogo no se edita: lo escrito se perdería.
	$: editable = reporte.estado === 'borrador' && estadoGuardado !== 'conflicto' && !ocupado;
	$: ruta = resolve('/reportes/[id]', { id: reporte.id });
	$: huellaActual = huella(reporte);
	$: if (
		editable &&
		huellaActual !== ultimaHuella &&
		huellaActual !== huellaFallida &&
		estadoGuardado !== 'guardando'
	)
		programar();
	$: visible = conBajas(reporte, bajas);
	$: numeroAlcance = new Map(visible.alcances.map((a, i) => [a.id, i + 1]));
	$: totalFotos = visible.alcances.reduce((total, a) => total + a.fotos.length, 0);
	$: puedeDescargar = !!reporte.fechaEjecucion;
	$: pendientes = validarParaRevision(visible, { requiereTag: equiposPartida.length > 0 });
	$: completitud = completitudPorSeccion(pendientes, visible);
	$: errores = erroresVisibles(pendientes, visible, tocados, intentoEnvio);
	// Las observaciones del servidor (422) se suman a las locales sin repetir campos.
	$: listaResumen = [
		...pendientes,
		...observacionesServidor.filter((o) => !pendientes.some((p) => p.campo === o.campo))
	];
	// Días válidos: el mes o, si aplica, la semana, quincena o día elegidos.
	$: rango = rangoDelPeriodo(reporte.periodoMes, reporte.ocurrencia);
	$: hoyEnPeriodo = !!rango && rango.desde <= hoy && hoy <= rango.hasta;
	$: idsEquipos = new Set(reporte.equipos.map((e) => e.id));
	$: contexto = `${reporte.usuario} › Partida ${reporte.numeroPartida} › ${textoMes(
		reporte.periodoMes,
		{ inicial: true }
	)}${reporte.ocurrencia ? ` · ${ETIQUETA_OCURRENCIA[reporte.ocurrencia.tipo]} ${reporte.ocurrencia.numero}` : ''}`;
	$: entradasIndice = [
		seccion('seccion-encabezado', 'Encabezado', completitud.porSeccion.encabezado),
		seccion('seccion-firmas', 'Firmas', completitud.porSeccion.firmas),
		seccion('seccion-objetivo', '1. Objetivo', completitud.porSeccion.objetivo),
		seccion('seccion-alcance', '2. Alcance', completitud.porSeccion.alcance),
		...visible.alcances.map(
			(a, i): EntradaIndice => ({
				id: `alcance-${a.id}`,
				texto: `2.${i + 1} ${a.titulo.trim() || 'Sin título'}`,
				pendientes: completitud.porAlcance[a.id] ?? 0,
				nivel: 1
			})
		),
		seccion('seccion-herramientas', 'Herramientas y equipo', completitud.porSeccion.herramientas),
		seccion('seccion-conclusiones', 'Conclusiones', completitud.porSeccion.conclusiones)
	];

	function programar() {
		estadoGuardado = 'pendiente';
		if (temporizador) clearTimeout(temporizador);
		temporizador = setTimeout(() => {
			temporizador = null;
			encolar(guardar);
		}, espera);
	}

	/** Las operaciones con el servidor se hacen una tras otra para no mezclar versiones. */
	function encolar<T>(tarea: () => Promise<T>): Promise<T> {
		const siguiente = cola.then(tarea, tarea);
		cola = siguiente.catch(() => undefined);
		return siguiente;
	}

	function manejarFallo(resultado: Extract<ResultadoAccion, { ok: false }>) {
		const datos = resultado.datos as {
			error?: string;
			conflicto?: boolean;
			observaciones?: Observacion[];
		};
		mensaje = datos.error ?? 'No se pudo completar la operación.';
		if (resultado.estado === 409 && datos.conflicto) {
			estadoGuardado = 'conflicto';
			mensaje =
				'Otra persona modificó este reporte. Sus últimos cambios no se guardaron para no sobrescribir los de ella: recargue el reporte.';
		} else if (resultado.estado === 422) {
			observacionesServidor = datos.observaciones ?? [];
			if (observacionesServidor.length) verPendientes();
		}
	}

	/** Guarda si hay cambios. Devuelve falso si no se pudo (conflicto o error). */
	async function guardar(): Promise<boolean> {
		if (temporizador) {
			clearTimeout(temporizador);
			temporizador = null;
		}
		if (reporte.estado !== 'borrador') return true;
		if (estadoGuardado === 'conflicto') return false;
		const enviado = huella(reporte);
		if (enviado === ultimaHuella) {
			estadoGuardado = 'guardado';
			return true;
		}
		if (!reporte.titulo.trim()) {
			estadoGuardado = 'error';
			huellaFallida = enviado;
			mensaje = 'El título no puede quedar vacío.';
			return false;
		}
		estadoGuardado = 'guardando';
		const datos = new FormData();
		datos.set('reporte', JSON.stringify(paraGuardar(reporte)));
		const resultado = await enviar('guardar', datos, ruta);
		if (!resultado.ok) {
			if (estadoGuardado === 'guardando') estadoGuardado = 'error';
			huellaFallida = enviado;
			manejarFallo(resultado);
			return false;
		}
		const guardado = resultado.datos.reporte as Reporte;
		reporte.version = guardado.version;
		reporte.documentos = guardado.documentos;
		ultimaHuella = enviado;
		huellaFallida = null;
		guardadoEn = Date.now();
		mensaje = '';
		// Lo que se escribió mientras se guardaba queda pendiente para la siguiente pausa.
		estadoGuardado = 'guardado';
		if (huella(reporte) !== enviado) programar();
		return true;
	}

	function reintentar() {
		huellaFallida = null;
		guardarAhora();
	}

	function reemplazar(nuevo: Reporte) {
		reporte = normalizar(nuevo);
		ultimaHuella = huella(reporte);
		estadoGuardado = 'guardado';
	}

	async function cargarFotos(alcanceId: string, archivos: File[], momento: Momento | null) {
		// Los rechazos de una carga anterior se conservan mientras haya otra en curso.
		if (!Object.keys(cargas).length) rechazadas = [];
		const actual = cargas[alcanceId] ?? { total: 0, hechas: 0 };
		cargas = { ...cargas, [alcanceId]: { ...actual, total: actual.total + archivos.length } };
		for (const archivo of archivos) {
			await encolar(async () => {
				try {
					// El alcance debe existir en el servidor antes de recibir fotos.
					if (!(await guardar())) return;
					const datos = new FormData();
					datos.set('alcanceId', alcanceId);
					datos.set('version', String(reporte.version));
					if (momento) datos.set('momento', momento);
					datos.append('archivo', archivo);
					const resultado = await enviar('fotos', datos, ruta);
					if (!resultado.ok) {
						manejarFallo(resultado);
						rechazadas = [...rechazadas, { nombre: archivo.name, motivo: mensaje }];
						return;
					}
					const nuevas = resultado.datos.fotos as Foto[];
					rechazadas = [
						...rechazadas,
						...(resultado.datos.rechazadas as { nombre: string; motivo: string }[])
					];
					reporte.version = resultado.datos.version as number;
					reporte.alcances = reporte.alcances.map((a) =>
						a.id === alcanceId ? { ...a, fotos: [...a.fotos, ...nuevas] } : a
					);
				} finally {
					avanzarCarga(alcanceId);
				}
			});
		}
	}

	function avanzarCarga(alcanceId: string) {
		const carga = cargas[alcanceId];
		if (!carga) return;
		const resto = { ...cargas };
		if (carga.hechas + 1 >= carga.total) delete resto[alcanceId];
		else resto[alcanceId] = { ...carga, hechas: carga.hechas + 1 };
		cargas = resto;
	}

	/** Oculta el alcance o la foto y ofrece «Deshacer»; la baja se aplica al vencer el plazo. */
	function quitarConDeshacer(id: string, aviso: string) {
		const notificacion = notificaciones.mostrar({
			mensaje: aviso,
			textoDeshacer: 'Deshacer',
			plazo: plazoDeshacer,
			alDeshacer: () => olvidarBaja(id),
			alVencer: () => aplicarBaja(id)
		});
		bajas = { ...bajas, [id]: notificacion };
	}

	function olvidarBaja(id: string) {
		const resto = { ...bajas };
		delete resto[id];
		bajas = resto;
	}

	function aplicarBaja(id: string) {
		olvidarBaja(id);
		reporte.alcances = reporte.alcances
			.filter((a) => a.id !== id)
			.map((a) =>
				a.fotos.some((f) => f.id === id) ? { ...a, fotos: a.fotos.filter((f) => f.id !== id) } : a
			);
	}

	/** Antes de guardar para salir, descargar o cambiar de estado, las bajas pendientes se aplican. */
	function aplicarBajasPendientes(): boolean {
		const pendientesDeAplicar = Object.values(bajas);
		for (const notificacion of pendientesDeAplicar) notificaciones.confirmar(notificacion);
		return pendientesDeAplicar.length > 0;
	}

	function moverFoto(origenId: string, fotoId: string, destinoId: string) {
		const foto = reporte.alcances
			.find((a) => a.id === origenId)
			?.fotos.find((f) => f.id === fotoId);
		if (!foto) return;
		reporte.alcances = reporte.alcances.map((a) =>
			a.id === origenId
				? { ...a, fotos: a.fotos.filter((f) => f.id !== fotoId) }
				: a.id === destinoId
					? { ...a, fotos: [...a.fotos, { ...foto, alcanceId: destinoId }] }
					: a
		);
	}

	async function accionConGuardado(accion: string, campos: Record<string, string>) {
		aplicarBajasPendientes();
		ocupado = true;
		observacionesServidor = [];
		mensaje = '';
		try {
			await encolar(async () => {
				if (!(await guardar())) return;
				const datos = new FormData();
				datos.set('version', String(reporte.version));
				for (const [clave, valor] of Object.entries(campos)) datos.set(clave, valor);
				const resultado = await enviar(accion, datos, ruta);
				if (!resultado.ok) {
					manejarFallo(resultado);
					return;
				}
				reemplazar(resultado.datos.reporte as Reporte);
				if (accion === 'aplicarCatalogo') catalogoCambiado = false;
			});
		} finally {
			ocupado = false;
		}
	}

	/** Con datos pendientes no se llama al servidor: se muestra qué falta y dónde. */
	async function enviarARevision() {
		if (pendientes.length) {
			await verPendientes();
			return;
		}
		mostrarResumen = false;
		accionConGuardado('estado', { estado: 'en_revision' });
	}

	async function verPendientes() {
		intentoEnvio = true;
		mostrarResumen = true;
		await tick();
		tituloResumen?.focus();
	}

	/** La acción redirige a la revisión nueva (llamarAccion sigue la redirección). */
	async function crearRevision() {
		ocupado = true;
		mensaje = '';
		const resultado = await enviar('revision', new FormData(), ruta);
		if (!resultado.ok) manejarFallo(resultado);
		ocupado = false;
	}

	async function descargar(evento: MouseEvent) {
		const habiaBajas = aplicarBajasPendientes();
		if (!habiaBajas && (estadoGuardado === 'guardado' || reporte.estado !== 'borrador')) return;
		// Se guarda primero para descargar exactamente lo que está en pantalla.
		evento.preventDefault();
		const destino = (evento.currentTarget as HTMLAnchorElement).href;
		if (await encolar(guardar)) window.location.assign(destino);
	}

	/** Enfoca el elemento o, si no admite foco, su primer control; la sección se abre antes. */
	async function enfocar(id: string) {
		await tick();
		const elemento = document.getElementById(id);
		if (!elemento) return;
		const destino = elemento.matches(ENFOCABLE)
			? elemento
			: (elemento.querySelector<HTMLElement>(ENFOCABLE) ?? elemento);
		destino.focus();
	}

	function irAPendiente(observacion: Observacion) {
		const destino = destinoDeObservacion(observacion, visible);
		if (!destino) return;
		if (destino.seccion === 'firmas') abiertas.firmas = true;
		if (destino.seccion === 'objetivo') abiertas.objetivo = true;
		enfocar(destino.campoId);
	}

	/** Desde el índice: al título de la sección o, en un alcance, al alcance. */
	function irASeccion(id: string) {
		enfocar(document.getElementById(`${id}-titulo`) ? `${id}-titulo` : id);
	}

	function marcarTocado(evento: FocusEvent) {
		const id = (evento.target as HTMLElement | null)?.closest('[id]')?.id;
		if (id && !tocados[id]) tocados = { ...tocados, [id]: true };
	}

	function agregarAlcance() {
		reporte.alcances = [
			...reporte.alcances,
			{
				id: crypto.randomUUID(),
				orden: reporte.alcances.length + 1,
				titulo: '',
				descripcion: '',
				estadoVerificacion: 'pendiente',
				observaciones: '',
				partidaAlcanceId: null,
				fotos: []
			}
		];
	}

	/** Intercambia el alcance con el anterior o el siguiente visible. */
	function moverAlcance(id: string, paso: -1 | 1) {
		const orden = visible.alcances.map((a) => a.id);
		const vecino = orden[orden.indexOf(id) + paso];
		if (!vecino) return;
		const i = reporte.alcances.findIndex((a) => a.id === id);
		const j = reporte.alcances.findIndex((a) => a.id === vecino);
		const nuevos = [...reporte.alcances];
		[nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]];
		reporte.alcances = nuevos;
	}

	function quitarAlcance(alcance: Reporte['alcances'][number]) {
		const fotos = alcance.fotos.filter((f) => !bajas[f.id]).length;
		const numero = numeroAlcance.get(alcance.id);
		quitarConDeshacer(
			alcance.id,
			`Se quitó el alcance 2.${numero}${fotos ? ` con ${plural(fotos, 'foto')}` : ''}.`
		);
	}

	function alternarEquipo(equipo: Equipo, marcado: boolean) {
		reporte.equipos = marcado
			? [...reporte.equipos, { ...equipo, orden: reporte.equipos.length + 1 }]
			: reporte.equipos.filter((e) => e.id !== equipo.id);
	}

	function alternarVerificacion(evento: Event) {
		const casilla = evento.currentTarget as HTMLInputElement;
		const capturados = reporte.alcances.some(
			(a) => a.estadoVerificacion !== 'pendiente' || a.observaciones.trim()
		);
		if (!casilla.checked && capturados) {
			// Se pide confirmación; los estados se conservan por si se vuelve a activar.
			casilla.checked = true;
			confirmarOmitirTabla = true;
			return;
		}
		reporte.incluyeVerificacion = casilla.checked;
	}

	/** Hay cambios sin guardar, un guardado en curso o algo quitado que aún puede deshacerse. */
	export function hayCambiosPendientes(): boolean {
		return (
			reporte.estado === 'borrador' &&
			(estadoGuardado === 'pendiente' ||
				estadoGuardado === 'guardando' ||
				Object.keys(bajas).length > 0 ||
				huella(reporte) !== ultimaHuella)
		);
	}

	/**
	 * Aplica lo quitado y guarda de inmediato, después de lo que ya esté en curso. La página lo usa
	 * antes de navegar.
	 */
	export function guardarAhora(): Promise<boolean> {
		aplicarBajasPendientes();
		return encolar(guardar);
	}

	function antesDeSalir(evento: BeforeUnloadEvent) {
		if (hayCambiosPendientes()) evento.preventDefault();
	}

	onMount(() => {
		// La hora relativa del guardado se actualiza sola.
		const reloj = setInterval(() => (ahora = Date.now()), 5000);
		return () => clearInterval(reloj);
	});

	onDestroy(() => {
		if (temporizador) clearTimeout(temporizador);
		// Sin el editor, una baja pendiente ya no se aplica: el elemento sigue en el reporte.
		for (const notificacion of Object.values(bajas)) notificaciones.descartar(notificacion);
	});
</script>

<svelte:window on:beforeunload={antesDeSalir} />

<p class="migas">
	<a class="enlace" href={resolve('/captura')}>Captura</a> / {reporte.titulo}
</p>

<section class="card barra-reporte" aria-label="Estado del reporte">
	<div class="linea-estado">
		<span class="contexto" title={contexto}>{contexto}</span>
		<InsigniaEstado estado={reporte.estado} />
		{#if reporte.revision > 0}<span class="view-note">Rev. {reporte.revision}</span>{/if}
		{#if reporte.estado === 'borrador'}
			<span class="guardado guardado-{estadoGuardado}">
				<span role="status">{TEXTO_GUARDADO[estadoGuardado]}</span>
				{#if estadoGuardado === 'guardado' && guardadoEn}
					<span>{textoHaceTiempo(guardadoEn, ahora)}</span>
				{/if}
			</span>
			{#if estadoGuardado === 'error'}
				<button class="boton" type="button" on:click={reintentar}>Reintentar</button>
			{/if}
		{/if}
	</div>
	<div class="acciones-reporte">
		{#if reporte.estado === 'borrador'}
			{#if pendientes.length}
				<button class="boton faltan" type="button" on:click={verPendientes}
					><span class="marca-faltan" aria-hidden="true">!</span><span class="texto-largo"
						>Faltan
					</span>{pendientes.length}</button
				>
			{:else}
				<span class="completo"><span aria-hidden="true">✓</span> Completo</span>
			{/if}
		{/if}
		<!-- Siempre a la vista; sin fecha de ejecución no hay documento y se dice por qué. -->
		{#if puedeDescargar}
			<a
				class="boton"
				href={resolve('/reportes/[id]/documento', { id: reporte.id })}
				on:click={descargar}><span class="texto-largo">Descargar </span>DOCX</a
			>
		{:else}
			<span id="motivo-descarga" class="motivo-descarga">Indique la fecha de ejecución</span>
			<button class="boton" type="button" disabled aria-describedby="motivo-descarga"
				><span class="texto-largo">Descargar </span>DOCX</button
			>
		{/if}
		{#if reporte.estado === 'borrador'}
			<button
				class="boton primario"
				type="button"
				disabled={ocupado || estadoGuardado === 'conflicto'}
				on:click={enviarARevision}>Enviar a revisión</button
			>
		{:else if reporte.estado === 'en_revision'}
			<button
				class="boton"
				type="button"
				disabled={ocupado}
				on:click={() => accionConGuardado('estado', { estado: 'borrador' })}
				>Regresar a borrador</button
			>
			<button
				class="boton primario"
				type="button"
				disabled={ocupado}
				on:click={() => (dialogoEmision = true)}>Emitir</button
			>
		{:else if reporte.estado === 'emitido'}
			<button class="boton" type="button" disabled={ocupado} on:click={crearRevision}
				>Crear revisión</button
			>
		{/if}
	</div>
</section>

<div class="cuerpo-editor">
	<IndiceSecciones
		entradas={entradasIndice}
		total={pendientes.length}
		conCompletitud={reporte.estado === 'borrador'}
		on:ir={(e) => irASeccion(e.detail)}
	/>

	<div class="contenido-editor">
		{#if mensaje}
			<div class="aviso aviso-error" role="alert">
				<p>{mensaje}</p>
				{#if estadoGuardado === 'conflicto'}
					<button class="boton" type="button" on:click={() => window.location.reload()}
						>Recargar el reporte</button
					>
				{/if}
			</div>
		{/if}

		{#if mostrarResumen && reporte.estado === 'borrador'}
			<section class="aviso aviso-alerta resumen-pendientes" aria-labelledby="titulo-resumen">
				<h2 id="titulo-resumen" class="titulo-resumen" tabindex="-1" bind:this={tituloResumen}>
					{listaResumen.length
						? `Faltan ${plural(listaResumen.length, 'dato')} para enviar a revisión`
						: 'Listo para enviar a revisión'}
				</h2>
				{#if listaResumen.length}
					<ul>
						{#each listaResumen as observacion (observacion.campo)}
							<li>
								<a
									class="enlace"
									href={`#${destinoDeObservacion(observacion, visible)?.campoId ?? 'seccion-encabezado'}`}
									on:click|preventDefault={() => irAPendiente(observacion)}>{observacion.mensaje}</a
								>
							</li>
						{/each}
					</ul>
				{/if}
				<button class="boton" type="button" on:click={() => (mostrarResumen = false)}
					>Ocultar</button
				>
			</section>
		{/if}

		{#if catalogoCambiado && reporte.estado === 'borrador'}
			<div class="aviso aviso-alerta" role="status">
				<p>
					La partida cambió en el catálogo después de crear este borrador. El borrador conserva su
					contenido; puede aplicar los cambios (objetivo, alcances, herramientas y conclusiones).
					Las fotos de los alcances que siguen en el catálogo se conservan.
				</p>
				<button
					class="boton"
					type="button"
					disabled={ocupado}
					on:click={() => accionConGuardado('aplicarCatalogo', {})}
					>Aplicar cambios del catálogo</button
				>
			</div>
		{/if}
		{#if partidaPorConfirmar}
			<p class="aviso aviso-alerta">
				La partida de este reporte está por confirmar en el catálogo.
			</p>
		{/if}
		{#if rechazadas.length}
			<div class="aviso aviso-error" role="alert">
				<p>Algunas fotos no se cargaron; las demás se conservaron.</p>
				<ul>
					{#each rechazadas as r, i (i)}<li>{r.nombre}: {r.motivo}</li>{/each}
				</ul>
			</div>
		{/if}

		<fieldset class="editor-reporte" disabled={!editable} on:focusout={marcarTocado}>
			<legend class="sr-only">Contenido del reporte</legend>

			<section id="seccion-encabezado" class="card" aria-labelledby="seccion-encabezado-titulo">
				<h2 id="seccion-encabezado-titulo" class="view-heading" tabindex="-1">Encabezado</h2>
				<dl class="datos-contrato">
					{#each DATOS_CONTRATO as dato (dato.clave)}
						<div>
							<dt class="etiqueta">{dato.etiqueta}</dt>
							<dd
								id={`dato-${dato.clave}`}
								tabindex="-1"
								aria-describedby={describir(errores, `dato-${dato.clave}`)}
							>
								{reporte[dato.campo] || '—'}
							</dd>
							<ErrorCampo id={`error-dato-${dato.clave}`} mensaje={errores[`dato-${dato.clave}`]} />
						</div>
					{/each}
				</dl>
				<p class="view-note nota-contrato">
					Vienen del contrato y de la partida; si alguno está mal, corríjalo en el catálogo.
				</p>
				<div class="form-grid">
					<div class="form-group ancho-completo">
						<label for="titulo">Título</label>
						<input
							id="titulo"
							bind:value={reporte.titulo}
							required
							aria-invalid={!!errores.titulo}
							aria-describedby={describir(errores, 'titulo')}
						/>
						<ErrorCampo id="error-titulo" mensaje={errores.titulo} />
					</div>
					<div class="form-group">
						<label for="fecha">Fecha de ejecución ({textoMes(reporte.periodoMes)})</label>
						<div class="fila-fecha">
							<input
								id="fecha"
								type="date"
								min={rango?.desde}
								max={rango?.hasta}
								bind:value={reporte.fechaEjecucion}
								aria-invalid={!!errores.fecha}
								aria-describedby={describir(errores, 'fecha', ...(rango ? ['ayuda-fecha'] : []))}
							/>
							{#if hoyEnPeriodo}
								<button class="boton" type="button" on:click={() => (reporte.fechaEjecucion = hoy)}
									>Hoy</button
								>
							{/if}
						</div>
						{#if rango}<p id="ayuda-fecha" class="ayuda">Periodo: {textoRango(rango)}</p>{/if}
						<ErrorCampo id="error-fecha" mensaje={errores.fecha} />
					</div>
					<div class="form-group">
						<label for="tipo">Tipo de mantenimiento</label>
						<input
							id="tipo"
							bind:value={reporte.tipoMantenimiento}
							aria-invalid={!!errores.tipo}
							aria-describedby={describir(errores, 'tipo')}
						/>
						<ErrorCampo id="error-tipo" mensaje={errores.tipo} />
					</div>
				</div>
				{#if equiposPartida.length}
					<fieldset id="tags" class="casillas" aria-describedby={describir(errores, 'tags')}>
						<legend>TAG ({textoTags(reporte.equipos.map((e) => e.tag))})</legend>
						{#each equiposPartida as equipo (equipo.id)}
							<label>
								<input
									type="checkbox"
									checked={idsEquipos.has(equipo.id)}
									on:change={(e) =>
										alternarEquipo(equipo, (e.currentTarget as HTMLInputElement).checked)}
								/>
								{equipo.tag}
							</label>
						{/each}
					</fieldset>
					<ErrorCampo id="error-tags" mensaje={errores.tags} />
				{:else}
					<p class="view-note">TAG: {textoTags(reporte.equipos.map((e) => e.tag))}</p>
				{/if}
			</section>

			<SeccionResumen
				id="seccion-firmas"
				titulo="Firmas"
				pendientes={completitud.porSeccion.firmas}
				{editable}
				bind:abierta={abiertas.firmas}
			>
				<ul slot="resumen" class="resumen-firmas">
					{#each FUNCIONES as funcion (funcion.clave)}
						{@const firma = reporte.firmantes[funcion.clave]}
						<li>
							<span class="etiqueta">{funcion.etiqueta}</span>
							<span
								>{firma?.nombre || 'Sin nombre'}{firma?.cargo
									? ` · ${firma.cargo}`
									: ''}{firma?.empresa ? ` · ${firma.empresa}` : ''}</span
							>
						</li>
					{/each}
				</ul>
				<div class="firmas">
					{#each FUNCIONES as funcion (funcion.clave)}
						{@const firma = reporte.firmantes[funcion.clave]}
						{@const campoNombre = `firma-${funcion.clave}-nombre`}
						{#if firma}
							<fieldset class="firma">
								<legend>{funcion.etiqueta}</legend>
								<label class="etiqueta" for={campoNombre}>Nombre</label>
								<input
									id={campoNombre}
									bind:value={firma.nombre}
									aria-invalid={!!errores[campoNombre]}
									aria-describedby={describir(errores, campoNombre)}
								/>
								<ErrorCampo id={`error-${campoNombre}`} mensaje={errores[campoNombre]} />
								<label class="etiqueta" for={`firma-${funcion.clave}-cargo`}>Cargo</label>
								<input id={`firma-${funcion.clave}-cargo`} bind:value={firma.cargo} />
								<label class="etiqueta" for={`firma-${funcion.clave}-empresa`}>Empresa</label>
								<input id={`firma-${funcion.clave}-empresa`} bind:value={firma.empresa} />
							</fieldset>
						{/if}
					{/each}
				</div>
			</SeccionResumen>

			<SeccionResumen
				id="seccion-objetivo"
				titulo="1. Objetivo"
				pendientes={completitud.porSeccion.objetivo}
				{editable}
				bind:abierta={abiertas.objetivo}
			>
				<p slot="resumen" class="resumen-texto">{reporte.objetivo || 'Sin objetivo.'}</p>
				<label class="sr-only" for="objetivo">Objetivo</label>
				<textarea
					id="objetivo"
					rows="4"
					bind:value={reporte.objetivo}
					aria-invalid={!!errores.objetivo}
					aria-describedby={describir(errores, 'objetivo')}
				></textarea>
				<ErrorCampo id="error-objetivo" mensaje={errores.objetivo} />
			</SeccionResumen>

			<section id="seccion-alcance" class="card" aria-labelledby="seccion-alcance-titulo">
				<h2 id="seccion-alcance-titulo" class="view-heading" tabindex="-1">2. Alcance</h2>
				<label class="etiqueta" for="introduccion">Introducción (opcional)</label>
				<textarea id="introduccion" rows="3" bind:value={reporte.introduccion}></textarea>

				<label class="casilla-verificacion">
					<input
						type="checkbox"
						checked={reporte.incluyeVerificacion}
						on:change={alternarVerificacion}
					/>
					Incluir tabla de verificación
				</label>
				{#if confirmarOmitirTabla}
					<div class="aviso aviso-alerta" role="alertdialog" aria-labelledby="texto-omitir">
						<p id="texto-omitir">
							Ya hay estados u observaciones capturados. El documento omitirá la tabla, pero se
							conservan por si vuelve a activarla.
						</p>
						<button
							class="boton"
							type="button"
							on:click={() => {
								reporte.incluyeVerificacion = false;
								confirmarOmitirTabla = false;
							}}>Omitir la tabla</button
						>
						<button class="boton" type="button" on:click={() => (confirmarOmitirTabla = false)}
							>Mantenerla</button
						>
					</div>
				{/if}

				<ol class="alcances">
					{#each reporte.alcances as alcance (alcance.id)}
						{#if !bajas[alcance.id]}
							{@const numero = numeroAlcance.get(alcance.id) ?? 0}
							{@const campoTitulo = `titulo-alcance-${alcance.id}`}
							{@const campoEstado = `estado-${alcance.id}`}
							{@const campoObservaciones = `observaciones-${alcance.id}`}
							<li id={`alcance-${alcance.id}`} class="alcance" tabindex="-1">
								<div class="cabecera-alcance">
									<label for={campoTitulo}>2.{numero}</label>
									<input
										id={campoTitulo}
										placeholder="Título del alcance"
										bind:value={alcance.titulo}
										aria-invalid={!!errores[campoTitulo]}
										aria-describedby={describir(errores, campoTitulo)}
									/>
									<div class="acciones-alcance">
										<button
											type="button"
											class="action-btn"
											aria-label={`Subir el alcance 2.${numero}`}
											disabled={numero === 1}
											on:click={() => moverAlcance(alcance.id, -1)}>↑</button
										>
										<button
											type="button"
											class="action-btn"
											aria-label={`Bajar el alcance 2.${numero}`}
											disabled={numero === visible.alcances.length}
											on:click={() => moverAlcance(alcance.id, 1)}>↓</button
										>
										<button
											type="button"
											class="action-btn delete"
											aria-label={`Quitar el alcance 2.${numero}`}
											on:click={() => quitarAlcance(alcance)}>Quitar</button
										>
									</div>
								</div>
								<ErrorCampo id={`error-${campoTitulo}`} mensaje={errores[campoTitulo]} />
								<label class="sr-only" for={`descripcion-${alcance.id}`}
									>Descripción del alcance 2.{numero}</label
								>
								<textarea
									id={`descripcion-${alcance.id}`}
									rows="2"
									placeholder="Descripción de lo realizado"
									bind:value={alcance.descripcion}
								></textarea>
								<FotosAlcance
									bind:fotos={alcance.fotos}
									posicionAlcance={numero}
									disposicion={reporte.disposicionFotos}
									reporteId={reporte.id}
									soloLectura={!editable}
									progreso={cargas[alcance.id] ?? null}
									ocultas={bajas}
									otrosAlcances={visible.alcances
										.map((a, j) => ({ id: a.id, etiqueta: `2.${j + 1} ${a.titulo}` }))
										.filter((a) => a.id !== alcance.id)}
									on:cargar={(e) => cargarFotos(alcance.id, e.detail.archivos, e.detail.momento)}
									on:mover={(e) => moverFoto(alcance.id, e.detail.fotoId, e.detail.alcanceId)}
									on:quitar={(e) =>
										quitarConDeshacer(e.detail.fotoId, `Se quitó la ${e.detail.pie}.`)}
								/>
								{#if reporte.incluyeVerificacion}
									{@const conObservacion = alcance.estadoVerificacion === 'con_observacion'}
									<div class="verificacion">
										<span class="etiqueta" aria-hidden="true">Verificación</span>
										<BotonesSegmentados
											id={campoEstado}
											etiqueta={`Verificación del alcance 2.${numero}`}
											opciones={OPCIONES_VERIFICACION}
											valor={alcance.estadoVerificacion}
											disabled={!editable}
											invalido={!!errores[campoEstado]}
											describedby={describir(errores, campoEstado)}
											on:change={(e) =>
												(alcance.estadoVerificacion = e.detail as EstadoVerificacion)}
										/>
										<ErrorCampo id={`error-${campoEstado}`} mensaje={errores[campoEstado]} />
										<!-- Se muestran con «Con observación» o si ya tienen texto: no se oculta lo capturado. -->
										{#if conObservacion || alcance.observaciones.trim()}
											<label class="etiqueta" for={campoObservaciones}
												>Observaciones{conObservacion ? ' (obligatorias)' : ''}</label
											>
											<input
												id={campoObservaciones}
												bind:value={alcance.observaciones}
												required={conObservacion}
												aria-invalid={!!errores[campoObservaciones]}
												aria-describedby={describir(errores, campoObservaciones)}
											/>
											<ErrorCampo
												id={`error-${campoObservaciones}`}
												mensaje={errores[campoObservaciones]}
											/>
										{/if}
									</div>
								{/if}
							</li>
						{/if}
					{/each}
				</ol>
				<button id="agregar-alcance" class="boton" type="button" on:click={agregarAlcance}
					>Agregar alcance</button
				>
			</section>

			<section id="seccion-herramientas" class="card" aria-labelledby="seccion-herramientas-titulo">
				<h2 id="seccion-herramientas-titulo" class="view-heading" tabindex="-1">
					Herramientas y equipo
				</h2>
				<ul class="lista-editable">
					{#each reporte.herramientas as herramienta, i (i)}
						<li>
							<label class="sr-only" for={`cantidad-${i}`}>Cantidad</label>
							<input
								id={`cantidad-${i}`}
								class="cantidad"
								placeholder="Cantidad"
								value={herramienta.cantidad ?? ''}
								on:input={(e) =>
									(herramienta.cantidad = (e.currentTarget as HTMLInputElement).value)}
							/>
							<label class="sr-only" for={`herramienta-${i}`}>Descripción</label>
							<input
								id={`herramienta-${i}`}
								placeholder="Descripción"
								bind:value={herramienta.descripcion}
							/>
							<button
								type="button"
								class="action-btn delete"
								aria-label={`Quitar la herramienta ${i + 1}`}
								on:click={() =>
									(reporte.herramientas = reporte.herramientas.filter((_, j) => j !== i))}
								>Quitar</button
							>
						</li>
					{/each}
				</ul>
				<button
					class="boton"
					type="button"
					on:click={() =>
						(reporte.herramientas = [...reporte.herramientas, { cantidad: null, descripcion: '' }])}
					>Agregar herramienta</button
				>
			</section>

			<section id="seccion-conclusiones" class="card" aria-labelledby="seccion-conclusiones-titulo">
				<h2 id="seccion-conclusiones-titulo" class="view-heading" tabindex="-1">
					Conclusiones y/o recomendaciones
				</h2>
				<label class="sr-only" for="conclusiones">Conclusiones</label>
				<textarea
					id="conclusiones"
					rows="4"
					bind:value={reporte.conclusiones}
					aria-invalid={!!errores.conclusiones}
					aria-describedby={describir(errores, 'conclusiones')}
				></textarea>
				<ErrorCampo id="error-conclusiones" mensaje={errores.conclusiones} />
			</section>
		</fieldset>
	</div>
</div>

<Dialogo
	id="dialogo-emitir"
	bind:abierto={dialogoEmision}
	titulo="¿Emitir el reporte?"
	textoConfirmar="Emitir"
	on:confirmar={() => accionConGuardado('estado', { estado: 'emitido' })}
>
	<p class="titulo-emision">{reporte.titulo}</p>
	<p>Revisión {reporte.revision} · {plural(totalFotos, 'foto')}</p>
	<p>Un reporte emitido ya no se puede modificar; para corregirlo se crea una revisión.</p>
</Dialogo>

<style>
	/* Barra fija pegada al borde superior del área de contenido, sin hueco por el relleno. */
	.barra-reporte {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 12px;
		align-items: center;
		justify-content: space-between;
		position: sticky;
		top: calc(-1 * var(--relleno-main, 0px));
		z-index: 2;
		padding: 10px 16px;
	}
	.linea-estado {
		display: flex;
		flex: 1 1 320px;
		gap: 8px 12px;
		align-items: center;
		min-width: 0;
	}
	.contexto {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.guardado {
		display: inline-flex;
		gap: 4px;
		color: var(--muted);
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.guardado-pendiente,
	.guardado-guardando {
		font-style: italic;
	}
	.guardado-conflicto,
	.guardado-error {
		color: var(--danger);
		font-weight: 600;
	}
	.acciones-reporte {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.acciones-reporte .boton {
		white-space: nowrap;
	}
	.faltan {
		color: var(--danger);
		border-color: var(--danger);
		font-weight: 600;
	}
	.marca-faltan {
		display: inline-grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--danger);
		color: var(--surface);
		font-size: 0.75rem;
	}
	.motivo-descarga {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.titulo-emision {
		margin: 0;
		font-weight: 600;
	}
	.completo {
		color: var(--success);
		font-weight: 600;
		white-space: nowrap;
	}
	.cuerpo-editor {
		display: grid;
		gap: 16px;
	}
	.contenido-editor {
		min-width: 0;
	}
	@media (min-width: 1100px) {
		.cuerpo-editor {
			grid-template-columns: 220px minmax(0, 1fr);
			align-items: start;
			gap: 24px;
		}
	}
	.resumen-pendientes ul {
		margin: 8px 0 12px;
		padding-left: 20px;
		display: grid;
		gap: 4px;
	}
	.titulo-resumen {
		margin: 0;
		font-size: 1rem;
	}
	.editor-reporte {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	.editor-reporte textarea,
	.editor-reporte input:not([type='checkbox']) {
		width: 100%;
	}
	.datos-contrato {
		display: grid;
		gap: 8px 16px;
		grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
		margin: 0;
	}
	.datos-contrato dd {
		margin: 2px 0 0;
	}
	.nota-contrato {
		margin: 8px 0 16px;
		font-size: 0.85rem;
	}
	.fila-fecha {
		display: flex;
		gap: 8px;
	}
	.ayuda {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.ancho-completo {
		grid-column: 1 / -1;
	}
	.etiqueta {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--muted);
	}
	.resumen-firmas {
		display: grid;
		gap: 4px 16px;
		grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.resumen-firmas li {
		display: grid;
	}
	.resumen-texto {
		margin: 0;
		white-space: pre-line;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.firmas {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
	}
	.firma {
		display: grid;
		gap: 6px;
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px 12px 12px;
		margin: 0;
		min-width: 0;
	}
	.firma legend {
		padding: 0 4px;
		font-weight: 600;
	}
	.firma .etiqueta:not(:first-of-type) {
		margin-top: 4px;
	}
	.alcances {
		list-style: none;
		margin: 12px 0;
		padding: 0;
		display: grid;
		gap: 16px;
	}
	.alcance {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px;
		display: grid;
		gap: 8px;
		min-width: 0;
	}
	.cabecera-alcance {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 6px;
		align-items: center;
	}
	.acciones-alcance {
		display: flex;
		gap: 2px;
	}
	.verificacion {
		display: grid;
		gap: 4px 8px;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
	}
	.verificacion :global(.error-campo) {
		grid-column: 2;
	}
	.casilla-verificacion {
		display: flex;
		gap: 8px;
		align-items: center;
		margin: 12px 0 4px;
	}
	.cantidad {
		max-width: 120px;
	}
	@media (max-width: 600px) {
		/* En móvil la cabecera de la página ya muestra el reporte: la barra se queda en dos líneas. */
		.barra-reporte {
			padding: 8px 12px;
		}
		.contexto {
			display: none;
		}
		/* Se oculta a la vista, no del nombre accesible («Descargar DOCX»). */
		.texto-largo {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		/* Los botones van en una fila; sin fecha, el motivo de la descarga ocupa la línea siguiente. */
		.acciones-reporte {
			flex-wrap: wrap;
			row-gap: 4px;
		}
		.acciones-reporte .boton {
			padding-inline: 12px;
		}
		.motivo-descarga {
			order: 1;
			flex-basis: 100%;
		}
		.cabecera-alcance {
			grid-template-columns: auto minmax(0, 1fr);
		}
		.acciones-alcance {
			grid-column: 1 / -1;
			justify-self: end;
		}
		.verificacion {
			grid-template-columns: minmax(0, 1fr);
		}
		.verificacion :global(.error-campo) {
			grid-column: auto;
		}
	}
</style>
