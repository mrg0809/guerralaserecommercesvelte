<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import favicon from '$lib/assets/favicon.svg';
	import { cart } from '$lib/stores/cart';
	import { userStore } from '$lib/stores/user';
	import { supabase } from '$lib/supabaseClient';
	import { getDisplayPrice } from '$lib/utils';
	import { trackPageView, trackWhatsAppContact } from '$lib/gtag';
	import ReauthModal from '$lib/components/ReauthModal.svelte';
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import LazyGoogleMap from '$lib/components/LazyGoogleMap.svelte';
	import MetaPixel from '$lib/components/MetaPixel.svelte';
	import { isNativeCapacitorApp } from '$lib/mobile/appShell';
	import type { Category } from '$lib/types';
	import '../app.css';
	
	// Inicializar Vercel Analytics
	injectAnalytics();

	let { children } = $props();

	let cartItemCount = $state(0);
	let categories: Category[] = $state([]);
	let showSearch = $state(false);
	let searchQuery = $state('');
let searchResults = $state<any[]>([]);
let searchTimeout: NodeJS.Timeout;
let currentPath = $state('/');
let isAdminRoute = $state(false);
let isStandaloneApp = $state(false);

const showPublicSiteChrome = $derived(!isAdminRoute && !isStandaloneApp);
	
