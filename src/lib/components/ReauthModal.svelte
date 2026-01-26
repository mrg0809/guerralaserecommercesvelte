<script lang="ts">
	import { supabase } from '$lib/supabaseClient';

	let { 
		show = false, 
		onReauth = () => {}, 
		onsuccess = (data: any) => {},
		onlogout = () => {}
	} = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleReauth() {
		if (!email || !password) {
			error = 'Por favor completa todos los campos';
			return;
		}

		loading = true;
		error = '';

		try {
			const { data, error: signInError } = await supabase.auth.signInWithPassword({
				email,
				password
			});

			if (signInError) {
				error = signInError.message;
				return;
			}

			if (data.user && data.session) {
				onsuccess({ user: data.user, session: data.session });
				onReauth();
			}
		} catch (err) {
			error = 'Error al iniciar sesión';
		} finally {
			loading = false;
		}
	}

	function handleLogout() {
		supabase.auth.signOut();
		onlogout();
	}
</script>

{#if show}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
			<div class="text-center mb-6">
				<h2 class="text-2xl font-bold text-gray-900 mb-2">Sesión Expirada</h2>
				<p class="text-gray-600">
					Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente para continuar.
				</p>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleReauth(); }} class="space-y-4">
				{#if error}
					<div class="bg-red-50 border border-red-200 rounded-lg p-3">
						<p class="text-red-600 text-sm">{error}</p>
					</div>
				{/if}

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
					<input
						type="email"
						bind:value={email}
						placeholder="tu@email.com"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						required
					/>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
					<input
						type="password"
						bind:value={password}
						placeholder="••••••••"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						required
					/>
				</div>

				<div class="flex gap-3">
					<button
						type="submit"
						disabled={loading}
						class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
					>
						{loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
					</button>
					<button
						type="button"
						onclick={handleLogout}
						class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition font-medium"
					>
						Cerrar Sesión
					</button>
				</div>
			</form>

			<div class="mt-4 text-center">
				<p class="text-xs text-gray-500">
					Para sesiones más largas, considera "Recordarme" en el próximo inicio de sesión.
				</p>
			</div>
		</div>
	</div>
{/if}
