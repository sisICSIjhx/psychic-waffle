<script lang="ts">
	import DashboardView from '$lib/components/views/DashboardView.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<DashboardView {...data} />
