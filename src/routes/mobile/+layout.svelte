<script lang="ts">
	import { onMount } from 'svelte';
	import '$lib/components/assistant/assistant.css';
	import { initNativeAssistantApp } from '$lib/mobile/nativeApp';

	let { children } = $props();

	onMount(() => {
		document.documentElement.classList.add('assistant-standalone-page');
		void initNativeAssistantApp();
		return () => {
			document.documentElement.classList.remove('assistant-standalone-page');
		};
	});
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<meta name="theme-color" content="#131314" />
</svelte:head>

{@render children()}
