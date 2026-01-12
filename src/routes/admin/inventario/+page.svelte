<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import * as XLSX from 'xlsx';

	let categories = $state<any[]>([]);
	let products = $state<any[]>([]);
	let loading = $state(true);
	let selectedCategories = $state<Set<string>>(new Set());
	let selectAllCategories = $state(false);
	let separateByCategory = $state(true);
	let showCategorySelector = $state(false);

	$effect(() => {
		loadData();
	});

	async function loadData() {
		loading = true;

		// Cargar categorías con jerarquía
		const { data: categoriesData } = await supabase
			.from('categories')
			.select('id, name, parent_id')
			.eq('is_active', true)
			.order('name');

		categories = categoriesData || [];

		// Cargar productos - solo columnas necesarias (sin expandir relaciones)
		const { data: productsData } = await supabase
			.from('products')
			.select('id, sku, name, stock_quantity, category_id')
			.eq('is_active', true)
			.order('name');

		products = productsData || [];
		loading = false;
	}

	function getCategoryPath(categoryId: string): string {
		const path: string[] = [];
		let currentId: string | null = categoryId;

		while (currentId) {
			const cat = categories.find((c) => c.id === currentId);
			if (!cat) break;
			path.unshift(cat.name);
			currentId = cat.parent_id;
		}

		return path.join(' > ');
	}

	function getCategoryLevels(categoryId: string): { family: string; category: string; subcategory: string } {
		const path: string[] = [];
		let currentId: string | null = categoryId;

		while (currentId) {
			const cat = categories.find((c) => c.id === currentId);
			if (!cat) break;
			path.unshift(cat.name);
			currentId = cat.parent_id;
		}

		return {
			family: path[0] || '',
			category: path[1] || '',
			subcategory: path[2] || ''
		};
	}

	function toggleCategory(categoryId: string) {
		if (selectedCategories.has(categoryId)) {
			selectedCategories.delete(categoryId);
		} else {
			selectedCategories.add(categoryId);
		}
		selectedCategories = new Set(selectedCategories);
		updateSelectAll();
	}

	function toggleSelectAll() {
		selectAllCategories = !selectAllCategories;

		if (selectAllCategories) {
			selectedCategories = new Set(categories.map((c) => c.id));
		} else {
			selectedCategories = new Set();
		}
	}

	function updateSelectAll() {
		selectAllCategories = selectedCategories.size === categories.length;
	}

	function getProductsByCategories(): Map<string, any[]> {
		const categoryMap = new Map<string, any[]>();

		for (const categoryId of selectedCategories) {
			const descendantIds = getDescendantCategoryIds(categoryId);
			const allIds = [categoryId, ...descendantIds];

			const categoryProducts = products.filter((p) => allIds.includes(p.category_id));
			if (categoryProducts.length > 0) {
				categoryMap.set(categoryId, categoryProducts);
			}
		}

		return categoryMap;
	}

	function getDescendantCategoryIds(categoryId: string): string[] {
		const ids: string[] = [];
		const stack: string[] = [categoryId];

		while (stack.length) {
			const current = stack.pop()!;
			const children = categories.filter((c) => c.parent_id === current);
			for (const child of children) {
				ids.push(child.id);
				stack.push(child.id);
			}
		}

		return ids;
	}

	function sanitizeSheetName(name: string): string {
		// Remover caracteres no permitidos en nombres de hojas de Excel
		return name
			.replace(/[:\\/?*[\]]/g, '_')
			.substring(0, 31); // Excel limita a 31 caracteres
	}

	function generateCountSheet() {
		if (selectedCategories.size === 0) {
			alert('Por favor selecciona al menos una categoría');
			return;
		}

		const categoryMap = getProductsByCategories();
		const workbook = XLSX.utils.book_new();
		const sheetNameMap = new Map<string, number>(); // Para rastrear nombres duplicados

		if (separateByCategory) {
			// Una hoja por categoría
			for (const [categoryId, categoryProducts] of categoryMap) {
				const category = categories.find((c) => c.id === categoryId);
				let sheetName = sanitizeSheetName(category?.name || 'Categoría');

				// Si el nombre ya existe, agregar un contador
				if (sheetNameMap.has(sheetName)) {
					const count = (sheetNameMap.get(sheetName) || 0) + 1;
					sheetNameMap.set(sheetName, count);
					const newName = sanitizeSheetName(`${sheetName}_${count}`);
					sheetName = newName.substring(0, 31);
				} else {
					sheetNameMap.set(sheetName, 0);
				}

				const data: any[] = [];

				for (const product of categoryProducts) {
					const { family, category: catName, subcategory } = product.category_id
						? getCategoryLevels(product.category_id)
						: { family: '', category: '', subcategory: '' };
					if (product.product_variants && product.product_variants.length > 0) {
						// Si tiene variantes, una fila por variante
						for (const variant of product.product_variants) {
							data.push({
								Familia: family,
								Categoria: catName,
								Subcategoria: subcategory,
								SKU: product.sku || '-',
								Nombre: product.name,
								Variante: variant.name,
								Inventario: variant.stock_quantity || 0,
								Conteo: ''
							});
						}
					} else {
						// Si no tiene variantes, una fila por producto
						data.push({
							Familia: family,
							Categoria: catName,
							Subcategoria: subcategory,
							SKU: product.sku || '-',
							Nombre: product.name,
							Variante: '-',
							Inventario: product.stock_quantity || 0,
							Conteo: ''
						});
					}
				}

				const worksheet = XLSX.utils.json_to_sheet(data);

				// Ajustar anchos de columna
				worksheet['!cols'] = [
					{ wch: 18 }, // Familia
					{ wch: 22 }, // Categoria
					{ wch: 22 }, // Subcategoria
					{ wch: 15 }, // SKU
					{ wch: 30 }, // Nombre
					{ wch: 20 }, // Variante
					{ wch: 12 }, // Inventario
					{ wch: 12 } // Conteo
				];

				XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
			}
		} else {
			// Todo en una sola hoja
			const allData: any[] = [];

			for (const [categoryId, categoryProducts] of categoryMap) {
				const categoryPath = getCategoryPath(categoryId);

				// Agregar nombre de categoría como encabezado con ruta completa
				if (allData.length > 0) {
					allData.push({
						SKU: '',
						Nombre: '',
						Variante: '',
						Inventario: '',
						Conteo: ''
					});
				}

				allData.push({
					SKU: `[${categoryPath}]`,
					Nombre: '',
					Variante: '',
					Inventario: '',
					Conteo: ''
				});

				// Agregar productos
				for (const product of categoryProducts) {
					const { family, category: catName, subcategory } = product.category_id
						? getCategoryLevels(product.category_id)
						: { family: '', category: '', subcategory: '' };
					if (product.product_variants && product.product_variants.length > 0) {
						// Si tiene variantes, una fila por variante
						for (const variant of product.product_variants) {
							allData.push({
								Familia: family,
								Categoria: catName,
								Subcategoria: subcategory,
								SKU: product.sku || '-',
								Nombre: product.name,
								Variante: variant.name,
								Inventario: variant.stock_quantity || 0,
								Conteo: ''
							});
						}
					} else {
						// Si no tiene variantes, una fila por producto
						allData.push({
							Familia: family,
							Categoria: catName,
							Subcategoria: subcategory,
							SKU: product.sku || '-',
							Nombre: product.name,
							Variante: '-',
							Inventario: product.stock_quantity || 0,
							Conteo: ''
						});
					}
				}
			}

			const worksheet = XLSX.utils.json_to_sheet(allData);

			// Ajustar anchos de columna
				worksheet['!cols'] = [
					{ wch: 18 }, // Familia
					{ wch: 22 }, // Categoria
					{ wch: 22 }, // Subcategoria
					{ wch: 15 }, // SKU
					{ wch: 30 }, // Nombre
					{ wch: 20 }, // Variante
					{ wch: 12 }, // Inventario
					{ wch: 12 } // Conteo
				];
		}

		// Descargar archivo
		const fileName = `Hoja_Conteo_${new Date().toISOString().split('T')[0]}.xlsx`;
		XLSX.writeFile(workbook, fileName);
	}
