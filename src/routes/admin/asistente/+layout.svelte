<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/user';
	import AssistantShell from '$lib/components/assistant/AssistantShell.svelte';

	let { children } = $props();
	let ready = $state(false);

	onMount(async () => {
		await userStore.init();
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) {
			goto('/login');
			return;
		}
		const state = get(userStore);
		const canUse =
			state.permissions.includes('use_ai_assistant') ||
			state.roles.includes('admin') ||
			state.roles.includes('superadmin');
		if (!canUse) {
			goto('/admin');
			return;
		}
		ready = true;
	});
</script>

{#if ready}
	{@render children()}
{/if}
