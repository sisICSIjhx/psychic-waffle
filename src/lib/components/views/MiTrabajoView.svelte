<!-- Inicio «Mi trabajo»: avance del mes, tarjetas que llevan a cada lista y el siguiente trabajo
     ordenado por urgencia, con «Capturar» o «Continuar borrador» en un clic. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { ETIQUETA_OCURRENCIA } from '$lib/dominio/captura';
	import { fechaEnZona } from '$lib/dominio/fechas';
	import type { ResumenMes, TrabajoPendiente } from '$lib/dominio/planeacion';
	import { plural, textoMes, textoOracion } from '$lib/dominio/textos';

	type Filtro = 'vencidos' | 'mes' | 'todos';

	export let hoy = fechaEnZona();
	export let resumen: ResumenMes = { programadas: 0, cumplidas: 0, pendientes: 0, vencidas: 0 };
	export let programasVigentes = 0;
	export let trabajo: (TrabajoPendiente & { sitio: string })[] = [];
	export let ver: Filtro | null = null;
	export let borradores = 0;
	export let enRevision = 0;

	/** Elementos de la lista sin filtro; el resto queda a un clic en «Ver todos». */
	const MOSTRADOS = 10;
	const TITULO_FILTRO: Record<Filtro, string> = {
		vencidos: 'Pendientes vencidos',
		mes: 'Pendientes del mes',
		todos: 'Todo el trabajo pendiente'
	};

	$: porcentaje = resumen.programadas
		? Math.round((resumen.cumplidas / resumen.programadas) * 100)
		: 0;
	$: filtrados =
		ver === 'vencidos'
			? trabajo.filter((t) => t.estado === 'vencido')
			: ver === 'mes'
				? trabajo.filter((t) => t.estado === 'pendiente')
				: trabajo;
	$: mostrados = ver ? filtrados : filtrados.slice(0, MOSTRADOS);
	$: restantes = filtrados.length - mostrados.length;
	$: tarjetas = [
		{
			clave: 'vencidos',
			valor: resumen.vencidas,
			etiqueta: 'Pendientes vencidos',
			destino: `${resolve('/')}?ver=vencidos#siguiente-trabajo`,
			peligro: resumen.vencidas > 0
		},
		{
			clave: 'mes',
			valor: resumen.pendientes,
			etiqueta: 'Pendientes del mes',
			destino: `${resolve('/')}?ver=mes#siguiente-trabajo`,
			peligro: false
		},
		{
			clave: 'borradores',
			valor: borradores,
			etiqueta: 'Borradores abiertos',
			destino: `${resolve('/historial')}?estado=borrador`,
			peligro: false
		},
		{
			clave: 'revision',
			valor: enRevision,
			etiqueta: 'En revisión',
			destino: `${resolve('/historial')}?estado=en_revision`,
			peligro: false
		}
	];

	/** Captura nueva con contrato, sitio, partida y mes ya elegidos. */
	const captura = (t: TrabajoPendiente) =>
		`${resolve('/captura')}?contrato=${t.contratoId}&sitio=${t.sitioId}&partida=${t.partidaId}&mes=${t.mes}${t.reprogramacionId ? `&reprogramacion=${t.reprogramacionId}` : ''}`;

	const detalleBorrador = (b: TrabajoPendiente['borradores'][number]) =>
		[
			b.ocurrencia ? `${ETIQUETA_OCURRENCIA[b.ocurrencia.tipo]} ${b.ocurrencia.numero}` : '',
			b.tags ?? ''
		]
			.filter(Boolean)
			.join(' · ');
</script>

