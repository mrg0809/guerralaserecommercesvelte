<script lang="ts">
	import { onMount } from 'svelte';

	let testData = $state({
		cartItems: [
			{
				product: {
					id: '1',
					name: 'Tubo Láser CO2 60W',
					base_price: 5000,
					shipping_type: 'delicate'
				},
				quantity: 1
			}
		],
		destination: {
			street: 'Gustavo Diaz Ordaz 235',
			city: 'Tijuana',
			state: 'BC',
			zip: '22106',
			country: 'MX'
		},
		customerInfo: {
			name: 'Marcelo Rodriguez Guerra',
			email: 'mrg0809@gmail.com',
			phone: '6643654383'
		}
	});

	let loading = $state(false);
	let error = $state('');
	let result = $state<any>(null);
	let enviaStatus = $state<any>(null);
	let checkingConfig = $state(true);

	onMount(async () => {
		// Check if token is configured on the server
		try {
			const response = await fetch('/api/config/envia-status');
			enviaStatus = await response.json();
		} catch (e) {
			console.error('Error checking Envia status:', e);
			enviaStatus = { configured: false };
		} finally {
			checkingConfig = false;
		}
	});

	async function testQuote() {
		loading = true;
		error = '';
		result = null;

		try {
			console.log('📦 Enviando solicitud de cotización:', testData);

			const response = await fetch('/api/shipping/quote', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testData)
			});

			const data = await response.json();
			console.log('✅ Respuesta recibida:', data);

			result = data;

			if (!response.ok) {
				error = data.error || 'Error al obtener cotización';
			}
		} catch (e: any) {
			error = e.message;
			console.error('❌ Error:', e);
		} finally {
			loading = false;
		}
	}

	function updateTestData(field: string, value: any) {
		const parts = field.split('.');
		let current: any = testData;

		for (let i = 0; i < parts.length - 1; i++) {
			current = current[parts[i]];
		}

		current[parts[parts.length - 1]] = value;
		testData = { ...testData };
	}
</script>

