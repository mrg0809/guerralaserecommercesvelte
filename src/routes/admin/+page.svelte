<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';

	let stats = $state({
		totalProducts: 0,
		totalCategories: 0,
		totalBundles: 0,
		totalPaidOrders: 0,
		orderPending: 0,
		orderProcessing: 0,
		orderCompleted: 0,
		orderCancelled: 0
	});

	onMount(async () => {
		// Check if user is logged in
		const {
			data: { session }
		} = await supabase.auth.getSession();

		if (!session) {
			goto('/login');
			return;
		}

		// Pedidos: vía API con service role (el cliente Supabase sufre RLS y puede contar de menos)
		let orderStats = {
			totalPaid: 0,
			pending: 0,
			processing: 0,
			completed: 0,
			cancelled: 0
		};
		if (session?.access_token) {
			const statsRes = await fetch('/api/admin/orders/stats', {
				headers: { Authorization: `Bearer ${session.access_token}` }
			});
			const statsJson = await statsRes.json();
			if (statsRes.ok && statsJson.success) {
				orderStats = {
					totalPaid: statsJson.totalPaid ?? 0,
					pending: statsJson.pending ?? 0,
					processing: statsJson.processing ?? 0,
					completed: statsJson.completed ?? 0,
					cancelled: statsJson.cancelled ?? 0
				};
			}
		}

		const [products, categories, bundles] = await Promise.all([
			supabase.from('products').select('id', { count: 'exact', head: true }),
			supabase.from('categories').select('id', { count: 'exact', head: true }),
			supabase.from('product_bundles').select('id', { count: 'exact', head: true })
		]);

		stats.totalProducts = products.count || 0;
		stats.totalCategories = categories.count || 0;
		stats.totalBundles = bundles.count || 0;
		stats.totalPaidOrders = orderStats.totalPaid;
		stats.orderPending = orderStats.pending;
		stats.orderProcessing = orderStats.processing;
		stats.orderCompleted = orderStats.completed;
		stats.orderCancelled = orderStats.cancelled;
	});
</script>

<svelte:head>
	<title>Panel de Administración - Guerra Láser</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-4xl font-bold mb-8">Panel de Administración</h1>

	<!-- Stats Cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
		<div class="bg-white rounded-lg shadow-md p-6">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-gray-600 text-sm">Total Productos</p>
					<p class="text-3xl font-bold text-blue-600">{stats.totalProducts}</p>
				</div>
				<div class="text-4xl">📦</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-gray-600 text-sm">Categorías</p>
					<p class="text-3xl font-bold text-green-600">{stats.totalCategories}</p>
				</div>
				<div class="text-4xl">🏷️</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-gray-600 text-sm">Bundles Activos</p>
					<p class="text-3xl font-bold text-pink-600">{stats.totalBundles}</p>
				</div>
				<div class="text-4xl">🎁</div>
			</div>
		</div>

		<a
			href="/admin/pedidos"
			class="bg-white rounded-lg shadow-md p-6 block transition hover:shadow-lg hover:border-purple-200 border border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
		>
			<div class="flex items-center justify-between">
				<div class="min-w-0 flex-1">
					<p class="text-gray-800 font-semibold">Total pedidos</p>
					<p class="text-xs text-gray-500 mt-0.5">Pagos confirmados (misma vista que Pedidos)</p>
					<p class="text-3xl font-bold text-purple-600 mt-1">{stats.totalPaidOrders}</p>
					<p class="text-xs text-gray-600 mt-2 leading-relaxed">
						<span class="text-orange-700">Pendiente:</span>
						{stats.orderPending}
						<span class="text-gray-400 mx-1">·</span>
						<span class="text-blue-700">Procesando:</span>
						{stats.orderProcessing}
						<span class="text-gray-400 mx-1">·</span>
						<span class="text-green-700">Completado:</span>
						{stats.orderCompleted}
						{#if stats.orderCancelled > 0}
							<span class="text-gray-400 mx-1">·</span>
							<span class="text-red-700">Cancelado:</span>
							{stats.orderCancelled}
						{/if}
					</p>
				</div>
				<div class="text-4xl shrink-0 ml-2">🛍️</div>
			</div>
		</a>
	</div>

	<!-- Pending Orders Alert -->
	{#if stats.orderPending > 0}
		<div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="text-2xl">⏳</div>
					<div>
						<p class="font-bold text-orange-800">
							Tienes {stats.orderPending}
							{stats.orderPending === 1 ? 'pedido pagado' : 'pedidos pagados'} por procesar
						</p>
						<p class="text-sm text-orange-700">
							Pedidos pagados aún en estado pendiente de preparación/envío
						</p>
					</div>
				</div>
				<a
					href="/admin/pedidos"
					class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
				>
					Ver Pedidos
				</a>
			</div>
		</div>
	{/if}

	<!-- Quick Actions -->
	<div class="bg-white rounded-lg shadow-md p-6">
		<h2 class="text-2xl font-bold mb-6">Acciones Rápidas</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<a
				href="/admin/clientes"
				class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
			>
				<div class="text-3xl">👥</div>
				<div>
					<h3 class="font-bold text-lg">Gestionar Clientes</h3>
					<p class="text-gray-600 text-sm">Base de datos de clientes</p>
				</div>
			</a>

			<a
				href="/admin/productos"
				class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
			>
				<div class="text-3xl">📦</div>
				<div>
					<h3 class="font-bold text-lg">Gestionar Productos</h3>
					<p class="text-gray-600 text-sm">Crear y editar productos</p>
				</div>
			</a>

			<a
				href="/admin/cotizaciones"
				class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
			>
				<div class="text-3xl">🧾</div>
				<div>
					<h3 class="font-bold text-lg">Crear Cotización</h3>
					<p class="text-gray-600 text-sm">Genera cotizaciones en PDF</p>
				</div>
			</a>

			<a
				href="/admin/cotizacion-chat"
				class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
			>
				<div class="text-3xl">🤖</div>
				<div>
					<h3 class="font-bold text-lg">Chat Cotización IA</h3>
					<p class="text-gray-600 text-sm">Asistente de cotizaciones</p>
				</div>
			</a>
		</div>
	</div>

	<!-- Admin Notice -->
	<div class="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
		<p class="text-yellow-800">
			<strong>Nota:</strong> Para usar el panel de administración en producción, asegúrate de configurar
			la autenticación de Supabase y las políticas de seguridad (RLS) para usuarios admin.
		</p>
	</div>
</div>