<!-- Inicio «Mi trabajo»: avance del mes, tarjetas que llevan a cada lista y el siguiente trabajo
     ordenado por urgencia, con «Capturar» o «Continuar borrador» en un clic. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { ETIQUETA_OCURRENCIA } from '$lib/dominio/captura';
	import { fechaEnZona } from '$lib/dominio/fechas';
	import type { ResumenMes, TrabajoPendiente } from '$lib/dominio/planeacion';
	import { plural, textoMes } from '$lib/dominio/textos';

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
		`${resolve('/captura')}?contrato=${t.contratoId}&sitio=${t.sitioId}&partida=${t.partidaId}&mes=${t.mes}`;

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
		<p class="view-note">
			Sin programa no se sabe qué toca capturar este mes. Importe el programa anual desde el
			catálogo del contrato.
		</p>
		<a class="boton primario" href={resolve('/catalogo')}>Ir al catálogo</a>
	{:else}
		<h2 id="titulo-avance" class="view-heading">
			{textoMes(hoy, { inicial: true })}: {resumen.cumplidas} de {plural(
				resumen.programadas,
				'partida realizada',
				'partidas realizadas'
			)}
		</h2>
		<div class="barra-avance">
			<progress
				max={Math.max(resumen.programadas, 1)}
				value={resumen.cumplidas}
				aria-labelledby="titulo-avance"
			></progress>
			<span class="porcentaje">{porcentaje} %</span>
		</div>
		<p class="view-note">
			{plural(programasVigentes, 'programa anual vigente', 'programas anuales vigentes')}.
		</p>
	{/if}
</section>

<ul class="tarjetas" aria-label="Resumen del trabajo">
	{#each tarjetas as tarjeta (tarjeta.clave)}
		<li>
			<a class="card tarjeta" class:peligro={tarjeta.peligro} href={tarjeta.destino}>
				<span class="icono" aria-hidden="true">
					{#if tarjeta.clave === 'vencidos'}!{:else if tarjeta.clave === 'mes'}●{:else if tarjeta.clave === 'borradores'}✎{:else}◉{/if}
				</span>
				<span class="valor">{tarjeta.valor}</span>
				<span class="etiqueta">{tarjeta.etiqueta}</span>
			</a>
		</li>
	{/each}
</ul>

<section id="siguiente-trabajo" class="card" aria-labelledby="titulo-siguiente" tabindex="-1">
	<div class="cabecera-lista">
		<h2 id="titulo-siguiente" class="view-heading">
			{ver ? TITULO_FILTRO[ver] : 'Siguiente trabajo'}
		</h2>
		{#if ver}<a class="enlace" href={`${resolve('/')}#siguiente-trabajo`}>Ver lo más urgente</a
			>{/if}
	</div>

	{#if filtrados.length === 0}
		{#if ver && trabajo.length > 0}
			<!-- Con un filtro vacío no se dice «al día»: puede haber trabajo de otro tipo. -->
			<p class="view-note">No hay {TITULO_FILTRO[ver].toLowerCase()} por ahora.</p>
		{:else if programasVigentes > 0}
			<p class="al-dia"><span aria-hidden="true">✓</span> El trabajo programado está al día.</p>
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
							<span aria-hidden="true">{t.estado === 'vencido' ? '!' : '●'}</span>
							{t.estado === 'vencido' ? 'Vencido' : 'Pendiente'} · {textoMes(t.mes)}
						</span>
						<span class="partida"><strong>Partida {t.numero}</strong> {t.actividad}</span>
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
						<a
							class="boton"
							class:primario={t.borradores.length === 0}
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
	.avance-mes .view-heading {
		margin-bottom: 8px;
	}
	.barra-avance {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}
	.barra-avance progress {
		flex: 1;
		height: 14px;
		accent-color: var(--primary);
	}
	.porcentaje {
		font-weight: 600;
	}
	.tarjetas {
		display: grid;
		gap: 16px;
		grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
		list-style: none;
		margin: 0 0 20px;
		padding: 0;
	}
	.tarjeta {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-areas:
			'icono valor'
			'icono etiqueta';
		gap: 0 12px;
		align-items: center;
		margin: 0;
		color: var(--text);
		border-left: 4px solid var(--border);
	}
	.tarjeta:hover {
		border-color: var(--primary);
	}
	.tarjeta.peligro {
		border-left-color: var(--danger);
		background: var(--danger-bg);
	}
	.icono {
		grid-area: icono;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--neutral-bg);
		font-weight: 700;
	}
	.peligro .icono {
		background: var(--danger);
		color: var(--surface);
	}
	.valor {
		grid-area: valor;
		font-size: 1.6rem;
		font-weight: 800;
		line-height: 1.1;
	}
	.etiqueta {
		grid-area: etiqueta;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.peligro .valor,
	.peligro .etiqueta {
		color: var(--danger);
	}
	.cabecera-lista {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		align-items: baseline;
		justify-content: space-between;
	}
	.lista-trabajo {
		display: grid;
		gap: 0;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.elemento {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		align-items: center;
		justify-content: space-between;
		padding: 12px 0;
		border-top: 1px solid var(--border);
	}
	.datos {
		display: grid;
		gap: 2px;
		flex: 1 1 320px;
		min-width: 0;
	}
	.estado {
		display: inline-flex;
		gap: 6px;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.estado-vencido {
		color: var(--danger);
	}
	.estado-pendiente {
		color: var(--warning);
	}
	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.al-dia {
		color: var(--success);
		font-weight: 600;
	}
	.acciones-vacio {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.restantes {
		margin: 12px 0 0;
	}
</style>
