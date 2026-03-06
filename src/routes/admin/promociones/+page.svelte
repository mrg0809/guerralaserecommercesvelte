<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { IMAGEKIT_BASE_URL, getImageKitUrl, getProductImageUrl } from '$lib/storage';
	import type { Promotion } from '$lib/types';

	let promotions: Promotion[] = $state([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingPromotion = $state<Promotion | null>(null);
	let uploadingImage = $state(false);
	let selectedFile: File | null = $state(null);
	let imagePreview = $state('');

	let formData = $state({
		title: '',
		description: '',
		image_url: '',
		link_url: '',
		display_order: 0,
		is_active: true
	});

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();

		if (!session) {
			goto('/login');
			return;
		}

		await loadPromotions();
	});

	async function loadPromotions() {
		loading = true;
		const { data, error } = await supabase
			.from('promotions')
			.select('*')
			.order('display_order', { ascending: true });

		if (error) {
			console.error('Error loading promotions:', error);
			alert('Error al cargar promociones: ' + error.message);
		} else {
			promotions = data || [];
		}
		loading = false;
	}

	function openModal(promotion?: Promotion) {
		if (promotion) {
			editingPromotion = promotion;
			formData = {
				title: promotion.title,
				description: promotion.description || '',
				image_url: promotion.image_url,
				link_url: promotion.link_url || '',
				display_order: promotion.display_order,
				is_active: promotion.is_active
			};
			imagePreview = promotion.image_url;
		} else {
			editingPromotion = null;
			formData = {
				title: '',
				description: '',
				image_url: '',
				link_url: '',
				display_order: promotions.length,
				is_active: true
			};
			imagePreview = '';
		}

		selectedFile = null;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingPromotion = null;
		selectedFile = null;
		imagePreview = '';
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || !input.files[0]) return;

		const file = input.files[0];
		const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

		if (!validTypes.includes(file.type)) {
			alert('Por favor selecciona una imagen valida (JPG, PNG, WEBP o GIF)');
			input.value = '';
			return;
		}

		if (file.size > 8 * 1024 * 1024) {
			alert('La imagen no debe superar los 8MB');
			input.value = '';
			return;
		}

		selectedFile = file;

		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview = (e.target?.result as string) || '';
		};
		reader.readAsDataURL(file);
	}

	async function uploadImage(): Promise<string | null> {
		if (!selectedFile) return null;

		uploadingImage = true;
		try {
			const timestamp = Date.now();
			const randomStr = Math.random().toString(36).slice(2, 8);
			const fileExt = selectedFile.name.split('.').pop() || 'jpg';
			const safeTitle = formData.title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '') || 'promo';
			const fileName = `promotions/${safeTitle}-${timestamp}-${randomStr}.${fileExt}`;

			const { error } = await supabase.storage
				.from('product-images')
				.upload(fileName, selectedFile, {
					cacheControl: '3600',
					upsert: false
				});

			if (error) throw error;

			return getProductImageUrl(fileName);
		} catch (error: any) {
			console.error('Error uploading image:', error);
			alert('Error al subir la imagen: ' + error.message);
			return null;
		} finally {
			uploadingImage = false;
		}
	}

	function removeSelectedImage() {
		selectedFile = null;
		imagePreview = '';
		formData.image_url = '';
		const fileInput = document.getElementById('promotion-image') as HTMLInputElement;
		if (fileInput) fileInput.value = '';
	}

	function normalizeLink(link: string): string {
		const trimmed = link.trim();
		if (!trimmed) return '';
		if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
			return trimmed;
		}
		return `/${trimmed}`;
	}

	function extractStoragePathFromUrl(url: string): string | null {
		if (!url) return null;

		const publicMarker = '/storage/v1/object/public/product-images/';
		if (url.includes(publicMarker)) {
			return url.split(publicMarker)[1] || null;
		}

		const imageKitMarker = `${IMAGEKIT_BASE_URL}/`;
		if (url.includes(imageKitMarker)) {
			return url.split(imageKitMarker)[1] || null;
		}

		return null;
	}

	async function savePromotion() {
		try {
			if (selectedFile) {
				const uploadedUrl = await uploadImage();
				if (!uploadedUrl) return;
				formData.image_url = uploadedUrl;
			}

			if (!formData.image_url) {
				alert('Debes subir una imagen para la promocion');
				return;
			}

			const payload = {
				title: formData.title.trim(),
				description: formData.description.trim() || null,
				image_url: formData.image_url,
				link_url: normalizeLink(formData.link_url) || null,
				display_order: formData.display_order,
				is_active: formData.is_active
			};

			if (editingPromotion) {
				const { error } = await supabase
					.from('promotions')
					.update(payload)
					.eq('id', editingPromotion.id);
				if (error) throw error;
			} else {
				const { error } = await supabase
					.from('promotions')
					.insert([payload]);
				if (error) throw error;
			}

			closeModal();
			await loadPromotions();
		} catch (error: any) {
			console.error('Error saving promotion:', error);
			alert('Error al guardar promocion: ' + error.message);
		}
	}

	async function deletePromotion(promotion: Promotion) {
		if (!confirm('¿Estas seguro de eliminar esta promocion?')) return;

		try {
			const storagePath = extractStoragePathFromUrl(promotion.image_url);
			if (storagePath) {
				const { error: storageError } = await supabase.storage
					.from('product-images')
					.remove([storagePath]);
				if (storageError) {
					console.error('Error deleting promotion image from storage:', storageError);
				}
			}

			const { error } = await supabase
				.from('promotions')
				.delete()
				.eq('id', promotion.id);

			if (error) throw error;

			await loadPromotions();
		} catch (error: any) {
			console.error('Error deleting promotion:', error);
			alert('Error al eliminar promocion: ' + error.message);
		}
	}

	async function toggleActive(promotion: Promotion) {
		try {
			const { error } = await supabase
				.from('promotions')
				.update({ is_active: !promotion.is_active })
				.eq('id', promotion.id);

			if (error) throw error;
			await loadPromotions();
		} catch (error: any) {
			console.error('Error toggling promotion:', error);
			alert('Error al actualizar estado: ' + error.message);
		}
	}

	async function movePromotion(promotion: Promotion, direction: 'up' | 'down') {
		const currentIndex = promotions.findIndex((p) => p.id === promotion.id);
		const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

		if (newIndex < 0 || newIndex >= promotions.length) return;

		const otherPromotion = promotions[newIndex];

		try {
			const { error: errorA } = await supabase
				.from('promotions')
				.update({ display_order: otherPromotion.display_order })
				.eq('id', promotion.id);
			if (errorA) throw errorA;

			const { error: errorB } = await supabase
				.from('promotions')
				.update({ display_order: promotion.display_order })
				.eq('id', otherPromotion.id);
			if (errorB) throw errorB;

			await loadPromotions();
		} catch (error: any) {
			console.error('Error moving promotion:', error);
			alert('Error al mover promocion: ' + error.message);
		}
	}
