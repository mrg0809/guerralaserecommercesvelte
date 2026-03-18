<script lang="ts">
	import { supabase } from '$lib/supabaseClient';

	const supabaseAny: any = supabase;

	let rate_mxn_per_usd = $state<number>(0);
	let note = $state<string>('');
	let loading = $state(true);
	let saving = $state(false);

	let rates: any[] = $state([]);

	function formatRate(v: any) {
		const n = Number(v ?? 0);
		return n.toFixed(4);
	}

	async function loadRates() {
		loading = true;
		try {
			const { data } = await supabaseAny
				.from('exchange_rates')
				.select('id, rate_mxn_per_usd, effective_at, note')
				.order('effective_at', { ascending: false })
				.limit(10);
			rates = data ?? [];
			// precargar el rate actual con el último guardado
			if (rates.length > 0) {
				rate_mxn_per_usd = Number(rates[0].rate_mxn_per_usd ?? 0);
			}
		} finally {
			loading = false;
		}
	}

	// cargar al entrar
	$effect(() => {
		void loadRates();
	});

	async function saveRate() {
		const rate = Number(rate_mxn_per_usd);
		if (!Number.isFinite(rate) || rate <= 0) {
			alert('Ingresa un tipo de cambio válido (MXN por USD)');
			return;
		}
		saving = true;
		try {
			const { error } = await supabaseAny.from('exchange_rates').insert({
				currency_from: 'USD',
				currency_to: 'MXN',
				rate_mxn_per_usd: rate,
				note: note.trim() || null
			});

			if (error) throw error;

			note = '';
			await loadRates();
			alert('Tipo de cambio guardado');
		} catch (e: any) {
			alert('Error al guardar tipo de cambio: ' + e.message);
		} finally {
			saving = false;
		}
	}
	
	function formatDate(dateString: string) {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleString('es-MX', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Tipo de Cambio - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-4xl font-bold">Tipo de Cambio</h1>
		<a
			href="/admin"
			class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
		>
			← Volver
		</a>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<div class="bg-white rounded-lg shadow-md p-6">
			<h2 class="text-xl font-bold mb-4">Guardar nuevo tipo de cambio</h2>

			<div class="space-y-4">
				<div>
					<label class="block text-sm font-semibold mb-2" for="rate">1 USD = (MXN)</label>
					<input
						id="rate"
						type="number"
						min="0"
						step="0.0001"
						bind:value={rate_mxn_per_usd}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2" for="note">Nota (opcional)</label>
					<input
						id="note"
						type="text"
						bind:value={note}
						placeholder="Ej: actualización semanal"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<button
					type="button"
					onclick={saveRate}
					disabled={saving || loading}
					class="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
				>
					{saving ? 'Guardando...' : 'Guardar tipo de cambio'}
				</button>
			</div>

			<p class="text-xs text-gray-500 mt-4">
				Se guarda el histórico para poder calcular costos en MXN con el tipo de cambio vigente o el de una fecha
				(si más adelante lo agregamos a reportes).
			</p>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6">
			<h2 class="text-xl font-bold mb-4">Últimos cambios</h2>
			{#if loading}
				<p class="text-gray-600">Cargando...</p>
			{:else if rates.length === 0}
				<p class="text-gray-600">Sin registros</p>
			{:else}
				<div class="space-y-3">
					{#each rates as r}
						<div class="flex items-start justify-between gap-4 p-3 border rounded-lg">
							<div>
								<p class="font-semibold">1 USD = {formatRate(r.rate_mxn_per_usd)} MXN</p>
								<p class="text-xs text-gray-500">{formatDate(r.effective_at)}</p>
								{#if r.note}
									<p class="text-xs text-gray-700 mt-1">{r.note}</p>
								{/if}
							</div>
							<span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">USD->MXN</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

