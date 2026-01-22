<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import { userStore, canAccessAdmin, checkPermission } from '$lib/stores/user';
	import type { Permission } from '$lib/types/roles';

	let { children } = $props();
	let menuOpen = $state(false);

	// Menú con permisos requeridos
	const menuItems: Array<{
		href: string;
		label: string;
		icon: string;
		permission?: Permission;
	}> = [
		{ href: '/admin', label: 'Dashboard', icon: '🏠', permission: 'view_admin_panel' },
		{ href: '/admin/productos', label: 'Productos', icon: '📦', permission: 'view_products' },
		{ href: '/admin/categorias', label: 'Categorías', icon: '🏷️', permission: 'view_categories' },
		{ href: '/admin/bundles', label: 'Bundles', icon: '🎁', permission: 'view_bundles' },
		{ href: '/admin/pedidos', label: 'Pedidos', icon: '🛍️', permission: 'view_orders' },
		{ href: '/admin/inventario', label: 'Inventario', icon: '📋', permission: 'view_inventory' },
		{ href: '/admin/importar', label: 'Importar', icon: '📊', permission: 'create_products' },
		{ href: '/admin/videos', label: 'Videos', icon: '🎥', permission: 'view_admin_panel' },
		{ href: '/admin/usuarios', label: 'Usuarios', icon: '👥', permission: 'view_admin_panel' }
	];

	let userState = $state({ initialized: false, loading: true });

	onMount(async () => {
		// Inicializar el store de usuario
		await userStore.init();

		// Verificar autenticación
		const {
			data: { session }
		} = await supabase.auth.getSession();

		if (!session) {
			goto('/login');
			return;
		}

		// Suscribirse a cambios del store
		const unsubscribe = userStore.subscribe((state) => {
			userState = state;
			
			// Verificar permisos cuando el store esté inicializado
			if (state.initialized && !state.loading) {
				if (!state.user) {
					goto('/login');
				} else if (!state.permissions.includes('view_admin_panel')) {
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
		return checkPermission(item.permission);
	}));

	function isActive(href: string) {
		return $page.url.pathname === href || 
		       ($page.url.pathname.startsWith(href) && href !== '/admin');
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
						<a
							href={item.href}
							class="px-3 py-1.5 rounded-lg transition text-sm {isActive(item.href)
								? 'bg-blue-600 text-white'
								: 'text-gray-700 hover:bg-gray-100'}"
						>
							<span class="mr-1.5">{item.icon}</span>
							{item.label}
						</a>
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
					<a
						href={item.href}
						onclick={() => menuOpen = false}
						class="flex items-center gap-3 px-4 py-3 rounded-lg transition {isActive(item.href)
							? 'bg-blue-600 text-white'
							: 'text-gray-700 hover:bg-gray-100'}"
					>
						<span class="text-xl">{item.icon}</span>
						<span class="font-medium">{item.label}</span>
					</a>
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