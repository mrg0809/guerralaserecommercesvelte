<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { parseExcelFile, validateProductRow, downloadTemplate, parseSpecifications, parseTags, type ProductImportRow, type ImportResult } from '$lib/excelImport';
	import type { Category } from '$lib/types';

	let file = $state<File | null>(null);
	let importing = $state(false);
	let parsing = $state(false);
	let parsedProducts = $state<ProductImportRow[]>([]);
	let importResult = $state<ImportResult | null>(null);
	let categories = $state<Category[]>([]);
	let previewMode = $state(true);

	// Computed values for stats
	let validCount = $derived(parsedProducts.filter((p, i) => validateProductRow(p, i + 2).valid).length);
	let errorCount = $derived(parsedProducts.length - validCount);

	$effect(() => {
		loadCategories();
	});

	async function loadCategories() {
		const { data } = await supabase
			.from('categories')
			.select('*')
			.order('name');
		if (data) categories = data;
	}

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			file = target.files[0];
			parsedProducts = [];
			importResult = null;
		}
	}

	async function parseFile() {
		if (!file) return;
		
		parsing = true;
		try {
			parsedProducts = await parseExcelFile(file);
			previewMode = true;
		} catch (error) {
			alert('Error al leer el archivo: ' + (error as Error).message);
			console.error(error);
		} finally {
			parsing = false;
		}
	}

	async function importProducts() {
		if (parsedProducts.length === 0) return;
		
		importing = true;
		const errors: Array<{ row: number; error: string; data?: any }> = [];
		let imported = 0;

		try {
			// Get category map
			const categoryMap = new Map(categories.map(c => [c.slug, c.id]));
			
			// Map to store created products by SKU (for variants)
			const productMap = new Map<string, string>(); // SKU -> product_id

			for (let i = 0; i < parsedProducts.length; i++) {
				const row = parsedProducts[i];
				const rowNumber = i + 2; // +2 because Excel is 1-indexed and has header
				
				// Check if this is a variant row
				const isVariant = row.producto_padre && row.producto_padre.trim() !== '';
				
				if (isVariant) {
					// This is a variant - handle separately
					const parentProductId = productMap.get(row.producto_padre);
					
					if (!parentProductId) {
						errors.push({
							row: rowNumber,
							error: `Producto padre '${row.producto_padre}' no encontrado. Asegúrate de que el producto padre se importe primero.`,
							data: row
						});
						continue;
					}
					
					if (!row.variante_nombre || !row.variante_sku) {
						errors.push({
							row: rowNumber,
							error: 'Las variantes requieren "Variante" y "Variante SKU"',
							data: row
						});
						continue;
					}
					
					try {
						// Insert variant
						const { error: variantError } = await supabase
							.from('product_variants')
							.insert({
								product_id: parentProductId,
								name: row.variante_nombre,
								sku: row.variante_sku,
								price: row.variante_precio || 0,
								stock_quantity: row.variante_stock || 0,
								is_active: true
							});
							
						if (variantError) throw variantError;
						imported++;
					} catch (error) {
						errors.push({
							row: rowNumber,
							error: `Error al crear variante: ${(error as Error).message}`,
							data: row
						});
					}
					continue;
				}
				
				// This is a regular product (not a variant)
				// Validate
				const validation = validateProductRow(row, rowNumber);
				if (!validation.valid) {
					errors.push({
						row: rowNumber,
						error: validation.errors.join(', '),
						data: row
					});
					continue;
				}

				// Get category ID
				const categoryId = categoryMap.get(row.categoria_slug);
				if (!categoryId) {
					errors.push({
						row: rowNumber,
						error: `Categoría '${row.categoria_slug}' no encontrada`,
						data: row
					});
					continue;
				}

				try {
					// Insert product
					const { data: product, error: productError } = await supabase
						.from('products')
						.insert({
							name: row.nombre,
							slug: row.slug,
							short_description: row.descripcion_corta || null,
							long_description: row.descripcion_larga || null,
							base_price: row.precio_base,
							category_id: categoryId,
							sku: row.sku,
							stock_quantity: row.stock || 0,
							is_active: row.activo ?? true,
							is_featured: row.destacado ?? false
						})
						.select()
						.single();

					if (productError) throw productError;
					
					// Store product ID by SKU for variant lookup
					if (row.sku) {
						productMap.set(row.sku, product.id);
					}

					// Insert specifications if provided
					if (row.especificaciones && row.especificaciones.trim() !== '') {
						const specs = parseSpecifications(row.especificaciones);
						const specInserts = Object.entries(specs).map(([key, value]) => ({
							product_id: product.id,
							spec_key: key,
							spec_value: value
						}));

						if (specInserts.length > 0) {
							const { error: specError } = await supabase
								.from('product_specifications')
								.insert(specInserts);
							if (specError) console.error('Error inserting specs:', specError);
						}
					}

					// Insert tags if provided
					if (row.etiquetas && row.etiquetas.trim() !== '') {
						const tagNames = parseTags(row.etiquetas);
						
						for (const tagName of tagNames) {
							// Get or create tag
							let { data: tag } = await supabase
								.from('tags')
								.select()
								.eq('name', tagName)
								.single();

							if (!tag) {
								const { data: newTag } = await supabase
									.from('tags')
									.insert({ name: tagName })
									.select()
									.single();
								tag = newTag;
							}

							if (tag) {
								await supabase
									.from('product_tags')
									.insert({
										product_id: product.id,
										tag_id: tag.id
									});
							}
						}
					}

					// Insert discount if provided
					if (row.descuento_porcentaje && row.descuento_porcentaje > 0) {
						// Find or create discount
						const { data: discount } = await supabase
							.from('discounts')
							.select()
							.eq('percentage', row.descuento_porcentaje)
							.eq('start_date', row.descuento_fecha_inicio || null)
							.eq('end_date', row.descuento_fecha_fin || null)
							.single();

						let discountId = discount?.id;

						if (!discountId) {
							const { data: newDiscount } = await supabase
								.from('discounts')
								.insert({
									name: `Descuento ${row.descuento_porcentaje}%`,
									percentage: row.descuento_porcentaje,
									start_date: row.descuento_fecha_inicio || null,
									end_date: row.descuento_fecha_fin || null,
									is_active: true
								})
								.select()
								.single();
							discountId = newDiscount?.id;
						}

						if (discountId) {
							await supabase
								.from('product_discounts')
								.insert({
									product_id: product.id,
									discount_id: discountId
								});
						}
					}

					imported++;
				} catch (error) {
					errors.push({
						row: rowNumber,
						error: (error as Error).message,
						data: row
					});
				}
			}

			importResult = {
				success: true,
				total: parsedProducts.length,
				imported,
				errors
			};

		} catch (error) {
			alert('Error durante la importación: ' + (error as Error).message);
			console.error(error);
		} finally {
			importing = false;
		}
	}

	function reset() {
		file = null;
		parsedProducts = [];
		importResult = null;
		previewMode = true;
		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		if (input) input.value = '';
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-7xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Importar Productos Masivamente</h1>
		<p class="text-gray-600">Sube un archivo Excel con múltiples productos para importar en bulk</p>
	</div>

	<!-- Instructions -->
	<div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 rounded-lg p-6">
		<h2 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
			<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			Instrucciones de Uso
		</h2>
		<ol class="space-y-3 text-gray-700">
			<li class="flex gap-3">
				<span class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</span>
				<div class="flex-1">
					<strong class="block text-gray-900">Descarga la plantilla Excel</strong>
					<span class="text-sm">Haz clic en el botón de abajo para obtener el archivo con el formato correcto y ejemplos</span>
				</div>
			</li>
			<li class="flex gap-3">
				<span class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</span>
				<div class="flex-1">
					<strong class="block text-gray-900">Completa la información de tus productos</strong>
					<span class="text-sm">Agrega filas con los datos de cada producto. Las columnas obligatorias son: Nombre, Precio y Categoría</span>
				</div>
			</li>
			<li class="flex gap-3">
				<span class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</span>
				<div class="flex-1">
					<strong class="block text-gray-900">Sube el archivo y previsualiza</strong>
					<span class="text-sm">Selecciona tu archivo Excel y haz clic en "Leer y Previsualizar" para verificar los datos antes de importar</span>
				</div>
			</li>
			<li class="flex gap-3">
				<span class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</span>
				<div class="flex-1">
					<strong class="block text-gray-900">Importa tus productos</strong>
					<span class="text-sm">Si todo se ve correcto, haz clic en "Importar Productos" para agregar todos los productos a la base de datos</span>
				</div>
			</li>
		</ol>
	</div>

	<!-- Download Template -->
	<div class="mb-8 bg-white rounded-lg shadow-lg p-6 border border-gray-200">
		<div class="flex items-center gap-4 mb-4">
			<div class="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
				<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
			</div>
			<div class="flex-1">
				<h3 class="text-lg font-bold text-gray-900">Paso 1: Descarga la Plantilla</h3>
				<p class="text-sm text-gray-600">La plantilla incluye todas las columnas necesarias y un ejemplo de producto</p>
			</div>
		</div>
		<button
			onclick={downloadTemplate}
			class="w-full sm:w-auto bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			Descargar Plantilla Excel
		</button>
		
		<!-- Column info -->
		<details class="mt-4 text-sm">
			<summary class="cursor-pointer text-gray-700 font-medium hover:text-gray-900">Ver columnas disponibles</summary>
			<div class="mt-3 space-y-4">
				<div>
					<h4 class="font-bold text-gray-900 mb-2">Columnas para Productos:</h4>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-600 bg-gray-50 rounded-lg p-4">
						<div><strong class="text-red-600">*</strong> Nombre (requerido)</div>
						<div><strong class="text-red-600">*</strong> Precio (requerido)</div>
						<div><strong class="text-red-600">*</strong> Categoría (slug, requerido)</div>
						<div>SKU (único)</div>
						<div>Slug (auto-generado si vacío)</div>
						<div>Stock</div>
						<div>Descripción Corta</div>
						<div>Descripción Larga</div>
						<div>Especificaciones (JSON o key:value|key2:value2)</div>
						<div>Etiquetas (separadas por comas)</div>
						<div>Descuento Porcentaje</div>
						<div>Descuento Fecha Inicio</div>
						<div>Descuento Fecha Fin</div>
						<div>Activo (true/false)</div>
						<div>Destacado (true/false)</div>
					</div>
				</div>
				
				<div>
					<h4 class="font-bold text-gray-900 mb-2">Columnas para Variantes:</h4>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-600 bg-blue-50 rounded-lg p-4 border border-blue-200">
						<div><strong class="text-red-600">*</strong> Producto Padre (SKU del producto base)</div>
						<div><strong class="text-red-600">*</strong> Variante (nombre: ej. "100W", "Rojo")</div>
						<div><strong class="text-red-600">*</strong> Variante SKU (único)</div>
						<div>Variante Precio</div>
						<div>Variante Stock</div>
					</div>
					<p class="text-xs text-blue-700 mt-2 italic">
						💡 Para crear variantes: primero importa el producto padre, luego en las siguientes filas pon el SKU del padre en "Producto Padre" y deja vacíos los campos del producto (Nombre, Categoría, etc.)
					</p>
				</div>
			</div>
		</details>
	</div>

	<!-- File Upload -->
	<div class="bg-white rounded-lg shadow-lg p-6 mb-8 border border-gray-200">
		<div class="flex items-center gap-4 mb-4">
			<div class="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
				<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
				</svg>
			</div>
			<div class="flex-1">
				<h3 class="text-lg font-bold text-gray-900">Paso 2: Sube tu Archivo Excel</h3>
				<p class="text-sm text-gray-600">Selecciona el archivo .xlsx o .xls con tus productos</p>
			</div>
		</div>

		<div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
			<label class="cursor-pointer">
				<input
					type="file"
					accept=".xlsx,.xls"
					onchange={handleFileChange}
					class="hidden"
				/>
				<div class="flex flex-col items-center gap-3">
					<svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
					</svg>
					<div>
						<span class="text-lg font-medium text-gray-700">Haz clic para seleccionar archivo</span>
						<p class="text-sm text-gray-500 mt-1">o arrastra y suelta aquí</p>
					</div>
					<span class="text-xs text-gray-400">Formatos: .xlsx, .xls</span>
				</div>
			</label>
		</div>

		{#if file}
			<div class="mt-4 bg-blue-50 rounded-lg p-4 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
					<div>
						<p class="font-medium text-gray-900">{file.name}</p>
						<p class="text-sm text-gray-600">{(file.size / 1024).toFixed(1)} KB</p>
					</div>
				</div>
				<div class="flex gap-2">
					<button
						onclick={parseFile}
						disabled={parsing}
						class="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
					>
						{#if parsing}
							<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Leyendo...
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Leer y Previsualizar
						{/if}
					</button>
					<button
						onclick={reset}
						class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
					>
						✕
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Preview -->
	{#if parsedProducts.length > 0}
		<div class="bg-white rounded-lg shadow-lg p-6 mb-8 border border-gray-200">
			<div class="flex items-center gap-4 mb-4">
				<div class="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
					<svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
					</svg>
				</div>
				<div class="flex-1">
					<h3 class="text-lg font-bold text-gray-900">Paso 3: Previsualización</h3>
					<p class="text-sm text-gray-600">Revisa los datos antes de importar - {parsedProducts.length} productos encontrados</p>
				</div>
			</div>
			
			<!-- Stats -->
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
				<div class="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
					<div class="text-3xl font-bold text-blue-600">{parsedProducts.length}</div>
					<div class="text-sm text-gray-600 font-medium">Total productos</div>
				</div>
				<div class="bg-green-50 rounded-lg p-4 text-center border border-green-200">
					<div class="text-3xl font-bold text-green-600">{validCount}</div>
					<div class="text-sm text-gray-600 font-medium">Válidos</div>
				</div>
				<div class="bg-red-50 rounded-lg p-4 text-center border border-red-200">
					<div class="text-3xl font-bold text-red-600">{errorCount}</div>
					<div class="text-sm text-gray-600 font-medium">Con errores</div>
				</div>
			</div>
			
			<div class="overflow-x-auto mb-6 border border-gray-200 rounded-lg">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-100">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">#</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Tipo</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre / Variante</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Precio</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Categoría</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">SKU</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Stock</th>
							<th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each parsedProducts as product, idx}
							{@const validation = validateProductRow(product, idx + 2)}
							{@const isVariant = product.producto_padre && product.producto_padre.trim() !== ''}
							<tr class={validation.valid ? (isVariant ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50') : 'bg-red-50 hover:bg-red-100'}>
								<td class="px-4 py-3 text-sm font-medium text-gray-900">{idx + 1}</td>
								<td class="px-4 py-3 text-sm">
									{#if isVariant}
										<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
											<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
												<path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
											</svg>
											Variante
										</span>
									{:else}
										<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
											Producto
										</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-sm">
									{#if isVariant}
										<div class="text-xs text-gray-500">↳ Padre: {product.producto_padre}</div>
										<div class="font-medium text-blue-900">{product.variante_nombre || '—'}</div>
									{:else}
										<div class="font-medium text-gray-900">{product.nombre || '—'}</div>
									{/if}
								</td>
								<td class="px-4 py-3 text-sm text-gray-700">
									{#if isVariant}
										${product.variante_precio || 0}
									{:else}
										${product.precio_base || 0}
									{/if}
								</td>
								<td class="px-4 py-3 text-sm text-gray-700">
									{#if !isVariant && product.categoria_slug}
										<span class="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{product.categoria_slug}</span>
									{:else}
										<span class="text-gray-400">—</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-sm">
									{#if isVariant}
										<span class="font-mono text-xs bg-blue-100 px-2 py-1 rounded">{product.variante_sku || '—'}</span>
									{:else}
										<span class="font-mono text-xs">{product.sku || '—'}</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-sm text-gray-700">
									{#if isVariant}
										{product.variante_stock || 0}
									{:else}
										{product.stock || 0}
									{/if}
								</td>
								<td class="px-4 py-3 text-sm">
									{#if validation.valid}
										<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
											<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
											</svg>
											OK
										</span>
									{:else}
										<div class="text-xs text-red-700">
											{#each validation.errors as error}
												<div class="mb-1">⚠ {error}</div>
											{/each}
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if parsedProducts.filter((p, i) => validateProductRow(p, i + 2).valid).length > 0}
				<div class="flex items-center justify-between bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4 border border-red-200">
					<div>
						<p class="font-bold text-gray-900">¿Todo listo para importar?</p>
						<p class="text-sm text-gray-600">Se importarán {validCount} productos válidos</p>
					</div>
					<button
						onclick={importProducts}
						disabled={importing}
						class="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 text-white px-8 py-3 rounded-lg font-bold text-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2"
					>
						{#if importing}
							<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Importando...
						{:else}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Importar Productos
						{/if}
					</button>
				</div>
			{:else}
				<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
					<svg class="w-12 h-12 text-yellow-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<p class="font-medium text-yellow-900">No hay productos válidos para importar</p>
					<p class="text-sm text-yellow-700 mt-1">Corrige los errores en tu archivo Excel y vuelve a intentar</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Results -->
	{#if importResult}
		<div class="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
			<div class="flex items-center gap-4 mb-6">
				<div class="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
					<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div class="flex-1">
					<h3 class="text-lg font-bold text-gray-900">Paso 4: Resultado de Importación</h3>
					<p class="text-sm text-gray-600">
						{#if importResult.imported === importResult.total}
							¡Excelente! Todos los productos se importaron correctamente
						{:else if importResult.imported > 0}
							Importación completada con algunos errores
						{:else}
							No se pudo importar ningún producto
						{/if}
					</p>
				</div>
			</div>
			
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
				<div class="bg-blue-50 rounded-lg p-6 text-center border-2 border-blue-200">
					<div class="text-4xl font-bold text-blue-600 mb-1">{importResult.total}</div>
					<div class="text-sm text-gray-600 font-medium">Total procesados</div>
				</div>
				<div class="bg-green-50 rounded-lg p-6 text-center border-2 border-green-200">
					<div class="text-4xl font-bold text-green-600 mb-1">{importResult.imported}</div>
					<div class="text-sm text-gray-600 font-medium">Importados ✓</div>
				</div>
				<div class="bg-red-50 rounded-lg p-6 text-center border-2 border-red-200">
					<div class="text-4xl font-bold text-red-600 mb-1">{importResult.errors.length}</div>
					<div class="text-sm text-gray-600 font-medium">Errores ✕</div>
				</div>
			</div>

			{#if importResult.errors.length > 0}
				<div class="mb-6">
					<h4 class="font-bold text-red-900 mb-3 flex items-center gap-2">
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
						</svg>
						Errores encontrados ({importResult.errors.length})
					</h4>
					<div class="bg-red-50 border-2 border-red-200 rounded-lg p-4 max-h-96 overflow-y-auto">
						<div class="space-y-2">
							{#each importResult.errors as error, idx}
								<div class="bg-white rounded-lg p-3 border border-red-200">
									<div class="flex items-start gap-3">
										<span class="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
										<div class="flex-1">
											<span class="font-medium text-red-800 block">Fila {error.row} en Excel:</span>
											<span class="text-red-700 text-sm">{error.error}</span>
											{#if error.data}
												<div class="text-xs text-red-600 mt-1 bg-red-50 rounded px-2 py-1 inline-block">
													Producto: {error.data.nombre || 'Sin nombre'}
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
					<p class="text-sm text-gray-600 mt-3">
						💡 Corrige estos errores en tu archivo Excel y vuelve a importar solo las filas con errores.
					</p>
				</div>
			{:else}
				<div class="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center mb-6">
					<svg class="w-16 h-16 text-green-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p class="text-xl font-bold text-green-900 mb-2">¡Importación exitosa!</p>
					<p class="text-green-700">Todos los productos se agregaron correctamente a la base de datos</p>
				</div>
			{/if}

			<div class="flex gap-3">
				<button
					onclick={reset}
					class="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg"
				>
					Importar Otro Archivo
				</button>
				<a
					href="/admin/productos"
					class="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg text-center"
				>
					Ver Productos
				</a>
			</div>
		</div>
	{/if}
</div>
