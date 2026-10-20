<!-- components/fields/SelectField.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	type Opcion = { value: string; label: string; disabled?: boolean };

	export let label = '';
	export let name = '';
	export let value = '';
	export let options: Opcion[] = [];
	export let placeholder = 'Selecciona una opción';
	export let disabled = false;
	export let required = false;

	const dispatch = createEventDispatcher<{ change: { name: string; value: string } }>();

	function handleChange(event: Event) {
		const newValue = (event.target as HTMLSelectElement).value;
		dispatch('change', { name, value: newValue });
	}
</script>

<div class="form-group">
	{#if label}
		<label for={name}>{label}</label>
	{/if}
	<select id={name} {name} {disabled} {required} {value} on:change={handleChange}>
		{#if placeholder}
			<option value="" disabled={required}>{placeholder}</option>
		{/if}
		{#each options as option (option.value)}
			<option value={option.value} disabled={option.disabled}>{option.label}</option>
		{/each}
	</select>
</div>
