<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { getImageKitUrl, getProductImageUrl } from '$lib/storage';
	import type { HeroBannerSettings } from '$lib/heroBanner';
	import { DEFAULT_HERO_BANNER, MOBILE_VIDEO_MAX_BYTES } from '$lib/heroBanner';

	let loading = $state(true);
	let saving = $state(false);
	let emails = $state('');

	let heroBanner = $state<HeroBannerSettings>({ ...DEFAULT_HERO_BANNER });
	let uploadingDesktop = $state(false);
	let uploadingMobile = $state(false);
	let uploadingMobilePoster = $state(false);
	let desktopPreview = $state('');
	let mobilePreview = $state('');
	let mobilePosterPreview = $state('');
	let selectedDesktopFile: File | null = $state(null);
	let selectedMobileFile: File | null = $state(null);
	let selectedMobilePosterFile: File | null = $state(null);

	let mobilePreviewIsVideo = $state(false);

	async function getSessionToken(): Promise<string | null> {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		return session?.access_token || null;
	}

	async function loadSettings() {
		loading = true;
		try {
			const token = await getSessionToken();
			if (!token) {
				alert('No autorizado');
				return;
			}

			const [emailsResponse, heroResponse] = await Promise.all([
				fetch('/api/admin/settings/order-notification-emails', {
					headers: { Authorization: `Bearer ${token}` }
				}),
				fetch('/api/admin/settings/hero-banner', {
					headers: { Authorization: `Bearer ${token}` }
				})
			]);

			const emailsResult = await emailsResponse.json();
			if (!emailsResponse.ok || !emailsResult.success) {
				throw new Error(emailsResult.error || 'No se pudo cargar la configuración de correos');
			}
			emails = emailsResult.emails || '';

			const heroResult = await heroResponse.json();
			if (!heroResponse.ok || !heroResult.success) {
				throw new Error(heroResult.error || 'No se pudo cargar la configuración del banner');
			}

			heroBanner = heroResult.heroBanner;
			updatePreviews();
		} catch (error: any) {
			alert('Error al cargar configuración: ' + error.message);
		} finally {
			loading = false;
		}
	}

	function updatePreviews() {
		desktopPreview = heroBanner.desktop_url ? getImageKitUrl(heroBanner.desktop_url) : '';

		mobilePreviewIsVideo = heroBanner.mobile_media_type === 'video';
		mobilePreview = heroBanner.mobile_url ? getImageKitUrl(heroBanner.mobile_url) : '';
		mobilePosterPreview = heroBanner.mobile_poster_url
			? getImageKitUrl(heroBanner.mobile_poster_url)
			: '';
	}

	function handleDesktopFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.[0]) return;

		const file = input.files[0];
		const isVideo = heroBanner.media_type === 'video';

		if (isVideo) {
			if (!file.type.startsWith('video/')) {
				alert('Selecciona un archivo de video (MP4)');
				input.value = '';
				return;
			}
			if (file.size > 50 * 1024 * 1024) {
				alert('El video no debe superar los 50MB');
				input.value = '';
				return;
			}
		} else {
			const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
			if (!validTypes.includes(file.type)) {
				alert('Selecciona una imagen válida (JPG, PNG o WEBP)');
				input.value = '';
				return;
			}
			if (file.size > 8 * 1024 * 1024) {
				alert('La imagen no debe superar los 8MB');
				input.value = '';
				return;
			}
		}

		selectedDesktopFile = file;
		desktopPreview = URL.createObjectURL(file);
	}

	function resetMobileFileInput() {
		selectedMobileFile = null;
		const fileInput = document.getElementById('hero-mobile-file') as HTMLInputElement;
		if (fileInput) fileInput.value = '';
		updatePreviews();
	}

	function handleMobileFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.[0]) return;

		const file = input.files[0];
		const isVideo = heroBanner.mobile_media_type === 'video';

		if (isVideo) {
			if (!file.type.startsWith('video/')) {
				alert('Selecciona un archivo de video (MP4 recomendado)');
				input.value = '';
				return;
			}
			if (file.size > MOBILE_VIDEO_MAX_BYTES) {
				alert('El video móvil no debe superar los 8MB. Usa un clip corto y comprimido.');
				input.value = '';
				return;
			}
		} else {
			const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
			if (!validTypes.includes(file.type)) {
				alert('Selecciona una imagen válida (JPG, PNG o WEBP)');
				input.value = '';
				return;
			}
			if (file.size > 8 * 1024 * 1024) {
				alert('La imagen no debe superar los 8MB');
				input.value = '';
				return;
			}
		}

		selectedMobileFile = file;
		mobilePreviewIsVideo = isVideo;
		mobilePreview = URL.createObjectURL(file);
	}

	function handleMobilePosterFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.[0]) return;

		const file = input.files[0];
		const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
		if (!validTypes.includes(file.type)) {
			alert('Selecciona una imagen válida (JPG, PNG o WEBP)');
			input.value = '';
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			alert('La imagen poster no debe superar los 2MB. Usa un JPEG comprimido (~50-100 KB).');
			input.value = '';
			return;
		}

		selectedMobilePosterFile = file;
		mobilePosterPreview = URL.createObjectURL(file);
	}

	async function uploadFile(file: File, prefix: string): Promise<string | null> {
		const timestamp = Date.now();
		const randomStr = Math.random().toString(36).slice(2, 8);
		const fileExt = file.name.split('.').pop() || 'jpg';
		const fileName = `banners/${prefix}-${timestamp}-${randomStr}.${fileExt}`;

		const { error } = await supabase.storage.from('product-images').upload(fileName, file, {
			cacheControl: '3600',
			upsert: false
		});

		if (error) throw error;
		return getProductImageUrl(fileName);
	}

	async function saveEmails() {
		saving = true;
		try {
			const token = await getSessionToken();
			if (!token) {
				alert('No autorizado');
				return;
			}

			const response = await fetch('/api/admin/settings/order-notification-emails', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({ emails })
			});

			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.error || 'No se pudo guardar la configuración');
			}

			alert('Correos guardados');
		} catch (error: any) {
			alert('Error al guardar correos: ' + error.message);
		} finally {
			saving = false;
		}
	}

	async function saveHeroBanner() {
		saving = true;
		try {
			uploadingDesktop = !!selectedDesktopFile;
			uploadingMobile = !!selectedMobileFile;
			uploadingMobilePoster = !!selectedMobilePosterFile;

			if (selectedDesktopFile) {
				const prefix = heroBanner.media_type === 'video' ? 'hero-video' : 'hero-desktop';
				const uploadedUrl = await uploadFile(selectedDesktopFile, prefix);
				if (!uploadedUrl) return;
				heroBanner.desktop_url = uploadedUrl;
				selectedDesktopFile = null;
			}

			if (selectedMobileFile) {
				const prefix =
					heroBanner.mobile_media_type === 'video' ? 'hero-mobile-video' : 'hero-mobile-image';
				const uploadedUrl = await uploadFile(selectedMobileFile, prefix);
				if (!uploadedUrl) return;
				heroBanner.mobile_url = uploadedUrl;
				selectedMobileFile = null;
			}

			if (selectedMobilePosterFile) {
				const uploadedUrl = await uploadFile(selectedMobilePosterFile, 'hero-mobile-poster');
				if (!uploadedUrl) return;
				heroBanner.mobile_poster_url = uploadedUrl;
				selectedMobilePosterFile = null;
			}

			const token = await getSessionToken();
			if (!token) {
				alert('No autorizado');
				return;
			}

			const response = await fetch('/api/admin/settings/hero-banner', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(heroBanner)
			});

			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.error || 'No se pudo guardar el banner');
			}

			heroBanner = result.heroBanner;
			updatePreviews();
			alert('Banner guardado');
		} catch (error: any) {
			alert('Error al guardar banner: ' + error.message);
		} finally {
			saving = false;
			uploadingDesktop = false;
			uploadingMobile = false;
			uploadingMobilePoster = false;
		}
	}

	onMount(() => {
		void loadSettings();
	});
