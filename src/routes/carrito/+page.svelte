<script lang="ts">
	import { cart, acrylicCutKey } from '$lib/stores/cart';
	import { formatPrice } from '$lib/utils';
	import { goto } from '$app/navigation';

	let cartItems = $state<any[]>([]);

	cart.subscribe((items) => {
		cartItems = items;
	});

	function linePrice(item: any): number {
		if (item.bundle) return item.bundle.bundle_price;
		if (item.acrylicCut?.unit_price != null) return item.acrylicCut.unit_price;
		if (item.variant) return item.variant.price;
		return item.product.base_price;
	}

	function updateQuantity(item: any, quantity: number) {
		const cutKey = item.acrylicCut ? acrylicCutKey(item) : undefined;
		if (quantity <= 0) {
			cart.removeItem(item.product.id, item.variant?.id, item.bundle?.id, cutKey);
		} else {
			cart.updateQuantity(item.product.id, quantity, item.variant?.id, item.bundle?.id, cutKey);
		}
	}

	function removeItem(item: any) {
		const cutKey = item.acrylicCut ? acrylicCutKey(item) : undefined;
		cart.removeItem(item.product.id, item.variant?.id, item.bundle?.id, cutKey);
	}

	let subtotal = $derived(
		cartItems.reduce((sum, item) => sum + linePrice(item) * item.quantity, 0)
	);

	let total = $derived(subtotal);

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
			<div class="lg:col-span-2">
				<div class="bg-white rounded-lg shadow-md">
					{#each cartItems as item, index}
						{@const price = linePrice(item)}
						{@const image =
							item.media?.find((m: any) => m.is_primary)?.url || item.media?.[0]?.url}

						<div class="p-4 {index > 0 ? 'border-t' : ''}">
							<div class="flex gap-4">
								<a href="/productos/{item.product.slug}" class="flex-shrink-0">
									{#if image}
										<img src={image} alt={item.product.name} class="w-24 h-24 object-cover rounded-lg" />
									{:else}
										<div class="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
											<span class="text-gray-400 text-xs">Sin imagen</span>
										</div>
									{/if}
								</a>

								<div class="flex-grow">
									<a
										href="/productos/{item.product.slug}"
										class="font-bold text-lg hover:text-blue-600"
									>
										{item.product.name}
									</a>
									{#if item.bundle}
										<p class="text-blue-600 text-sm font-semibold">📦 Paquete: {item.bundle.name}</p>
										{#if item.bundle.items && item.bundle.items.length > 0}
											<div class="text-xs text-gray-600 mt-1">
												<p class="font-medium">Incluye:</p>
												<ul class="list-disc list-inside ml-2">
													{#each item.bundle.items as bundleItem}
														<li>
															{bundleItem.quantity}x {bundleItem.products?.name || 'Producto'}
															{#if bundleItem.product_variants}
																({bundleItem.product_variants.name})
															{/if}
														</li>
													{/each}
												</ul>
											</div>
										{/if}
										{#if item.bundle.savings > 0}
											<p class="text-green-600 text-xs mt-1">
												✓ Ahorras {formatPrice(item.bundle.savings)}
											</p>
										{/if}
									{:else if item.acrylicCut}
										<p class="text-gray-600 text-sm">
											{item.variant?.name || 'Lámina'} — {item.acrylicCut.label}
										</p>
									{:else if item.variant}
										<p class="text-gray-600 text-sm">{item.variant.name}</p>
									{/if}
									<p class="text-blue-600 font-semibold mt-1">{formatPrice(price)}</p>
								</div>

								<div class="flex flex-col items-end gap-2">
									<div class="flex items-center gap-2">
										<button
											onclick={() => updateQuantity(item, item.quantity - 1)}
											class="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded"
										>
											-
										</button>
										<span class="w-12 text-center">{item.quantity}</span>
										<button
											onclick={() => updateQuantity(item, item.quantity + 1)}
											class="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded"
										>
											+
										</button>
									</div>
									<button
										onclick={() => removeItem(item)}
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

			<div class="lg:col-span-1">
				<div class="bg-white rounded-lg shadow-md p-6 sticky top-4">
					<h2 class="text-2xl font-bold mb-4">Resumen del Pedido</h2>

					<div class="space-y-2 mb-4">
						<div class="flex justify-between">
							<span class="text-gray-600">Subtotal:</span>
							<span>{formatPrice(subtotal)}</span>
						</div>
						<div class="border-t pt-2 flex justify-between font-bold text-lg">
							<span>Total:</span>
							<span class="text-blue-600">{formatPrice(total)}</span>
						</div>
					</div>

					<button
						onclick={proceedToCheckout}
						class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
					>
						Proceder al Checkout
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
