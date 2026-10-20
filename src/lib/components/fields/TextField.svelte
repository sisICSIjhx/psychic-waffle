<!-- components/fields/TextField.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label = '';
	export let name = '';
	export let type = 'text';
	export let value = '';
	export let placeholder = '';
	export let readonly = false;

	const dispatch = createEventDispatcher();

	function handleInput(event: Event) {
		const newValue = (event.target as HTMLInputElement).value;
		dispatch('change', { name, value: newValue });
	}
</script>

<div class="form-group">
	{#if label}
		<label for={name}>{label}</label>
	{/if}
	<input id={name} {name} {type} {placeholder} {readonly} {value} on:input={handleInput} />
</div>
