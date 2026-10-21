<script lang="ts">
	import MiTrabajoView from '$lib/components/views/MiTrabajoView.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<MiTrabajoView {...data} />
