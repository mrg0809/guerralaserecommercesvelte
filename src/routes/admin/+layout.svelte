<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { userStore, checkPermission } from '$lib/stores/user';
	import type { Permission } from '$lib/types/roles';

	let { children } = $props();
	let menuOpen = $state(false);
	let openDropdowns = $state<Record<string, boolean>>({});

	type ThirdMenuItem = {
		href: string;
		label: string;
		icon?: string;
		permission?: Permission;
	};

	type SecondMenuItem =
		| {
				kind: 'link';
				href: string;
				label: string;
				icon?: string;
				permission?: Permission;
		  }
		| {
				kind: 'flyout';
				label: string;
				icon?: string;
				permission?: Permission;
				items: ThirdMenuItem[];
		  };

	type TopMenuItem =
		| {
				kind: 'link';
				href: string;
				label: string;
				icon: string;
				permission?: Permission;
				/** Solo icono en la barra (p. ej. Dashboard); label sirve para accesibilidad */
				iconOnly?: boolean;
		  }
		| {
				kind: 'dropdown';
				label: string;
				icon: string;
				permission?: Permission;
				subItems: SecondMenuItem[];
				iconOnly?: boolean;
		  };

	const menuItems: TopMenuItem[] = [
		{
			kind: 'link',
			href: '/admin',
			label: 'Dashboard',
			icon: '🏠',
			permission: 'view_admin_panel',
			iconOnly: true
		},
		{
			kind: 'dropdown',
			label: 'Catálogo',
			icon: '📚',
			subItems: [
				{
					kind: 'link',
					href: '/admin/bundles',
					label: 'Bundles / Paquetes',
					icon: '🔀',
					permission: 'view_bundles'
				},
				{
					kind: 'link',
					href: '/admin/categorias',
					label: 'Categorías',
					icon: '📁',
					permission: 'view_categories'
				},
				{
					kind: 'link',
					href: '/admin/productos',
					label: 'Gestión de Productos',
					icon: '⚙️',
					permission: 'view_products'
				},
				{
					kind: 'link',
					href: '/admin/importar',
					label: 'Importar Productos',
					icon: '📥',
					permission: 'create_products'
				},
				{
					kind: 'link',
					href: '/admin/promociones',
					label: 'Promociones',
					icon: '🏷️',
					permission: 'view_admin_panel'
				}
			]
		},
		{
			kind: 'dropdown',
			label: 'Comercial',
			icon: '🛒',
			subItems: [
				{
					kind: 'link',
					href: '/admin/clientes',
					label: 'Clientes',
					icon: '👥',
					permission: 'view_customers'
				},
				{
					kind: 'flyout',
					label: 'Cotizaciones',
					icon: '📄',
					permission: 'view_admin_panel',
					items: [
						{
							href: '/admin/cotizaciones/historial',
							label: 'Guardadas',
							icon: '📋',
							permission: 'view_quotations'
						},
						{
							href: '/admin/asistente',
							label: 'Asistente IA',
							icon: '🤖',
							permission: 'use_ai_assistant'
						},
						{
							href: '/admin/cotizacion-chat',
							label: 'Cotiz. IA (legacy)',
							icon: '📱',
							permission: 'view_admin_panel'
						},
						{
							href: '/admin/cotizaciones',
							label: 'Manuales',
							icon: '📝',
							permission: 'view_admin_panel'
						}
					]
				},
				{
					kind: 'link',
					href: '/admin/pedidos',
					label: 'Gestión de Pedidos',
					icon: '📦',
					permission: 'view_orders'
				},
				{
					kind: 'link',
					href: '/admin/punto-venta',
					label: 'POS',
					icon: '🔑',
					permission: 'manage_inventory'
				},
				{
					kind: 'link',
					href: '/admin/pos-reportes',
					label: 'Reportes POS',
					icon: '📊',
					permission: 'manage_inventory'
				}
			]
		},
		{
			kind: 'dropdown',
			label: 'Herramientas',
			icon: '🛠️',
			subItems: [
				{
					kind: 'link',
					href: '/admin/asistente',
					label: 'Asistente IA',
					icon: '🧠',
					permission: 'use_ai_assistant'
				},
				{
					kind: 'link',
					href: '/admin/nesting',
					label: 'Nesting Láser',
					icon: '🧩',
					permission: 'view_admin_panel'
				},
				{
					kind: 'link',
					href: '/admin/vectorize',
					label: 'Imagen → DXF/PLT',
					icon: '🖼️',
					permission: 'view_admin_panel'
				},
				{
					kind: 'link',
					href: '/admin/design-builder',
					label: 'Constructor de diseños',
					icon: '✏️',
					permission: 'view_admin_panel'
				},
				{
					kind: 'link',
					href: '/admin/design-icons',
					label: 'Biblioteca de iconos',
					icon: '🎨',
					permission: 'view_admin_panel'
				}
			]
		},
		{
			kind: 'dropdown',
			label: 'Operaciones',
			icon: '🔧',
			subItems: [
				{
					kind: 'link',
					href: '/admin/entregas',
					label: 'Entrega de Máquinas',
					icon: '🚚',
					permission: 'view_machine_deliveries'
				},
				{
					kind: 'link',
					href: '/admin/ordenes-compra',
					label: 'Órdenes de Compra',
					icon: '📥',
					permission: 'manage_inventory'
				},
				{
					kind: 'link',
					href: '/admin/inventario',
					label: 'Reportes de Inventario',
					icon: '📋',
					permission: 'view_inventory'
				},
				{
					kind: 'link',
					href: '/admin/tipos-envio',
					label: 'Tipos de Envío',
					icon: '🚢',
					permission: 'view_admin_panel'
				}
			]
		},
		{
			kind: 'dropdown',
			label: 'Configuración',
			icon: '⚙️',
			iconOnly: true,
			subItems: [
				{
					kind: 'link',
					href: '/admin/configuracion',
					label: 'General',
					icon: '🏠',
					permission: 'manage_settings'
				},
				{
					kind: 'link',
					href: '/admin/configuracion/whatsapp',
					label: 'WhatsApp',
					icon: '💬',
					permission: 'manage_settings'
				},
				{
					kind: 'link',
					href: '/admin/tipo-cambio',
					label: 'Tipo de Cambio',
					icon: '💵',
					permission: 'manage_settings'
				},
				{
					kind: 'link',
					href: '/admin/usuarios',
					label: 'Usuarios',
					icon: '👥',
					permission: 'view_admin_panel'
				},
				{
					kind: 'link',
					href: '/admin/videos',
					label: 'Videos',
					icon: '🎥',
					permission: 'view_admin_panel'
				}
			]
		}
	];

	function menuPermOk(p?: Permission): boolean {
		if (!userState.initialized) return false;
		if (!p) return true;
		return checkPermission(p);
	}

	function filterThird(items: ThirdMenuItem[]): ThirdMenuItem[] {
		return items.filter((i) => menuPermOk(i.permission));
	}

	function filterSecond(items: SecondMenuItem[]): SecondMenuItem[] {
		const out: SecondMenuItem[] = [];
		for (const it of items) {
			if (it.kind === 'link') {
				if (menuPermOk(it.permission)) out.push(it);
			} else {
				const filt = filterThird(it.items);
				if (filt.length > 0 && menuPermOk(it.permission)) {
					out.push({ ...it, items: filt });
				}
			}
		}
		return out;
	}

	function filterTop(items: TopMenuItem[]): TopMenuItem[] {
		const result: TopMenuItem[] = [];
		for (const item of items) {
			if (item.kind === 'link') {
				if (menuPermOk(item.permission)) result.push(item);
			} else {
				const subs = filterSecond(item.subItems);
				if (subs.length === 0) continue;
				if (item.permission !== undefined && !menuPermOk(item.permission)) continue;
				result.push({ ...item, subItems: subs });
			}
		}
		return result;
	}

	function toggleDropdown(label: string) {
		openDropdowns[label] = !openDropdowns[label];
	}

	let userState = $state({ initialized: false, loading: true });
	let hasValidSession = $state(false);
	let wasAuthenticated = $state(false);

	onMount(() => {
		const unsubscribe = userStore.subscribe((state) => {
			userState = state;

			// Marcar que estuvo autenticado si tiene usuario
			if (state.user) {
				wasAuthenticated = true;
			}

			// NO REDIRIGIR AUTOMÁTICAMENTE - La verificación inicial en onMount es suficiente
			// Esto evita que el usuario sea sacado mientras trabaja en modales
			console.log('🔍 Admin: Estado del usuario actualizado, manteniendo en página actual');
		});

		const init = async () => {
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

			const storeState = get(userStore);
			if (!storeState.permissions.includes('view_admin_panel')) {
				if (storeState.roles.includes('tecnico')) {
					goto('/tecnico/entregas');
					return;
				}
				goto('/login');
				return;
			}

			hasValidSession = true;
		};

		void init();

		return () => {
			unsubscribe();
		};
	});

	const visibleMenuItems = $derived(filterTop(menuItems));

	function isActive(href: string) {
		return (
			$page.url.pathname === href ||
			($page.url.pathname.startsWith(href) && href !== '/admin')
		);
	}

	function isThirdActive(item: ThirdMenuItem): boolean {
		return isActive(item.href);
	}

	function isSecondActive(sub: SecondMenuItem): boolean {
		if (sub.kind === 'link') return isActive(sub.href);
		return sub.items.some(isThirdActive);
	}

	function isTopDropdownActive(item: TopMenuItem & { kind: 'dropdown' }): boolean {
		return item.subItems.some(isSecondActive);
	}

	function flyoutKey(topLabel: string, flyoutLabel: string): string {
		return `${topLabel}|${flyoutLabel}`;
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
						{#if item.kind === 'dropdown'}
							<div class="relative group">
								<div
									class="rounded-lg transition flex items-center cursor-default outline-none {item.iconOnly
										? 'text-2xl px-2.5 py-1 justify-center gap-0.5 leading-none ' +
											(isTopDropdownActive(item)
												? 'ring-2 ring-blue-400 ring-offset-1'
												: '')
										: 'text-sm px-3 py-1.5 gap-1'} {isTopDropdownActive(item)
										? 'bg-blue-600 text-white'
										: 'text-gray-700 group-hover:bg-gray-100'}"
									aria-label={item.label}
									aria-expanded="false"
									aria-haspopup="true"
									role="button"
									tabindex="0"
								>
									<span class={item.iconOnly ? '' : 'mr-1.5'}>{item.icon}</span>
									{#if !item.iconOnly}
										{item.label}
									{/if}
									<svg
										class="{item.iconOnly ? 'w-3 h-3' : 'w-4 h-4'} shrink-0 transition-transform group-hover:rotate-180"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								</div>
								<div
									class="absolute top-full left-0 -mt-1 min-w-[220px] z-50 opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto transition-all duration-150"
								>
									<div class="bg-white rounded-lg shadow-lg border py-1">
										{#each item.subItems as sub}
											{#if sub.kind === 'link'}
												<a
													href={sub.href}
													class="flex items-center gap-2 px-4 py-2 text-sm transition {isActive(sub.href)
														? 'bg-blue-50 text-blue-600'
														: 'text-gray-700 hover:bg-gray-50'}"
												>
													{#if sub.icon}<span>{sub.icon}</span>{/if}
													{sub.label}
												</a>
											{:else}
												<div class="relative group/sub">
													<div
														class="flex items-center justify-between gap-2 px-4 py-2 text-sm cursor-default text-gray-700 group-hover/sub:bg-gray-50"
													>
														<span class="flex items-center gap-2">
															{#if sub.icon}<span>{sub.icon}</span>{/if}
															{sub.label}
														</span>
														<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
														</svg>
													</div>
													<div
														class="absolute left-full top-0 ml-0 min-w-[200px] z-[60] opacity-0 invisible pointer-events-none group-hover/sub:opacity-100 group-hover/sub:visible group-hover/sub:pointer-events-auto transition-all duration-150"
													>
														<div class="bg-white rounded-lg shadow-lg border py-1 ml-1">
															{#each sub.items as leaf}
																<a
																	href={leaf.href}
																	class="flex items-center gap-2 px-4 py-2 text-sm transition {isActive(leaf.href)
																		? 'bg-blue-50 text-blue-600'
																		: 'text-gray-700 hover:bg-gray-50'}"
																>
																	{#if leaf.icon}<span>{leaf.icon}</span>{/if}
																	{leaf.label}
																</a>
															{/each}
														</div>
													</div>
												</div>
											{/if}
										{/each}
									</div>
								</div>
							</div>
						{:else}
							<a
								href={item.href}
								aria-label={item.label}
								title={item.label}
								class="rounded-lg transition flex items-center {item.iconOnly
									? 'text-2xl px-3 py-1 justify-center leading-none shadow-sm border border-transparent hover:border-gray-200'
									: 'text-sm px-3 py-1.5 gap-1'} {isActive(item.href)
									? 'bg-blue-600 text-white ' +
										(item.iconOnly ? 'ring-2 ring-blue-400 ring-offset-1' : '')
									: 'text-gray-700 hover:bg-gray-100'}"
							>
								{#if item.iconOnly}
									<span class="drop-shadow-sm">{item.icon}</span>
								{:else}
									<span class="mr-1.5">{item.icon}</span>
									{item.label}
								{/if}
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
					{#if item.kind === 'dropdown'}
						<div>
							<button
								type="button"
								onclick={() => toggleDropdown(item.label)}
								aria-label={item.label}
								class="flex items-center justify-between w-full px-4 py-3 rounded-lg transition {isTopDropdownActive(item)
									? 'bg-blue-600 text-white'
									: 'text-gray-700 hover:bg-gray-100'}"
							>
								<div class="flex items-center gap-3">
									<span class={item.iconOnly ? 'text-3xl leading-none' : 'text-xl'}>{item.icon}</span>
									{#if !item.iconOnly}
										<span class="font-medium">{item.label}</span>
									{:else}
										<span class="sr-only">{item.label}</span>
									{/if}
								</div>
								<svg
									class="w-5 h-5 shrink-0 transition-transform {openDropdowns[item.label] ? 'rotate-180' : ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</button>
							{#if openDropdowns[item.label]}
								<div class="ml-4 mt-2 space-y-1 border-l-2 border-gray-100 pl-3">
									{#each item.subItems as sub}
										{#if sub.kind === 'link'}
											<a
												href={sub.href}
												onclick={() => (menuOpen = false)}
												class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition {isActive(sub.href)
													? 'bg-blue-50 text-blue-600'
													: 'text-gray-600 hover:bg-gray-50'}"
											>
												{#if sub.icon}<span>{sub.icon}</span>{/if}
												{sub.label}
											</a>
										{:else}
											<div class="mt-1">
												<button
													type="button"
													onclick={() => toggleDropdown(flyoutKey(item.label, sub.label))}
													class="flex items-center justify-between w-full px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
												>
													<span class="flex items-center gap-2">
														{#if sub.icon}<span>{sub.icon}</span>{/if}
														{sub.label}
													</span>
													<svg
														class="w-4 h-4 {openDropdowns[flyoutKey(item.label, sub.label)] ? 'rotate-180' : ''}"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
													</svg>
												</button>
												{#if openDropdowns[flyoutKey(item.label, sub.label)]}
													<div class="ml-4 mt-1 space-y-1">
														{#each sub.items as leaf}
															<a
																href={leaf.href}
																onclick={() => (menuOpen = false)}
																class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition {isActive(leaf.href)
																	? 'bg-blue-50 text-blue-600'
																	: 'text-gray-600 hover:bg-gray-50'}"
															>
																{#if leaf.icon}<span>{leaf.icon}</span>{/if}
																{leaf.label}
															</a>
														{/each}
													</div>
												{/if}
											</div>
										{/if}
									{/each}
								</div>
							{/if}
						</div>
					{:else}
						<a
							href={item.href}
							onclick={() => (menuOpen = false)}
							aria-label={item.label}
							title={item.label}
							class="flex items-center gap-3 px-4 py-3 rounded-lg transition {isActive(item.href)
								? 'bg-blue-600 text-white'
								: 'text-gray-700 hover:bg-gray-100'}"
						>
							{#if item.iconOnly}
								<span class="text-3xl leading-none">{item.icon}</span>
								<span class="sr-only">{item.label}</span>
							{:else}
								<span class="text-xl">{item.icon}</span>
								<span class="font-medium">{item.label}</span>
							{/if}
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