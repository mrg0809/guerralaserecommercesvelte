<script lang="ts">
	import { formatPrice } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('es-MX', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Pedido {data.order.order_number} - Guerra Láser</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<div class="bg-white rounded-lg shadow-md p-8">
		<!-- Success Message -->
		<div class="text-center mb-8">
			<div class="text-6xl mb-4">✅</div>
			<h1 class="text-4xl font-bold mb-2">¡Pedido Confirmado!</h1>
			<p class="text-xl text-gray-600">Gracias por tu compra, {data.order.customer_name}</p>
		</div>

		<!-- Order Number -->
		<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
			<p class="text-sm text-gray-600 mb-1">Número de Pedido</p>
			<p class="text-2xl font-mono font-bold text-blue-600">{data.order.order_number}</p>
		</div>

		<!-- Order Info -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
			<div>
				<h3 class="font-bold mb-2">Información de Contacto</h3>
				<p class="text-gray-700">{data.order.customer_email}</p>
				{#if data.order.customer_phone}
					<p class="text-gray-700">{data.order.customer_phone}</p>
				{/if}
			</div>

			<div>
				<h3 class="font-bold mb-2">Dirección de Envío</h3>
				{#if data.order.shipping_address}
					{@const addr = data.order.shipping_address}
					<p class="text-gray-700">{addr.street}</p>
					<p class="text-gray-700">
						{addr.city}{addr.state ? `, ${addr.state}` : ''}
					</p>
					{#if addr.zip_code}
						<p class="text-gray-700">CP: {addr.zip_code}</p>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Order Items -->
		<div class="mb-8">
			<h3 class="font-bold text-xl mb-4">Productos</h3>
			<div class="space-y-3">
				{#each data.order.order_items as item}
					<div class="flex justify-between border-b pb-3">
						<div>
							<p class="font-semibold">{item.product_name}</p>
							{#if item.variant_name}
								<p class="text-sm text-gray-600">{item.variant_name}</p>
							{/if}
							<p class="text-sm text-gray-600">Cantidad: {item.quantity}</p>
						</div>
						<p class="font-semibold">{formatPrice(item.total_price)}</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Order Summary -->
		<div class="border-t pt-6 mb-8">
			<div class="space-y-2">
				<div class="flex justify-between">
					<span class="text-gray-600">Subtotal:</span>
					<span>{formatPrice(data.order.subtotal)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-600">IVA:</span>
					<span>{formatPrice(data.order.tax_amount)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-600">Envío:</span>
					<span>{formatPrice(data.order.shipping_amount)}</span>
				</div>
				<div class="flex justify-between font-bold text-xl border-t pt-2">
					<span>Total:</span>
					<span class="text-blue-600">{formatPrice(data.order.total_amount)}</span>
				</div>
			</div>
		</div>

		<div class="text-sm text-gray-600 mb-8">
			<p><strong>Fecha de pedido:</strong> {formatDate(data.order.created_at)}</p>
			<p class="mt-2">
				<strong>Estado:</strong>
				<span class="capitalize">{data.order.status}</span>
			</p>
		</div>

		<!-- Next Steps -->
		<div class="bg-gray-50 rounded-lg p-6 mb-6">
			<h3 class="font-bold mb-3">Próximos Pasos</h3>
			<ul class="space-y-2 text-gray-700">
				<li>✉️ Te hemos enviado un correo de confirmación a {data.order.customer_email}</li>
				<li>📦 Procesaremos tu pedido y te notificaremos cuando sea enviado</li>
				<li>🚚 El tiempo estimado de entrega es de 3-5 días hábiles</li>
			</ul>
		</div>

		<!-- Actions -->
		<div class="flex gap-4 justify-center">
			<a
				href="/productos"
				class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
			>
				Seguir Comprando
			</a>
			<a href="/" class="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg transition">
				Volver al Inicio
			</a>
		</div>
	</div>
</div>