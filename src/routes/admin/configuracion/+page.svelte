<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';

	let loading = $state(true);
	let saving = $state(false);
	let emails = $state('');

	async function loadSetting() {
		loading = true;
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();

			if (!session?.access_token) {
				alert('No autorizado');
				return;
			}

			const response = await fetch('/api/admin/settings/order-notification-emails', {
				headers: {
					Authorization: `Bearer ${session.access_token}`
				}
			});

			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.error || 'No se pudo cargar la configuración');
			}

			emails = result.emails || '';
		} catch (error: any) {
			alert('Error al cargar configuración: ' + error.message);
		} finally {
			loading = false;
		}
	}

	async function saveSetting() {
		saving = true;
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();

			if (!session?.access_token) {
				alert('No autorizado');
				return;
			}

			const response = await fetch('/api/admin/settings/order-notification-emails', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${session.access_token}`
				},
				body: JSON.stringify({ emails })
			});

			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.error || 'No se pudo guardar la configuración');
			}

			alert('Configuración guardada');
		} catch (error: any) {
			alert('Error al guardar configuración: ' + error.message);
		} finally {
			saving = false;
		}
	}

	onMount(() => {
		void loadSetting();
	});
</script>

<svelte:head>
	<title>Configuración General - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-4xl font-bold">Configuración General</h1>
		<a href="/admin" class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
			← Volver
		</a>
	</div>

	<div class="bg-white rounded-lg shadow-md p-6 max-w-3xl">
		<h2 class="text-xl font-bold mb-3">Correos de aviso por nueva venta</h2>
		<p class="text-sm text-gray-600 mb-4">
			Ingresa los correos internos que deben recibir el aviso de venta completada. Puedes separar por
			coma, punto y coma o salto de línea.
		</p>

		<textarea
			bind:value={emails}
			rows="8"
			placeholder="produccion@tuempresa.com&#10;ventas@tuempresa.com"
			class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
			disabled={loading || saving}
		></textarea>

		<div class="mt-4 flex gap-3">
			<button
				type="button"
				onclick={saveSetting}
				disabled={loading || saving}
				class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
			>
				{saving ? 'Guardando...' : 'Guardar'}
			</button>
			<button
				type="button"
				onclick={loadSetting}
				disabled={loading || saving}
				class="bg-gray-100 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-200 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed font-medium border border-gray-300"
			>
				Recargar
			</button>
		</div>
	</div>
</div>
