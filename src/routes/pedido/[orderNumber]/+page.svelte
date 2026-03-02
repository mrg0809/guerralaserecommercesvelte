<script lang="ts">
	import { formatPrice } from '$lib/utils';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	
	let trackingInfo = $state<any>(null);
	let loadingTracking = $state(false);
	
	const paymentStatus = $page.url.searchParams.get('payment');

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('es-MX', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function loadTrackingInfo() {
		if (!data.order.shipping_tracking_number || !data.order.shipping_carrier) {
			return;
		}

		loadingTracking = true;

		try {
			const response = await fetch(
				`/api/shipping/track?tracking=${data.order.shipping_tracking_number}&carrier=${data.order.shipping_carrier}`
			);

			if (response.ok) {
				const responseData = await response.json();
				trackingInfo = responseData.tracking;
			}
		} catch (e) {
			console.error('Error loading tracking info:', e);
		} finally {
			loadingTracking = false;
		}
	}

	function getShippingStatusBadge(status: string) {
		switch (status) {
			case 'delivered':
				return 'bg-green-100 text-green-800';
			case 'in_transit':
			case 'out_for_delivery':
				return 'bg-blue-100 text-blue-800';
			case 'label_created':
			case 'picked_up':
				return 'bg-yellow-100 text-yellow-800';
			case 'failed':
			case 'returned':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function getShippingStatusText(status: string) {
		const statusMap: Record<string, string> = {
			'pending': 'Pendiente',
			'quote_requested': 'Cotización solicitada',
			'quote_sent': 'Cotización enviada',
			'label_created': 'Etiqueta creada',
			'picked_up': 'Recolectado',
			'in_transit': 'En tránsito',
			'out_for_delivery': 'En reparto',
			'delivered': 'Entregado',
			'failed': 'Fallo en entrega',
			'returned': 'Devuelto',
			'cancelled': 'Cancelado'
		};
		return statusMap[status] || status;
	}
</script>

<svelte:head>
	<title>Pedido {data.order.order_number} - Guerra Láser</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<div class="bg-white rounded-lg shadow-md p-8">
		<!-- Success Message -->
		{#if paymentStatus === 'success'}
			<div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
				<div class="flex items-start">
					<svg class="h-8 w-8 text-green-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					<div class="ml-4">
						<h2 class="text-2xl font-bold text-green-800 mb-2">¡Pago Exitoso!</h2>
						<p class="text-green-700">
							Tu pedido ha sido confirmado y tu pago procesado correctamente. 
							{#if data.order.shipping_tracking_number}
								Tu guía de envío ha sido generada automáticamente.
							{:else}
								Estamos generando tu guía de envío.
							{/if}
						</p>
					</div>
				</div>
			</div>
		{/if}

		<div class="text-center mb-8">
			<div class="text-6xl mb-4">✅</div>
			<h1 class="text-4xl font-bold mb-2">¡Pedido Confirmado!</h1>
			<p class="text-xl text-gray-600">Gracias por tu compra, {data.order.customer_name}</p>
		</div>

		<!-- Order Number -->
		<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
			<p class="text-sm text-gray-600 mb-1">Número de Pedido</p>
			<p class="text-2xl font-mono font-bold text-blue-600">{data.order.order_number}</p>
			{#if data.order.shipping_status}
				<span class="inline-flex mt-2 px-3 py-1 rounded-full text-sm font-semibold {getShippingStatusBadge(data.order.shipping_status)}">
					📦 {getShippingStatusText(data.order.shipping_status)}
				</span>
			{/if}
		</div>

		<!-- Shipping Info -->
		{#if data.order.shipping_tracking_number}
			<div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
				<h3 class="font-bold text-xl mb-4 flex items-center">
					<span class="text-2xl mr-2">📦</span>
					Información de Envío
				</h3>
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
					<div>
						<p class="text-sm text-gray-600">Paquetería</p>
						<p class="font-semibold text-lg">{data.order.shipping_carrier?.toUpperCase()}</p>
					</div>
					<div>
						<p class="text-sm text-gray-600">Servicio</p>
						<p class="font-semibold">{data.order.shipping_service}</p>
					</div>
					<div class="md:col-span-2">
						<p class="text-sm text-gray-600">Número de Rastreo</p>
						<p class="font-semibold font-mono text-lg">{data.order.shipping_tracking_number}</p>
					</div>
				</div>

				<div class="flex gap-3">
					{#if data.order.shipping_label_url}
						<a
							href={data.order.shipping_label_url}
							target="_blank"
							class="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg text-center hover:bg-blue-700 transition font-semibold"
						>
							📄 Descargar Guía de Envío
						</a>
					{/if}
					<button
						onclick={loadTrackingInfo}
						disabled={loadingTracking}
						class="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 font-semibold"
					>
						{loadingTracking ? 'Consultando...' : '🔍 Rastrear Paquete'}
					</button>
				</div>

				{#if trackingInfo}
					<div class="mt-4 p-4 bg-white rounded-lg border border-blue-200">
						<h4 class="font-semibold mb-2">Estado del Envío</h4>
						<pre class="text-sm overflow-auto">{JSON.stringify(trackingInfo, null, 2)}</pre>
					</div>
				{/if}
			</div>
		{/if}

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