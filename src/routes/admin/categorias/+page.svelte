<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { generateSlug } from '$lib/utils';
	import { getProductImageUrl } from '$lib/storage';
	import type { Category } from '$lib/types';

	let categories: Category[] = $state([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingCategory = $state<Category | null>(null);
	let searchTerm = $state('');
	let expandedCategories = $state<Record<string, boolean>>({});
	let uploadingImage = $state(false);
	let selectedFile: File | null = $state(null);
	let imagePreview = $state('');

	let formData = $state({
		name: '',
		slug: '',
		description: '',
		image_url: '',
		display_order: 0,
		is_active: true,
		parent_id: null as string | null
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

		await loadCategories();
	});

	async function loadCategories() {
		loading = true;
		const { data } = await supabase
			.from('categories')
			.select('*')
			.order('display_order');

		if (data) {
			categories = data;
		}
		loading = false;
	}

	function openModal(category?: Category) {
		if (category) {
			editingCategory = category;
			formData = {
				name: category.name,
				slug: category.slug,
				description: category.description || '',
				image_url: category.image_url || '',
				display_order: category.display_order,
				is_active: category.is_active,
				parent_id: category.parent_id
			};
			imagePreview = category.image_url || '';
		} else {
			editingCategory = null;
			formData = {
				name: '',
				slug: '',
				description: '',
				image_url: '',
				display_order: 0,
				is_active: true,
				parent_id: null
			};
			imagePreview = '';
		}
		selectedFile = null;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingCategory = null;
		selectedFile = null;
		imagePreview = '';
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedFile = input.files[0];
			
			// Validar tipo de archivo
			const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
			if (!validTypes.includes(selectedFile.type)) {
				alert('Por favor selecciona una imagen válida (JPG, PNG, WEBP o GIF)');
				selectedFile = null;
				input.value = '';
				return;
			}
			
			// Validar tamaño (max 5MB)
			if (selectedFile.size > 5 * 1024 * 1024) {
				alert('La imagen no debe superar los 5MB');
				selectedFile = null;
				input.value = '';
				return;
			}
			
			// Crear preview
			const reader = new FileReader();
			reader.onload = (e) => {
				imagePreview = e.target?.result as string;
			};
			reader.readAsDataURL(selectedFile);
		}
	}

	async function uploadImage(): Promise<string | null> {
		if (!selectedFile) return null;
		
		uploadingImage = true;
		try {
			// Generar nombre único para el archivo
			const timestamp = Date.now();
			const randomStr = Math.random().toString(36).substring(7);
			const fileExt = selectedFile.name.split('.').pop();
			const fileName = `categories/${formData.slug || 'category'}-${timestamp}-${randomStr}.${fileExt}`;
			
			// Subir archivo al bucket
			const { data, error } = await supabase.storage
				.from('product-images')
				.upload(fileName, selectedFile, {
					cacheControl: '3600',
					upsert: false
				});
			
			if (error) {
				console.error('Error uploading image:', error);
				throw new Error('Error al subir la imagen: ' + error.message);
			}
			
			// Obtener URL pública
			const publicUrl = getProductImageUrl(fileName);
			return publicUrl;
		} catch (error: any) {
			console.error('Error uploading image:', error);
			alert('Error al subir la imagen: ' + error.message);
			return null;
		} finally {
			uploadingImage = false;
		}
	}

	function removeImage() {
		selectedFile = null;
		imagePreview = '';
		formData.image_url = '';
		// Reset file input
		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
		if (fileInput) fileInput.value = '';
	}

	function updateSlug() {
		if (formData.name && !editingCategory) {
			let baseSlug = generateSlug(formData.name);
			
			// Si tiene padre, agregar el slug del padre al inicio para hacerlo único
			if (formData.parent_id) {
				const parent = categories.find(c => c.id === formData.parent_id);
				if (parent) {
					baseSlug = `${parent.slug}-${baseSlug}`;
				}
			}
			
			formData.slug = baseSlug;
		}
	}

	async function saveCategory() {
		try {
				// Si hay una imagen seleccionada, subirla primero
				if (selectedFile) {
					const uploadedUrl = await uploadImage();
					if (uploadedUrl) {
						formData.image_url = uploadedUrl;
					} else {
						alert('No se pudo subir la imagen. ¿Deseas continuar sin imagen?');
						return;
					}
				}
				
				const { data: sess } = await supabase.auth.getSession();
				const payload = {
					...formData,
					parent_id: formData.parent_id || null
				};
				const res = await fetch('/admin/categorias', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {})
					},
					body: JSON.stringify(
						editingCategory
							? { op: 'update', id: editingCategory.id, payload }
							: { op: 'create', payload }
					)
				});
				const out = await res.json();
				if (!out.ok) throw new Error(out.error || 'Error desconocido');

				closeModal();
				await loadCategories();
			} catch (error: any) {
				console.error('Error al guardar categoría:', error);
				alert('Error al guardar categoría: ' + error.message);
			}
	}

	async function deleteCategory(id: string) {
		if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;

		try {
			const { data: sess } = await supabase.auth.getSession();
			const res = await fetch('/admin/categorias', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {})
				},
				body: JSON.stringify({ op: 'delete', id })
			});
			const out = await res.json();
			if (!out.ok) throw new Error(out.error || 'Error desconocido');

			await loadCategories();
		} catch (error: any) {
			console.error('Error al eliminar categoría:', error);
			alert('Error al eliminar categoría: ' + error.message);
		}
	}

	async function toggleActive(category: Category) {
		try {
			const { data: sess } = await supabase.auth.getSession();
			const res = await fetch('/admin/categorias', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {})
				},
				body: JSON.stringify({ op: 'toggle', id: category.id, payload: { is_active: !category.is_active } })
			});
			const out = await res.json();
			if (!out.ok) throw new Error(out.error || 'Error desconocido');

			await loadCategories();
		} catch (error: any) {
			console.error('Error al actualizar categoría:', error);
			alert('Error al actualizar categoría: ' + error.message);
		}
	}

	function getParentCategory(parentId: string | null): Category | undefined {
		return categories.find(c => c.id === parentId);
	}

	function getChildCategories(parentId: string): Category[] {
		return categories.filter(c => c.parent_id === parentId).sort((a, b) => {
			if (a.display_order !== b.display_order) {
				return a.display_order - b.display_order;
			}
			return a.name.localeCompare(b.name);
		});
	}

	function getRootCategories(): Category[] {
		return categories.filter(c => !c.parent_id).sort((a, b) => {
			if (a.display_order !== b.display_order) {
				return a.display_order - b.display_order;
			}
			return a.name.localeCompare(b.name);
		});
	}

	function toggleExpand(categoryId: string) {
		expandedCategories[categoryId] = !expandedCategories[categoryId];
	}

	function filterCategories(searchText: string): Category[] {
		if (!searchText.trim()) return categories;
		const lower = searchText.toLowerCase();
		return categories.filter(
			c => c.name.toLowerCase().includes(lower) || c.slug.toLowerCase().includes(lower)
		);
	}

	function getFilteredRootCategories(): Category[] {
		const filtered = filterCategories(searchTerm);
		return filtered.filter(c => !c.parent_id).sort((a, b) => {
			if (a.display_order !== b.display_order) {
				return a.display_order - b.display_order;
			}
			return a.name.localeCompare(b.name);
		});
	}

	function getDepth(category: Category): number {
		let depth = 0;
		let current = category;
		while (current.parent_id) {
			depth++;
			current = categories.find(c => c.id === current.parent_id) || current;
			if (current === category) break; // Evitar ciclos
		}
		return depth;
	}
