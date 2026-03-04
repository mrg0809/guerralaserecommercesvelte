<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice } from '$lib/utils';
	import type { Order } from '$lib/types';

	type AdminOrder = Order & {
		order_items?: any[];
		shipping_carrier?: string | null;
		shipping_tracking_number?: string | null;
		shipping_status?: string | null;
	};

	let orders: AdminOrder[] = $state([]);
	let loading = $state(true);
	let selectedOrder = $state<AdminOrder | null>(null);
	let showModal = $state(false);
	let filterStatus = $state<string>('all');
	let shippingCarrierInput = $state('');
	let shippingTrackingInput = $state('');
	let savingShipping = $state(false);

	const statusOptions = [
		{ value: 'pending', label: 'Pendiente', color: 'orange' },
		{ value: 'processing', label: 'Procesando', color: 'blue' },
		{ value: 'completed', label: 'Completado', color: 'green' },
		{ value: 'cancelled', label: 'Cancelado', color: 'red' }
	];

	onMount(async () => {
		await loadOrders();
	});

	async function loadOrders() {
		loading = true;
		let query = supabase
			.from('orders')
			.select('*, order_items(*)')
			.eq('payment_status', 'paid')
			.order('created_at', { ascending: false });

		if (filterStatus !== 'all') {
			query = query.eq('status', filterStatus);
		}

		const { data } = await query;

		if (data) {
			orders = data as AdminOrder[];
		}
		loading = false;
	}

	async function viewOrder(order: Order) {
		const { data } = await supabase
			.from('orders')
			.select('*, order_items(*)')
			.eq('id', order.id)
			.eq('payment_status', 'paid')
			.single();

		if (data) {
			selectedOrder = data as AdminOrder;
			shippingCarrierInput = selectedOrder.shipping_carrier || '';
			shippingTrackingInput = selectedOrder.shipping_tracking_number || '';
			showModal = true;
		}
	}

	function closeModal() {
		showModal = false;
		selectedOrder = null;
		shippingCarrierInput = '';
		shippingTrackingInput = '';
	}

	async function updateOrderStatus(orderId: string, status: string) {
		try {
			const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);

			if (error) throw error;

			await loadOrders();
			if (selectedOrder && selectedOrder.id === orderId) {
				selectedOrder.status = status;
			}
		} catch (error: any) {
			alert('Error al actualizar estado: ' + error.message);
		}
	}

	async function saveShippingInfo() {
		if (!selectedOrder) return;

		const shippingCarrier = shippingCarrierInput.trim();
		const shippingTrackingNumber = shippingTrackingInput.trim();

		if (!shippingCarrier || !shippingTrackingNumber) {
			alert('Captura la paquetería y el número de guía');
			return;
		}

		savingShipping = true;
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();

			if (!session) {
				throw new Error('Sesión no válida');
			}

			const response = await fetch('/api/admin/orders/update-shipping', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${session.access_token}`
				},
				body: JSON.stringify({
					orderId: selectedOrder.id,
					shippingCarrier,
					shippingTrackingNumber
				})
			});

			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.error || 'No se pudo guardar la guía');
			}

			selectedOrder.shipping_carrier = shippingCarrier;
			selectedOrder.shipping_tracking_number = shippingTrackingNumber;
			selectedOrder.shipping_status = 'in_transit';

			orders = orders.map((order) =>
				order.id === selectedOrder!.id
					? {
						...order,
						shipping_carrier: shippingCarrier,
						shipping_tracking_number: shippingTrackingNumber,
						shipping_status: 'in_transit'
					}
					: order
			);

			alert('Guía guardada y correo enviado al cliente');
		} catch (error: any) {
			alert('Error al guardar guía: ' + error.message);
		} finally {
			savingShipping = false;
		}
	}

	function getStatusColor(status: string | null) {
		const option = statusOptions.find((s) => s.value === status);
		return option?.color || 'gray';
	}

	function formatDate(dateString: string | null) {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('es-MX', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Reload orders when filter changes
	$effect(() => {
		void filterStatus; // Track filterStatus changes
		loadOrders();
	});
</script>

<svelte:head>
	<title>Gestión de Pedidos - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-4xl font-bold">Gestión de Pedidos</h1>
		<a
			href="/admin"
			class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
		>
			← Volver
		</a>
	</div>

	<!-- Filters -->
	<div class="mb-6">
		<div class="flex flex-wrap gap-2">
			<button
				onclick={() => (filterStatus = 'all')}
				class="px-4 py-2 rounded-lg {filterStatus === 'all'
					? 'bg-blue-600 text-white'
					: 'bg-gray-200 hover:bg-gray-300'}"
			>
				Todos
			</button>
			{#each statusOptions as option}
				<button
					onclick={() => (filterStatus = option.value)}
					class="px-4 py-2 rounded-lg {filterStatus === option.value
						? 'bg-blue-600 text-white'
						: 'bg-gray-200 hover:bg-gray-300'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">Cargando pedidos...</p>
		</div>
	{:else if orders.length === 0}
		<div class="bg-gray-50 rounded-lg p-8 text-center">
			<p class="text-xl text-gray-600">No hay pedidos pagados registrados</p>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow-md overflow-hidden">
			<table class="w-full">
				<thead class="bg-gray-100">
					<tr>
						<th class="px-4 py-3 text-left">Número de Pedido</th>
						<th class="px-4 py-3 text-left">Cliente</th>
						<th class="px-4 py-3 text-left">Fecha</th>
						<th class="px-4 py-3 text-left">Total</th>
						<th class="px-4 py-3 text-left">Pago</th>
						<th class="px-4 py-3 text-left">Estado</th>
						<th class="px-4 py-3 text-right">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each orders as order}
						<tr class="border-t hover:bg-gray-50">
							<td class="px-4 py-3 font-mono text-sm">{order.order_number}</td>
							<td class="px-4 py-3">
								<div>
									<p class="font-semibold">{order.customer_name}</p>
									<p class="text-sm text-gray-600">{order.customer_email}</p>
								</div>
							</td>
							<td class="px-4 py-3 text-sm">{formatDate(order.created_at)}</td>
							<td class="px-4 py-3 font-semibold">{formatPrice(order.total_amount)}</td>
							<td class="px-4 py-3">
								<span class="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
									Pagado
								</span>
							</td>
							<td class="px-4 py-3">
								<span
									class="px-3 py-1 rounded-full text-sm bg-{getStatusColor(
										order.status
									)}-100 text-{getStatusColor(order.status)}-800"
								>
									{statusOptions.find((s) => s.value === order.status)?.label || order.status}
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								<button
									onclick={() => viewOrder(order)}
									class="text-blue-600 hover:text-blue-800"
								>
									Ver Detalles
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Order Details Modal -->
{#if showModal && selectedOrder}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
			<div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
				<h2 class="text-2xl font-bold">Pedido {selectedOrder.order_number}</h2>
				<button onclick={closeModal} class="text-gray-500 hover:text-gray-700 text-2xl">
					×
				</button>
			</div>

			<div class="p-6 space-y-6">
				<div class="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
					Mostrando únicamente pedidos con pago confirmado.
				</div>

				<!-- Order Status -->
				<div>
					<label class="block text-sm font-semibold mb-2" for="order-status-select">Estado del Pedido</label>
					<select
						id="order-status-select"
						value={selectedOrder.status}
						onchange={(e) => updateOrderStatus(selectedOrder!.id, e.currentTarget.value)}
						class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{#each statusOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<!-- Shipping Tracking -->
				<div class="border rounded-lg p-4 bg-blue-50">
					<h3 class="font-bold mb-3">Datos de Envío (Guía Manual)</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-semibold mb-2" for="shipping-carrier">Paquetería / Compañía</label>
							<input
								id="shipping-carrier"
								type="text"
								bind:value={shippingCarrierInput}
								placeholder="Ej: FedEx, DHL, Estafeta"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
						<div>
							<label class="block text-sm font-semibold mb-2" for="shipping-tracking">Número de guía</label>
							<input
								id="shipping-tracking"
								type="text"
								bind:value={shippingTrackingInput}
								placeholder="Ej: 7890123456"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					</div>
					<div class="mt-4">
						<button
							onclick={saveShippingInfo}
							disabled={savingShipping}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
						>
							{savingShipping ? 'Guardando...' : 'Guardar guía y enviar correo'}
						</button>
					</div>
				</div>

				<!-- Customer Info -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<h3 class="font-bold mb-2">Información del Cliente</h3>
						<p><strong>Nombre:</strong> {selectedOrder.customer_name}</p>
						<p><strong>Email:</strong> {selectedOrder.customer_email}</p>
						{#if selectedOrder.customer_phone}
							<p><strong>Teléfono:</strong> {selectedOrder.customer_phone}</p>
						{/if}
					</div>

					<div>
						<h3 class="font-bold mb-2">Dirección de Envío</h3>
						{#if selectedOrder.shipping_address}
							{@const addr = selectedOrder.shipping_address as any}
							<p>{addr.street}</p>
							<p>
								{addr.city}{addr.state ? `, ${addr.state}` : ''}
							</p>
							{#if addr.zip_code}
								<p>CP: {addr.zip_code}</p>
							{/if}
							<p>{addr.country || 'México'}</p>
						{/if}
					</div>
				</div>

				<!-- Order Items -->
				<div>
					<h3 class="font-bold mb-2">Productos</h3>
					<div class="bg-gray-50 rounded-lg p-4 space-y-2">
						{#if selectedOrder.order_items}
							{#each selectedOrder.order_items as item}
								<div class="flex justify-between">
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
						{/if}
					</div>
				</div>

				<!-- Order Summary -->
				<div class="border-t pt-4">
					<div class="space-y-2">
						<div class="flex justify-between">
							<span>Subtotal:</span>
							<span>{formatPrice(selectedOrder.subtotal)}</span>
						</div>
						<div class="flex justify-between">
							<span>IVA:</span>
							<span>{formatPrice(selectedOrder.tax_amount ?? 0)}</span>
						</div>
						<div class="flex justify-between">
							<span>Envío:</span>
							<span>{formatPrice(selectedOrder.shipping_amount ?? 0)}</span>
						</div>
						<div class="flex justify-between font-bold text-lg border-t pt-2">
							<span>Total:</span>
							<span class="text-blue-600">{formatPrice(selectedOrder.total_amount)}</span>
						</div>
					</div>
				</div>

				{#if selectedOrder.notes}
					<div>
						<h3 class="font-bold mb-2">Notas</h3>
						<p class="text-gray-700 bg-gray-50 p-4 rounded-lg">{selectedOrder.notes}</p>
					</div>
				{/if}

				<div class="text-sm text-gray-600">
					<p><strong>Fecha de pedido:</strong> {formatDate(selectedOrder.created_at)}</p>
				</div>
			</div>
		</div>
	</div>
{/if}