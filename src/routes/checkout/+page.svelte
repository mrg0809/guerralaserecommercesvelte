<script lang="ts">
	import { cart } from '$lib/stores/cart';
	import { formatPrice, generateOrderNumber } from '$lib/utils';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { cartRequiresQuotation, getCheckoutButtonLabel } from '$lib/services/shippingService';
	import { loadStripe } from '@stripe/stripe-js';
	import type { Stripe, StripeElements } from '@stripe/stripe-js';
	import { onMount } from 'svelte';

	let cartItems = $state<any[]>([]);
	let submitting = $state(false);
	let error = $state('');
	let showQuotationModal = $state(false);
	let showShippingOptions = $state(false);
	let loadingShippingOptions = $state(false);
	let shippingOptions = $state<any[]>([]);
	let selectedShippingOption = $state<any>(null);
	let stripe: Stripe | null = null;
	let elements: StripeElements | null = null;
	let paymentElement: any = null;

	// Initialize Stripe
	onMount(async () => {
		const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
		if (!stripePublishableKey) {
			console.error('Stripe publishable key not found');
			error = 'Error de configuración de pago';
			return;
		}
		stripe = await loadStripe(stripePublishableKey);
	});

	let quotationData = $state({
		customerName: '',
		customerEmail: '',
		customerPhone: '',
		deliveryAddress: {
			street: '',
			city: '',
			state: '',
			zip: '',
			country: 'MX'
		},
		notes: ''
	});

	let formData = $state({
		customer_name: '',
		customer_email: '',
		customer_phone: '',
		shipping_address: {
			street: '',
			city: '',
			state: '',
			zip_code: '',
			country: 'México'
		},
		notes: ''
	});

	let subtotal = $derived(
		cartItems.reduce((sum, item) => {
			const price = item.variant ? item.variant.price : item.product.base_price;
			return sum + price * item.quantity;
		}, 0)
	);

	let tax = $derived(subtotal * 0.16);
	let shipping = $derived(selectedShippingOption ? selectedShippingOption.price : 0);
	let total = $derived(subtotal + tax + shipping);

	// Watch for cart changes and check if quotation is needed
	$effect(() => {
		cart.subscribe((items) => {
			cartItems = items;
			shippingOptions = [];
			selectedShippingOption = null;
			showShippingOptions = false;
			if (cartRequiresQuotation(items)) {
				// If cart contains items requiring quotation, show modal instead
				showQuotationModal = true;
			}
		})();
	});

	$effect(() => {
		if (
			cartItems.length > 0 &&
			!cartRequiresQuotation(cartItems) &&
			!loadingShippingOptions &&
			!showShippingOptions
		) {
			loadShippingOptions();
		}
	});

	async function loadShippingOptions() {
		loadingShippingOptions = true;
		error = '';

		try {
			const response = await fetch('/api/shipping/quote', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cartItems
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get shipping options');
			}

			const data = await response.json();
			shippingOptions = data.options || [];
			showShippingOptions = true;

			// Auto-select first option
			if (shippingOptions.length > 0) {
				selectedShippingOption = shippingOptions[0];
			}
		} catch (e: any) {
			error = e.message || 'Error al obtener opciones de envío';
		} finally {
			loadingShippingOptions = false;
		}
	}

	async function initializeStripePayment() {
		if (!stripe) {
			error = 'Error de configuración de pago';
			return null;
		}

		// Create payment intent
		const paymentIntentResponse = await fetch('/api/stripe/create-payment-intent', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				amount: Math.round(total * 100), // Amount in cents
				currency: 'mxn',
				description: `Compra Guerra Láser`,
				metadata: {
					customerName: formData.customer_name,
					customerEmail: formData.customer_email
				}
			})
		});

		if (!paymentIntentResponse.ok) {
			throw new Error('Failed to create payment intent');
		}

		const { clientSecret, paymentIntentId } = await paymentIntentResponse.json();

		// Initialize Stripe Elements
		elements = stripe.elements({
			clientSecret,
			appearance: {
				theme: 'stripe',
				variables: {
					colorPrimary: '#2563eb'
				}
			}
		});

		// Create and mount payment element
		paymentElement = elements.create('payment');
		paymentElement.mount('#payment-element');

		return { clientSecret, paymentIntentId };
	}

	async function submitOrder() {
		if (cartItems.length === 0) {
			error = 'El carrito está vacío';
			return;
		}

		// If cart requires quotation, show modal instead
		if (cartRequiresQuotation(cartItems)) {
			showQuotationModal = true;
			return;
		}

		// Validate form
		if (
			!formData.customer_name ||
			!formData.customer_email ||
			!formData.shipping_address.street ||
			!formData.shipping_address.city
		) {
			error = 'Por favor completa todos los campos requeridos';
			return;
		}

		if (!selectedShippingOption) {
			error = 'Por favor selecciona una opción de envío';
			return;
		}

		if (!stripe || !elements) {
			error = 'Error de configuración de pago. Por favor recarga la página.';
			return;
		}

		submitting = true;
		error = '';

		try {
			const orderNumber = generateOrderNumber();

			// Create order in database first
			const { data: order, error: orderError } = await supabase
				.from('orders')
				.insert({
					order_number: orderNumber,
					customer_name: formData.customer_name,
					customer_email: formData.customer_email,
					customer_phone: formData.customer_phone,
					shipping_address: formData.shipping_address,
					billing_address: formData.shipping_address,
					subtotal,
					discount_amount: 0,
					tax_amount: tax,
					shipping_amount: shipping,
					shipping_carrier: selectedShippingOption.carrier || 'custom',
					shipping_service: selectedShippingOption.service || selectedShippingOption.name || 'standard',
					total_amount: total,
					status: 'pending',
					payment_status: 'pending',
					notes: formData.notes
				})
				.select()
				.single();

			if (orderError || !order) throw orderError;

			// Create order items
			const orderItems = cartItems.map((item) => ({
				order_id: order.id,
				product_id: item.product.id,
				variant_id: item.variant?.id || null,
				product_name: item.product.name,
				variant_name: item.variant?.name || null,
				quantity: item.quantity,
				unit_price: item.variant ? item.variant.price : item.product.base_price,
				total_price:
					(item.variant ? item.variant.price : item.product.base_price) * item.quantity
			}));

			const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
			if (itemsError) throw itemsError;

			// Initialize Stripe payment
			const paymentData = await initializeStripePayment();
			if (!paymentData) {
				throw new Error('Failed to initialize payment');
			}

			// Update order with payment intent ID
			await (supabase as any)
				.from('orders')
				.update({
					stripe_payment_intent_id: paymentData.paymentIntentId
				})
				.eq('id', order.id);

			// Confirm payment with Stripe
			const { error: stripeError } = await stripe.confirmPayment({
				elements,
				confirmParams: {
					return_url: `${window.location.origin}/pedido/${orderNumber}?payment=success`
				}
			});

			if (stripeError) {
				// Payment failed
				await supabase
					.from('orders')
					.update({
						payment_status: 'failed',
						status: 'cancelled'
					})
					.eq('id', order.id);

				error = stripeError.message || 'Error al procesar el pago';
				submitting = false;
				return;
			}

			// If we get here without redirect, payment succeeded
			// Clear cart
			cart.clear();

			// Redirect to order confirmation
			goto(`/pedido/${orderNumber}?payment=success`);
		} catch (e: any) {
			error = e.message || 'Error al procesar el pedido';
			submitting = false;
		}
	}

	async function submitQuotation() {
		// Validate quotation form
		if (
			!quotationData.customerName ||
			!quotationData.customerEmail ||
			!quotationData.deliveryAddress.street ||
			!quotationData.deliveryAddress.city
		) {
			error = 'Por favor completa todos los campos requeridos';
			return;
		}

		submitting = true;
		error = '';

		try {
			const response = await fetch('/api/quotations/shipping', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					customerName: quotationData.customerName,
					customerEmail: quotationData.customerEmail,
					customerPhone: quotationData.customerPhone,
					deliveryAddress: quotationData.deliveryAddress,
					items: cartItems.map(item => ({
						productId: item.product.id,
						productName: item.product.name,
						variantId: item.variant?.id,
						variantName: item.variant?.name,
						quantity: item.quantity,
						price: item.variant ? item.variant.price : item.product.base_price
					})),
					estimatedSubtotal: subtotal,
					estimatedTax: tax,
					notes: quotationData.notes
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Error al enviar solicitud de cotización');
			}

			const data = await response.json();

			// Clear cart
			cart.clear();

			// Show success message and redirect
			goto(`/cotizacion-enviada?id=${data.quotationId}`);
		} catch (e: any) {
			error = e.message || 'Error al enviar solicitud de cotización';
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Checkout - Guerra Láser</title>
</svelte:head>

{#if showQuotationModal && cartRequiresQuotation(cartItems)}
	<!-- Quotation Modal for Heavy Items -->
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
			<div class="p-6 border-b border-gray-200 sticky top-0 bg-white">
				<h2 class="text-2xl font-bold">Solicitar Cotización de Envío</h2>
				<p class="text-gray-600 mt-2">
					Tu carrito contiene equipos que requieren envío especializado. Un asesor te contactará en menos de 30 minutos con una cotización exacta.
				</p>
			</div>

			<div class="p-6 space-y-6">
				<!-- Customer Info Section -->
				<div>
					<h3 class="text-lg font-semibold mb-4">Información de Contacto</h3>
					<div class="space-y-4">
						<div>
							<label for="quot-name" class="block text-sm font-semibold mb-2">
								Nombre Completo *
							</label>
							<input
								type="text"
								id="quot-name"
								bind:value={quotationData.customerName}
								required
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<div>
							<label for="quot-email" class="block text-sm font-semibold mb-2">
								Correo Electrónico *
							</label>
							<input
								type="email"
								id="quot-email"
								bind:value={quotationData.customerEmail}
								required
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<div>
							<label for="quot-phone" class="block text-sm font-semibold mb-2">Teléfono *</label>
							<input
								type="tel"
								id="quot-phone"
								bind:value={quotationData.customerPhone}
								required
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					</div>
				</div>

				<!-- Delivery Address Section -->
				<div>
					<h3 class="text-lg font-semibold mb-4">Dirección de Entrega</h3>
					<div class="space-y-4">
						<div>
							<label for="quot-street" class="block text-sm font-semibold mb-2">
								Calle y Número *
							</label>
							<input
								type="text"
								id="quot-street"
								bind:value={quotationData.deliveryAddress.street}
								required
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="quot-city" class="block text-sm font-semibold mb-2">Ciudad *</label>
								<input
									type="text"
									id="quot-city"
									bind:value={quotationData.deliveryAddress.city}
									required
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="quot-state" class="block text-sm font-semibold mb-2">Estado *</label>
								<input
									type="text"
									id="quot-state"
									bind:value={quotationData.deliveryAddress.state}
									required
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="quot-zip" class="block text-sm font-semibold mb-2">Código Postal</label>
								<input
									type="text"
									id="quot-zip"
									bind:value={quotationData.deliveryAddress.zip}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="quot-country" class="block text-sm font-semibold mb-2">País</label>
								<input
									type="text"
									id="quot-country"
									bind:value={quotationData.deliveryAddress.country}
									readonly
									class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
								/>
							</div>
						</div>

						<div>
							<label for="quot-notes" class="block text-sm font-semibold mb-2">
								Notas Adicionales (Opcional)
							</label>
							<textarea
								id="quot-notes"
								bind:value={quotationData.notes}
								rows="3"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Ej: Acceso limitado, requiere grúa, etc."
							></textarea>
						</div>
					</div>
				</div>

				<!-- Cart Summary -->
				<div class="bg-gray-50 rounded-lg p-4">
					<h3 class="font-semibold mb-3">Resumen de Items</h3>
					<div class="space-y-2 max-h-40 overflow-y-auto">
						{#each cartItems as item}
							{@const price = item.variant ? item.variant.price : item.product.base_price}
							<div class="flex justify-between text-sm">
								<span>{item.product.name} x{item.quantity}</span>
								<span>{formatPrice(price * item.quantity)}</span>
							</div>
						{/each}
					</div>
					<div class="border-t border-gray-200 mt-3 pt-3 font-semibold flex justify-between">
						<span>Subtotal:</span>
						<span>{formatPrice(subtotal)}</span>
					</div>
				</div>

				{#if error}
					<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
						{error}
					</div>
				{/if}

				<div class="flex gap-3">
					<button
						onclick={() => (showQuotationModal = false)}
						class="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
						disabled={submitting}
					>
						Volver al Carrito
					</button>
					<button
						onclick={submitQuotation}
						disabled={submitting}
						class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
					>
						{submitting ? 'Enviando...' : 'Solicitar Cotización'}
					</button>
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Regular Checkout Form -->
	<div class="container mx-auto px-4 py-8">
	<h1 class="text-4xl font-bold mb-8">Finalizar Compra</h1>

	{#if cartItems.length === 0}
		<div class="text-center py-12 bg-gray-50 rounded-lg">
			<p class="text-xl text-gray-600 mb-4">Tu carrito está vacío</p>
			<a
				href="/productos"
				class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
			>
				Ir a Productos
			</a>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<!-- Checkout Form -->
			<div class="lg:col-span-2">
				<form onsubmit={(e) => { e.preventDefault(); submitOrder(); }} class="space-y-6">
					<!-- Customer Info -->
					<div class="bg-white rounded-lg shadow-md p-6">
						<h2 class="text-2xl font-bold mb-4">Información de Contacto</h2>

						<div class="space-y-4">
							<div>
								<label for="name" class="block text-sm font-semibold mb-2">
									Nombre Completo *
								</label>
								<input
									type="text"
									id="name"
									bind:value={formData.customer_name}
									required
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="email" class="block text-sm font-semibold mb-2">
									Correo Electrónico *
								</label>
								<input
									type="email"
									id="email"
									bind:value={formData.customer_email}
									required
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label for="phone" class="block text-sm font-semibold mb-2">Teléfono</label>
								<input
									type="tel"
									id="phone"
									bind:value={formData.customer_phone}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
						</div>
					</div>

					<!-- Shipping Address -->
					<div class="bg-white rounded-lg shadow-md p-6">
						<h2 class="text-2xl font-bold mb-4">Dirección de Envío</h2>

						<div class="space-y-4">
							<div>
								<label for="street" class="block text-sm font-semibold mb-2">Calle y Número *</label>
								<input
									type="text"
									id="street"
									bind:value={formData.shipping_address.street}
									required
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<label for="city" class="block text-sm font-semibold mb-2">Ciudad *</label>
									<input
										type="text"
										id="city"
										bind:value={formData.shipping_address.city}
										required
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								<div>
									<label for="state" class="block text-sm font-semibold mb-2">Estado</label>
									<input
										type="text"
										id="state"
										bind:value={formData.shipping_address.state}
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<label for="zip" class="block text-sm font-semibold mb-2">Código Postal *</label>
									<input
										type="text"
										id="zip"
										bind:value={formData.shipping_address.zip_code}
										required
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								<div>
									<label for="country" class="block text-sm font-semibold mb-2">País</label>
									<input
										type="text"
										id="country"
										bind:value={formData.shipping_address.country}
										readonly
										class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
									/>
								</div>
							</div>

							<div>
								<label for="notes" class="block text-sm font-semibold mb-2">
									Notas de Entrega (Opcional)
								</label>
								<textarea
									id="notes"
									bind:value={formData.notes}
									rows="3"
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								></textarea>
							</div>

							<!-- Load Shipping Options Button -->
							<button
								type="button"
								onclick={loadShippingOptions}
								disabled={loadingShippingOptions}
								class="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400"
							>
								{loadingShippingOptions ? 'Consultando...' : 'Consultar Opciones de Envío'}
							</button>
						</div>
					</div>

					<!-- Shipping Options -->
					{#if showShippingOptions && shippingOptions.length > 0}
						<div class="bg-white rounded-lg shadow-md p-6">
							<h2 class="text-2xl font-bold mb-4">Opciones de Envío</h2>
							
							<div class="space-y-3">
								{#each shippingOptions as option}
									<label class="flex items-center p-4 border-2 rounded-lg cursor-pointer transition hover:border-blue-500 {selectedShippingOption?.id === option.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}">
										<input
											type="radio"
											name="shipping"
											value={option}
											checked={selectedShippingOption?.id === option.id}
											onchange={() => selectedShippingOption = option}
											class="mr-3"
										/>
										<div class="flex-1">
											<div class="flex justify-between items-start">
												<div>
													<p class="font-semibold">{(option.carrier || 'Envío').toUpperCase()} - {option.service || option.name}</p>
													<p class="text-sm text-gray-600">{option.description}</p>
													{#if option.estimatedDays}
														<p class="text-xs text-gray-500">Entrega estimada: {option.estimatedDays} días hábiles</p>
													{/if}
												</div>
												<p class="font-bold text-blue-600">{formatPrice(option.price)}</p>
											</div>
										</div>
									</label>
								{/each}
							</div>
						</div>
					{/if}

					{#if showShippingOptions && shippingOptions.length === 0}
						<div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
							No hay opciones de envío disponibles para los productos del carrito. Asigna un tipo de envío en administración.
						</div>
					{/if}

					<!-- Payment Section -->
					{#if selectedShippingOption}
						<div class="bg-white rounded-lg shadow-md p-6">
							<h2 class="text-2xl font-bold mb-4">Método de Pago</h2>
							
							<div id="payment-element" class="mb-4">
								<!-- Stripe Payment Element will be mounted here -->
							</div>
							
							<p class="text-sm text-gray-600 mb-4">
								💳 Pago seguro procesado por Stripe. Aceptamos tarjetas de crédito y débito.
							</p>
						</div>
					{/if}

					{#if error}
						<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
							{error}
						</div>
					{/if}

					<button
						type="submit"
						disabled={submitting || !selectedShippingOption}
						class="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
					>
						{submitting ? 'Procesando Pago...' : selectedShippingOption ? 'Pagar y Finalizar Compra' : 'Selecciona envío primero'}
					</button>

					{#if selectedShippingOption}
						<p class="text-center text-sm text-gray-600">
							Al hacer clic en "Pagar y Finalizar Compra", se procesará tu pago de forma segura.
						</p>
					{/if}
				</form>
			</div>

			<!-- Order Summary -->
			<div class="lg:col-span-1">
				<div class="bg-white rounded-lg shadow-md p-6 sticky top-4">
					<h2 class="text-2xl font-bold mb-4">Resumen del Pedido</h2>

					<div class="space-y-3 mb-4 max-h-64 overflow-y-auto">
						{#each cartItems as item}
							{@const price = item.variant ? item.variant.price : item.product.base_price}
							<div class="flex justify-between text-sm">
								<div class="flex-1">
									<p class="font-semibold">{item.product.name}</p>
									{#if item.variant}
										<p class="text-gray-600">{item.variant.name}</p>
									{/if}
									<p class="text-gray-600">Cantidad: {item.quantity}</p>
								</div>
								<p class="font-semibold">{formatPrice(price * item.quantity)}</p>
							</div>
						{/each}
					</div>

					<div class="border-t pt-4 space-y-2">
						<div class="flex justify-between">
							<span class="text-gray-600">Subtotal:</span>
							<span>{formatPrice(subtotal)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">IVA (16%):</span>
							<span>{formatPrice(tax)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Envío:</span>
							<span>{cartRequiresQuotation(cartItems) ? 'Por cotizar' : (selectedShippingOption ? formatPrice(shipping) : 'Pendiente')}</span>
						</div>
						<div class="border-t pt-2 flex justify-between font-bold text-lg">
							<span>Total:</span>
							<span class="text-blue-600">{formatPrice(total)}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
	</div>
{/if}