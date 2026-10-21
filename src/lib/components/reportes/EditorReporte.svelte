<!-- Editor del reporte FOR-ICSI-RMT-01: encabezado, TAG, firmantes, alcances con fotos y
     verificación, herramientas y conclusiones. Autoguarda tras una pausa con concurrencia optimista
     (un conflicto de versión detiene el guardado sin sobrescribir) y controla los estados. -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		aGuardado,
		partesMes,
		rangoDelPeriodo,
		validarParaRevision,
		type Observacion
	} from '$lib/dominio/captura';
	import { MESES, TEXTO_ESTADO_VERIFICACION, textoTags } from '$lib/dominio/documento';
	import type { Equipo, Foto, Reporte, ReporteGuardado } from '$lib/dominio/esquemas';
	import { llamarAccion, type EnviarAccion, type ResultadoAccion } from './acciones';
	import FotosAlcance from './FotosAlcance.svelte';
	import InsigniaEstado from './InsigniaEstado.svelte';

	export let reporte: Reporte;
	export let equiposPartida: Equipo[] = [];
	export let catalogoCambiado = false;
	export let partidaPorConfirmar = false;
	/** Pausa del autoguardado tras el último cambio, en milisegundos. */
	export let espera = 1500;
	export let enviar: EnviarAccion = llamarAccion;

	type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'conflicto' | 'error';
	type Momento = 'antes' | 'durante' | 'despues';

	const FUNCIONES = [
		{ clave: 'elaboro', etiqueta: 'Elaboró' },
		{ clave: 'aprobo', etiqueta: 'Aprobó' },
		{ clave: 'recibio', etiqueta: 'Recibió' }
	] as const;
	const TEXTO_GUARDADO: Record<EstadoGuardado, string> = {
		guardado: 'Cambios guardados',
		pendiente: 'Cambios sin guardar',
		guardando: 'Guardando…',
		conflicto: 'Versión desactualizada',
		error: 'No se guardó'
	};

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

	reporte = normalizar(reporte);
	let ultimaHuella = huella(reporte);
	let estadoGuardado: EstadoGuardado = 'guardado';
	let mensaje = '';
	let observacionesServidor: Observacion[] = [];
	let rechazadas: { nombre: string; motivo: string }[] = [];
	let cargandoPorAlcance: Record<string, number> = {};
	let ocupado = false;
	let confirmarOmitirTabla = false;
	let temporizador: ReturnType<typeof setTimeout> | null = null;
	let cola: Promise<unknown> = Promise.resolve();

	// Mientras cambia el estado o se aplica el catálogo no se edita: lo escrito se perdería.
	$: editable = reporte.estado === 'borrador' && estadoGuardado !== 'conflicto' && !ocupado;
	$: ruta = resolve('/reportes/[id]', { id: reporte.id });
	$: huellaActual = huella(reporte);
	$: if (editable && huellaActual !== ultimaHuella && estadoGuardado !== 'guardando') programar();
	$: pendientes = validarParaRevision(reporte, { requiereTag: equiposPartida.length > 0 });
	$: mes = partesMes(reporte.periodoMes);
	// Días válidos: el mes o, si aplica, la semana, quincena o día elegidos.
	$: rango = rangoDelPeriodo(reporte.periodoMes, reporte.ocurrencia);
	$: idsEquipos = new Set(reporte.equipos.map((e) => e.id));

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
			mensaje = 'El título no puede quedar vacío.';
			return false;
		}
		estadoGuardado = 'guardando';
		const datos = new FormData();
		datos.set('reporte', JSON.stringify(paraGuardar(reporte)));
		const resultado = await enviar('guardar', datos, ruta);
		if (!resultado.ok) {
			if (estadoGuardado === 'guardando') estadoGuardado = 'error';
			manejarFallo(resultado);
			return false;
		}
		const guardado = resultado.datos.reporte as Reporte;
		reporte.version = guardado.version;
		reporte.documentos = guardado.documentos;
		ultimaHuella = enviado;
		mensaje = '';
		// Lo que se escribió mientras se guardaba queda pendiente para la siguiente pausa.
		estadoGuardado = 'guardado';
		if (huella(reporte) !== enviado) programar();
		return true;
	}

	function reemplazar(nuevo: Reporte) {
		reporte = normalizar(nuevo);
		ultimaHuella = huella(reporte);
		estadoGuardado = 'guardado';
	}

	async function cargarFotos(alcanceId: string, archivos: File[], momento: Momento | null) {
		rechazadas = [];
		cargandoPorAlcance = {
			...cargandoPorAlcance,
			[alcanceId]: (cargandoPorAlcance[alcanceId] ?? 0) + archivos.length
		};
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
					cargandoPorAlcance = {
						...cargandoPorAlcance,
						[alcanceId]: (cargandoPorAlcance[alcanceId] ?? 1) - 1
					};
				}
			});
		}
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

	/** La acción redirige a la revisión nueva (llamarAccion sigue la redirección). */
	async function crearRevision() {
		ocupado = true;
		mensaje = '';
		const resultado = await enviar('revision', new FormData(), ruta);
		if (!resultado.ok) manejarFallo(resultado);
		ocupado = false;
	}

	function emitir() {
		if (
			confirm(
				'Un reporte emitido ya no se puede modificar; para corregirlo se crea una revisión. ¿Emitir?'
			)
		) {
			accionConGuardado('estado', { estado: 'emitido' });
		}
	}

	async function descargar(evento: MouseEvent) {
		if (estadoGuardado === 'guardado' || reporte.estado !== 'borrador') return;
		// Se guarda primero para descargar exactamente lo que está en pantalla.
		evento.preventDefault();
		const destino = (evento.currentTarget as HTMLAnchorElement).href;
		if (await encolar(guardar)) window.location.assign(destino);
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

	function moverAlcance(indice: number, paso: -1 | 1) {
		const destino = indice + paso;
		if (destino < 0 || destino >= reporte.alcances.length) return;
		const nuevos = [...reporte.alcances];
		[nuevos[indice], nuevos[destino]] = [nuevos[destino], nuevos[indice]];
		reporte.alcances = nuevos;
	}

	function quitarAlcance(indice: number) {
		const alcance = reporte.alcances[indice];
		const aviso = alcance.fotos.length
			? `El alcance 2.${indice + 1} tiene ${alcance.fotos.length} foto(s), que también se quitarán. ¿Continuar?`
			: `¿Quitar el alcance 2.${indice + 1}?`;
		if (confirm(aviso)) reporte.alcances = reporte.alcances.filter((_, i) => i !== indice);
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

	/** Hay cambios sin guardar o un guardado en curso. */
	export function hayCambiosPendientes(): boolean {
		return (
			reporte.estado === 'borrador' &&
			(estadoGuardado === 'pendiente' ||
				estadoGuardado === 'guardando' ||
				huella(reporte) !== ultimaHuella)
		);
	}

	/** Guarda de inmediato, después de lo que ya esté en curso. La página lo usa antes de navegar. */
	export function guardarAhora(): Promise<boolean> {
		return encolar(guardar);
	}

	function antesDeSalir(evento: BeforeUnloadEvent) {
		if (hayCambiosPendientes()) evento.preventDefault();
	}

	onDestroy(() => {
		if (temporizador) clearTimeout(temporizador);
	});
</script>

<svelte:window on:beforeunload={antesDeSalir} />

<p class="migas">
	<a class="enlace" href={resolve('/captura')}>Captura</a> / {reporte.titulo}
</p>

<section class="card barra-reporte" aria-label="Estado del reporte">
	<div class="estado-reporte">
		<InsigniaEstado estado={reporte.estado} />
		{#if reporte.revision > 0}<span class="view-note">Revisión {reporte.revision}</span>{/if}
		{#if reporte.estado === 'borrador'}
			<span class="view-note guardado-{estadoGuardado}" role="status">
				{TEXTO_GUARDADO[estadoGuardado]}
			</span>
		{/if}
	</div>
	<div class="acciones-reporte">
		{#if reporte.fechaEjecucion}
			<a
				class="boton"
				href={resolve('/reportes/[id]/documento', { id: reporte.id })}
				on:click={descargar}>Descargar DOCX</a
			>
		{/if}
		{#if reporte.estado === 'borrador'}
			<button
				class="boton primario"
				type="button"
				disabled={ocupado || estadoGuardado === 'conflicto'}
				on:click={() => accionConGuardado('estado', { estado: 'en_revision' })}
				>Enviar a revisión</button
			>
		{:else if reporte.estado === 'en_revision'}
			<button
				class="boton"
				type="button"
				disabled={ocupado}
				on:click={() => accionConGuardado('estado', { estado: 'borrador' })}
				>Regresar a borrador</button
			>
			<button class="boton primario" type="button" disabled={ocupado} on:click={emitir}
				>Emitir</button
			>
		{:else if reporte.estado === 'emitido'}
			<button class="boton" type="button" disabled={ocupado} on:click={crearRevision}
				>Crear revisión</button
			>
		{/if}
	</div>
</section>

{#if mensaje || observacionesServidor.length}
	<div class="aviso aviso-error" role="alert">
		{#if mensaje}<p>{mensaje}</p>{/if}
		{#if observacionesServidor.length}
			<ul>
				{#each observacionesServidor as o (o.campo)}<li>{o.mensaje}</li>{/each}
			</ul>
		{/if}
		{#if estadoGuardado === 'conflicto'}
			<button class="boton" type="button" on:click={() => window.location.reload()}
				>Recargar el reporte</button
			>
		{/if}
	</div>
{/if}

{#if catalogoCambiado && reporte.estado === 'borrador'}
	<div class="aviso aviso-alerta" role="status">
		<p>
			La partida cambió en el catálogo después de crear este borrador. El borrador conserva su
			contenido; puede aplicar los cambios (objetivo, alcances, herramientas y conclusiones). Las
			fotos de los alcances que siguen en el catálogo se conservan.
		</p>
		<button
			class="boton"
			type="button"
			disabled={ocupado}
			on:click={() => accionConGuardado('aplicarCatalogo', {})}>Aplicar cambios del catálogo</button
		>
	</div>
{/if}
{#if partidaPorConfirmar}
	<p class="aviso aviso-alerta">La partida de este reporte está por confirmar en el catálogo.</p>
{/if}
{#if rechazadas.length}
	<div class="aviso aviso-error" role="alert">
		<p>Algunas fotos no se cargaron; las demás se conservaron.</p>
		<ul>
			{#each rechazadas as r, i (i)}<li>{r.nombre}: {r.motivo}</li>{/each}
		</ul>
	</div>
{/if}

<fieldset class="editor-reporte" disabled={!editable}>
	<legend class="sr-only">Contenido del reporte</legend>

	<section class="card" aria-labelledby="titulo-encabezado">
		<h2 id="titulo-encabezado" class="view-heading">Encabezado</h2>
		<div class="form-grid">
			<div class="form-group ancho-completo">
				<label for="titulo">Título</label>
				<input id="titulo" bind:value={reporte.titulo} required />
			</div>
			<div class="form-group">
				<span class="etiqueta">Usuario</span>
				<span>{reporte.usuario}</span>
			</div>
			<div class="form-group">
				<span class="etiqueta">No. contrato / OC</span>
				<span>{reporte.contratoTexto}</span>
			</div>
			<div class="form-group">
				<span class="etiqueta">Sitio</span>
				<span>{reporte.sitioTexto}</span>
			</div>
			<div class="form-group">
				<span class="etiqueta">Periodicidad</span>
				<span>{reporte.periodicidad}</span>
			</div>
			<div class="form-group">
				<label for="fecha">Fecha de ejecución ({MESES[mes.mes - 1]} {mes.anio})</label>
				<input
					id="fecha"
					type="date"
					min={rango?.desde}
					max={rango?.hasta}
					bind:value={reporte.fechaEjecucion}
					aria-invalid={pendientes.some((o) => o.campo === 'fechaEjecucion')}
				/>
			</div>
			<div class="form-group">
				<label for="tipo">Tipo de mantenimiento</label>
				<input id="tipo" bind:value={reporte.tipoMantenimiento} />
			</div>
		</div>
		{#if equiposPartida.length}
			<fieldset class="casillas">
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
		{:else}
			<p class="view-note">TAG: {textoTags(reporte.equipos.map((e) => e.tag))}</p>
		{/if}
	</section>

	<section class="card" aria-labelledby="titulo-firmas">
		<h2 id="titulo-firmas" class="view-heading">Firmas</h2>
		<div class="firmas">
			{#each FUNCIONES as funcion (funcion.clave)}
				{@const firma = reporte.firmantes[funcion.clave]}
				{#if firma}
					<fieldset class="firma">
						<legend>{funcion.etiqueta}</legend>
						<label class="etiqueta" for={`firma-${funcion.clave}-nombre`}>Nombre</label>
						<input id={`firma-${funcion.clave}-nombre`} bind:value={firma.nombre} />
						<label class="etiqueta" for={`firma-${funcion.clave}-cargo`}>Cargo</label>
						<input id={`firma-${funcion.clave}-cargo`} bind:value={firma.cargo} />
						<label class="etiqueta" for={`firma-${funcion.clave}-empresa`}>Empresa</label>
						<input id={`firma-${funcion.clave}-empresa`} bind:value={firma.empresa} />
					</fieldset>
				{/if}
			{/each}
		</div>
	</section>

	<section class="card" aria-labelledby="titulo-objetivo">
		<h2 id="titulo-objetivo" class="view-heading">1. Objetivo</h2>
		<label class="sr-only" for="objetivo">Objetivo</label>
		<textarea id="objetivo" rows="4" bind:value={reporte.objetivo}></textarea>
	</section>

	<section class="card" aria-labelledby="titulo-alcance">
		<h2 id="titulo-alcance" class="view-heading">2. Alcance</h2>
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
			{#each reporte.alcances as alcance, i (alcance.id)}
				<li class="alcance">
					<div class="cabecera-alcance">
						<label for={`alcance-${alcance.id}`}>2.{i + 1}</label>
						<input
							id={`alcance-${alcance.id}`}
							placeholder="Título del alcance"
							bind:value={alcance.titulo}
						/>
						<div class="acciones-alcance">
							<button
								type="button"
								class="action-btn"
								aria-label={`Subir el alcance 2.${i + 1}`}
								disabled={i === 0}
								on:click={() => moverAlcance(i, -1)}>↑</button
							>
							<button
								type="button"
								class="action-btn"
								aria-label={`Bajar el alcance 2.${i + 1}`}
								disabled={i === reporte.alcances.length - 1}
								on:click={() => moverAlcance(i, 1)}>↓</button
							>
							<button
								type="button"
								class="action-btn delete"
								aria-label={`Quitar el alcance 2.${i + 1}`}
								on:click={() => quitarAlcance(i)}>Quitar</button
							>
						</div>
					</div>
					<label class="sr-only" for={`descripcion-${alcance.id}`}
						>Descripción del alcance 2.{i + 1}</label
					>
					<textarea
						id={`descripcion-${alcance.id}`}
						rows="2"
						placeholder="Descripción de lo realizado"
						bind:value={alcance.descripcion}
					></textarea>
					<FotosAlcance
						bind:fotos={alcance.fotos}
						posicionAlcance={i + 1}
						disposicion={reporte.disposicionFotos}
						reporteId={reporte.id}
						soloLectura={!editable}
						cargando={cargandoPorAlcance[alcance.id] ?? 0}
						otrosAlcances={reporte.alcances
							.map((a, j) => ({ id: a.id, etiqueta: `2.${j + 1} ${a.titulo}` }))
							.filter((a) => a.id !== alcance.id)}
						on:cargar={(e) => cargarFotos(alcance.id, e.detail.archivos, e.detail.momento)}
						on:mover={(e) => moverFoto(alcance.id, e.detail.fotoId, e.detail.alcanceId)}
					/>
					{#if reporte.incluyeVerificacion}
						<div class="verificacion">
							<label class="etiqueta" for={`estado-${alcance.id}`}>Verificación</label>
							<select id={`estado-${alcance.id}`} bind:value={alcance.estadoVerificacion}>
								{#each Object.entries(TEXTO_ESTADO_VERIFICACION) as [valor, texto] (valor)}
									<option value={valor}>{texto}</option>
								{/each}
							</select>
							<label class="etiqueta" for={`observaciones-${alcance.id}`}>Observaciones</label>
							<input
								id={`observaciones-${alcance.id}`}
								bind:value={alcance.observaciones}
								required={alcance.estadoVerificacion === 'con_observacion'}
								aria-invalid={alcance.estadoVerificacion === 'con_observacion' &&
									!alcance.observaciones.trim()}
							/>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
		<button class="boton" type="button" on:click={agregarAlcance}>Agregar alcance</button>
	</section>

	<section class="card" aria-labelledby="titulo-herramientas">
		<h2 id="titulo-herramientas" class="view-heading">Herramientas y equipo</h2>
		<ul class="lista-editable">
			{#each reporte.herramientas as herramienta, i (i)}
				<li>
					<label class="sr-only" for={`cantidad-${i}`}>Cantidad</label>
					<input
						id={`cantidad-${i}`}
						class="cantidad"
						placeholder="Cantidad"
						value={herramienta.cantidad ?? ''}
						on:input={(e) => (herramienta.cantidad = (e.currentTarget as HTMLInputElement).value)}
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
						on:click={() => (reporte.herramientas = reporte.herramientas.filter((_, j) => j !== i))}
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

	<section class="card" aria-labelledby="titulo-conclusiones">
		<h2 id="titulo-conclusiones" class="view-heading">Conclusiones y/o recomendaciones</h2>
		<label class="sr-only" for="conclusiones">Conclusiones</label>
		<textarea id="conclusiones" rows="4" bind:value={reporte.conclusiones}></textarea>
	</section>
</fieldset>

{#if reporte.estado === 'borrador' && pendientes.length}
	<section class="card" aria-labelledby="titulo-pendientes">
		<h2 id="titulo-pendientes" class="view-heading">Pendiente para enviar a revisión</h2>
		<ul>
			{#each pendientes as o (o.campo)}<li>{o.mensaje}</li>{/each}
		</ul>
	</section>
{/if}

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
	.estado-reporte,
	.acciones-reporte {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.editor-reporte {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	.editor-reporte textarea,
	.editor-reporte input:not([type='checkbox']),
	.editor-reporte select {
		width: 100%;
	}
	.ancho-completo {
		grid-column: 1 / -1;
	}
	.etiqueta {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--muted);
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
	@media (max-width: 600px) {
		.barra-reporte {
			padding: 8px 12px;
		}
		.acciones-reporte {
			flex-wrap: nowrap;
		}
		.acciones-reporte .boton {
			padding-inline: 12px;
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
	.guardado-pendiente,
	.guardado-guardando {
		font-style: italic;
	}
	.guardado-conflicto,
	.guardado-error {
		color: var(--danger);
		font-weight: 600;
	}
</style>
