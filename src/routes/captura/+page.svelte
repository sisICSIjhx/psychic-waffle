<script lang="ts">
	import { page } from '$app/stores';
	import CapturaView from '$lib/components/views/CapturaView.svelte';
</script>

<CapturaView cliente={$page.url.searchParams.get('cliente')} />
