<script lang="ts">
	import { page } from '$app/stores';
	import AssistantShell from '$lib/components/assistant/AssistantShell.svelte';

	const initialMode = $derived($page.url.searchParams.get('mode') === 'quote' ? 'quotation' : 'knowledge');
</script>

<AssistantShell mode="admin" showBackLink={true} {initialMode} />