<!-- Los enlaces llevan filtros en la consulta o un ancla: resolve() se aplica a la ruta. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<section class="card avance-mes" aria-labelledby="titulo-avance">
	{#if programasVigentes === 0}
		<h2 id="titulo-avance" class="view-heading">No hay programas anuales vigentes</h2>
		<p class="view-note sin-programa">
			Sin programa no se sabe qué toca capturar este mes. Importe el programa anual desde el
			catálogo del contrato.
		</p>
		<a class="boton primario" href={resolve('/catalogo')}>Ir al catálogo</a>
	{:else}
		<div class="lectura">
			<h2 id="titulo-avance" class="titulo-avance">
				<span class="mes">{textoMes(hoy, { inicial: true })}:</span>
				<span class="cifra realizadas">{resumen.cumplidas}</span> de {plural(
					resumen.programadas,
					'partida realizada',
					'partidas realizadas'
				)}
			</h2>
			<span class="porcentaje cifra">{porcentaje} %</span>
		</div>
		<progress
			class="barra-avance"
			max={Math.max(resumen.programadas, 1)}
			value={resumen.cumplidas}
			aria-labelledby="titulo-avance"
		></progress>
		<p class="view-note">
			{plural(programasVigentes, 'programa anual vigente', 'programas anuales vigentes')}.
		</p>
	{/if}

	<ul class="tarjetas" aria-label="Resumen del trabajo">
		{#each tarjetas as tarjeta (tarjeta.clave)}
			<li>
				<a class="tarjeta" class:peligro={tarjeta.peligro} href={tarjeta.destino}>
					<span class="valor cifra">{tarjeta.valor}</span>
					<span class="etiqueta">
						{#if tarjeta.peligro}<svg
								class="icono"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
								><path
									d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
								/><path d="M12 9v4M12 17h.01" /></svg
							>{/if}{tarjeta.etiqueta}
					</span>
				</a>
			</li>
		{/each}
	</ul>
</section>

<section id="siguiente-trabajo" class="card" aria-labelledby="titulo-siguiente" tabindex="-1">
	<div class="cabecera-lista">
		<h2 id="titulo-siguiente" class="view-heading">
			{ver ? TITULO_FILTRO[ver] : 'Siguiente trabajo'}
		</h2>
		{#if ver}<a class="enlace" href={`${resolve('/')}#siguiente-trabajo`}>Ver lo más urgente</a
			>{:else}<span class="view-note">Lo vencido primero; después, lo del mes.</span>{/if}
	</div>

	{#if filtrados.length === 0}
		{#if ver && trabajo.length > 0}
			<!-- Con un filtro vacío no se dice «al día»: puede haber trabajo de otro tipo. -->
			<p class="view-note">No hay {TITULO_FILTRO[ver].toLowerCase()} por ahora.</p>
		{:else if programasVigentes > 0}
			<p class="al-dia">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg
				> El trabajo programado está al día.
			</p>
			<div class="acciones-vacio">
				<a class="boton primario" href={resolve('/captura')}>Ir a Capturar</a>
				{#if borradores > 0}
					<a class="boton" href={`${resolve('/historial')}?estado=borrador`}
						>Revisar {plural(borradores, 'borrador', 'borradores')}</a
					>
				{/if}
			</div>
		{:else}
			<p class="view-note">Cuando haya un programa vigente, aquí aparecerá lo que toca capturar.</p>
		{/if}
	{:else}
		<ul class="lista-trabajo">
			{#each mostrados as t (`${t.sitioId}-${t.partidaId}-${t.mes}`)}
				<li class="elemento">
					<div class="datos">
						<span class="estado estado-{t.estado}">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
								><circle cx="12" cy="12" r="9" />{#if t.estado === 'vencido'}<path
										d="M12 8v5M12 16.5h.01"
									/>{:else}<path d="M12 7v5l3 2" />{/if}</svg
							>
							{t.estado === 'vencido' ? 'Vencido' : 'Pendiente'} · {textoMes(t.mes)}
						</span>
						<span class="partida"
							><strong>Partida {t.numero}</strong> {textoOracion(t.actividad)}</span
						>
						<span class="view-note">{t.sitio}{t.faltan > 1 ? ` · faltan ${t.faltan}` : ''}</span>
					</div>
					<div class="acciones">
						{#each t.borradores as borrador (borrador.id)}
							{@const detalle = detalleBorrador(borrador)}
							<a
								class="boton primario"
								href={resolve('/reportes/[id]', { id: borrador.id })}
								title={borrador.titulo}>Continuar borrador{detalle ? ` (${detalle})` : ''}</a
							>
						{/each}
						<!-- Una columna de botones rellenos competiría consigo misma: la acción de fila es
						     secundaria y solo «Continuar borrador» (retomar trabajo empezado) se destaca. -->
						<a
							class="boton contorno"
							href={captura(t)}
							aria-label={`Capturar partida ${t.numero} de ${textoMes(t.mes)}`}>Capturar</a
						>
					</div>
				</li>
			{/each}
		</ul>
		{#if restantes > 0}
			<p class="restantes">
				{plural(restantes, 'pendiente más', 'pendientes más')}.
				<a class="enlace" href={`${resolve('/')}?ver=todos#siguiente-trabajo`}>Ver todos</a>
			</p>
		{/if}
	{/if}
</section>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
	/* Lectura del mes: la cifra realizada manda; los contadores van debajo, en la misma pieza. */
	.lectura {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
	}
	.titulo-avance {
		margin: 0;
		font-size: var(--texto-md);
		font-weight: 500;
		color: var(--tinta-secundaria);
	}
	.mes {
		color: var(--tinta);
		font-weight: 600;
	}
	.realizadas {
		font-size: var(--texto-xl);
		font-weight: 700;
		color: var(--tinta);
		letter-spacing: -0.02em;
	}
	.porcentaje {
		font-size: var(--texto-md);
		font-weight: 600;
		white-space: nowrap;
	}
	.barra-avance {
		appearance: none;
		display: block;
		width: 100%;
		height: 6px;
		margin: 10px 0 8px;
		border: none;
		border-radius: 3px;
		overflow: hidden;
		background: var(--neutro-fondo);
		color: var(--accion);
	}
	.barra-avance::-webkit-progress-bar {
		background: var(--neutro-fondo);
	}
	.barra-avance::-webkit-progress-value {
		background: var(--accion);
	}
	.barra-avance::-moz-progress-bar {
		background: var(--accion);
	}
	.sin-programa {
		margin-bottom: 16px;
	}
	.tarjetas {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 4px;
		list-style: none;
		margin: 16px -12px -8px;
		padding: 12px 0 0;
		border-top: 1px solid var(--linea);
	}
	.tarjeta {
		display: grid;
		gap: 2px;
		padding: 8px 12px;
		border-radius: var(--radio-control);
		color: var(--tinta);
		transition: background-color 0.12s var(--curva-salida);
	}
	.tarjeta:hover {
		background: var(--superficie-hover);
	}
	.valor {
		font-size: var(--texto-xl);
		font-weight: 600;
		line-height: 1.15;
		letter-spacing: -0.02em;
	}
	.etiqueta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--tinta-tenue);
		font-size: var(--texto-sm);
	}
	.icono {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}
	.peligro .valor,
	.peligro .etiqueta {
		color: var(--peligro);
	}
	.peligro .etiqueta {
		font-weight: 600;
	}
	.peligro:hover {
		background: var(--peligro-fondo);
	}
	.cabecera-lista {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		align-items: baseline;
		justify-content: space-between;
	}
	.cabecera-lista .view-heading {
		margin-bottom: 8px;
	}
	.lista-trabajo {
		display: grid;
		list-style: none;
		margin: 0 -12px;
		padding: 0;
	}
	.elemento {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		align-items: center;
		justify-content: space-between;
		padding: 12px;
		border-top: 1px solid var(--linea);
	}
	.elemento:first-child {
		border-top-color: transparent;
	}
	.elemento:hover {
		background: var(--superficie-alta);
	}
	.datos {
		display: grid;
		gap: 2px;
		flex: 1 1 320px;
		min-width: 0;
	}
	.estado {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--texto-sm);
		font-weight: 600;
	}
	.estado svg {
		width: 14px;
		height: 14px;
	}
	.estado-vencido {
		color: var(--peligro);
	}
	.estado-pendiente {
		color: var(--info);
	}
	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.al-dia {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--exito);
		font-weight: 600;
	}
	.al-dia svg {
		width: 16px;
		height: 16px;
	}
	.acciones-vacio {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.restantes {
		margin: 12px 0 0;
		color: var(--tinta-tenue);
	}
	@media (max-width: 768px) {
		.tarjetas {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