</script>

<svelte:head>
	<title>Configuración General - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-4xl font-bold">Configuración General</h1>
		<a href="/admin" class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
			← Volver
		</a>
	</div>

	<div class="space-y-8 max-w-3xl">
		<!-- Banner de inicio -->
		<div class="bg-white rounded-lg shadow-md p-6">
			<h2 class="text-xl font-bold mb-3">Banner de inicio</h2>
			<p class="text-sm text-gray-600 mb-4">
				Configura el banner principal de la página de inicio. En móvil puedes usar una imagen optimizada
				(recomendado para velocidad) o un video ligero y corto.
			</p>

			<div class="space-y-4" class:opacity-50={loading || saving} class:pointer-events-none={loading || saving}>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Tipo de banner</label>
					<select
						bind:value={heroBanner.media_type}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="video">Video en escritorio + media en móvil</option>
						<option value="image">Imagen en todos los dispositivos</option>
					</select>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">
						{heroBanner.media_type === 'video' ? 'Video de escritorio' : 'Imagen de escritorio'}
					</label>
					<input
						id="hero-desktop-file"
						type="file"
						accept={heroBanner.media_type === 'video' ? 'video/mp4,video/*' : 'image/jpeg,image/png,image/webp'}
						onchange={handleDesktopFileSelect}
						class="w-full text-sm"
					/>
					{#if desktopPreview}
						<div class="mt-2 rounded-lg overflow-hidden border max-h-48">
							{#if heroBanner.media_type === 'video' && !selectedDesktopFile}
								<video src={desktopPreview} class="w-full max-h-48 object-cover" muted playsinline controls></video>
							{:else if heroBanner.media_type === 'video' && selectedDesktopFile}
								<video src={desktopPreview} class="w-full max-h-48 object-cover" muted playsinline controls></video>
							{:else}
								<img src={desktopPreview} alt="Preview escritorio" class="w-full max-h-48 object-cover" />
							{/if}
						</div>
					{/if}
					{#if uploadingDesktop}
						<p class="text-sm text-blue-600 mt-1">Subiendo archivo de escritorio...</p>
					{/if}
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Tipo de media móvil</label>
					<select
						bind:value={heroBanner.mobile_media_type}
						onchange={resetMobileFileInput}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="image">Imagen optimizada (recomendado)</option>
						<option value="video">Video ligero (máx. 8MB)</option>
					</select>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">
						{heroBanner.mobile_media_type === 'video' ? 'Video para móvil' : 'Imagen para móvil'}
						{#if heroBanner.media_type === 'video'}
							<span class="text-red-600">*</span>
						{/if}
					</label>
					<p class="text-xs text-gray-500 mb-2">
						{#if heroBanner.mobile_media_type === 'video'}
							Sube un clip corto comprimido (idealmente menor a 2MB) para no afectar la carga en móvil.
						{:else}
							Esta imagen se usa en pantallas pequeñas y suele ser el elemento LCP en móvil.
						{/if}
					</p>
					<input
						id="hero-mobile-file"
						type="file"
						accept={heroBanner.mobile_media_type === 'video'
							? 'video/mp4,video/*'
							: 'image/jpeg,image/png,image/webp'}
						onchange={handleMobileFileSelect}
						class="w-full text-sm"
					/>
					{#if mobilePreview}
						<div class="mt-2 rounded-lg overflow-hidden border max-h-48">
							{#if mobilePreviewIsVideo}
								<video
									src={mobilePreview}
									class="w-full max-h-48 object-cover"
									muted
									playsinline
									controls
								></video>
							{:else}
								<img src={mobilePreview} alt="Preview móvil" class="w-full max-h-48 object-cover" />
							{/if}
						</div>
					{/if}
					{#if uploadingMobile}
						<p class="text-sm text-blue-600 mt-1">Subiendo media móvil...</p>
					{/if}
				</div>

				{#if heroBanner.mobile_media_type === 'video'}
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">
							Imagen poster para carga rápida (opcional)
						</label>
						<p class="text-xs text-gray-500 mb-2">
							JPEG/WebP comprimido (~50-100 KB) que se muestra al instante en móvil mientras carga el
							video. Mejora el LCP en PageSpeed.
						</p>
						<input
							id="hero-mobile-poster-file"
							type="file"
							accept="image/jpeg,image/png,image/webp"
							onchange={handleMobilePosterFileSelect}
							class="w-full text-sm"
						/>
						{#if mobilePosterPreview}
							<div class="mt-2 rounded-lg overflow-hidden border max-h-48">
								<img
									src={mobilePosterPreview}
									alt="Preview poster LCP"
									class="w-full max-h-48 object-cover"
								/>
							</div>
						{/if}
						{#if uploadingMobilePoster}
							<p class="text-sm text-blue-600 mt-1">Subiendo poster LCP...</p>
						{/if}
					</div>
				{/if}

				<div>
					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={heroBanner.show_overlay_text}
							class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm font-medium text-gray-700">
							Mostrar título y subtítulo sobre el banner
						</span>
					</label>
					<p class="text-xs text-gray-500 mt-2">
						Desactiva esta opción para mostrar solo el video o imagen sin texto ni capa oscura encima.
					</p>
				</div>

				<div class:opacity-60={!heroBanner.show_overlay_text}>
					<label class="block text-sm font-medium text-gray-700 mb-1">
						Título
						{#if heroBanner.show_overlay_text}
							<span class="text-red-600">*</span>
						{/if}
					</label>
					<input
						type="text"
						bind:value={heroBanner.title}
						disabled={!heroBanner.show_overlay_text}
						placeholder={heroBanner.show_overlay_text ? '' : 'Opcional (accesibilidad)'}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
					/>
				</div>

				<div class:opacity-60={!heroBanner.show_overlay_text}>
					<label class="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
					<textarea
						bind:value={heroBanner.subtitle}
						disabled={!heroBanner.show_overlay_text}
						rows="2"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
					></textarea>
				</div>

				<div class="flex gap-3">
					<button
						type="button"
						onclick={saveHeroBanner}
						disabled={loading || saving}
						class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
					>
						{saving ? 'Guardando...' : 'Guardar banner'}
					</button>
					<button
						type="button"
						onclick={loadSettings}
						disabled={loading || saving}
						class="bg-gray-100 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-200 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed font-medium border border-gray-300"
					>
						Recargar
					</button>
				</div>
			</div>
		</div>

		<!-- Correos de aviso -->
		<div class="bg-white rounded-lg shadow-md p-6">
			<h2 class="text-xl font-bold mb-3">Correos de aviso por nueva venta</h2>
			<p class="text-sm text-gray-600 mb-4">
				Ingresa los correos internos que deben recibir el aviso de venta completada. Puedes separar por
				coma, punto y coma o salto de línea.
			</p>

			<textarea
				bind:value={emails}
				rows="8"
				placeholder="produccion@tuempresa.com&#10;ventas@tuempresa.com"
				class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
				disabled={loading || saving}
			></textarea>

			<div class="mt-4 flex gap-3">
				<button
					type="button"
					onclick={saveEmails}
					disabled={loading || saving}
					class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
				>
					{saving ? 'Guardando...' : 'Guardar correos'}
				</button>
				<button
					type="button"
					onclick={loadSettings}
					disabled={loading || saving}
					class="bg-gray-100 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-200 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed font-medium border border-gray-300"
				>
					Recargar
				</button>
			</div>
		</div>
	</div>
</div>
