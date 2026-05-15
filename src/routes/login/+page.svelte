<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/user';
	import { getPostLoginPath } from '$lib/services/permissions';
	import { goto } from '$app/navigation';
	import type { UserRole } from '$lib/types/roles';

	let email = '';
	let password = '';
	let errorMsg = '';
	let loading = false;

	async function login(e: Event) {
		e.preventDefault();
		errorMsg = '';
		loading = true;

		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			errorMsg = error.message;
			loading = false;
			return;
		}

		if (data.user) {
			await userStore.forceRefresh();
			const state = await new Promise<{ roles: UserRole[] }>((resolve) => {
				const unsub = userStore.subscribe((s) => {
					if (s.initialized) {
						unsub();
						resolve({ roles: s.roles });
					}
				});
			});
			goto(getPostLoginPath(state.roles));
		}

		loading = false;
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<form on:submit={login} class="bg-white p-6 rounded shadow w-full max-w-sm space-y-4">
		<div class="flex justify-center mb-2">
			<img src="/logorectangular.png" alt="Guerra Láser" class="h-12" />
		</div>
		<h1 class="text-2xl font-bold text-center">Iniciar sesión</h1>
		{#if errorMsg}
			<p class="text-red-600 text-sm">{errorMsg}</p>
		{/if}
		<label class="block">
			<span class="text-sm font-semibold">Email</span>
			<input type="email" bind:value={email} required class="w-full px-3 py-2 border rounded" />
		</label>
		<label class="block">
			<span class="text-sm font-semibold">Contraseña</span>
			<input type="password" bind:value={password} required class="w-full px-3 py-2 border rounded" />
		</label>
		<button
			type="submit"
			disabled={loading}
			class="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
		>
			{loading ? 'Entrando...' : 'Entrar'}
		</button>
	</form>
</div>
