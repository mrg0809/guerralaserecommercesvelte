<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		goto('/admin/asistente?mode=quote');
	});
</script>

<p class="p-8">Redirigiendo al asistente...</p>
