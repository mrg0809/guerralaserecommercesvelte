<script lang="ts">
	import { cart } from '$lib/stores/cart';
	import { formatPrice } from '$lib/utils';
	import { goto } from '$app/navigation';

	let cartItems = $state<any[]>([]);

	cart.subscribe((items) => {
		cartItems = items;
	});

	function updateQuantity(productId: string, quantity: number, variantId?: string) {
		if (quantity <= 0) {
			cart.removeItem(productId, variantId);
		} else {
			cart.updateQuantity(productId, quantity, variantId);
		}
	}

	function removeItem(productId: string, variantId?: string) {
		cart.removeItem(productId, variantId);
	}

	let subtotal = $derived(
		cartItems.reduce((sum, item) => {
			const price = item.variant ? item.variant.price : item.product.base_price;
			return sum + price * item.quantity;
		}, 0)
	);

	let tax = $derived(subtotal * 0.16); // 16% IVA
	let total = $derived(subtotal + tax);

	function proceedToCheckout() {
		goto('/checkout');
	}
</script>

<svelte:head>
	<title>Carrito de Compras - Guerra Láser</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-4xl font-bold mb-8">Carrito de Compras</h1>

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
			<!-- Cart Items -->
			<div class="lg:col-span-2">
				<div class="bg-white rounded-lg shadow-md">
					{#each cartItems as item, index}
						{@const price = item.variant ? item.variant.price : item.product.base_price}
						{@const image =
							item.media?.find((m) => m.is_primary)?.url || item.media?.[0]?.url}

						<div class="p-4 {index > 0 ? 'border-t' : ''}">
							<div class="flex gap-4">
								<!-- Image -->
								<a href="/productos/{item.product.slug}" class="flex-shrink-0">
									{#if image}
										<img src={image} alt={item.product.name} class="w-24 h-24 object-cover rounded-lg" />
									{:else}
										<div class="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
											<span class="text-gray-400 text-xs">Sin imagen</span>
										</div>
									{/if}
								</a>

								<!-- Info -->
								<div class="flex-grow">
									<a
										href="/productos/{item.product.slug}"
										class="font-bold text-lg hover:text-blue-600"
									>
										{item.product.name}
									</a>
									{#if item.variant}
										<p class="text-gray-600 text-sm">{item.variant.name}</p>
									{/if}
									<p class="text-blue-600 font-semibold mt-1">{formatPrice(price)}</p>
								</div>

								<!-- Quantity Controls -->
								<div class="flex flex-col items-end gap-2">
									<div class="flex items-center gap-2">
										<button
											onclick={() =>
												updateQuantity(
													item.product.id,
													item.quantity - 1,
													item.variant?.id
												)}
											class="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded"
										>
											-
										</button>
										<span class="w-12 text-center">{item.quantity}</span>
										<button
											onclick={() =>
												updateQuantity(
													item.product.id,
													item.quantity + 1,
													item.variant?.id
												)}
											class="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded"
										>
											+
										</button>
									</div>
									<button
										onclick={() => removeItem(item.product.id, item.variant?.id)}
										class="text-red-600 hover:text-red-700 text-sm"
									>
										Eliminar
									</button>
									<p class="font-bold">{formatPrice(price * item.quantity)}</p>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Order Summary -->
			<div class="lg:col-span-1">
				<div class="bg-white rounded-lg shadow-md p-6 sticky top-4">
					<h2 class="text-2xl font-bold mb-4">Resumen del Pedido</h2>

					<div class="space-y-2 mb-4">
						<div class="flex justify-between">
							<span class="text-gray-600">Subtotal:</span>
							<span>{formatPrice(subtotal)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">IVA (16%):</span>
							<span>{formatPrice(tax)}</span>
						</div>
						<div class="border-t pt-2 flex justify-between font-bold text-lg">
							<span>Total:</span>
							<span class="text-blue-600">{formatPrice(total)}</span>
						</div>
					</div>

					<button
						onclick={proceedToCheckout}
						class="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
					>
						Proceder al Pago
					</button>

					<a
						href="/productos"
						class="block text-center text-blue-600 hover:text-blue-700 mt-4"
					>
						Continuar Comprando
					</a>
				</div>
			</div>
		</div>
	{/if}
</div>