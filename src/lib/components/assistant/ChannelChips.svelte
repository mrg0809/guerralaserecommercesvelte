<script lang="ts">
	import type { AiKnowledgeChannel } from '$lib/types/assistant';
	import { AI_CHANNELS } from '$lib/types/assistant';

	let {
		activeChannel = $bindable('general' as AiKnowledgeChannel),
		onchange
	}: {
		activeChannel?: AiKnowledgeChannel;
		onchange?: (channel: AiKnowledgeChannel) => void;
	} = $props();

	function select(channel: AiKnowledgeChannel) {
		activeChannel = channel;
		onchange?.(channel);
	}
</script>

<div class="flex flex-wrap gap-2 px-4 py-2 overflow-x-auto">
	{#each AI_CHANNELS as ch}
		<button
			type="button"
			class="assistant-chip {activeChannel === ch.id ? 'active' : ''}"
			onclick={() => select(ch.id)}
		>
			<span>{ch.emoji}</span>
			<span>{ch.label}</span>
		</button>
	{/each}
</div>
