<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import type { Product, ProductVariant } from '$lib/types';
	import * as XLSX from 'xlsx';

	interface Category {
		id: string;
		name: string;
		parent_id: string | null;
	}

	let products: Product[] = $state([]);
	let categories: Category[] = $state([]);
	let productVariants: Record<string, ProductVariant[]> = $state({});
	let expandedProducts: Set<string> = $state(new Set());
	let loading = $state(true);
	let saving = $state(false);
	let searchTerm = $state('');
	let selectedCategory = $state('');
	let successMessage = $state('');
	let errorMessage = $state('');

	// Objeto para trackear los cambios de cada producto y variante
	let productChanges: Record<string, { base_price?: number; stock_quantity?: number }> = $state({});
	let variantChanges: Record<string, { price?: number; stock_quantity?: number }> = $state({});

	onMount(async () => {
		await loadCategories();
		await loadAllVariants(); // Cargar variantes primero
		await loadProducts(); // Luego productos (para poder expandir los que tienen variantes)
	});

	async function loadCategories() {
		const { data, error } = await supabase
			.from('categories')
			.select('id, name, parent_id')
			.order('name');

		if (error) {
			console.error('Error loading categories:', error);
		} else {
			categories = data || [];
		}
	}

	// Función recursiva para obtener todas las categorías hijas
	function getCategoryWithChildren(categoryId: string): string[] {
		const result = [categoryId];
		const children = categories.filter(c => c.parent_id === categoryId);
		children.forEach(child => {
			result.push(...getCategoryWithChildren(child.id));
		});
		return result;
	}

	async function loadProducts() {
		loading = true;
		const { data, error } = await supabase
			.from('products')
			.select('id, name, sku, base_price, stock_quantity, is_active, category_id, categories(name)')
			.order('name');

		if (error) {
			console.error('Error loading products:', error);
			errorMessage = 'Error al cargar productos';
		} else {
			products = data || [];
			// Expandir todos los productos con variantes por defecto
			expandAllProductsWithVariants();
		}
		loading = false;
	}

	function expandAllProductsWithVariants() {
		const productsWithVariants = products.filter(p => hasVariants(p.id)).map(p => p.id);
		expandedProducts = new Set(productsWithVariants);
	}

	async function loadAllVariants() {
		const { data, error } = await supabase
			.from('product_variants')
			.select('*')
			.order('created_at');

		if (error) {
			console.error('Error loading variants:', error);
		} else if (data) {
			productVariants = {};
			for (const variant of data) {
				if (!productVariants[variant.product_id]) {
					productVariants[variant.product_id] = [];
				}
				productVariants[variant.product_id].push(variant);
			}
		}
	}

	function toggleExpanded(productId: string) {
		if (expandedProducts.has(productId)) {
			expandedProducts.delete(productId);
		} else {
			expandedProducts.add(productId);
		}
		expandedProducts = new Set(expandedProducts);
	}

	function handlePriceChange(productId: string, value: string) {
		const price = parseFloat(value);
		if (!isNaN(price) && price >= 0) {
			if (!productChanges[productId]) {
				productChanges[productId] = {};
			}
			productChanges[productId].base_price = price;
		}
	}

	function handleStockChange(productId: string, value: string) {
		const stock = parseInt(value);
		if (!isNaN(stock) && stock >= 0) {
			if (!productChanges[productId]) {
				productChanges[productId] = {};
			}
			productChanges[productId].stock_quantity = stock;
		}
	}

	function handleVariantPriceChange(variantId: string, value: string) {
		const price = parseFloat(value);
		if (!isNaN(price) && price >= 0) {
			if (!variantChanges[variantId]) {
				variantChanges[variantId] = {};
			}
			variantChanges[variantId].price = price;
		}
	}

	function handleVariantStockChange(variantId: string, value: string) {
		const stock = parseInt(value);
		if (!isNaN(stock) && stock >= 0) {
			if (!variantChanges[variantId]) {
				variantChanges[variantId] = {};
			}
			variantChanges[variantId].stock_quantity = stock;
		}
	}

	async function saveChanges() {
		if (Object.keys(productChanges).length === 0 && Object.keys(variantChanges).length === 0) {
			errorMessage = 'No hay cambios para guardar';
			setTimeout(() => errorMessage = '', 3000);
			return;
		}

		saving = true;
		errorMessage = '';
		successMessage = '';

		try {
			// Guardar cada producto que tenga cambios
			for (const [productId, changes] of Object.entries(productChanges)) {
				const { error } = await supabase
					.from('products')
					.update(changes)
					.eq('id', productId);

				if (error) throw error;
			}

			// Guardar cada variante que tenga cambios
			for (const [variantId, changes] of Object.entries(variantChanges)) {
				const { error } = await supabase
					.from('product_variants')
					.update(changes)
					.eq('id', variantId);

				if (error) throw error;
			}

			const totalChanges = Object.keys(productChanges).length + Object.keys(variantChanges).length;
			successMessage = `${totalChanges} elemento(s) actualizado(s) correctamente`;
			productChanges = {}; // Limpiar cambios después de guardar
			variantChanges = {};
			await loadProducts(); // Recargar productos
			await loadAllVariants(); // Recargar variantes
			
			setTimeout(() => successMessage = '', 3000);
		} catch (error: any) {
			console.error('Error saving changes:', error);
			errorMessage = 'Error al guardar cambios: ' + error.message;
		} finally {
			saving = false;
		}
	}

	function cancelChanges() {
		productChanges = {};
		variantChanges = {};
		loadProducts();
		loadAllVariants();
	}

	// Filtrar productos por búsqueda y categoría
	let filteredProducts = $derived(
		products.filter(p => {
			const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
			
			// Si hay categoría seleccionada, incluir productos de esa categoría y sus hijas
			let matchesCategory = true;
			if (selectedCategory) {
				const categoryIds = getCategoryWithChildren(selectedCategory);
				matchesCategory = p.category_id && categoryIds.includes(p.category_id);
			}
			
			return matchesSearch && matchesCategory;
		})
	);

	// Verificar si hay cambios pendientes
	let hasChanges = $derived(Object.keys(productChanges).length > 0 || Object.keys(variantChanges).length > 0);

	// Verificar si un producto tiene variantes
	function hasVariants(productId: string): boolean {
		return productVariants[productId] && productVariants[productId].length > 0;
	}

	// Verificar si un producto está expandido
	function isExpanded(productId: string): boolean {
		return expandedProducts.has(productId);
	}

	// Función para exportar a Excel
	function exportToExcel() {
		// Preparar datos para exportar, ordenados por categoría y alfabéticamente
		const exportData: any[] = [];
		
		// Obtener productos para exportar (filtrados o todos, incluyendo categorías hijas)
		let productsToExport: any[];
		if (selectedCategory) {
			const categoryIds = getCategoryWithChildren(selectedCategory);
			productsToExport = products.filter(p => p.category_id && categoryIds.includes(p.category_id));
		} else {
			productsToExport = products;
		}

		// Agrupar por categoría y ordenar
		const productsByCategory: Record<string, any[]> = {};
		
		productsToExport.forEach(product => {
			const categoryName = (product as any).categories?.name || 'Sin categoría';
			if (!productsByCategory[categoryName]) {
				productsByCategory[categoryName] = [];
			}
			productsByCategory[categoryName].push(product);
		});

		// Ordenar categorías alfabéticamente
		const sortedCategories = Object.keys(productsByCategory).sort();

		// Construir datos de exportación
		sortedCategories.forEach(categoryName => {
			// Ordenar productos dentro de la categoría alfabéticamente
			const sortedProducts = productsByCategory[categoryName].sort((a, b) => 
				a.name.localeCompare(b.name)
			);

			sortedProducts.forEach(product => {
				if (hasVariants(product.id)) {
					// Producto con variantes - mostrar cada variante
					const variants = productVariants[product.id] || [];
					variants.forEach(variant => {
						exportData.push({
							'Categoría': categoryName,
							'Producto': product.name,
							'Variante': variant.name || 'Variante sin nombre',
							'SKU': variant.sku || product.sku || '',
							'Precio': variant.price || 0,
							'Stock Sistema': variant.stock_quantity || 0,
							'Inventario Físico': ''
						});
					});
				} else {
					// Producto simple
					exportData.push({
						'Categoría': categoryName,
						'Producto': product.name,
						'Variante': '-',
						'SKU': product.sku || '',
						'Precio': product.base_price || 0,
						'Stock Sistema': product.stock_quantity || 0,
						'Inventario Físico': ''
					});
				}
			});
		});

		// Crear libro de Excel
		const worksheet = XLSX.utils.json_to_sheet(exportData);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');

		// Ajustar ancho de columnas
		worksheet['!cols'] = [
			{ wch: 20 }, // Categoría
			{ wch: 40 }, // Producto
			{ wch: 30 }, // Variante
			{ wch: 15 }, // SKU
			{ wch: 12 }, // Precio
			{ wch: 15 }, // Stock Sistema
			{ wch: 20 }  // Inventario Físico
		];

		// Generar nombre de archivo
		const fileName = selectedCategory 
			? `inventario_${categories.find(c => c.id === selectedCategory)?.name || 'categoria'}_${new Date().toISOString().split('T')[0]}.xlsx`
			: `inventario_completo_${new Date().toISOString().split('T')[0]}.xlsx`;

		// Descargar archivo
		XLSX.writeFile(workbook, fileName);
	}
