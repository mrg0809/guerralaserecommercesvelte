<script lang="ts">
	import { cart } from '$lib/stores/cart';
	import { formatPrice, generateOrderNumber } from '$lib/utils';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';

	let cartItems = $state<any[]>([]);
	let submitting = $state(false);
	let error = $state('');

	cart.subscribe((items) => {
		cartItems = items;
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
	let shipping = $derived(0); // Free shipping for now
	let total = $derived(subtotal + tax + shipping);

	async function submitOrder() {
		if (cartItems.length === 0) {
			error = 'El carrito está vacío';
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

		submitting = true;
		error = '';

		try {
			const orderNumber = generateOrderNumber();

			// Create order
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

			// Clear cart
			cart.clear();

			// Redirect to success page
			goto(`/pedido/${orderNumber}`);
		} catch (e: any) {
			error = e.message || 'Error al procesar el pedido';
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Checkout - Guerra Láser</title>
</svelte:head>

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
				<form on:submit|preventDefault={submitOrder} class="space-y-6">
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
									<label for="zip" class="block text-sm font-semibold mb-2">Código Postal</label>
									<input
										type="text"
										id="zip"
										bind:value={formData.shipping_address.zip_code}
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
						</div>
					</div>

					{#if error}
						<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
							{error}
						</div>
					{/if}

					<button
						type="submit"
						disabled={submitting}
						class="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
					>
						{submitting ? 'Procesando...' : 'Confirmar Pedido'}
					</button>
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
							<span>{shipping === 0 ? 'GRATIS' : formatPrice(shipping)}</span>
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