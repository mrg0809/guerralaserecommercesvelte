<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import { userStore, canAccessAdmin, checkPermission } from '$lib/stores/user';
	import type { Permission } from '$lib/types/roles';

	let { children } = $props();
	let menuOpen = $state(false);
	let openDropdowns = $state<Record<string, boolean>>({});

	type MenuItem = {
		href?: string;
		label: string;
		icon: string;
		permission?: Permission;
		subItems?: Array<{
			href: string;
			label: string;
			permission?: Permission;
		}>;
	};

	// Menú reorganizado con estructura jerárquica
	const menuItems: MenuItem[] = [
		{ href: '/admin', label: 'Dashboard', icon: '🏠', permission: 'view_admin_panel' },
		{
			label: 'Productos',
			icon: '📦',
			permission: 'view_products',
			subItems: [
				{ href: '/admin/productos', label: 'Gestión de Productos', permission: 'view_products' },
				{ href: '/admin/categorias', label: 'Categorías', permission: 'view_categories' },
				{ href: '/admin/bundles', label: 'Bundles', permission: 'view_bundles' }
			]
		},
		{ href: '/admin/inventario', label: 'Inventario', icon: '📋', permission: 'view_inventory' },
		{
			label: 'Ventas',
			icon: '🛍️',
			permission: 'view_orders',
			subItems: [
				{ href: '/admin/pedidos', label: 'Gestión de Pedidos', permission: 'view_orders' },
				{ href: '/admin/cotizaciones', label: 'Cotizaciones', permission: 'view_admin_panel' },
				{ href: '/admin/cotizacion-chat', label: 'Cotización IA', permission: 'view_admin_panel' }
			]
		},
		{ href: '/admin/importar', label: 'Importar', icon: '📊', permission: 'create_products' },
		{
			label: 'Configuración',
			icon: '⚙️',
			permission: 'view_admin_panel',
			subItems: [
				{ href: '/admin/videos', label: 'Videos', permission: 'view_admin_panel' },
				{ href: '/admin/usuarios', label: 'Usuarios', permission: 'view_admin_panel' }
			]
		}
	];

	function toggleDropdown(label: string) {
		openDropdowns[label] = !openDropdowns[label];
	}

	let userState = $state({ initialized: false, loading: true });
	let hasValidSession = $state(false);
	let wasAuthenticated = $state(false);

	onMount(async () => {
		// Inicializar el store de usuario
		await userStore.init();

		// Verificar autenticación
		const {
			data: { session }
		} = await supabase.auth.getSession();

		if (!session) {
			console.log('🔍 Admin: No hay sesión, redirigiendo a login');
			goto('/login');
			return;
		}

		// Marcar que hay una sesión válida
		hasValidSession = true;
		console.log('🔍 Admin: Sesión válida detectada');

		// Suscribirse a cambios del store
		const unsubscribe = userStore.subscribe((state) => {
			userState = state;
			
			// Marcar que estuvo autenticado si tiene usuario
			if (state.user) {
				wasAuthenticated = true;
			}
			
			// Solo verificar permisos si:
			// 1. El store está inicializado
			// 2. No está cargando
			// 3. Hay una sesión válida de Supabase
			if (state.initialized && !state.loading && hasValidSession) {
				// Solo redirigir si nunca estuvo autenticado (no es un timeout temporal)
				if (!state.user && !wasAuthenticated) {
					console.log('🔍 Admin: Usuario nunca autenticado, redirigiendo a login');
					goto('/login');
				} else if (state.user && !state.permissions.includes('view_admin_panel')) {
					console.log('🔍 Admin: Usuario sin permisos de admin, redirigiendo a home');
					goto('/');
				}
			}
		});

		return () => {
			unsubscribe();
		};
	});

	// Filtrar menú según permisos
	const visibleMenuItems = $derived(menuItems.filter((item) => {
		if (!item.permission) return true;
		if (!userState.initialized || userState.loading) return false;
		const hasPermission = checkPermission(item.permission);
		
		// Si tiene subItems, filtrarlos también
		if (item.subItems) {
			const visibleSubItems = item.subItems.filter(subItem => {
				if (!subItem.permission) return true;
				return checkPermission(subItem.permission);
			});
			return hasPermission && visibleSubItems.length > 0;
		}
		
		return hasPermission;
	}));

	function getVisibleSubItems(item: MenuItem) {
		if (!item.subItems) return [];
		return item.subItems.filter(subItem => {
			if (!subItem.permission) return true;
			if (!userState.initialized || userState.loading) return false;
			return checkPermission(subItem.permission);
		});
	}

	function isActive(href: string) {
		return $page.url.pathname === href || 
		       ($page.url.pathname.startsWith(href) && href !== '/admin');
	}

	function isDropdownActive(item: MenuItem) {
		if (!item.subItems) return false;
		return item.subItems.some(subItem => isActive(subItem.href));
	}
