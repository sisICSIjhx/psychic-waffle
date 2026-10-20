<!-- components/fields/DateField.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label = '';
	export let name = '';
	/** Fecha en formato AAAA-MM-DD. */
	export let value = '';
	export let min = '';
	export let max = '';
	export let readonly = false;
	export let required = false;

	const dispatch = createEventDispatcher<{ change: { name: string; value: string } }>();

	function handleInput(event: Event) {
		const newValue = (event.target as HTMLInputElement).value;
		dispatch('change', { name, value: newValue });
	}
</script>

<div class="form-group">
	{#if label}
		<label for={name}>{label}</label>
	{/if}
	<input
		id={name}
		{name}
		type="date"
		min={min || undefined}
		max={max || undefined}
		{readonly}
		{required}
		{value}
		on:input={handleInput}
	/>
</div>
