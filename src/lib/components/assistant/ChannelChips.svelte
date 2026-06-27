<script lang="ts">
	export type AiChannel = { slug: string; label: string; emoji: string };

	let {
		channels = [],
		activeChannel = $bindable('general'),
		onchange
	}: {
		channels?: AiChannel[];
		activeChannel?: string;
		onchange?: (channel: string) => void;
	} = $props();

	function select(slug: string) {
		activeChannel = slug;
		onchange?.(slug);
	}
</script>

<div class="flex flex-wrap gap-2 px-4 py-2 overflow-x-auto">
	{#each channels as ch}
		<button
			type="button"
			class="assistant-chip {activeChannel === ch.slug ? 'active' : ''}"
			onclick={() => select(ch.slug)}
		>
			<span>{ch.emoji}</span>
			<span>{ch.label}</span>
		</button>
	{:else}
		<span class="text-xs text-[var(--as-text-muted)] px-2">Cargando temas...</span>
	{/each}
</div>
