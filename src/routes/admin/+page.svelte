<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';

	let stats = $state({
		totalProducts: 0,
		totalCategories: 0,
		totalOrders: 0,
		pendingOrders: 0
	});

	onMount(async () => {
		// Get stats
		const [products, categories, orders, pending] = await Promise.all([
			supabase.from('products').select('id', { count: 'exact', head: true }),
			supabase.from('categories').select('id', { count: 'exact', head: true }),
			supabase.from('orders').select('id', { count: 'exact', head: true }),
			supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending')
		]);

		stats.totalProducts = products.count || 0;
		stats.totalCategories = categories.count || 0;
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
					<p class="text-gray-600 text-sm">Total Pedidos</p>
					<p class="text-3xl font-bold text-purple-600">{stats.totalOrders}</p>
				</div>
				<div class="text-4xl">🛍️</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-6">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-gray-600 text-sm">Pedidos Pendientes</p>
					<p class="text-3xl font-bold text-orange-600">{stats.pendingOrders}</p>
				</div>
				<div class="text-4xl">⏳</div>
			</div>
		</div>
	</div>

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
				href="/admin/pedidos"
				class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
			>
				<div class="text-3xl">🛍️</div>
				<div>
					<h3 class="font-bold text-lg">Ver Pedidos</h3>
					<p class="text-gray-600 text-sm">Administrar pedidos</p>
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