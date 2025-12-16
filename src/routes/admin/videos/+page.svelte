<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import type { TestimonialVideo } from '$lib/types';

	let videos: TestimonialVideo[] = $state([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingVideo = $state<TestimonialVideo | null>(null);

	let formData = $state({
		title: '',
		description: '',
		video_url: '',
		video_type: 'youtube' as 'youtube' | 'tiktok',
		thumbnail_url: '',
		display_order: 0,
		is_active: true
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

		await loadVideos();
	});

	async function loadVideos() {
		loading = true;
		const { data, error } = await supabase
			.from('testimonial_videos')
			.select('*')
			.order('display_order', { ascending: true });

		if (error) {
			console.error('Error loading videos:', error);
			alert('Error al cargar videos: ' + error.message);
		} else if (data) {
			videos = data;
		}
		loading = false;
	}

	function openModal(video?: TestimonialVideo) {
		if (video) {
			editingVideo = video;
			formData = {
				title: video.title,
				description: video.description || '',
				video_url: video.video_url,
				video_type: video.video_type,
				thumbnail_url: video.thumbnail_url || '',
				display_order: video.display_order,
				is_active: video.is_active
			};
		} else {
			editingVideo = null;
			formData = {
				title: '',
				description: '',
				video_url: '',
				video_type: 'youtube',
				thumbnail_url: '',
				display_order: videos.length,
				is_active: true
			};
		}
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingVideo = null;
	}

	function extractVideoId(url: string, type: 'youtube' | 'tiktok'): string | null {
		try {
			if (type === 'youtube') {
				// Soportar diferentes formatos de URL de YouTube
				const patterns = [
					/(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
					/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
					/^([a-zA-Z0-9_-]{11})$/
				];
				
				for (const pattern of patterns) {
					const match = url.match(pattern);
					if (match) return match[1];
				}
			}
		} catch (e) {
			console.error('Error extracting video ID:', e);
		}
		return null;
	}

	function autoFillFields() {
		if (formData.video_type === 'youtube' && formData.video_url) {
			const videoId = extractVideoId(formData.video_url, 'youtube');
			if (videoId) {
				// Auto-generar URL de embed
				formData.video_url = `https://www.youtube.com/embed/${videoId}`;
				// Auto-generar thumbnail
				if (!formData.thumbnail_url) {
					formData.thumbnail_url = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
				}
			}
		} else if (formData.video_type === 'tiktok') {
			// Limpiar thumbnail para TikTok
			formData.thumbnail_url = '';
		}
	}

	async function saveVideo() {
		try {
			// Auto-completar campos antes de guardar
			autoFillFields();

			if (editingVideo) {
				const { error } = await supabase
					.from('testimonial_videos')
					.update(formData)
					.eq('id', editingVideo.id);

				if (error) throw error;
			} else {
				const { error } = await supabase
					.from('testimonial_videos')
					.insert([formData]);

				if (error) throw error;
			}

			closeModal();
			await loadVideos();
		} catch (error: any) {
			console.error('Error saving video:', error);
			alert('Error al guardar video: ' + error.message);
		}
	}

	async function deleteVideo(id: string) {
		if (!confirm('¿Estás seguro de eliminar este video?')) return;

		try {
			const { error } = await supabase
				.from('testimonial_videos')
				.delete()
				.eq('id', id);

			if (error) throw error;

			await loadVideos();
		} catch (error: any) {
			console.error('Error deleting video:', error);
			alert('Error al eliminar video: ' + error.message);
		}
	}

	async function toggleActive(video: TestimonialVideo) {
		try {
			const { error } = await supabase
				.from('testimonial_videos')
				.update({ is_active: !video.is_active })
				.eq('id', video.id);

			if (error) throw error;

			await loadVideos();
		} catch (error: any) {
			console.error('Error updating video:', error);
			alert('Error al actualizar video: ' + error.message);
		}
	}

	async function moveVideo(video: TestimonialVideo, direction: 'up' | 'down') {
		const currentIndex = videos.findIndex(v => v.id === video.id);
		const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
		
		if (newIndex < 0 || newIndex >= videos.length) return;

		const otherVideo = videos[newIndex];

		try {
			// Intercambiar display_order
			await supabase
				.from('testimonial_videos')
				.update({ display_order: otherVideo.display_order })
				.eq('id', video.id);

			await supabase
				.from('testimonial_videos')
				.update({ display_order: video.display_order })
				.eq('id', otherVideo.id);

			await loadVideos();
		} catch (error: any) {
			console.error('Error moving video:', error);
			alert('Error al mover video: ' + error.message);
		}
	}
</script>

<svelte:head>
	<title>Gestión de Videos Testimoniales - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-3xl font-bold">Videos Testimoniales</h1>
		<button
			onclick={() => openModal()}
			class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
		>
			+ Nuevo Video
		</button>
	</div>

	{#if loading}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">Cargando videos...</p>
		</div>
	{:else if videos.length === 0}
		<div class="text-center py-12 bg-gray-50 rounded-lg">
			<p class="text-xl text-gray-600 mb-4">No hay videos testimoniales</p>
			<button
				onclick={() => openModal()}
				class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
			>
				Agregar Primer Video
			</button>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Video</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each videos as video, index}
						<tr class="hover:bg-gray-50">
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="flex items-center gap-1">
									<button
										onclick={() => moveVideo(video, 'up')}
										disabled={index === 0}
										class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
										title="Mover arriba"
									>
										▲
									</button>
									<span class="text-sm font-medium">{video.display_order}</span>
									<button
										onclick={() => moveVideo(video, 'down')}
										disabled={index === videos.length - 1}
										class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
										title="Mover abajo"
									>
										▼
									</button>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if video.thumbnail_url}
									<img src={video.thumbnail_url} alt={video.title} class="w-24 h-16 object-cover rounded" />
								{:else}
									<div class="w-24 h-16 bg-gray-200 rounded flex items-center justify-center">
										<svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
											<path d="M8 5v14l11-7z"/>
										</svg>
									</div>
								{/if}
							</td>
							<td class="px-6 py-4">
								<div class="text-sm font-medium text-gray-900">{video.title}</div>
								{#if video.description}
									<div class="text-sm text-gray-500 truncate max-w-xs">{video.description}</div>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span class="px-2 py-1 text-xs rounded-full {video.video_type === 'youtube' ? 'bg-red-100 text-red-800' : 'bg-black text-white'}">
									{video.video_type}
								</span>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<button
									onclick={() => toggleActive(video)}
									class="px-3 py-1 rounded-full text-xs {video.is_active
										? 'bg-green-100 text-green-800'
										: 'bg-red-100 text-red-800'}"
								>
									{video.is_active ? 'Activo' : 'Inactivo'}
								</button>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<button
									onclick={() => openModal(video)}
									class="text-blue-600 hover:text-blue-900 mr-4"
								>
									Editar
								</button>
								<button
									onclick={() => deleteVideo(video.id)}
									class="text-red-600 hover:text-red-900"
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
					{editingVideo ? 'Editar Video' : 'Nuevo Video'}
				</h2>
				<button onclick={closeModal} class="text-gray-500 hover:text-gray-700 text-2xl">
					×
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); saveVideo(); }} class="p-6 space-y-4">
				<div>
					<label class="block text-sm font-semibold mb-2">Tipo de Video *</label>
					<div class="flex gap-4">
						<label class="flex items-center gap-2">
							<input
								type="radio"
								bind:group={formData.video_type}
								value="youtube"
								onchange={autoFillFields}
								class="w-4 h-4"
							/>
							<span class="flex items-center gap-2">
								<svg class="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
									<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
								</svg>
								YouTube
							</span>
						</label>
						<label class="flex items-center gap-2">
							<input
								type="radio"
								bind:group={formData.video_type}
								value="tiktok"
								onchange={autoFillFields}
								class="w-4 h-4"
							/>
							<span class="flex items-center gap-2">
								<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
									<path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
								</svg>
								TikTok
							</span>
						</label>
					</div>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">URL del Video *</label>
					<input
						type="text"
						bind:value={formData.video_url}
						onblur={autoFillFields}
						required
						placeholder={formData.video_type === 'youtube' 
							? 'https://www.youtube.com/watch?v=... o https://youtu.be/... o solo el ID'
							: 'https://www.tiktok.com/embed/v2/...'}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<p class="text-xs text-gray-500 mt-1">
						{#if formData.video_type === 'youtube'}
							Pega cualquier URL de YouTube. Se convertirá automáticamente al formato correcto.
						{:else}
							Pega la URL de inserción de TikTok (usa el botón "Insertar" en TikTok)
						{/if}
					</p>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Título *</label>
					<input
						type="text"
						bind:value={formData.title}
						required
						placeholder="Ej: Cliente satisfecho - Máquina Láser CO2"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Descripción</label>
					<textarea
						bind:value={formData.description}
						rows="3"
						placeholder="Descripción opcional del testimonio"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					></textarea>
				</div>

				{#if formData.video_type === 'youtube'}
					<div>
						<label class="block text-sm font-semibold mb-2">URL del Thumbnail</label>
						<input
							type="text"
							bind:value={formData.thumbnail_url}
							placeholder="Se genera automáticamente para YouTube"
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
						/>
						<p class="text-xs text-gray-500 mt-1">
							Se genera automáticamente. Puedes cambiarlo manualmente si lo necesitas.
						</p>
					</div>
				{/if}

				<div>
					<label class="block text-sm font-semibold mb-2">Orden de Visualización</label>
					<input
						type="number"
						bind:value={formData.display_order}
						min="0"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<p class="text-xs text-gray-500 mt-1">
						Orden en que aparece en el carrusel (menor número = primero)
					</p>
				</div>

				<div>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={formData.is_active} class="w-4 h-4" />
						<span class="text-sm">Video Activo (visible en el sitio web)</span>
					</label>
				</div>

				<!-- Preview -->
				{#if formData.video_url}
					<div class="border-t pt-4">
						<h3 class="text-sm font-semibold mb-2">Vista Previa:</h3>
						<div class="aspect-video bg-black rounded-lg overflow-hidden">
							<iframe
								src={formData.video_url}
								title="Preview"
								class="w-full h-full"
								frameborder="0"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowfullscreen
							></iframe>
						</div>
					</div>
				{/if}

				<div class="flex gap-4 pt-4">
					<button
						type="submit"
						class="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
					>
						{editingVideo ? 'Actualizar' : 'Crear'} Video
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
