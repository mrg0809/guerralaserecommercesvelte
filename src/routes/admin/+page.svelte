<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';

	let stats = $state({
		totalProducts: 0,
		totalCategories: 0,
		totalBundles: 0,
		totalOrders: 0,
		pendingOrders: 0
	});

	let isAuthorized = $state(false);

	onMount(async () => {
		// Check if user is logged in
		const {
			data: { session }
		} = await supabase.auth.getSession();

		if (!session) {
			goto('/login');
			return;
		}

		isAuthorized = true;

		// Get stats
		const [products, categories, bundles, orders, pending] = await Promise.all([
			supabase.from('products').select('id', { count: 'exact', head: true }),
			supabase.from('categories').select('id', { count: 'exact', head: true }),
			supabase.from('product_bundles').select('id', { count: 'exact', head: true }),
			supabase.from('orders').select('id', { count: 'exact', head: true }),
			supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending')
		]);

		stats.totalProducts = products.count || 0;
		stats.totalCategories = categories.count || 0;
		stats.totalBundles = bundles.count || 0;
		stats.totalOrders = orders.count || 0;
		stats.pendingOrders = pending.count || 0;
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

		<div class="bg-white rounded-lg shadow-md p-6">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-gray-600 text-sm">Total Pedidos</p>
					<p class="text-3xl font-bold text-purple-600">{stats.totalOrders}</p>
				</div>
				<div class="text-4xl">🛍️</div>
			</div>
		</div>
	</div>

	<!-- Pending Orders Alert -->
	{#if stats.pendingOrders > 0}
		<div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="text-2xl">⏳</div>
					<div>
						<p class="font-bold text-orange-800">
							Tienes {stats.pendingOrders} pedido{stats.pendingOrders !== 1 ? 's' : ''} pendiente{stats.pendingOrders !== 1 ? 's' : ''}
						</p>
						<p class="text-sm text-orange-700">Revisa y procesa los pedidos pendientes</p>
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
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
				href="/admin/categorias"
				class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
			>
				<div class="text-3xl">🏷️</div>
				<div>
					<h3 class="font-bold text-lg">Gestionar Categorías</h3>
					<p class="text-gray-600 text-sm">Organizar categorías</p>
				</div>
			</a>

			<a
				href="/admin/bundles"
				class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
			>
				<div class="text-3xl">🎁</div>
				<div>
					<h3 class="font-bold text-lg">Gestionar Bundles</h3>
					<p class="text-gray-600 text-sm">Paquetes de productos</p>
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
				href="/admin/pedidos"
				class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
			>
				<div class="text-3xl">🛍️</div>
				<div>
					<h3 class="font-bold text-lg">Ver Pedidos</h3>
					<p class="text-gray-600 text-sm">Administrar pedidos</p>
				</div>
			</a>

			<a
				href="/admin/importar"
				class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
			>
				<div class="text-3xl">📊</div>
				<div>
					<h3 class="font-bold text-lg">Importar Excel</h3>
					<p class="text-gray-600 text-sm">Importar productos masivamente</p>
				</div>
			</a>

			<a
				href="/admin/videos"
				class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
			>
				<div class="text-3xl">🎥</div>
				<div>
					<h3 class="font-bold text-lg">Videos Testimoniales</h3>
					<p class="text-gray-600 text-sm">Gestionar videos de clientes</p>
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