</script>

<svelte:head>
	<title>Gestión de Categorías - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-4xl font-bold">Gestión de Categorías</h1>
		<div class="flex gap-4">
			<a
				href="/admin"
				class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
			>
				← Volver
			</a>
			<button
				onclick={() => openModal()}
				class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
			>
				+ Nueva Categoría
			</button>
		</div>
	</div>

	<!-- Buscador -->
	<div class="mb-8">
		<input
			type="text"
			bind:value={searchTerm}
			placeholder="Buscar categoría por nombre o slug..."
			class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
		/>
	</div>

	{#if loading}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">Cargando categorías...</p>
		</div>
	{:else if categories.length === 0}
		<div class="bg-gray-50 rounded-lg p-8 text-center">
			<p class="text-xl text-gray-600 mb-4">No hay categorías registradas</p>
			<button
				onclick={() => openModal()}
				class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
			>
				Crear Primera Categoría
			</button>
		</div>
	{:else}
		<div class="space-y-2">
			{#each getFilteredRootCategories() as rootCategory}
				{@const hasChildren = getChildCategories(rootCategory.id).length > 0}
				{@const isExpanded = expandedCategories[rootCategory.id] || false}
				{@const depth = getDepth(rootCategory)}
				{@const colors = ['blue', 'green', 'purple', 'orange']}
				{@const colorClass = colors[depth % colors.length]}
				{@const colorMap = {
					blue: 'text-blue-600',
					green: 'text-green-600',
					purple: 'text-purple-600',
					orange: 'text-orange-600'
				}}
				{@const badgeMap = {
					blue: 'bg-blue-100 text-blue-800',
					green: 'bg-green-100 text-green-700',
					purple: 'bg-purple-100 text-purple-700',
					orange: 'bg-orange-100 text-orange-700'
				}}

				<!-- Categoría Padre -->
				<div class="bg-white rounded-lg shadow p-4 border-l-4" style="border-color: rgb({
					colorClass === 'blue' ? '59, 130, 246' :
					colorClass === 'green' ? '22, 163, 74' :
					colorClass === 'purple' ? '168, 85, 247' :
					'249, 115, 22'
				})">
					<div class="flex items-center justify-between">
						<div class="flex-1 flex items-center gap-3">
							{#if hasChildren}
								<button
									onclick={() => toggleExpand(rootCategory.id)}
									class="px-2 py-1 text-lg font-bold text-gray-600 hover:bg-gray-100 rounded transition"
								>
									{isExpanded ? '▼' : '▶'}
								</button>
							{:else}
								<div class="px-2"></div>
							{/if}
							{#if rootCategory.image_url}
								<img src={rootCategory.image_url} alt={rootCategory.name} class="w-10 h-10 object-cover rounded" />
							{:else}
								<div class="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">Img</div>
							{/if}
							<div class="flex-1">
								<h4 class="font-semibold {colorMap[colorClass]}">{rootCategory.name}</h4>
								<p class="text-xs text-gray-600">{rootCategory.slug}</p>
								<span class="inline-block mt-1 px-2 py-0.5 {badgeMap[colorClass]} text-xs rounded">Padre</span>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<button
								onclick={() => toggleActive(rootCategory)}
								class="px-2 py-1 rounded text-xs {rootCategory.is_active
									? 'bg-green-100 text-green-800'
									: 'bg-red-100 text-red-800'}"
							>
								{rootCategory.is_active ? 'Activo' : 'Inactivo'}
							</button>
							<button
								onclick={() => openModal(rootCategory)}
								class="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition"
							>
								Editar
							</button>
							<button
								onclick={() => deleteCategory(rootCategory.id)}
								class="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition"
							>
								Eliminar
							</button>
						</div>
					</div>

					<!-- Hijas (colapsables) -->
					{#if hasChildren && isExpanded}
						<div class="mt-4 space-y-2 ml-4 border-l-2 border-gray-200 pl-4">
							{#each getChildCategories(rootCategory.id) as childCat}
								{@const childDepth = getDepth(childCat)}
								{@const childColor = colors[childDepth % colors.length]}
								{@const childHasChildren = getChildCategories(childCat.id).length > 0}
								{@const childIsExpanded = expandedCategories[childCat.id] || false}

								<div class="bg-gray-50 rounded p-3">
									<div class="flex items-center justify-between">
										<div class="flex-1 flex items-center gap-2">
											{#if childHasChildren}
												<button
													onclick={() => toggleExpand(childCat.id)}
													class="px-1 py-0 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded transition"
												>
													{childIsExpanded ? '▼' : '▶'}
												</button>
											{:else}
												<div class="px-1"></div>
											{/if}
											{#if childCat.image_url}
												<img src={childCat.image_url} alt={childCat.name} class="w-8 h-8 object-cover rounded" />
											{:else}
												<div class="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">Im</div>
											{/if}
											<div class="flex-1 min-w-0">
												<h5 class="font-semibold text-sm {colorMap[childColor]} truncate">{childCat.name}</h5>
												<p class="text-xs text-gray-600 truncate">{childCat.slug}</p>
											</div>
										</div>
										<div class="flex items-center gap-1 flex-shrink-0">
											<button
												onclick={() => toggleActive(childCat)}
												class="px-1.5 py-0.5 rounded text-xs {childCat.is_active
													? 'bg-green-100 text-green-800'
													: 'bg-red-100 text-red-800'}"
											>
												{childCat.is_active ? 'Act' : 'Ina'}
											</button>
											<button
												onclick={() => openModal(childCat)}
												class="px-2 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition"
											>
												Edit
											</button>
											<button
												onclick={() => deleteCategory(childCat.id)}
												class="px-2 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition"
											>
												Del
											</button>
										</div>
									</div>

									<!-- Nietos (si hay) -->
									{#if childHasChildren && childIsExpanded}
										<div class="mt-2 space-y-1 ml-3 text-xs">
											{#each getChildCategories(childCat.id) as grandchildCat}
												<div class="bg-white p-2 rounded border-l-2 border-gray-300">
													<div class="flex items-center justify-between">
														<span class="font-medium truncate">{grandchildCat.name}</span>
														<div class="flex gap-0.5">
															<button
																onclick={() => toggleActive(grandchildCat)}
																class="px-1 py-0.5 rounded text-xs {grandchildCat.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}"
															>
																{grandchildCat.is_active ? 'Act' : 'Ina'}
															</button>
															<button onclick={() => openModal(grandchildCat)} class="px-1.5 py-0.5 bg-blue-500 text-white rounded">Edit</button>
															<button onclick={() => deleteCategory(grandchildCat.id)} class="px-1.5 py-0.5 bg-red-500 text-white rounded">Del</button>
														</div>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal -->
{#if showModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
			<div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
				<h2 class="text-2xl font-bold">
					{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
				</h2>
				<button onclick={closeModal} class="text-gray-500 hover:text-gray-700 text-2xl">
					×
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); saveCategory(); }} class="p-6 space-y-4">
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
					<label class="block text-sm font-semibold mb-2">Descripción</label>
					<textarea
						bind:value={formData.description}
						rows="4"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Categoría Padre</label>
					<select
						bind:value={formData.parent_id}
						onchange={updateSlug}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">Ninguna</option>
						{#each categories as cat}
							{#if !editingCategory || cat.id !== editingCategory.id}
								<option value={cat.id}>{cat.name}</option>
							{/if}
						{/each}
					</select>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Imagen de Categoría</label>
					
					<!-- Preview de imagen actual o seleccionada -->
					{#if imagePreview}
						<div class="mb-3 relative">
							<img src={imagePreview} alt="Preview" class="w-full h-48 object-cover rounded-lg border-2 border-gray-300" />
							<button
								type="button"
								onclick={removeImage}
								class="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition text-sm"
							>
								Eliminar Imagen
							</button>
						</div>
					{/if}
					
					<!-- Input para subir nueva imagen -->
					<div class="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition">
						<input
							type="file"
							accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
							onchange={handleFileSelect}
							class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
						/>
						<p class="text-xs text-gray-500 mt-2">
							Formatos aceptados: JPG, PNG, WEBP, GIF. Tamaño máximo: 5MB
						</p>
					</div>
					
					<!-- Opción de URL manual (avanzado) -->
					<details class="mt-3">
						<summary class="text-sm text-gray-600 cursor-pointer hover:text-blue-600">
							Usar URL externa (avanzado)
						</summary>
						<input
							type="url"
							bind:value={formData.image_url}
							placeholder="https://ejemplo.com/imagen.jpg"
							class="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							onchange={() => {
								if (formData.image_url) {
									imagePreview = formData.image_url;
									selectedFile = null;
								}
							}}
						/>
					</details>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Orden de Visualización</label>
					<input
						type="number"
						bind:value={formData.display_order}
						min="0"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={formData.is_active} class="w-4 h-4" />
						<span class="text-sm">Categoría Activa</span>
					</label>
				</div>

				<div class="flex gap-4 pt-4">
					<button
						type="submit"
						disabled={uploadingImage}
						class="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
					>
						{uploadingImage ? 'Subiendo imagen...' : editingCategory ? 'Actualizar' : 'Crear'} Categoría
					</button>
					<button
						type="button"
						onclick={closeModal}
						disabled={uploadingImage}
						class="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition disabled:bg-gray-100 disabled:cursor-not-allowed"
					>
						Cancelar
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}