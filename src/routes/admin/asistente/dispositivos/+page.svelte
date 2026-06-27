<script lang="ts">
	import { onMount } from 'svelte';
	import { aiFetch } from '$lib/assistantApi';

	let message = $state('');

	onMount(() => {
		message =
			'Gestiona el token del APK desde Supabase (tabla mobile_app_tokens) o ejecuta: npx tsx scripts/create-mobile-app-token.ts';
	});

	async function loadArticles() {
		const res = await aiFetch('/api/ai/knowledge');
		if (res.ok) {
			const data = await res.json();
			message = `${data.articles?.length ?? 0} artículos en la base de conocimientos`;
		}
	}
</script>

<div class="p-6 max-w-2xl text-white" style="background:#131314;min-height:100vh">
	<h1 class="text-xl font-bold mb-4">Dispositivos y token móvil</h1>
	<p class="text-sm text-gray-400 mb-4">
		Un solo APK para todo el equipo. El token se embebe como <code>PUBLIC_MOBILE_APP_TOKEN</code> en el build.
	</p>

	<div class="rounded-lg border border-gray-700 p-4 mb-4 text-sm space-y-2">
		<p><strong>1.</strong> Ejecuta la migración SQL en Supabase</p>
		<p><strong>2.</strong> Genera token: <code>npx tsx scripts/create-mobile-app-token.ts</code></p>
		<p><strong>3.</strong> Añade a .env: <code>PUBLIC_MOBILE_APP_TOKEN=gl_mob_...</code></p>
		<p><strong>4.</strong> Build APK con Capacitor (Fase 2.5)</p>
	</div>

	<p class="text-sm text-gray-300">{message}</p>

	<button
		type="button"
		class="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-sm"
		onclick={loadArticles}
	>
		Verificar conexión KB
	</button>

	<a href="/admin/asistente" class="block mt-6 text-blue-400 text-sm hover:underline">← Volver al asistente</a>
</div>