<svelte:head>
	<title>Prueba Envia.com - Guerra Láser</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-4xl font-bold mb-8">🧪 Prueba de Integración Envia.com</h1>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Form -->
			<div class="lg:col-span-2 space-y-6">
				<!-- Config Info -->
				<div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
					<h2 class="text-xl font-bold mb-3">⚙️ Configuración</h2>
					<div class="space-y-2 text-sm">
					{#if checkingConfig}
						<div class="animate-pulse">Verificando configuración...</div>
					{:else if enviaStatus?.configured}
						<p>
							<strong>Token Envia.com:</strong>
							<code class="bg-white px-2 py-1 rounded text-xs">✅ CONFIGURADO</code>
						</p>
						<p class="text-gray-600">
							Token: <code class="bg-white px-1 py-1 rounded text-xs text-green-600">{enviaStatus.tokenPreview}</code>
						</p>
						<p class="text-green-700 font-semibold">
							Se usarán tarifas reales de Envia.com
						</p>
					{:else}
						<p>
							<strong>Token Envia.com:</strong>
							<code class="bg-white px-2 py-1 rounded text-xs">❌ NO CONFIGURADO</code>
						</p>
						<p class="text-gray-600">
							Agrega <code>VITE_ENVIA_API_TOKEN</code> a tu archivo <code>.env</code> para usar la API real de Envia.com
						</p>
						<p class="text-yellow-700 font-semibold">
							Se usarán tarifas de prueba
						</p>
					{/if}
				<div class="bg-white rounded-lg shadow-md p-6">
					<h2 class="text-xl font-bold mb-4">📋 Datos de Prueba</h2>

					<div class="space-y-4">
						<!-- Destination -->
						<div>
							<h3 class="font-semibold mb-3">Destino</h3>
							<div class="space-y-3">
								<div>
									<label class="block text-sm font-medium mb-1">Calle</label>
									<input
										type="text"
										bind:value={testData.destination.street}
										class="w-full px-3 py-2 border border-gray-300 rounded-lg"
									/>
								</div>
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="block text-sm font-medium mb-1">Ciudad</label>
										<input
											type="text"
											bind:value={testData.destination.city}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg"
										/>
									</div>
									<div>
										<label class="block text-sm font-medium mb-1">Estado</label>
										<input
											type="text"
											bind:value={testData.destination.state}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg"
										/>
									</div>
								</div>
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="block text-sm font-medium mb-1">CP</label>
										<input
											type="text"
											bind:value={testData.destination.zip}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg"
										/>
									</div>
									<div>
										<label class="block text-sm font-medium mb-1">País</label>
										<input
											type="text"
											bind:value={testData.destination.country}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg"
										/>
									</div>
								</div>
							</div>
						</div>

						<!-- Customer Info -->
						<div>
							<h3 class="font-semibold mb-3">Información del Cliente</h3>
							<div class="space-y-3">
								<div>
									<label class="block text-sm font-medium mb-1">Nombre</label>
									<input
										type="text"
										bind:value={testData.customerInfo.name}
										class="w-full px-3 py-2 border border-gray-300 rounded-lg"
									/>
								</div>
								<div>
									<label class="block text-sm font-medium mb-1">Email</label>
									<input
										type="email"
										bind:value={testData.customerInfo.email}
										class="w-full px-3 py-2 border border-gray-300 rounded-lg"
									/>
								</div>
								<div>
									<label class="block text-sm font-medium mb-1">Teléfono</label>
									<input
										type="tel"
										bind:value={testData.customerInfo.phone}
										class="w-full px-3 py-2 border border-gray-300 rounded-lg"
									/>
								</div>
							</div>
						</div>

						<!-- Actions -->
						<button
							onclick={testQuote}
							disabled={loading}
							class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition"
						>
							{loading ? 'Consultando...' : '🚀 Probar Cotización'}
						</button>
					</div>
				</div>
			</div>

			<!-- Results -->
			<div class="lg:col-span-1">
				<div class="bg-white rounded-lg shadow-md p-6 sticky top-4">
					<h2 class="text-xl font-bold mb-4">📊 Resultado</h2>

					{#if error}
						<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
							<p class="font-semibold mb-2">❌ Error</p>
							<p class="text-sm">{error}</p>
						</div>
					{:else if result}
						<div class="space-y-3">
							{#if result.warning}
								<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
									<p class="text-sm text-yellow-800">
										<strong>⚠️</strong> {result.warning}
									</p>
								</div>
							{/if}

							{#if result.rates && result.rates.length > 0}
								<div class="bg-green-50 border border-green-200 rounded-lg p-3">
									<p class="text-sm text-green-800 font-semibold">
										✅ {result.rates.length} opciones disponibles
									</p>
								</div>

								<div class="space-y-2">
									{#each result.rates as rate}
										<div class="bg-gray-50 rounded p-3">
											<div class="flex justify-between items-start mb-1">
												<p class="font-semibold text-sm">
													{rate.carrier.toUpperCase()} - {rate.service}
												</p>
												<p class="font-bold text-blue-600">${rate.price}</p>
											</div>
											<p class="text-xs text-gray-600">{rate.description}</p>
											<p class="text-xs text-gray-600">
												{rate.deliveryDays} días
											</p>
										</div>
									{/each}
								</div>
							{:else if result.rates}
								<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
									<p class="text-sm text-yellow-800">
										⚠️ No hay tarifas disponibles para este destino
									</p>
								</div>
							{/if}

							<details class="text-xs">
								<summary class="cursor-pointer font-semibold mb-2">Ver JSON completo</summary>
								<pre class="bg-gray-100 p-2 rounded overflow-auto max-h-64">{JSON.stringify(result, null, 2)}</pre>
							</details>
						</div>
					{:else}
						<p class="text-gray-600 text-center py-8">Presiona "Probar Cotización" para ver el resultado</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Debugging Guide -->
		<div class="mt-8 bg-gray-50 rounded-lg p-6">
			<h2 class="text-xl font-bold mb-4">🔍 Guía de Debugging</h2>
			<ol class="list-decimal list-inside space-y-2 text-sm">
				<li>Abre DevTools (F12) y ve a la pestaña <strong>Console</strong></li>
				<li>Presiona "Probar Cotización"</li>
				<li>En la Console deberías ver logs como:
					<code class="bg-white px-2 py-1 rounded text-xs">[SHIPPING QUOTE] Request received...</code>
				</li>
				<li>
					En la pestaña <strong>Network</strong>, haz click en el request <code>/api/shipping/quote</code> para ver los detalles
				</li>
				<li>Lee la documentación: <a href="/ENVIA_DEBUGGING_GUIDE.md" class="text-blue-600 hover:underline">ENVIA_DEBUGGING_GUIDE.md</a></li>
			</ol>
		</div>
	</div>
</div>