</script>

<svelte:head>
	<title>Gestión de Promociones - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<div>
			<h1 class="text-3xl font-bold">Promociones del Inicio</h1>
			<p class="text-gray-600 mt-1">Sube creativos y enlazalos a productos o categorias</p>
		</div>
		<button
			onclick={() => openModal()}
			class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
		>
			+ Nueva Promoción
		</button>
	</div>

	{#if loading}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">Cargando promociones...</p>
		</div>
	{:else if promotions.length === 0}
		<div class="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
			<p class="text-xl text-gray-700 mb-2">No hay promociones registradas</p>
			<p class="text-gray-500 mb-4">Sube tus banners de Instagram/Facebook para mostrarlos en el home</p>
			<button
				onclick={() => openModal()}
				class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
			>
				Agregar Primera Promoción
			</button>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Imagen</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each promotions as promotion, index}
						<tr class="hover:bg-gray-50">
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="flex items-center gap-1">
									<button
										onclick={() => movePromotion(promotion, 'up')}
										disabled={index === 0}
										class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
										title="Mover arriba"
									>
										▲
									</button>
									<span class="text-sm font-medium">{promotion.display_order}</span>
									<button
										onclick={() => movePromotion(promotion, 'down')}
										disabled={index === promotions.length - 1}
										class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
										title="Mover abajo"
									>
										▼
									</button>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<img
									src={getImageKitUrl(promotion.image_url)}
									alt={promotion.title}
									class="w-28 h-16 object-cover rounded"
								/>
							</td>
							<td class="px-6 py-4">
								<p class="font-medium text-gray-900">{promotion.title}</p>
								{#if promotion.description}
									<p class="text-sm text-gray-500 line-clamp-2">{promotion.description}</p>
								{/if}
							</td>
							<td class="px-6 py-4">
								{#if promotion.link_url}
									<p class="text-sm text-blue-700 break-all">{promotion.link_url}</p>
								{:else}
									<p class="text-sm text-gray-400">Sin link</p>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<button
									onclick={() => toggleActive(promotion)}
									class="px-3 py-1 rounded-full text-xs {promotion.is_active
										? 'bg-green-100 text-green-800 hover:bg-green-200'
										: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
								>
									{promotion.is_active ? 'Activa' : 'Inactiva'}
								</button>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="flex gap-2">
									<button
										onclick={() => openModal(promotion)}
										class="text-blue-600 hover:text-blue-800"
									>
										Editar
									</button>
									<button
										onclick={() => deletePromotion(promotion)}
										class="text-red-600 hover:text-red-800"
									>
										Eliminar
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if showModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
			<div class="p-6 border-b border-gray-200 flex justify-between items-center">
				<h2 class="text-2xl font-bold">{editingPromotion ? 'Editar Promoción' : 'Nueva Promoción'}</h2>
				<button onclick={closeModal} class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					savePromotion();
				}}
				class="p-6 space-y-4"
			>
				<div>
					<label class="block text-sm font-semibold mb-2" for="promotion-title">Título *</label>
					<input
						id="promotion-title"
						type="text"
						bind:value={formData.title}
						required
						class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
						placeholder="Promo primavera, Lanzamiento, etc."
					/>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2" for="promotion-description">Descripción</label>
					<textarea
						id="promotion-description"
						bind:value={formData.description}
						rows="3"
						class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
						placeholder="Texto opcional para acompañar la imagen"
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2" for="promotion-link">Link</label>
					<input
						id="promotion-link"
						type="text"
						bind:value={formData.link_url}
						class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
						placeholder="/productos/mi-producto o /categorias/mi-categoria"
					/>
					<p class="text-xs text-gray-500 mt-1">También puedes usar URL externa completa: https://...</p>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2" for="promotion-image">Imagen *</label>
					<input
						id="promotion-image"
						type="file"
						accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
						onchange={handleFileSelect}
						class="w-full border border-gray-300 rounded-lg px-4 py-2"
					/>
					<p class="text-xs text-gray-500 mt-1">Recomendado: formato cuadrado (ej. 1600x1600) para Instagram/Facebook</p>

					{#if imagePreview}
						<div class="mt-4">
							<img src={getImageKitUrl(imagePreview)} alt="Preview" class="w-full h-44 object-cover rounded-lg border" />
							<button
								type="button"
								onclick={removeSelectedImage}
								class="mt-2 text-red-600 hover:text-red-800 text-sm"
							>
								Quitar imagen
							</button>
						</div>
					{/if}
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-semibold mb-2" for="promotion-order">Orden</label>
						<input
							id="promotion-order"
							type="number"
							min="0"
							bind:value={formData.display_order}
							class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div class="flex items-end pb-2">
						<label class="flex items-center gap-2 text-sm font-semibold">
							<input type="checkbox" bind:checked={formData.is_active} class="w-4 h-4" />
							Promoción activa
						</label>
					</div>
				</div>

				<div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
					<button
						type="button"
						onclick={closeModal}
						class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
						disabled={uploadingImage}
					>
						Cancelar
					</button>
					<button
						type="submit"
						class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
						disabled={uploadingImage}
					>
						{uploadingImage ? 'Subiendo imagen...' : editingPromotion ? 'Actualizar' : 'Crear'} Promoción
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
