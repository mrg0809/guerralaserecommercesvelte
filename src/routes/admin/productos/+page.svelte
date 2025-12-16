<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice, generateSlug } from '$lib/utils';
	import { getProductImageUrl } from '$lib/storage';
	import type { Product, Category, ProductSpecification, Discount, Tag, ProductMedia } from '$lib/types';

	let products: Product[] = $state([]);
	let categories: Category[] = $state([]);
	let discounts: Discount[] = $state([]);
	let allTags: Tag[] = $state([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingProduct = $state<Product | null>(null);
	let categoryHierarchy: Record<string, string> = $state({});
	let specifications: ProductSpecification[] = $state([]);
	let newSpec = $state({ key: '', value: '', data_type: 'text' });
	let selectedDiscounts: string[] = $state([]);
	let selectedTags: string[] = $state([]);
	let newTagName = $state('');
	
	// Variables para gestión de imágenes
	let productImages: ProductMedia[] = $state([]);
	let uploadingImages = $state(false);
	let selectedFiles: File[] = $state([]);
	let imagePreviews: string[] = $state([]);
	
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
		await loadDiscounts();
		await loadTags();
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
			buildCategoryHierarchy();
		}
	}

	function buildCategoryHierarchy() {
		categoryHierarchy = {};
		categories.forEach(cat => {
			if (cat.parent_id) {
				const parent = categories.find(c => c.id === cat.parent_id);
				if (parent) {
					categoryHierarchy[cat.id] = `${parent.name} → ${cat.name}`;
				}
			} else {
				categoryHierarchy[cat.id] = cat.name;
			}
		});
	}

	async function loadDiscounts() {
		const { data } = await supabase
			.from('discounts')
			.select('*')
			.eq('is_active', true)
			.order('name');

		if (data) {
			discounts = data;
		}
	}

	async function loadTags() {
		const { data } = await supabase.from('tags').select('*').order('name');

		if (data) {
			allTags = data;
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
			loadProductSpecifications(product.id);
			loadProductDiscounts(product.id);
			loadProductTags(product.id);
			loadProductImages(product.id);
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
			specifications = [];
			selectedDiscounts = [];
			selectedTags = [];
			productImages = [];
		}
		newSpec = { key: '', value: '', data_type: 'text' };
		newTagName = '';
		selectedFiles = [];
		imagePreviews = [];
		showModal = true;
	}

	async function loadProductDiscounts(productId: string) {
		const { data } = await supabase
			.from('product_discounts')
			.select('discount_id')
			.eq('product_id', productId);

		if (data) {
			selectedDiscounts = data.map(d => d.discount_id);
		}
	}

	async function loadProductTags(productId: string) {
		const { data } = await supabase
			.from('product_tags')
			.select('tag_id')
			.eq('product_id', productId);

		if (data) {
			selectedTags = data.map(t => t.tag_id);
		}
	}

	async function loadProductImages(productId: string) {
		const { data } = await supabase
			.from('product_media')
			.select('*')
			.eq('product_id', productId)
			.order('display_order');

		if (data) {
			productImages = data;
		}
	}

	function handleImageSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			const files = Array.from(input.files);
			
			// Validar cada archivo
			const validFiles: File[] = [];
			const validPreviews: string[] = [];
			
			for (const file of files) {
				// Validar tipo
				const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
				if (!validTypes.includes(file.type)) {
					alert(`El archivo ${file.name} no es una imagen válida (JPG, PNG, WEBP o GIF)`);
					continue;
				}
				
				// Validar tamaño (max 5MB)
				if (file.size > 5 * 1024 * 1024) {
					alert(`El archivo ${file.name} supera los 5MB`);
					continue;
				}
				
				validFiles.push(file);
				
				// Crear preview
				const reader = new FileReader();
				reader.onload = (e) => {
					validPreviews.push(e.target?.result as string);
					if (validPreviews.length === validFiles.length) {
						imagePreviews = [...imagePreviews, ...validPreviews];
					}
				};
				reader.readAsDataURL(file);
			}
			
			selectedFiles = [...selectedFiles, ...validFiles];
		}
	}

	async function uploadProductImages(productId: string): Promise<boolean> {
		if (selectedFiles.length === 0) return true;
		
		uploadingImages = true;
		try {
			const uploadPromises = selectedFiles.map(async (file, index) => {
				// Generar nombre único
				const timestamp = Date.now();
				const randomStr = Math.random().toString(36).substring(7);
				const fileExt = file.name.split('.').pop();
				const fileName = `products/${formData.slug || 'product'}-${timestamp}-${randomStr}.${fileExt}`;
				
				// Subir archivo
				const { data, error } = await supabase.storage
					.from('product-images')
					.upload(fileName, file, {
						cacheControl: '3600',
						upsert: false
					});
				
				if (error) throw error;
				
				// Obtener URL pública
				const publicUrl = getProductImageUrl(fileName);
				
				// Guardar en product_media
				const displayOrder = productImages.length + index;
				const isPrimary = productImages.length === 0 && index === 0;
				
				const { error: mediaError } = await supabase
					.from('product_media')
					.insert({
						product_id: productId,
						url: publicUrl,
						media_type: 'image',
						is_primary: isPrimary,
						display_order: displayOrder
					});
				
				if (mediaError) throw mediaError;
			});
			
			await Promise.all(uploadPromises);
			return true;
		} catch (error: any) {
			console.error('Error uploading images:', error);
			alert('Error al subir imágenes: ' + error.message);
			return false;
		} finally {
			uploadingImages = false;
		}
	}

	async function removeProductImage(imageId: string, imageUrl: string) {
		if (!confirm('¿Estás seguro de eliminar esta imagen?')) return;
		
		try {
			// Extraer el path del archivo de la URL
			const urlParts = imageUrl.split('/product-images/');
			if (urlParts.length === 2) {
				const filePath = urlParts[1];
				
				// Eliminar del storage
				const { error: storageError } = await supabase.storage
					.from('product-images')
					.remove([filePath]);
				
				if (storageError) console.error('Error deleting from storage:', storageError);
			}
			
			// Eliminar de la base de datos
			const { error } = await supabase
				.from('product_media')
				.delete()
				.eq('id', imageId);
			
			if (error) throw error;
			
			productImages = productImages.filter(img => img.id !== imageId);
		} catch (error: any) {
			alert('Error al eliminar imagen: ' + error.message);
		}
	}

	async function setPrimaryImage(imageId: string) {
		if (!editingProduct) return;
		
		try {
			// Quitar primary de todas las imágenes
			await supabase
				.from('product_media')
				.update({ is_primary: false })
				.eq('product_id', editingProduct.id);
			
			// Establecer la nueva imagen primaria
			const { error } = await supabase
				.from('product_media')
				.update({ is_primary: true })
				.eq('id', imageId);
			
			if (error) throw error;
			
			// Actualizar estado local
			productImages = productImages.map(img => ({
				...img,
				is_primary: img.id === imageId
			}));
		} catch (error: any) {
			alert('Error al establecer imagen principal: ' + error.message);
		}
	}

	function removePreviewImage(index: number) {
		selectedFiles = selectedFiles.filter((_, i) => i !== index);
		imagePreviews = imagePreviews.filter((_, i) => i !== index);
	}

	async function loadProductSpecifications(productId: string) {
		const { data } = await supabase
			.from('product_specifications')
			.select('*')
			.eq('product_id', productId);

		if (data) {
			specifications = data;
		}
	}

	async function addSpecification() {
		if (!newSpec.key || !newSpec.value) {
			alert('Por favor completa clave y valor de la especificación');
			return;
		}

		if (!editingProduct) {
			alert('Primero debes crear el producto');
			return;
		}

		try {
			const { data, error } = await supabase
				.from('product_specifications')
				.insert([
					{
						product_id: editingProduct.id,
						specification_key: newSpec.key,
						specification_value: newSpec.value,
						data_type: newSpec.data_type
					}
				])
				.select();

			if (error) throw error;

			if (data) {
				specifications = [...specifications, ...data];
				newSpec = { key: '', value: '', data_type: 'text' };
			}
		} catch (error: any) {
			alert('Error al agregar especificación: ' + error.message);
		}
	}

	async function removeSpecification(specId: string) {
		try {
			const { error } = await supabase
				.from('product_specifications')
				.delete()
				.eq('id', specId);

			if (error) throw error;

			specifications = specifications.filter(s => s.id !== specId);
		} catch (error: any) {
			alert('Error al eliminar especificación: ' + error.message);
		}
	}

	function closeModal() {
		showModal = false;
		editingProduct = null;
		selectedFiles = [];
		imagePreviews = [];
		productImages = [];
	}

	function updateSlug() {
		if (formData.name && !editingProduct) {
			formData.slug = generateSlug(formData.name);
		}
	}

	async function saveProduct() {
		try {
			let productId: string;

			if (editingProduct) {
				const { error } = await supabase
					.from('products')
					.update(formData)
					.eq('id', editingProduct.id);

				if (error) throw error;
				productId = editingProduct.id;
			} else {
				const { data, error } = await supabase
					.from('products')
					.insert([formData])
					.select();

				if (error) throw error;
				if (!data || data.length === 0) throw new Error('No se pudo crear el producto');
				productId = data[0].id;
			}

			// Subir imágenes nuevas
			if (selectedFiles.length > 0) {
				const uploadSuccess = await uploadProductImages(productId);
				if (!uploadSuccess) {
					alert('El producto se guardó pero hubo errores al subir algunas imágenes');
				}
			}

			// Guardar descuentos
			await saveProductDiscounts(productId);

			// Guardar etiquetas
			await saveProductTags(productId);

			closeModal();
			await loadProducts();
		} catch (error: any) {
			alert('Error al guardar producto: ' + error.message);
		}
	}

	async function saveProductDiscounts(productId: string) {
		// Eliminar descuentos existentes
		await supabase.from('product_discounts').delete().eq('product_id', productId);

		// Agregar nuevos descuentos seleccionados
		if (selectedDiscounts.length > 0) {
			const discountInserts = selectedDiscounts.map(discountId => ({
				product_id: productId,
				discount_id: discountId
			}));

			await supabase.from('product_discounts').insert(discountInserts);
		}
	}

	async function saveProductTags(productId: string) {
		// Eliminar tags existentes
		await supabase.from('product_tags').delete().eq('product_id', productId);

		// Agregar nuevas tags seleccionadas
		if (selectedTags.length > 0) {
			const tagInserts = selectedTags.map(tagId => ({
				product_id: productId,
				tag_id: tagId
			}));

			await supabase.from('product_tags').insert(tagInserts);
		}
	}

	async function createNewTag() {
		if (!newTagName.trim()) {
			alert('Por favor ingresa un nombre para la etiqueta');
			return;
		}

		try {
			const slug = generateSlug(newTagName);
			const { data, error } = await supabase
				.from('tags')
				.insert([{ name: newTagName, slug }])
				.select();

			if (error) throw error;

			if (data && data.length > 0) {
				allTags = [...allTags, data[0]];
				selectedTags = [...selectedTags, data[0].id];
				newTagName = '';
			}
		} catch (error: any) {
			alert('Error al crear etiqueta: ' + error.message);
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
								<a
									href="/admin/productos/{product.id}/especificaciones"
									class="text-purple-600 hover:text-purple-800 mr-3"
								>
									Specs
								</a>
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

			<form onsubmit={(e) => { e.preventDefault(); saveProduct(); }} class="p-6 space-y-4">
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
							{#each Object.entries(categoryHierarchy) as [id, label]}
								<option value={id}>{label}</option>
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

				<!-- Descuentos -->
				<div>
					<label class="block text-sm font-semibold mb-2">Descuentos Aplicables</label>
					<div class="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
						{#if discounts.length === 0}
							<p class="text-sm text-gray-500">No hay descuentos disponibles</p>
						{:else}
							{#each discounts as discount}
								<label class="flex items-center gap-2 py-1">
									<input
										type="checkbox"
										value={discount.id}
										checked={selectedDiscounts.includes(discount.id)}
										onchange={(e) => {
											if (e.currentTarget.checked) {
												selectedDiscounts = [...selectedDiscounts, discount.id];
											} else {
												selectedDiscounts = selectedDiscounts.filter(d => d !== discount.id);
											}
										}}
										class="w-4 h-4"
									/>
									<span class="text-sm">
										{discount.name} ({discount.discount_type === 'percentage' ? discount.discount_value + '%' : '$' + discount.discount_value})
									</span>
								</label>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Etiquetas -->
				<div>
					<label class="block text-sm font-semibold mb-2">Etiquetas</label>
					<div class="border border-gray-300 rounded-lg p-3">
						<div class="flex flex-wrap gap-2 mb-3">
							{#if selectedTags.length === 0}
								<p class="text-sm text-gray-500">Sin etiquetas</p>
							{:else}
								{#each selectedTags as tagId}
									{@const tag = allTags.find(t => t.id === tagId)}
									{#if tag}
										<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-1">
											{tag.name}
											<button
												type="button"
												onclick={() => {
													selectedTags = selectedTags.filter(t => t !== tagId);
												}}
												class="hover:text-blue-900"
											>
												✕
											</button>
										</span>
									{/if}
								{/each}
							{/if}
						</div>

						<div class="border-t pt-3">
							<p class="text-xs font-semibold mb-2">Seleccionar etiquetas:</p>
							<div class="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
								{#each allTags.filter(t => !selectedTags.includes(t.id)) as tag}
									<button
										type="button"
										onclick={() => {
											selectedTags = [...selectedTags, tag.id];
										}}
										class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm hover:bg-gray-200"
									>
										+ {tag.name}
									</button>
								{/each}
							</div>

							<div class="flex gap-2">
								<input
									type="text"
									bind:value={newTagName}
									placeholder="Nueva etiqueta..."
									class="flex-1 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
								<button
									type="button"
									onclick={createNewTag}
									class="bg-green-600 text-white px-4 py-1 rounded text-sm hover:bg-green-700"
								>
									Crear
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Gestión de Imágenes -->
				<div class="border-t pt-4">
					<label class="block text-sm font-semibold mb-3">Imágenes del Producto</label>
					
					<!-- Imágenes existentes (para productos editándose) -->
					{#if editingProduct && productImages.length > 0}
						<div class="mb-4">
							<p class="text-sm text-gray-600 mb-2">Imágenes actuales:</p>
							<div class="grid grid-cols-3 gap-3">
								{#each productImages as image}
									<div class="relative group">
										<img 
											src={image.url} 
											alt="Imagen del producto" 
											class="w-full h-32 object-cover rounded-lg border-2 {image.is_primary ? 'border-blue-500' : 'border-gray-300'}"
										/>
										{#if image.is_primary}
											<span class="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-1 rounded">
												Principal
											</span>
										{:else}
											<button
												type="button"
												onclick={() => setPrimaryImage(image.id)}
												class="absolute top-1 left-1 bg-gray-800 bg-opacity-75 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
											>
												Hacer Principal
											</button>
										{/if}
										<button
											type="button"
											onclick={() => removeProductImage(image.id, image.url)}
											class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
										>
											×
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}
					
					<!-- Preview de nuevas imágenes -->
					{#if imagePreviews.length > 0}
						<div class="mb-4">
							<p class="text-sm text-gray-600 mb-2">Nuevas imágenes a subir:</p>
							<div class="grid grid-cols-3 gap-3">
								{#each imagePreviews as preview, index}
									<div class="relative group">
										<img 
											src={preview} 
											alt="Preview" 
											class="w-full h-32 object-cover rounded-lg border-2 border-green-300"
										/>
										<span class="absolute top-1 left-1 bg-green-500 text-white text-xs px-2 py-1 rounded">
											Nueva
										</span>
										<button
											type="button"
											onclick={() => removePreviewImage(index)}
											class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
										>
											×
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}
					
					<!-- Input para agregar más imágenes -->
					<div class="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition">
						<input
							type="file"
							accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
							multiple
							onchange={handleImageSelect}
							class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
						/>
						<p class="text-xs text-gray-500 mt-2">
							Puedes seleccionar múltiples imágenes. Formatos: JPG, PNG, WEBP, GIF. Máx: 5MB cada una.
						</p>
						{#if productImages.length === 0 && imagePreviews.length === 0}
							<p class="text-xs text-orange-600 mt-1">
								⚠️ La primera imagen será la imagen principal del producto
							</p>
						{/if}
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

				{#if editingProduct}
					<div class="border-t pt-6 mt-6">
						<h3 class="text-lg font-semibold mb-4">Especificaciones del Producto</h3>
						
						{#if specifications.length > 0}
							<div class="mb-4 space-y-2">
								{#each specifications as spec}
									<div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
										<div class="flex-1">
											<p class="font-medium text-sm">{spec.specification_key}</p>
											<p class="text-sm text-gray-600">{spec.specification_value} ({spec.data_type})</p>
										</div>
										<button
											type="button"
											onclick={() => removeSpecification(spec.id)}
											class="text-red-600 hover:text-red-800 ml-4"
										>
											✕
										</button>
									</div>
								{/each}
							</div>
						{/if}

						<div class="space-y-3 bg-blue-50 p-4 rounded-lg">
							<div>
								<label class="block text-sm font-semibold mb-1">Clave de Especificación</label>
								<input
									type="text"
									bind:value={newSpec.key}
									placeholder="Ej: Potencia, Velocidad, Voltaje"
									class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-1">Valor</label>
								<input
									type="text"
									bind:value={newSpec.value}
									placeholder="Ej: 40W, 100mm/s, 110V"
									class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-1">Tipo de Dato</label>
								<select
									bind:value={newSpec.data_type}
									class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="text">Texto</option>
									<option value="number">Número</option>
									<option value="boolean">Sí/No</option>
									<option value="select">Seleccionar</option>
								</select>
							</div>

							<button
								type="button"
								onclick={addSpecification}
								class="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition text-sm font-medium"
							>
								+ Agregar Especificación
							</button>
						</div>
					</div>
				{:else}
					<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
						💡 Primero crea el producto para agregar especificaciones
					</div>
				{/if}

				<div class="flex gap-4 pt-4">
					<button
						type="submit"
						disabled={uploadingImages}
						class="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
					>
						{uploadingImages ? 'Subiendo imágenes...' : editingProduct ? 'Actualizar' : 'Crear'} Producto
					</button>
					<button
						type="button"
						onclick={closeModal}
						disabled={uploadingImages}
						class="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition disabled:bg-gray-100 disabled:cursor-not-allowed"
					>
						Cancelar
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}