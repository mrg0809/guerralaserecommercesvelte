<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/user';

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
		const canTech =
			state.permissions.includes('view_technician_panel') ||
			state.roles.includes('tecnico') ||
			state.roles.includes('admin') ||
			state.roles.includes('superadmin');

		if (!canTech) {
			if (state.permissions.includes('view_admin_panel')) {
				goto('/admin');
			} else {
				goto('/login');
			}
			return;
		}

		ready = true;
	});

	async function logout() {
		await supabase.auth.signOut();
		userStore.logout();
		goto('/login');
	}
</script>

{#if ready}
	<div class="min-h-screen bg-gray-100 pb-20">
		<header class="bg-white shadow sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
			<a href="/tecnico/entregas" class="flex items-center gap-2">
				<img src="/logorectangular.png" alt="Guerra Láser" class="h-8" />
			</a>
			<button type="button" class="text-sm text-gray-600" onclick={logout}>Salir</button>
		</header>
		<main class="px-4 py-4 max-w-lg mx-auto">
			{@render children()}
		</main>
	</div>
{:else}
	<div class="min-h-screen flex items-center justify-center">
		<p class="text-gray-500">Cargando...</p>
	</div>
{/if}
