<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import * as XLSX from 'xlsx';
	import jsPDF from 'jspdf';
	import autoTable from 'jspdf-autotable';

	let categories = $state<any[]>([]);
	let products = $state<any[]>([]);
	let loading = $state(true);
	let selectedCategories = $state<Set<string>>(new Set());
	let selectAllCategories = $state(false);
	let separateByCategory = $state(true);
	let showCategorySelector = $state(false);
	let showPhotoListSelector = $state(false);
	let selectedCategoryForPhotos = $state<string>('');
	let exportFormat = $state<'pdf' | 'excel'>('pdf');

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
			.select(
				'id, sku, name, base_price, cost, stock_quantity, category_id,' +
					' product_variants(id, name, stock_quantity, price, is_active),' +
					' mercadolibre_listings(price)'
			)
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
								Variante: variant.name || 'Variante sin nombre',
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
								Variante: variant.name || 'Variante sin nombre',
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

			// Importante: agregar la hoja al workbook (si no, XLSX.writeFile marca "Workbook is empty")
			XLSX.utils.book_append_sheet(workbook, worksheet, 'Conteo');
		}

		// Si no se agregó ninguna hoja (por ejemplo, no hay productos en las categorías seleccionadas),
		// evitamos descargar un archivo vacío.
		if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
			alert('No hay productos para las categorías seleccionadas');
			return;
		}

		// Descargar archivo
		const fileName = `Hoja_Conteo_${new Date().toISOString().split('T')[0]}.xlsx`;
		XLSX.writeFile(workbook, fileName);
	}

	function exportStockReportExcel() {
		if (selectedCategories.size > 0) {
			// El reporte nuevo debe imprimir TODO el inventario, sin filtrar por categorías.
			// (El control de categorías aplica a "Hoja de Conteo" / otros exports.)
		}

		if (loading) return;
		if (!products || products.length === 0) {
			alert('No hay productos para generar el reporte de stock');
			return;
		}

		const rows: any[] = [];

		for (const product of products) {
			const { family, category: catName, subcategory } = product.category_id
				? getCategoryLevels(product.category_id)
				: { family: '', category: '', subcategory: '' };

			// Costo viene de `products.cost` (por defecto 0).
			const costo = (product as any)?.costo ?? (product as any)?.cost ?? 0;

			// Precio Mercado Libre está en mercadolibre_listings (1:1 por product_id),
			// pero dependiendo del shape del select puede venir como objeto o arreglo.
			const mlListing = (product as any)?.mercadolibre_listings;
			const precioMercadoLibre = Array.isArray(mlListing) ? mlListing[0]?.price ?? '' : mlListing?.price ?? '';

			if (product.product_variants && product.product_variants.length > 0) {
				for (const variant of product.product_variants) {
					rows.push({
						// Orden requerido:
						Familia: family,
						Categoria: catName,
						Subcategoria: subcategory,
						SKU: product.sku || '-',
						Nombre: product.name,
						Variante: variant.name || 'Variante sin nombre',
						Inventario: variant.stock_quantity || 0,
						Costo: costo,
						'Precio Publico': variant.price ?? product.base_price ?? 0,
						'Precio Mercado Libre': precioMercadoLibre
					});
				}
			} else {
				rows.push({
					Familia: family,
					Categoria: catName,
					Subcategoria: subcategory,
					SKU: product.sku || '-',
					Nombre: product.name,
					Variante: '-',
					Inventario: product.stock_quantity || 0,
					Costo: costo,
					'Precio Publico': product.base_price ?? 0,
					'Precio Mercado Libre': precioMercadoLibre
				});
			}
		}

		const workbook = XLSX.utils.book_new();
		const worksheet = XLSX.utils.json_to_sheet(rows);

		worksheet['!cols'] = [
			{ wch: 18 }, // Familia
			{ wch: 22 }, // Categoria
			{ wch: 22 }, // Subcategoria
			{ wch: 15 }, // SKU
			{ wch: 30 }, // Nombre
			{ wch: 22 }, // Variante
			{ wch: 12 }, // Inventario
			{ wch: 12 }, // Costo
			{ wch: 18 }, // Precio Publico
			{ wch: 22 } // Precio Mercado Libre
		];

		XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock');

		const fileName = `Reporte_Stock_${new Date().toISOString().split('T')[0]}.xlsx`;
		XLSX.writeFile(workbook, fileName);
	}

	async function exportWithPhotos() {
		if (!selectedCategoryForPhotos) {
			alert('Por favor selecciona una categoría');
			return;
		}

		const category = categories.find((c) => c.id === selectedCategoryForPhotos);
		if (!category) return;

		// Obtener productos de la categoría y sus descendientes
		const descendantIds = getDescendantCategoryIds(selectedCategoryForPhotos);
		const allIds = [selectedCategoryForPhotos, ...descendantIds];
		const categoryProducts = products
			.filter((p) => allIds.includes(p.category_id))
			.sort((a, b) => {
				const skuA = (a.sku || '').toLowerCase();
				const skuB = (b.sku || '').toLowerCase();
				return skuA.localeCompare(skuB);
			});

		if (categoryProducts.length === 0) {
			alert('No hay productos en esta categoría');
			return;
		}

		if (exportFormat === 'pdf') {
			await exportToPDF(category.name, categoryProducts);
		} else {
			await exportToExcelWithPhotos(category.name, categoryProducts);
		}

		showPhotoListSelector = false;
	}

	async function exportToPDF(categoryName: string, productList: any[]) {
		const doc = new jsPDF({ orientation: 'landscape' });
		const pageWidth = doc.internal.pageSize.getWidth();
		
		// Título
		doc.setFontSize(18);
		doc.text(`Listado de Productos - ${categoryName}`, pageWidth / 2, 15, { align: 'center' });
		doc.setFontSize(10);
		doc.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth / 2, 22, { align: 'center' });

		// Función auxiliar para convertir imagen a base64 y obtener dimensiones
		async function getImageData(imageUrl: string): Promise<{ base64: string; width: number; height: number } | null> {
			try {
				const img = new Image();
				img.crossOrigin = 'anonymous';
				
				await new Promise((resolve, reject) => {
					img.onload = resolve;
					img.onerror = reject;
					img.src = imageUrl;
				});
				
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				if (!ctx) return null;
				
				canvas.width = img.width;
				canvas.height = img.height;
				ctx.drawImage(img, 0, 0);
				
				return {
					base64: canvas.toDataURL('image/jpeg'),
					width: img.width,
					height: img.height
				};
			} catch (error) {
				console.error('Error al cargar imagen:', error);
				return null;
			}
		}

		// Preparar datos para la tabla con imágenes precargadas
		const tableData: any[] = [];
		
		for (const product of productList) {
			// Obtener imagen del producto desde product_media
			let imageData = null;
			if (product.id) {
				const { data: mediaItems } = await supabase
					.from('product_media')
					.select('url, is_primary')
					.eq('product_id', product.id)
					.order('is_primary', { ascending: false })
					.limit(1);
				
				if (mediaItems && mediaItems.length > 0) {
					const imageUrl = mediaItems[0].url;
					try {
						// Si la URL ya es completa, usarla directamente
						// Si no, obtener URL pública de Supabase storage
						let fullImageUrl = imageUrl;
						
						if (!imageUrl.startsWith('http')) {
							const { data: publicUrlData } = supabase.storage
								.from('product-images')
								.getPublicUrl(imageUrl);
							
							if (publicUrlData?.publicUrl) {
								fullImageUrl = publicUrlData.publicUrl;
							}
						}
						
						// Precargar y convertir imagen a base64 con dimensiones
						imageData = await getImageData(fullImageUrl);
					} catch (error) {
						console.error('Error al obtener imagen:', error);
					}
				}
			}

			tableData.push({
				imageData: imageData,
				sku: product.sku || '-',
				name: product.name,
				stock: product.stock_quantity || 0,
				price: `$${(product.base_price || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
			});
		}

		// Crear tabla con autoTable
		const standardRowHeight = 35; // Altura estándar para todas las filas con imágenes
		
		autoTable(doc, {
			startY: 28,
			head: [['Foto', 'SKU', 'Nombre', 'Existencia', 'Precio']],
			body: tableData.map(item => ['', item.sku, item.name, item.stock, item.price]),
			columnStyles: {
				0: { cellWidth: 35, halign: 'center' },
				1: { cellWidth: 35 },
				2: { cellWidth: 140 },
				3: { cellWidth: 25, halign: 'center' },
				4: { cellWidth: 30, halign: 'right' }
			},
			didDrawCell: (data: any) => {
				if (data.column.index === 0 && data.cell.section === 'body') {
					const rowIndex = data.row.index;
					const imgData = tableData[rowIndex]?.imageData;
					
					if (imgData && imgData.base64) {
						try {
							// Calcular dimensiones manteniendo aspect ratio con altura fija
							const maxWidth = 30;
							const maxHeight = standardRowHeight - 4; // Restar margen
							const aspectRatio = imgData.width / imgData.height;
							
							let imgWidth = maxWidth;
							let imgHeight = maxWidth / aspectRatio;
							
							// Si la altura excede el máximo, ajustar por altura
							if (imgHeight > maxHeight) {
								imgHeight = maxHeight;
								imgWidth = maxHeight * aspectRatio;
							}
							
							// Centrar la imagen en la celda
							const x = data.cell.x + (data.cell.width - imgWidth) / 2;
							const y = data.cell.y + (standardRowHeight - imgHeight) / 2;
							
							doc.addImage(imgData.base64, 'JPEG', x, y, imgWidth, imgHeight);
						} catch (error) {
							console.error('Error al agregar imagen al PDF:', error);
						}
					}
				}
			},
			margin: { top: 30 },
			styles: {
				minCellHeight: standardRowHeight,
				valign: 'middle',
				fontSize: 9
			},
			headStyles: {
				fillColor: [41, 128, 185],
				textColor: 255,
				fontStyle: 'bold',
				halign: 'center',
				minCellHeight: 10,
				fontSize: 10
			}
		});

		const fileName = `Listado_${categoryName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
		doc.save(fileName);
	}

	async function exportToExcelWithPhotos(categoryName: string, productList: any[]) {
		// Para Excel con imágenes usaremos el formato básico con URLs
		const data: any[] = [];

		for (const product of productList) {
			let imageUrl = '';
			
			if (product.id) {
				const { data: mediaItems } = await supabase
					.from('product_media')
					.select('url, is_primary')
					.eq('product_id', product.id)
					.order('is_primary', { ascending: false })
					.limit(1);
				
				if (mediaItems && mediaItems.length > 0) {
					const url = mediaItems[0].url;
					
					// Si la URL ya es completa, usarla directamente
					if (url.startsWith('http')) {
						imageUrl = url;
					} else {
						// Si no, obtener URL pública de Supabase storage
						const { data: publicUrlData } = supabase.storage
							.from('product-images')
							.getPublicUrl(url);
						
						if (publicUrlData?.publicUrl) {
							imageUrl = publicUrlData.publicUrl;
						}
					}
				}
			}

			data.push({
				'URL Imagen': imageUrl,
				'SKU': product.sku || '-',
				'Nombre': product.name,
				'Precio': product.base_price || 0
			});
		}

		const worksheet = XLSX.utils.json_to_sheet(data);
		
		// Ajustar anchos de columna
		worksheet['!cols'] = [
			{ wch: 60 }, // URL Imagen
			{ wch: 15 }, // SKU
			{ wch: 40 }, // Nombre
			{ wch: 12 }  // Precio
		];

		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

		const fileName = `Listado_${categoryName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
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

		<!-- Listado con Fotos -->
		<div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer" onclick={() => showPhotoListSelector = !showPhotoListSelector}>
			<div class="text-4xl mb-4">📸</div>
			<h2 class="text-xl font-bold mb-2">Listado con Fotos</h2>
			<p class="text-gray-600">Exporta productos con foto, nombre, SKU y precio en PDF o Excel</p>
		</div>

		<!-- Reporte de Stock (mismo patrón que Hoja de Conteo / Listado con Fotos: clic en todo el recuadro) -->
		<div
			class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition {loading || !products?.length
				? 'opacity-60 cursor-not-allowed'
				: 'cursor-pointer'}"
			onclick={() => exportStockReportExcel()}
		>
			<div class="text-4xl mb-4">📊</div>
			<h2 class="text-xl font-bold mb-2">Reporte de Stock</h2>
			<p class="text-gray-600">Genera un Excel con todo el inventario</p>
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

	<!-- Modal de Listado con Fotos -->
	{#if showPhotoListSelector}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<div class="bg-white rounded-lg max-w-xl w-full">
				<div class="p-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-2xl font-bold">Exportar Listado con Fotos</h2>
						<button
							onclick={() => showPhotoListSelector = false}
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
							<!-- Selección de Categoría -->
							<div>
								<label class="block font-semibold mb-2">Selecciona una categoría:</label>
								<select
									bind:value={selectedCategoryForPhotos}
									class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								>
									<option value="">-- Selecciona una categoría --</option>
									{#each categories as category}
										<option value={category.id}>
											{getCategoryPath(category.id)} ({products.filter((p) => {
												const descendantIds = getDescendantCategoryIds(category.id);
												const allIds = [category.id, ...descendantIds];
												return allIds.includes(p.category_id);
											}).length} productos)
										</option>
									{/each}
								</select>
							</div>

							<!-- Formato de Exportación -->
							<div class="border-t pt-4">
								<h3 class="font-semibold mb-3">Formato de Exportación</h3>
								<div class="space-y-2">
									<div class="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50" 
										class:border-blue-500={exportFormat === 'pdf'}
										class:bg-blue-50={exportFormat === 'pdf'}
										onclick={() => exportFormat = 'pdf'}>
										<input
											type="radio"
											id="pdf"
											name="exportFormat"
											value="pdf"
											checked={exportFormat === 'pdf'}
											class="w-4 h-4 text-blue-600 cursor-pointer"
										/>
										<label for="pdf" class="ml-3 font-medium text-gray-700 cursor-pointer flex-1">
											<span class="flex items-center gap-2">
												<span>📄</span>
												<span>PDF con imágenes incrustadas (Recomendado)</span>
											</span>
											<span class="text-sm text-gray-500">Incluye fotos directamente en el documento</span>
										</label>
									</div>
									<div class="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50"
										class:border-blue-500={exportFormat === 'excel'}
										class:bg-blue-50={exportFormat === 'excel'}
										onclick={() => exportFormat = 'excel'}>
										<input
											type="radio"
											id="excel"
											name="exportFormat"
											value="excel"
											checked={exportFormat === 'excel'}
											class="w-4 h-4 text-blue-600 cursor-pointer"
										/>
										<label for="excel" class="ml-3 font-medium text-gray-700 cursor-pointer flex-1">
											<span class="flex items-center gap-2">
												<span>📊</span>
												<span>Excel con URLs de imágenes</span>
											</span>
											<span class="text-sm text-gray-500">Incluye enlaces a las fotos</span>
										</label>
									</div>
								</div>
							</div>
						</div>

						<!-- Botones -->
						<div class="flex gap-3 mt-6 justify-end">
							<button
								onclick={() => showPhotoListSelector = false}
								class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
							>
								Cancelar
							</button>
							<button
								onclick={exportWithPhotos}
								class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
								disabled={!selectedCategoryForPhotos}
								class:opacity-50={!selectedCategoryForPhotos}
								class:cursor-not-allowed={!selectedCategoryForPhotos}
							>
								<span>{exportFormat === 'pdf' ? '📄' : '📊'}</span>
								Exportar {exportFormat === 'pdf' ? 'PDF' : 'Excel'}
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