</script>

<svelte:head>
	<title>Editar Precios y Stock - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-4xl font-bold">Editar Precios y Stock</h1>
		<div class="flex gap-4">
			<a
				href="/admin/productos"
				class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
			>
				← Volver a Productos
			</a>
		</div>
	</div>

	<!-- Mensajes de éxito/error -->
	{#if successMessage}
		<div class="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">
			{successMessage}
		</div>
	{/if}

	{#if errorMessage}
		<div class="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
			{errorMessage}
		</div>
	{/if}

	<!-- Filtros y botones de acción -->
	<div class="mb-6 space-y-4">
		<!-- Primera fila: Búsqueda y Categoría -->
		<div class="flex gap-4 items-center">
			<div class="flex-1">
				<input
					type="text"
					bind:value={searchTerm}
					placeholder="Buscar por nombre o SKU..."
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>
			<div class="w-64">
				<select
					bind:value={selectedCategory}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value="">Todas las categorías</option>
					{#each categories as category}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</div>
			<button
				onclick={exportToExcel}
				class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				Exportar Excel
			</button>
		</div>
		
		<!-- Segunda fila: Botones de guardar/cancelar -->
		{#if hasChanges}
			<div class="flex gap-4 justify-end">
				<button
					onclick={cancelChanges}
					class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
					disabled={saving}
				>
					Cancelar
				</button>
				<button
					onclick={saveChanges}
					class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
					disabled={saving}
				>
				{#if saving}
					<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Guardando...
				{:else}
					💾 Guardar Cambios ({Object.keys(productChanges).length + Object.keys(variantChanges).length})
				{/if}
			</button>
			</div>
		{/if}
	</div>

	<!-- Tabla de productos -->
	{#if loading}
		<div class="flex justify-center items-center py-12">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
		</div>
	{:else if filteredProducts.length === 0}
		<div class="text-center py-12 text-gray-500">
			{searchTerm ? 'No se encontraron productos con ese criterio de búsqueda' : 'No hay productos disponibles'}
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow-lg overflow-hidden">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
								Producto
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
								SKU
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
								Precio ($)
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
								Stock
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredProducts as product}
							<!-- Fila del producto principal -->
							<tr class="hover:bg-gray-50 transition {productChanges[product.id] ? 'bg-yellow-50' : ''} {hasVariants(product.id) ? 'bg-gray-50' : ''}">
								<td class="px-4 py-3">
									<div class="flex items-center gap-2">
										{#if hasVariants(product.id)}
											<button
												onclick={() => toggleExpanded(product.id)}
												class="text-gray-500 hover:text-gray-700 focus:outline-none"
											>
												<svg class="w-5 h-5 transform transition-transform {isExpanded(product.id) ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
												</svg>
											</button>
										{:else}
											<div class="w-5"></div>
										{/if}
										<span class="font-medium {product.is_active ? 'text-gray-900' : 'text-gray-400'}">
											{product.name}
										</span>
										{#if hasVariants(product.id)}
											<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
												{productVariants[product.id].length} variante(s)
											</span>
										{/if}
										{#if !product.is_active}
											<span class="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
												Inactivo
											</span>
										{/if}
									</div>
								</td>
								<td class="px-4 py-3">
									<span class="text-sm text-gray-600 font-mono">{product.sku || '-'}</span>
								</td>
								<td class="px-4 py-3">
									{#if hasVariants(product.id)}
										<span class="text-sm text-gray-500 italic">Ver variantes</span>
									{:else}
										<input
											type="number"
											value={productChanges[product.id]?.base_price ?? product.base_price}
											oninput={(e) => handlePriceChange(product.id, e.currentTarget.value)}
											min="0"
											step="0.01"
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent {productChanges[product.id]?.base_price !== undefined ? 'border-yellow-400 bg-yellow-50' : ''}"
										/>
									{/if}
								</td>
								<td class="px-4 py-3">
									{#if hasVariants(product.id)}
										<span class="text-sm text-gray-500 italic">Ver variantes</span>
									{:else}
										<input
											type="number"
											value={productChanges[product.id]?.stock_quantity ?? product.stock_quantity}
											oninput={(e) => handleStockChange(product.id, e.currentTarget.value)}
											min="0"
											step="1"
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent {productChanges[product.id]?.stock_quantity !== undefined ? 'border-yellow-400 bg-yellow-50' : ''}"
										/>
									{/if}
								</td>
							</tr>
							
							<!-- Filas de variantes (anidadas) -->
							{#if hasVariants(product.id) && isExpanded(product.id)}
								{#each productVariants[product.id] as variant}
									<tr class="bg-blue-50 hover:bg-blue-100 transition {variantChanges[variant.id] ? 'bg-yellow-50' : ''}">
										<td class="px-4 py-3 pl-12">
											<div class="flex items-center gap-2">
												<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
												</svg>
												<span class="text-sm font-medium text-gray-700">
													{variant.name || 'Variante sin nombre'}
												</span>
												{#if !variant.is_active}
													<span class="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
														Inactiva
													</span>
												{/if}
											</div>
										</td>
										<td class="px-4 py-3">
											<span class="text-sm text-gray-600 font-mono">{variant.sku || '-'}</span>
										</td>
										<td class="px-4 py-3">
											<input
												type="number"
												value={variantChanges[variant.id]?.price ?? variant.price}
												oninput={(e) => handleVariantPriceChange(variant.id, e.currentTarget.value)}
												min="0"
												step="0.01"
												class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent {variantChanges[variant.id]?.price !== undefined ? 'border-yellow-400 bg-yellow-50' : ''}"
											/>
										</td>
										<td class="px-4 py-3">
											<input
												type="number"
												value={variantChanges[variant.id]?.stock_quantity ?? variant.stock_quantity}
												oninput={(e) => handleVariantStockChange(variant.id, e.currentTarget.value)}
												min="0"
												step="1"
												class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent {variantChanges[variant.id]?.stock_quantity !== undefined ? 'border-yellow-400 bg-yellow-50' : ''}"
											/>
										</td>
									</tr>
								{/each}
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Resumen de productos -->
		<div class="mt-4 text-sm text-gray-600">
			Mostrando {filteredProducts.length} de {products.length} productos
			{#if hasChanges}
				<span class="ml-4 text-yellow-600 font-medium">
					• {Object.keys(productChanges).length + Object.keys(variantChanges).length} cambio(s) pendiente(s)
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	input[type="number"]::-webkit-inner-spin-button,
	input[type="number"]::-webkit-outer-spin-button {
		opacity: 1;
	}
</style>