// Detectar cambios de ruta y rastrear con Google Analytics
page.subscribe(($page) => {
	currentPath = $page.url.pathname;
	isAdminRoute = currentPath.startsWith('/admin');
	isStandaloneApp = currentPath.startsWith('/mobile');
	if (!isStandaloneApp) {
		trackPageView(currentPath);
	}
});
	
	cart.subscribe((items) => {
		cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
	});

	onMount(async () => {
		if (isNativeCapacitorApp()) {
			isStandaloneApp = true;
		}

		// Inicializar store de usuario si hay sesión
		const {
			data: { session }
		} = await supabase.auth.getSession();
		
		if (session?.user) {
			await userStore.init();
		}
		
		// Load categories for navigation
		const { data: cats } = await supabase
			.from('categories')
			.select('id, name, slug, parent_id, display_order, is_active')
			.eq('is_active', true)
			.order('display_order');

		if (cats) {
			categories = cats;
		}
		
		// Escuchar cambios de autenticación
		supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('🔍 Auth state change:', event);
			
			// Solo recargar en cambios reales, no en refresh de token
			if (event === 'SIGNED_IN' && session?.user) {
				await userStore.setUser(session.user);
			} else if (event === 'SIGNED_OUT') {
				userStore.logout();
			} else if (event === 'TOKEN_REFRESHED') {
				// No hacer nada en refresh de token, mantener estado actual
				console.log('🔍 Token refreshed, manteniendo estado actual');
			}
		});
	});

	onMount(() => {
		if (isStandaloneApp) return;

		ensureWhatsAppAudio();

		const primeSound = () => {
			prepareWhatsAppSound();
			if (waSoundEnabled) {
				window.removeEventListener('pointerdown', primeSound);
				window.removeEventListener('keydown', primeSound);
			}
		};

		window.addEventListener('pointerdown', primeSound, { passive: true });
		window.addEventListener('keydown', primeSound);
		waRevealTimeout = window.setTimeout(revealWhatsAppButton, WA_APPEAR_DELAY_MS);

		return () => {
			window.removeEventListener('pointerdown', primeSound);
			window.removeEventListener('keydown', primeSound);
			if (waRevealTimeout) {
				clearTimeout(waRevealTimeout);
			}
		};
	});

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

	function toggleSearch() {
		showSearch = !showSearch;
		if (!showSearch) {
			searchQuery = '';
			searchResults = [];
		}
	}

	async function handleSearch() {
		if (searchTimeout) clearTimeout(searchTimeout);
		
		if (searchQuery.trim().length < 3) {
			searchResults = [];
			return;
		}

		searchTimeout = setTimeout(async () => {
			const { data } = await supabase
				.from('products')
				.select('id, name, slug, base_price')
				.eq('is_active', true)
				.ilike('name', `%${searchQuery}%`)
				.limit(5);

			if (data) {
				searchResults = data;
			}
		}, 300);
	}

	// Floating WhatsApp widget state and handlers
	let showWA = $state(false);
	let showWAButton = $state(false);
	let waMessage = $state('Hola 👋 me interesa más información sobre sus productos.');
	const WA_APPEAR_DELAY_MS = 2200;
	const WA_SOUND_SRC = '/sounds/whatsapp-float-chime.wav';
	const WA_AUTO_OPEN_KEY = 'wa_product_chat_opened';
	let waRevealTimeout: number | undefined;
	let waNotificationAudio: HTMLAudioElement | null = null;
	let waSoundEnabled = false;
	let waSoundPlayed = false;

	function ensureWhatsAppAudio() {
		if (typeof window === 'undefined' || waNotificationAudio) {
			return;
		}

		waNotificationAudio = new Audio(WA_SOUND_SRC);
		waNotificationAudio.preload = 'auto';
		waNotificationAudio.volume = 0.42;
		waNotificationAudio.setAttribute('playsinline', 'true');
		waNotificationAudio.load();
	}

	function prepareWhatsAppSound() {
		if (typeof window === 'undefined') {
			return;
		}

		ensureWhatsAppAudio();
		waSoundEnabled = true;
	}

	async function playWhatsAppSound() {
		if (!waSoundEnabled || waSoundPlayed) {
			return;
		}

		ensureWhatsAppAudio();

		if (!waNotificationAudio) {
			return;
		}

		try {
			waNotificationAudio.currentTime = 0;
			await waNotificationAudio.play();
			waSoundPlayed = true;
		} catch {
			// Algunos navegadores bloquean autoplay hasta la primera interacción del usuario.
		}
	}

	// Abre el chat automáticamente una sola vez por sesión al entrar a un producto
	function tryAutoOpenWAOnProduct() {
		if (!showWAButton || showWA) {
			return;
		}
		if (!currentPath.match(/^\/productos\/[^/?#]+/)) {
			return;
		}
		if (sessionStorage.getItem(WA_AUTO_OPEN_KEY)) {
			return;
		}
		sessionStorage.setItem(WA_AUTO_OPEN_KEY, '1');
		showWA = true;
	}

	// $effect sólo corre en el navegador (no en SSR), reacciona a cambios de ruta
	$effect(() => {
		const _path = currentPath;
		tryAutoOpenWAOnProduct();
	});

	function revealWhatsAppButton() {
		showWAButton = true;
		void playWhatsAppSound();
		// Pequeña pausa para que termine la animación de entrada del botón
		window.setTimeout(tryAutoOpenWAOnProduct, 900);
	}

	function toggleWA() {
		showWA = !showWA;
	}

	function sendWhatsApp() {
		const phone = '523334758653'; // +52 33 3475 8653
		const base = waMessage.trim() || 'Hola 👋 me interesa más información.';
		let context = '';
		if (typeof window !== 'undefined') {
			const title = typeof document !== 'undefined' ? document.title : 'Guerra Láser';
			const path = window.location?.pathname ?? '/';
			const productMatch = path.match(/^\/productos\/([^\/?#]+)/);
			if (productMatch && productMatch[1]) {
				const slug = productMatch[1];
				const fullUrl = `https://guerralaser.com/productos/${slug}`;
				context = `\n\n— Enviado desde: ${title}\nSección: Producto\nRuta: ${fullUrl}`;
			} else {
				const fullUrl = `https://guerralaser.com${path}`;
				context = `\n\n— Enviado desde: ${title}\nRuta: ${fullUrl}`;
			}
		}
		const fullText = `${base}${context}`;
		const url = `https://wa.me/${phone}?text=${encodeURIComponent(fullText)}`;
		
		// Rastrear evento de contacto por WhatsApp
		trackWhatsAppContact(context || 'chat_flotante');
		
		if (typeof window !== 'undefined') {
			window.open(url, '_blank', 'noopener,noreferrer');
		}
		showWA = false;
	}

	// Mobile menu state and handlers
	let showMobileMenu = $state(false);
	function toggleMobileMenu() {
		showMobileMenu = !showMobileMenu;
	}

	// Mobile drawer accordion state
	let openRoots = $state<Record<string, boolean>>({});
	let openChildren = $state<Record<string, boolean>>({});

	function toggleRoot(id: string) {
		openRoots[id] = !openRoots[id];
		if (!openRoots[id]) {
			// collapse children when root closes
			for (const child of getChildCategories(id)) {
				delete openChildren[child.id];
			}
		}
	}

	function toggleChild(id: string) {
		openChildren[id] = !openChildren[id];
	}

	/** Listas largas (p. ej. Refacciones): panel ancho + varias columnas (sin scroll en el menú) */
	const ROOT_COLS_2_MIN = 8;
	const ROOT_COLS_3_MIN = 18;

	function rootSubmenuClass(count: number, slug: string): string {
		const slugLower = slug.toLowerCase();
		const forceWide =
			slugLower === 'refacciones' ||
			slugLower.includes('refaccion') ||
			count >= ROOT_COLS_2_MIN;
		if (count >= ROOT_COLS_3_MIN) return 'submenu-root-mega submenu-root-cols-3';
		if (forceWide) return 'submenu-root-mega submenu-root-cols-2';
		return '';
	}

	function positionSubmenu(event: MouseEvent) {
		if (typeof window === 'undefined') return;

		const menuItem = event.currentTarget as HTMLElement | null;
		if (!menuItem) return;

		const submenu = menuItem.querySelector(':scope > .js-submenu') as HTMLElement | null;
		if (!submenu) return;

		menuItem.classList.remove('open-left');

		const viewportPadding = 8;
		const initialRect = submenu.getBoundingClientRect();
		if (initialRect.right > window.innerWidth - viewportPadding) {
			menuItem.classList.add('open-left');
		}

		const adjustedRect = submenu.getBoundingClientRect();
		if (adjustedRect.left < viewportPadding && menuItem.classList.contains('open-left')) {
			menuItem.classList.remove('open-left');
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen flex flex-col {showPublicSiteChrome ? 'pt-20' : ''} {isStandaloneApp ? 'assistant-standalone-shell' : ''}">
	{#if showPublicSiteChrome}
	<header class="fixed top-0 left-0 right-0 bg-white shadow-md border-b-2 border-red-600 z-50">
		<nav class="w-full py-4">
			<div class="flex items-center px-4 justify-between">
				<!-- Logo (Left) - Esquina superior izquierda -->
				<div class="flex-shrink-0 min-w-fit">
					<a href="/" class="flex items-center hover:opacity-90 transition-opacity">
						<img src="/logorectangular.png" alt="Guerra Láser" width="149" height="112" class="h-16" />
					</a>
				</div>

				<!-- Category Navigation (Center) Desktop with dropdowns -->
				<div class="hidden md:flex items-center gap-1 flex-1 justify-center px-4">
					{#each getRootCategories() as rootCategory}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="relative group menu-item" onmouseenter={positionSubmenu}>
							<a
								href="/categorias/{rootCategory.slug}"
								class="px-3 py-2 font-semibold text-gray-700 hover:text-white hover:bg-red-600 transition-all rounded-md whitespace-nowrap text-sm flex items-center gap-1.5"
							>
								{rootCategory.name}
								{#if getChildCategories(rootCategory.id).length > 0}
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								{/if}
							</a>

							{#if getChildCategories(rootCategory.id).length > 0}
								{@const rootKids = getChildCategories(rootCategory.id)}
								<div
									class="js-submenu submenu-root absolute left-0 mt-1 bg-white rounded-lg shadow-2xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 {rootSubmenuClass(
										rootKids.length,
										rootCategory.slug
									) || 'w-64'}"
								>
									<div class="nav-submenu-list py-2">
										{#each rootKids as level2Cat}
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div class="relative group/level2 menu-item" onmouseenter={positionSubmenu}>
												<a
													href="/categorias/{level2Cat.slug}"
													class="block px-4 py-2.5 text-gray-700 hover:bg-red-50 hover:text-red-600 transition flex justify-between items-center"
												>
													<span class="font-medium">{level2Cat.name}</span>
													{#if getChildCategories(level2Cat.id).length > 0}
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
														</svg>
													{/if}
												</a>

												{#if getChildCategories(level2Cat.id).length > 0}
													<div class="js-submenu submenu-nested absolute left-full top-0 ml-1 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 opacity-0 invisible group-hover/level2:opacity-100 group-hover/level2:visible transition-all duration-200">
														<div class="py-2">
															{#each getChildCategories(level2Cat.id) as level3Cat}
																<!-- svelte-ignore a11y_no_static_element_interactions -->
																<div class="relative group/level3 menu-item" onmouseenter={positionSubmenu}>
																	<a
																		href="/categorias/{level3Cat.slug}"
																		class="block px-4 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition flex justify-between items-center"
																	>
																		<span>{level3Cat.name}</span>
																		{#if getChildCategories(level3Cat.id).length > 0}
																			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
																			</svg>
																		{/if}
																	</a>

																	{#if getChildCategories(level3Cat.id).length > 0}
																		<div class="js-submenu submenu-nested absolute left-full top-0 ml-1 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 opacity-0 invisible group-hover/level3:opacity-100 group-hover/level3:visible transition-all duration-200">
																			<div class="py-2">
																				{#each getChildCategories(level3Cat.id) as level4Cat}
																					<a
																						href="/categorias/{level4Cat.slug}"
																						class="block px-4 py-2.5 text-gray-700 hover:bg-red-50 hover:text-red-700 transition"
																					>
																						{level4Cat.name}
																					</a>
																			{/each}
																		</div>
																	</div>
																{/if}
															</div>
														{/each}
													</div>
												</div>
											{/if}
										</div>
									{/each}
									</div>
							</div>
						{/if}
					</div>
					{/each}
				</div>

				<button onclick={toggleMobileMenu} class="md:hidden p-2 rounded-lg hover:bg-gray-100 text-blue-900" aria-label="Abrir menú" title="Menú">
					<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>

				<!-- Search and Cart Icons (Right) - Esquina superior derecha -->
				<div class="flex items-center gap-2 flex-shrink-0 min-w-fit">
					<!-- Search Icon -->
					<button
						onclick={toggleSearch}
						class="relative hover:text-red-600 transition-colors text-blue-900 group"
						aria-label="Buscar productos"
					>
						<div class="p-2 hover:bg-red-50 rounded-lg transition-colors">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						</div>
					</button>

					<!-- Cart Icon -->
					<a href="/carrito" class="relative hover:text-red-600 transition-colors text-blue-900 group" aria-label="Ver carrito de compras">
						<div class="p-2 hover:bg-red-50 rounded-lg transition-colors">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
							</svg>
							{#if cartItemCount > 0}
								<span
									class="absolute top-0 right-0 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg"
								>
									{cartItemCount}
								</span>
							{/if}
						</div>
					</a>
				</div>
			</div>
		</nav>

		<!-- Mobile menu drawer -->
		{#if showMobileMenu}
			<div class="md:hidden fixed inset-0 z-50">
				<button
					type="button"
					class="absolute inset-0 bg-black/30"
					onclick={() => (showMobileMenu = false)}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							showMobileMenu = false;
						}
					}}
					aria-label="Cerrar menú móvil"
					tabindex="0"
				></button>
				<div class="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl border-r border-gray-200">
					<div class="flex items-center justify-between px-4 py-3 border-b">
						<div class="flex items-center gap-2">
							<img src="/logorectangular.png" alt="Guerra Láser" width="43" height="32" class="h-8" />
							<span class="font-bold">Categorías</span>
						</div>
						<button class="p-2 rounded hover:bg-gray-100" onclick={() => (showMobileMenu = false)} aria-label="Cerrar">
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="px-2 py-2 overflow-y-auto h-full">
						<ul class="space-y-1">
							{#each getRootCategories() as root}
								<li class="border border-gray-100 rounded-md">
									<div class="flex items-center justify-between px-3 py-2">
										<a href="/categorias/{root.slug}" class="font-medium hover:text-red-600">{root.name}</a>
										{#if getChildCategories(root.id).length > 0}
											<button
												onclick={() => toggleRoot(root.id)}
												class="p-1 rounded hover:bg-gray-100"
												aria-label="Mostrar subcategorías"
											>
												<svg class={`w-4 h-4 transition-transform ${openRoots[root.id] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
												</svg>
											</button>
										{/if}
									</div>

									{#if getChildCategories(root.id).length > 0 && openRoots[root.id]}
										<ul class="pl-4 pr-2 pb-2 space-y-1">
											{#each getChildCategories(root.id) as child}
												<li class="border-l border-gray-100 pl-3">
													<div class="flex items-center justify-between">
														<a href="/categorias/{child.slug}" class="block py-1 text-sm hover:text-red-600">{child.name}</a>
														{#if getChildCategories(child.id).length > 0}
															<button
																onclick={() => toggleChild(child.id)}
																class="p-1 rounded hover:bg-gray-100"
																aria-label="Mostrar subcategorías"
															>
																<svg class={`w-4 h-4 transition-transform ${openChildren[child.id] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
																</svg>
															</button>
														{/if}
													</div>

													{#if getChildCategories(child.id).length > 0 && openChildren[child.id]}
														<ul class="pl-3 pr-1 pb-1 space-y-1">
															{#each getChildCategories(child.id) as grand}
																<li>
																	<a href="/categorias/{grand.slug}" class="block py-1 text-sm hover:text-red-600">{grand.name}</a>
																</li>
															{/each}
														</ul>
													{/if}
												</li>
											{/each}
										</ul>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		{/if}

		<!-- Search Bar -->
		{#if showSearch}
			<div class="bg-white border-t border-gray-200 shadow-lg">
				<div class="container mx-auto px-4 py-4">
					<div class="relative">
						<input
							type="text"
							bind:value={searchQuery}
							oninput={handleSearch}
							placeholder="Buscar productos..."
							class="w-full px-4 py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
						/>
						<svg class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>

						<!-- Search Results -->
						{#if searchResults.length > 0}
							<div class="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
							{#each searchResults as product}
								{@const displayPrice = getDisplayPrice(product)}
								<a
									href="/productos/{product.slug}"
									class="block px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
									onclick={() => { showSearch = false; searchQuery = ''; searchResults = []; }}
								>
									<p class="font-semibold text-gray-900">{product.name}</p>
									{#if product.short_description}
										<p class="text-sm text-gray-600 mt-1">{product.short_description}</p>
									{/if}
									<p class="text-sm text-red-600 font-bold mt-1">
										{#if displayPrice.hasVariants}<span class="text-xs">Desde</span> {/if}
										${displayPrice.price.toLocaleString('es-MX')}
									</p>
								</a>
							{/each}
							</div>
						{:else if searchQuery.length >= 2}
							<div class="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-4">
								<p class="text-gray-600 text-center">No se encontraron productos</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</header>
	{/if}

	<main class="flex-grow {isStandaloneApp ? 'assistant-standalone-shell' : ''}">
		{@render children()}
	</main>

	<!-- Sección de Ubicación y Horarios - Solo en página de inicio -->
	{#if !isAdminRoute && !isStandaloneApp && currentPath === '/'}
	<section id="visitanos" class="bg-gradient-to-br from-blue-50 to-indigo-50 py-16">
		<div class="container mx-auto px-4">
			<div class="text-center mb-12">
				<h2 class="text-4xl font-bold text-gray-900 mb-3">Visítanos</h2>
				<p class="text-lg text-gray-600">Conoce nuestra ubicación y horarios de atención</p>
			</div>

			<div class="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
				<!-- Mapa -->
				<div class="rounded-2xl overflow-hidden shadow-2xl h-[400px] bg-white">
					<LazyGoogleMap
						src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3732.8!2d-103.4539846724633!3d20.658089643947697!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjDCsDM5JzI5LjEiTiAxMDPCsDI3JzE0LjMiVw!5e0!3m2!1ses!2smx!4v1234567890"
						title="Ubicación Guerra Láser"
					/>
				</div>

				<!-- Información de Contacto y Horarios -->
				<div class="space-y-6">
					<!-- Horarios -->
					<div class="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
						<div class="flex items-center gap-3 mb-6">
							<div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
								<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<h3 class="text-2xl font-bold text-gray-900">Horarios de Atención</h3>
						</div>
						
						<div class="space-y-4">
							<div class="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
								<span class="text-lg font-semibold text-gray-700">Lunes - Viernes</span>
								<span class="text-lg font-bold text-blue-600">9:00 - 17:30</span>
							</div>
							<div class="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
								<span class="text-lg font-semibold text-gray-700">Sábados</span>
								<span class="text-lg font-bold text-purple-600">9:00 - 14:00</span>
							</div>
						</div>
					</div>

					<!-- Dirección -->
					<div class="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
						<div class="flex items-start gap-3">
							<div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
								<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							</div>
							<div>
								<h3 class="text-xl font-bold text-gray-900 mb-2">Ubicación</h3>
								<p class="text-gray-600 leading-relaxed">Guadalajara, Jalisco, México</p>
								<a
									href="https://www.google.com/maps?q=20.658089643947697,-103.4539846724633"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
								>
									<span>Ver en Google Maps</span>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
									</svg>
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
	{/if}

	{#if showPublicSiteChrome}
	<footer class="bg-gray-800 text-white py-8">
		<div class="container mx-auto px-4">
			<div class="grid grid-cols-1 md:grid-cols-5 gap-8">
				<div>
					<img src="/logorectangular.png" alt="Guerra Láser" width="64" height="48" class="h-12 mb-4" />
					<p class="text-gray-400">Máquinas de corte y grabado láser de alta precisión</p>
				</div>
				<div>
					<h4 class="font-bold mb-4 text-red-500">Navegación</h4>
					<ul class="space-y-2 text-gray-400">
						<li><a href="/" class="hover:text-red-500 transition-colors">Inicio</a></li>
						<li><a href="/productos" class="hover:text-red-500 transition-colors">Productos</a></li>
						<li><a href="/categorias" class="hover:text-red-500 transition-colors">Categorías</a></li>
						<li><a href="/admin" class="hover:text-red-500 transition-colors">Admin</a></li>
					</ul>
				</div>
				<div>
					<h4 class="font-bold mb-4 text-red-500">Políticas</h4>
					<ul class="space-y-2 text-gray-400">
						<li><a href="/privacidad" class="hover:text-red-500 transition-colors">Aviso de Privacidad</a></li>
						<li><a href="/politica-envios" class="hover:text-red-500 transition-colors">Política de Envíos</a></li>
						<li><a href="/politica-devoluciones" class="hover:text-red-500 transition-colors">Cambios y Devoluciones</a></li>
						<li><a href="/terminos" class="hover:text-red-500 transition-colors">Términos y Condiciones</a></li>
					</ul>
				</div>
				<div>
					<h4 class="font-bold mb-4 text-red-500">Contacto</h4>
					<ul class="space-y-2 text-gray-400">
						<li class="flex items-start gap-2">
							<svg class="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
							<a href="mailto:mundolasergdl@gmail.com" class="hover:text-red-500 transition-colors">mundolasergdl@gmail.com</a>
						</li>
						<li class="flex items-start gap-2">
							<svg class="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
							</svg>
							<div class="flex flex-col">
								<a href="tel:+523320152372" class="hover:text-red-500 transition-colors">Tel: 33 2015 2372</a>
								<a href="tel:+523334758653" class="hover:text-red-500 transition-colors">Cel: 33 3475 8653</a>
								<a href="tel:+523318640008" class="hover:text-red-500 transition-colors">Cel: 33 1864 0008</a>
							</div>
						</li>
						<li class="flex items-start gap-2">
							<svg class="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							<span>Av. Las Torres 5301, Col. Glorias del Colli, Zapopan, Jalisco CP 45010</span>
						</li>
					</ul>
				</div>
				<div>
					<h4 class="font-bold mb-4 text-red-500">Síguenos</h4>
					<div class="flex gap-4 mb-8">
						<a
							href="https://www.facebook.com/GuerraLaserGdl/?locale=es_LA"
							target="_blank"
							rel="noopener noreferrer"
							class="text-gray-400 hover:text-red-500 transition-colors"
							aria-label="Facebook"
							title="Facebook"
						>
							<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
								<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
							</svg>
						</a>
						<a
							href="https://www.instagram.com/guerralaser/"
							target="_blank"
							rel="noopener noreferrer"
							class="text-gray-400 hover:text-red-500 transition-colors"
							aria-label="Instagram"
							title="Instagram"
						>
							<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
							</svg>
						</a>
						<a
							href="https://www.tiktok.com/@guerralaser"
							target="_blank"
							rel="noopener noreferrer"
							class="text-gray-400 hover:text-red-500 transition-colors"
							aria-label="TikTok"
							title="TikTok"
						>
							<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
							</svg>
						</a>
						<a
							href="https://www.youtube.com/channel/UCajYffPPUYvVkfh0MUoBGhQ"
							target="_blank"
							rel="noopener noreferrer"
							class="text-gray-400 hover:text-red-500 transition-colors"
							aria-label="YouTube"
							title="YouTube"
						>
							<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
								<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
							</svg>
						</a>
						<a
							href="https://wa.me/523334758653"
							target="_blank"
							rel="noopener noreferrer"
							class="text-gray-400 hover:text-green-500 transition-colors"
							aria-label="WhatsApp"
							title="WhatsApp"
						>
							<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
								<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
							</svg>
						</a>
					</div>
					<h4 class="font-bold mb-4 text-red-500">Métodos de Pago</h4>
					<div class="space-y-3">
						<p class="text-xs text-gray-400 mb-3">Procesados por <strong>Stripe</strong></p>
						<div class="flex gap-2">
							<!-- Visa -->
							<div class="bg-gray-700 rounded p-1.5 flex items-center justify-center w-12 h-8 hover:bg-gray-600 transition-colors" title="Visa">
								<svg class="w-8 h-5" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
									<rect width="48" height="32" rx="2" fill="#1434CB"/>
									<text x="24" y="20" font-size="9" fill="white" text-anchor="middle" font-weight="bold">VISA</text>
								</svg>
							</div>
							<!-- Mastercard -->
							<div class="bg-gray-700 rounded p-1.5 flex items-center justify-center w-12 h-8 hover:bg-gray-600 transition-colors" title="Mastercard">
								<svg class="w-8 h-5" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
									<rect width="48" height="32" rx="2" fill="#262626"/>
									<circle cx="17" cy="16" r="7" fill="#EB001B"/>
									<circle cx="31" cy="16" r="7" fill="#F79E1B"/>
									<ellipse cx="24" cy="16" rx="5" ry="7" fill="none" stroke="white" stroke-width="0.5"/>
								</svg>
							</div>
							<!-- American Express -->
							<div class="bg-gray-700 rounded p-1.5 flex items-center justify-center w-12 h-8 hover:bg-gray-600 transition-colors" title="American Express">
								<svg class="w-8 h-5" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
									<rect width="48" height="32" rx="2" fill="#006FCF"/>
									<text x="24" y="20" font-size="7" fill="white" text-anchor="middle" font-weight="bold">AMEX</text>
								</svg>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="mt-8 pt-8 border-t border-gray-700 text-center text-gray-400">
				© 2026 Guerra Láser marca operada por Luis Enrique Guerra Zavala
			</div>
		</div>
	</footer>
	{/if}

    <!-- Floating WhatsApp Chat -->
    {#if showPublicSiteChrome}
	<div
		class="fixed bottom-5 right-5 z-50 transition-all duration-500 sm:bottom-6 sm:right-6"
		class:opacity-0={!showWAButton}
		class:pointer-events-none={!showWAButton}
		class:translate-y-6={!showWAButton}
		class:opacity-100={showWAButton}
		class:pointer-events-auto={showWAButton}
		class:translate-y-0={showWAButton}
	>
    	{#if showWA}
    		<div class="mb-3 w-80 max-w-[92vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
    			<div class="flex items-center gap-2 px-4 py-3 bg-green-500 text-white">
    				<img src="/logorectangular.png" alt="Guerra Láser" width="32" height="24" class="h-6 w-auto bg-white rounded-sm px-1 py-0.5" />
    				<div class="font-semibold">Guerra Láser</div>
    				<button
    					class="ml-auto hover:opacity-80"
    					onclick={() => (showWA = false)}
    					aria-label="Cerrar chat"
    					title="Cerrar"
    				>
    					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    					</svg>
    				</button>
    			</div>

    			<div class="px-4 pt-3 pb-2 text-sm text-gray-700">
    				Hola 👋 ¿Cómo podemos ayudarte? Cuéntanos de qué producto necesitas más información.
    			</div>

    			<div class="px-4 pb-4">
    				<textarea
    					bind:value={waMessage}
    					rows="3"
    					placeholder="Escribe tu mensaje..."
    					class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
    				></textarea>

    				<button
    					onclick={sendWhatsApp}
    					class="mt-3 w-full bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
    				>
    					Enviar por WhatsApp
    				</button>
    			</div>
    		</div>
    	{/if}

    	<button
    		onclick={toggleWA}
	    		class="whatsapp-float-button relative flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full bg-[linear-gradient(145deg,#25d366_0%,#22c55e_50%,#128c48_100%)] text-white shadow-xl transition-all duration-300 hover:scale-[1.07] sm:h-[5.5rem] sm:w-[5.5rem]"
    		aria-label="Abrir chat de WhatsApp"
    		title="Chatea por WhatsApp"
    	>
	    		<span class="whatsapp-float-ring" aria-hidden="true"></span>
	    		<svg class="relative z-10 h-11 w-11 drop-shadow-[0_2px_4px_rgba(0,0,0,0.18)] sm:h-[3rem] sm:w-[3rem]" viewBox="0 0 24 24" fill="currentColor">
    			<path
    				d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"
    			/>
    		</svg>
		</button>
	</div>
    {/if}
</div>

    <!-- Modal de Reautenticación -->
    {#if !isStandaloneApp}
    <ReauthModal 
        show={$userStore.sessionExpired}
        onReauth={() => {
            console.log('🔍 Reautenticación completada, recargando página...');
			window.location.reload();
        }}
        onsuccess={(data) => {
			userStore.handleReauthSuccess(data.session, data.user);
		}}
        onlogout={() => {
			window.location.href = '/login';
		}}
    />
    {/if}

    <!-- Meta Pixel -->
    {#if showPublicSiteChrome}
    	<MetaPixel />
    {/if}

    <!-- Banner de Cookies -->
    {#if showPublicSiteChrome}
    	<CookieBanner />
    {/if}