</script>

<svelte:head>
	<title>Inventario - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="mb-6">
		<h1 class="text-4xl font-bold">Gestión de Inventario</h1>
		<p class="text-gray-600 mt-2">Gestiona y controla el inventario de tu tienda</p>
	</div>

	<!-- Secciones de Inventario -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		<!-- Hoja de Conteo -->
		<div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer" onclick={() => showCategorySelector = !showCategorySelector}>
			<div class="text-4xl mb-4">📋</div>
			<h2 class="text-xl font-bold mb-2">Hoja de Conteo</h2>
			<p class="text-gray-600">Genera una hoja de conteo en Excel seleccionando categorías</p>
		</div>

		<!-- Próximas funcionalidades -->
		<div class="bg-gray-100 rounded-lg shadow-md p-6 opacity-50 cursor-not-allowed">
			<div class="text-4xl mb-4 grayscale">📊</div>
			<h2 class="text-xl font-bold mb-2 text-gray-500">Reporte de Stock</h2>
			<p class="text-gray-500">Próximamente</p>
		</div>

		<div class="bg-gray-100 rounded-lg shadow-md p-6 opacity-50 cursor-not-allowed">
			<div class="text-4xl mb-4 grayscale">⚙️</div>
			<h2 class="text-xl font-bold mb-2 text-gray-500">Ajustes de Stock</h2>
			<p class="text-gray-500">Próximamente</p>
		</div>
	</div>

	<!-- Modal de Selección de Categorías -->
	{#if showCategorySelector}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
				<div class="p-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-2xl font-bold">Seleccionar Categorías</h2>
						<button
							onclick={() => showCategorySelector = false}
							class="text-gray-600 hover:text-gray-900 text-2xl"
						>
							×
						</button>
					</div>

					{#if loading}
						<p class="text-center py-8">Cargando categorías...</p>
					{:else if categories.length === 0}
						<p class="text-center py-8 text-gray-600">No hay categorías disponibles</p>
					{:else}
						<div class="space-y-4">
							<!-- Seleccionar Todo -->
							<div class="flex items-center p-4 bg-blue-50 rounded-lg">
								<input
									type="checkbox"
									id="selectAll"
									checked={selectAllCategories}
									onchange={toggleSelectAll}
									class="w-5 h-5 text-blue-600 rounded cursor-pointer"
								/>
								<label for="selectAll" class="ml-3 font-semibold text-blue-900 cursor-pointer flex-1">
									Seleccionar Todas las Categorías
								</label>
								<span class="text-sm text-blue-700">
									{selectedCategories.size} / {categories.length}
								</span>
							</div>

							<!-- Listado de Categorías -->
							<div class="space-y-2 border-t pt-4">
								{#each categories as category}
									<div class="flex items-center p-3 hover:bg-gray-50 rounded-lg">
										<input
											type="checkbox"
											id={`cat-${category.id}`}
											checked={selectedCategories.has(category.id)}
											onchange={() => toggleCategory(category.id)}
											class="w-5 h-5 text-blue-600 rounded cursor-pointer"
										/>
										<label for={`cat-${category.id}`} class="ml-3 font-medium text-gray-700 cursor-pointer flex-1">
											{category.name}
										</label>
										<span class="text-sm text-gray-500">
											{products.filter((p) => p.category_id === category.id).length} productos
										</span>
									</div>
								{/each}
							</div>

							<!-- Opciones de Formato -->
							<div class="border-t pt-4 mt-4">
								<h3 class="font-semibold mb-3">Formato del Reporte</h3>
								<div class="space-y-2">
									<div class="flex items-center">
										<input
											type="radio"
											id="separate"
											name="format"
											value="separate"
											checked={separateByCategory}
											onchange={() => (separateByCategory = true)}
											class="w-4 h-4 text-blue-600 cursor-pointer"
										/>
										<label for="separate" class="ml-3 font-medium text-gray-700 cursor-pointer">
											Una hoja por categoría
										</label>
									</div>
									<div class="flex items-center">
										<input
											type="radio"
											id="continuous"
											name="format"
											value="continuous"
											checked={!separateByCategory}
											onchange={() => (separateByCategory = false)}
											class="w-4 h-4 text-blue-600 cursor-pointer"
										/>
										<label for="continuous" class="ml-3 font-medium text-gray-700 cursor-pointer">
											Todo continuo en una hoja
										</label>
									</div>
								</div>
							</div>
						</div>

						<!-- Botones -->
						<div class="flex gap-3 mt-6 justify-end">
							<button
								onclick={() => showCategorySelector = false}
								class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
							>
								Cancelar
							</button>
							<button
								onclick={generateCountSheet}
								class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
							>
								<span>📥</span>
								Descargar Excel
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