</script>

<div class="min-h-screen bg-gray-100">
	<!-- Top Navigation Bar -->
	<nav class="bg-white shadow-md">
		<div class="container mx-auto px-4">
			<div class="flex items-center justify-between h-12">
				<!-- Logo/Brand -->
				<div class="flex items-center">
					<a href="/admin" class="flex items-center gap-2">
						<img src="/logorectangular.png" alt="Guerra Láser" class="h-8 w-auto" />
					</a>
				</div>

				<!-- Desktop Menu -->
				<div class="hidden md:flex items-center gap-1">
					{#each visibleMenuItems as item}
						{#if item.subItems}
							<!-- Dropdown Menu -->
							<div class="relative">
								<button
									onclick={() => toggleDropdown(item.label)}
									class="px-3 py-1.5 rounded-lg transition text-sm flex items-center gap-1 {isDropdownActive(item)
										? 'bg-blue-600 text-white'
										: 'text-gray-700 hover:bg-gray-100'}"
								>
									<span class="mr-1.5">{item.icon}</span>
									{item.label}
									<svg class="w-4 h-4 transition-transform {openDropdowns[item.label] ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								</button>
								{#if openDropdowns[item.label]}
									<div class="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border min-w-[200px] z-50">
										{#each getVisibleSubItems(item) as subItem}
											<a
												href={subItem.href}
												class="block px-4 py-2 text-sm transition {isActive(subItem.href)
													? 'bg-blue-50 text-blue-600'
													: 'text-gray-700 hover:bg-gray-50'}"
											>
												{subItem.label}
											</a>
										{/each}
									</div>
								{/if}
							</div>
						{:else}
							<!-- Regular Menu Item -->
							<a
								href={item.href}
								class="px-3 py-1.5 rounded-lg transition text-sm {isActive(item.href!)
									? 'bg-blue-600 text-white'
									: 'text-gray-700 hover:bg-gray-100'}"
							>
								<span class="mr-1.5">{item.icon}</span>
								{item.label}
							</a>
						{/if}
					{/each}
				</div>

				<!-- Right Side Actions -->
				<div class="flex items-center gap-2">
					<a
						href="/"
						target="_blank"
						class="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
					>
						<span>👁️</span>
						<span>Ver Tienda</span>
					</a>
					<button
						onclick={() => menuOpen = !menuOpen}
						class="md:hidden p-2 rounded-lg hover:bg-gray-100"
						aria-label="Toggle menu"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6h16M4 12h16M4 18h16"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	</nav>

	<!-- Mobile Menu -->
	{#if menuOpen}
		<div class="md:hidden bg-white border-t shadow-lg">
			<div class="container mx-auto px-4 py-4 space-y-2">
				{#each visibleMenuItems as item}
					{#if item.subItems}
						<!-- Mobile Dropdown -->
						<div>
							<button
								onclick={() => toggleDropdown(item.label)}
								class="flex items-center justify-between w-full px-4 py-3 rounded-lg transition {isDropdownActive(item)
									? 'bg-blue-600 text-white'
									: 'text-gray-700 hover:bg-gray-100'}"
							>
								<div class="flex items-center gap-3">
									<span class="text-xl">{item.icon}</span>
									<span class="font-medium">{item.label}</span>
								</div>
								<svg class="w-5 h-5 transition-transform {openDropdowns[item.label] ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</button>
							{#if openDropdowns[item.label]}
								<div class="ml-8 mt-2 space-y-1">
									{#each getVisibleSubItems(item) as subItem}
										<a
											href={subItem.href}
											onclick={() => menuOpen = false}
											class="block px-4 py-2 rounded-lg text-sm transition {isActive(subItem.href)
												? 'bg-blue-50 text-blue-600'
												: 'text-gray-600 hover:bg-gray-50'}"
										>
											{subItem.label}
										</a>
									{/each}
								</div>
							{/if}
						</div>
					{:else}
						<!-- Regular Mobile Item -->
						<a
							href={item.href}
							onclick={() => menuOpen = false}
							class="flex items-center gap-3 px-4 py-3 rounded-lg transition {isActive(item.href!)
								? 'bg-blue-600 text-white'
								: 'text-gray-700 hover:bg-gray-100'}"
						>
							<span class="text-xl">{item.icon}</span>
							<span class="font-medium">{item.label}</span>
						</a>
					{/if}
				{/each}
				<div class="border-t pt-2 mt-2">
					<a
						href="/"
						target="_blank"
						class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg"
					>
						<span class="text-xl">👁️</span>
						<span class="font-medium">Ver Tienda</span>
					</a>
				</div>
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	<main class="pt-2">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="bg-white border-t mt-12">
		<div class="container mx-auto px-4 py-6">
			<div class="text-center text-gray-600 text-sm">
				<p>Guerra Láser E-commerce Admin Panel</p>
			</div>
		</div>
	</footer>
</div>