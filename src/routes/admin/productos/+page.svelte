<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice, generateSlug } from '$lib/utils';
	import type { Product, Category } from '$lib/types';

	let products: Product[] = $state([]);
	let categories: Category[] = $state([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingProduct = $state<Product | null>(null);
	
	let formData = $state({
		name: '',
		slug: '',
		description: '',
		short_description: '',
		base_price: 0,
		category_id: '',
		is_active: true,
		is_featured: false,
		stock_quantity: 0,
		sku: ''
	});

	onMount(async () => {
		await loadProducts();
		await loadCategories();
	});

	async function loadProducts() {
		loading = true;
		const { data } = await supabase
			.from('products')
			.select('*')
			.order('created_at', { ascending: false });

		if (data) {
			products = data;
		}
		loading = false;
	}

	async function loadCategories() {
		const { data } = await supabase.from('categories').select('*').eq('is_active', true);
		if (data) {
			categories = data;
		}
	}

	function openModal(product?: Product) {
		if (product) {
			editingProduct = product;
			formData = {
				name: product.name,
				slug: product.slug,
				description: product.description || '',
				short_description: product.short_description || '',
				base_price: product.base_price,
				category_id: product.category_id || '',
				is_active: product.is_active,
				is_featured: product.is_featured,
				stock_quantity: product.stock_quantity,
				sku: product.sku || ''
			};
		} else {
			editingProduct = null;
			formData = {
				name: '',
				slug: '',
				description: '',
				short_description: '',
				base_price: 0,
				category_id: '',
				is_active: true,
				is_featured: false,
				stock_quantity: 0,
				sku: ''
			};
		}
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingProduct = null;
	}

	function updateSlug() {
		if (formData.name && !editingProduct) {
			formData.slug = generateSlug(formData.name);
		}
	}

	async function saveProduct() {
		try {
			if (editingProduct) {
				const { error } = await supabase
					.from('products')
					.update(formData)
					.eq('id', editingProduct.id);

				if (error) throw error;
			} else {
				const { error } = await supabase.from('products').insert([formData]);

				if (error) throw error;
			}

			closeModal();
			await loadProducts();
		} catch (error: any) {
			alert('Error al guardar producto: ' + error.message);
		}
	}

	async function deleteProduct(id: string) {
		if (!confirm('¿Estás seguro de eliminar este producto?')) return;

		try {
			const { error } = await supabase.from('products').delete().eq('id', id);

			if (error) throw error;

			await loadProducts();
		} catch (error: any) {
			alert('Error al eliminar producto: ' + error.message);
		}
	}

	async function toggleActive(product: Product) {
		try {
			const { error } = await supabase
				.from('products')
				.update({ is_active: !product.is_active })
				.eq('id', product.id);

			if (error) throw error;

			await loadProducts();
		} catch (error: any) {
			alert('Error al actualizar producto: ' + error.message);
		}
	}
</script>

<svelte:head>
	<title>Gestión de Productos - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-4xl font-bold">Gestión de Productos</h1>
		<div class="flex gap-4">
			<a
				href="/admin"
				class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
			>
				← Volver
			</a>
			<button
				onclick={() => openModal()}
				class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
			>
				+ Nuevo Producto
			</button>
		</div>
	</div>

	{#if loading}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">Cargando productos...</p>
		</div>
	{:else if products.length === 0}
		<div class="bg-gray-50 rounded-lg p-8 text-center">
			<p class="text-xl text-gray-600 mb-4">No hay productos registrados</p>
			<button
				onclick={() => openModal()}
				class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
			>
				Crear Primer Producto
			</button>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow-md overflow-hidden">
			<table class="w-full">
				<thead class="bg-gray-100">
					<tr>
						<th class="px-4 py-3 text-left">Producto</th>
						<th class="px-4 py-3 text-left">SKU</th>
						<th class="px-4 py-3 text-left">Precio</th>
						<th class="px-4 py-3 text-left">Stock</th>
						<th class="px-4 py-3 text-left">Estado</th>
						<th class="px-4 py-3 text-left">Destacado</th>
						<th class="px-4 py-3 text-right">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each products as product}
						<tr class="border-t hover:bg-gray-50">
							<td class="px-4 py-3">
								<div>
									<p class="font-semibold">{product.name}</p>
									<p class="text-sm text-gray-600">{product.slug}</p>
								</div>
							</td>
							<td class="px-4 py-3 text-sm">{product.sku || '-'}</td>
							<td class="px-4 py-3">{formatPrice(product.base_price)}</td>
							<td class="px-4 py-3">{product.stock_quantity}</td>
							<td class="px-4 py-3">
								<button
									onclick={() => toggleActive(product)}
									class="px-3 py-1 rounded-full text-sm {product.is_active
										? 'bg-green-100 text-green-800'
										: 'bg-red-100 text-red-800'}"
								>
									{product.is_active ? 'Activo' : 'Inactivo'}
								</button>
							</td>
							<td class="px-4 py-3">
								{product.is_featured ? '⭐' : '-'}
							</td>
							<td class="px-4 py-3 text-right">
								<button
									onclick={() => openModal(product)}
									class="text-blue-600 hover:text-blue-800 mr-3"
								>
									Editar
								</button>
								<button
									onclick={() => deleteProduct(product.id)}
									class="text-red-600 hover:text-red-800"
								>
									Eliminar
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Modal -->
{#if showModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
			<div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
				<h2 class="text-2xl font-bold">
					{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
				</h2>
				<button onclick={closeModal} class="text-gray-500 hover:text-gray-700 text-2xl">
					×
				</button>
			</div>

			<form on:submit|preventDefault={saveProduct} class="p-6 space-y-4">
				<div>
					<label class="block text-sm font-semibold mb-2">Nombre *</label>
					<input
						type="text"
						bind:value={formData.name}
						onblur={updateSlug}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Slug *</label>
					<input
						type="text"
						bind:value={formData.slug}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Descripción Corta</label>
					<input
						type="text"
						bind:value={formData.short_description}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Descripción</label>
					<textarea
						bind:value={formData.description}
						rows="4"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					></textarea>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-semibold mb-2">Precio Base *</label>
						<input
							type="number"
							bind:value={formData.base_price}
							step="0.01"
							min="0"
							required
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label class="block text-sm font-semibold mb-2">Stock</label>
						<input
							type="number"
							bind:value={formData.stock_quantity}
							min="0"
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-semibold mb-2">Categoría</label>
						<select
							bind:value={formData.category_id}
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Sin categoría</option>
							{#each categories as category}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="block text-sm font-semibold mb-2">SKU</label>
						<input
							type="text"
							bind:value={formData.sku}
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>

				<div class="flex gap-4">
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={formData.is_active} class="w-4 h-4" />
						<span class="text-sm">Producto Activo</span>
					</label>

					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={formData.is_featured} class="w-4 h-4" />
						<span class="text-sm">Producto Destacado</span>
					</label>
				</div>

				<div class="flex gap-4 pt-4">
					<button
						type="submit"
						class="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
					>
						{editingProduct ? 'Actualizar' : 'Crear'} Producto
					</button>
					<button
						type="button"
						onclick={closeModal}
						class="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
					>
						Cancelar
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}