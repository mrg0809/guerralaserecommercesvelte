<script lang="ts">
	import { renderProductText } from '$lib/utils/formatText';

	let { text, class: className = '' }: { text: string; class?: string } = $props();

	let html = $derived(renderProductText(text));
</script>

<div class="formatted-text {className}">
	{@html html}
</div>

<style>
	.formatted-text :global(p) {
		margin-bottom: 0.75rem;
	}

	.formatted-text :global(p:last-child) {
		margin-bottom: 0;
	}

	.formatted-text :global(ul),
	.formatted-text :global(ol) {
		margin: 0.5rem 0 0.75rem;
		padding-left: 1.5rem;
	}

	.formatted-text :global(ul) {
		list-style-type: disc;
	}

	.formatted-text :global(ol) {
		list-style-type: decimal;
	}

	.formatted-text :global(li) {
		margin-bottom: 0.25rem;
	}

	.formatted-text :global(a) {
		color: rgb(37 99 235);
		text-decoration: underline;
	}

	.formatted-text :global(a:hover) {
		color: rgb(29 78 216);
	}

	.formatted-text :global(strong) {
		font-weight: 600;
	}

	.formatted-text :global(h1),
	.formatted-text :global(h2),
	.formatted-text :global(h3) {
		font-weight: 700;
		margin: 1rem 0 0.5rem;
	}

	.formatted-text :global(h1) {
		font-size: 1.5rem;
	}

	.formatted-text :global(h2) {
		font-size: 1.25rem;
	}

	.formatted-text :global(h3) {
		font-size: 1.125rem;
	}
</style>
