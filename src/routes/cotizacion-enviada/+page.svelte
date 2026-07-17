<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { trackEvent } from '$lib/gtag';

	let quotationId = $state('');
	let loading = $state(true);
	let quotationData = $state<any>(null);
	let error = $state('');

	$effect(() => {
		const id = $page.url.searchParams.get('id');
		if (!id) {
			error = 'ID de cotización no encontrado';
			loading = false;
			return;
		}

		quotationId = id;
		loading = true;

		void (async () => {
			try {
				const response = await fetch(`/api/quotations/shipping?id=${id}`);
				if (response.ok) {
					quotationData = await response.json();
				}
			} catch (e) {
				console.error('Error fetching quotation:', e);
			} finally {
				loading = false;
			}
		})();
	});

	onMount(() => {
		trackEvent('conversion', {
			send_to: 'AW-950721855/tzouCM3EmIAcEL-6q8UD',
			value: 1.0,
			currency: 'MXN'
		});
	});
</script>

<svelte:head>
	<title>Cotización Enviada - Guerra Láser</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4 py-8">
	<div class="max-w-lg w-full">
		{#if loading}
			<div class="text-center py-12">
				<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
				<p class="mt-4 text-gray-600">Procesando tu solicitud...</p>
			</div>
		{:else if error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-6">
				<h1 class="text-2xl font-bold text-red-800 mb-2">Error</h1>
				<p class="text-red-700">{error}</p>
				<a href="/carrito" class="mt-4 inline-block bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">
					Volver al Carrito
				</a>
			</div>
		{:else}
			<div class="bg-white rounded-lg shadow-lg p-8 text-center">
				<!-- Success Icon -->
				<div class="flex justify-center mb-6">
					<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
						<svg
							class="w-8 h-8 text-green-600"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
				</div>

				<h1 class="text-3xl font-bold text-gray-900 mb-2">¡Cotización Enviada!</h1>

				<p class="text-gray-600 mb-6">
					Tu solicitud de cotización ha sido recibida exitosamente. Uno de nuestros asesores especializado se pondrá en contacto contigo en menos de 30 minutos.
				</p>

				<!-- Quotation Details -->
				<div class="bg-gray-50 rounded-lg p-6 mb-6 text-left">
					<h2 class="text-lg font-semibold text-gray-900 mb-4">Detalles de tu Solicitud</h2>

					<div class="space-y-3">
						<div class="flex justify-between">
							<span class="text-gray-600">Referencia:</span>
							<span class="font-mono text-gray-900 text-sm">{quotationId.substring(0, 8)}...</span>
						</div>

						{#if quotationData}
							<div class="flex justify-between">
								<span class="text-gray-600">Cliente:</span>
								<span class="text-gray-900">{quotationData.customer_name}</span>
							</div>

							<div class="flex justify-between">
								<span class="text-gray-600">Email:</span>
								<span class="text-gray-900 text-sm">{quotationData.customer_email}</span>
							</div>

							<div class="flex justify-between">
								<span class="text-gray-600">Teléfono:</span>
								<span class="text-gray-900">{quotationData.customer_phone || 'No proporcionado'}</span>
							</div>

							<div class="border-t pt-3 flex justify-between">
								<span class="text-gray-600">Entrega en:</span>
								<span class="text-gray-900 text-sm">
									{quotationData.delivery_address_city}, {quotationData.delivery_address_state}
								</span>
							</div>

							<div class="flex justify-between">
								<span class="text-gray-600">Fecha:</span>
								<span class="text-gray-900 text-sm">
									{new Date(quotationData.created_at).toLocaleDateString('es-MX')}
								</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Next Steps -->
				<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
					<h3 class="font-semibold text-blue-900 mb-2">Próximos pasos:</h3>
					<ol class="text-sm text-blue-800 text-left space-y-2">
						<li class="flex gap-2">
							<span class="font-bold">1.</span>
							<span>Un asesor revisará tu solicitud</span>
						</li>
						<li class="flex gap-2">
							<span class="font-bold">2.</span>
							<span>Te contactaremos vía email o WhatsApp</span>
						</li>
						<li class="flex gap-2">
							<span class="font-bold">3.</span>
							<span>Recibirás una cotización exacta con opciones de pago</span>
						</li>
						<li class="flex gap-2">
							<span class="font-bold">4.</span>
							<span>Podrás proceder con el pago seguro</span>
						</li>
					</ol>
				</div>

				<!-- Action Buttons -->
				<div class="space-y-3">
					<a
						href="/"
						class="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
					>
						Ir a Inicio
					</a>
					<a
						href="/productos"
						class="block w-full bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
					>
						Seguir Comprando
					</a>
				</div>

				<!-- Contact Info -->
				<div class="mt-8 pt-6 border-t border-gray-200">
					<p class="text-sm text-gray-600 mb-3">¿Necesitas ayuda inmediata?</p>
					<div class="flex gap-3 justify-center">
						<a
							href="https://wa.me/5212128889898?text=Hola%20tengo%20una%20consulta"
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold text-sm"
						>
							<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
								<path
									d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-4.946 1.196c-1.54.92-2.846 2.317-3.916 3.972-1.099 1.731-1.528 3.637-1.207 5.534.38 2.268 1.693 4.51 3.498 5.759 1.676 1.12 3.646 1.203 5.44.56l.312-.147c.694-.328 1.446-.918 2.087-1.52.52-.46 1.123-.923 1.65-1.285a9.87 9.87 0 001.097-4.471 9.868 9.868 0 00-2.064-5.411 9.841 9.841 0 00-3.901-2.587z"
								/>
							</svg>
							WhatsApp
						</a>
						<a href="mailto:info@guerralaser.com" class="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm">
							<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
								<path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
								<path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
							</svg>
							Email
						</a>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		background: white;
	}
</style>
