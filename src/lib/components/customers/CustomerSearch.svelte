<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import type { Database } from '$lib/types/database.types';

	type Customer = Database['public']['Tables']['customers']['Row'];

	// Props
	interface Props {
		onSelect: (customer: Customer) => void;
		placeholder?: string;
	}

	let { onSelect, placeholder = '🔍 Buscar cliente existente...' }: Props = $props();

	// Estado
	let searchTerm = $state('');
	let customers = $state<Customer[]>([]);
	let filteredCustomers = $state<Customer[]>([]);
	let showResults = $state(false);
	let loading = $state(false);
	let selectedIndex = $state(0);

	// Búsqueda de clientes
	async function searchCustomers() {
		if (!searchTerm.trim()) {
			customers = [];
			filteredCustomers = [];
			showResults = false;
			return;
		}

		loading = true;
		try {
			const { data, error } = await supabase
				.from('customers')
				.select('*')
				.or(
					`contact_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,mobile.ilike.%${searchTerm}%,customer_number.ilike.%${searchTerm}%`
				)
				.order('contact_name', { ascending: true })
				.limit(10);

			if (error) throw error;

			customers = data || [];
			filteredCustomers = customers;
			showResults = true;
			selectedIndex = 0;
		} catch (error) {
			console.error('Error buscando clientes:', error);
			customers = [];
			filteredCustomers = [];
		} finally {
			loading = false;
		}
	}

	// Debounce para la búsqueda
	let searchTimeout: number;
	function handleInput() {
		clearTimeout(searchTimeout);
		searchTimeout = window.setTimeout(searchCustomers, 300);
	}

	// Seleccionar cliente
	function selectCustomer(customer: Customer) {
		onSelect(customer);
		searchTerm = '';
		showResults = false;
		filteredCustomers = [];
	}

	// Navegación con teclado
	function handleKeydown(e: KeyboardEvent) {
		if (!showResults || filteredCustomers.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, filteredCustomers.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				break;
			case 'Enter':
				e.preventDefault();
				if (filteredCustomers[selectedIndex]) {
					selectCustomer(filteredCustomers[selectedIndex]);
				}
				break;
			case 'Escape':
				showResults = false;
				break;
		}
	}

	// Cerrar resultados al hacer click fuera
	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.customer-search-container')) {
			showResults = false;
		}
	}

	// Formato de tipo de cliente
	function getTypeBadge(type: string) {
		switch (type) {
			case 'vip':
				return { text: 'VIP', class: 'bg-yellow-100 text-yellow-800' };
			case 'wholesale':
				return { text: 'Mayoreo', class: 'bg-blue-100 text-blue-800' };
			default:
				return { text: 'Regular', class: 'bg-gray-100 text-gray-800' };
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="customer-search-container relative w-full">
	<div class="relative">
		<input
			type="text"
			bind:value={searchTerm}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={() => searchTerm && (showResults = true)}
			{placeholder}
			class="w-full px-4 py-3 pr-10 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			autocomplete="off"
		/>
		
		{#if loading}
			<div class="absolute right-3 top-1/2 -translate-y-1/2">
				<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
			</div>
		{:else if searchTerm}
			<button
				onclick={() => {
					searchTerm = '';
					showResults = false;
				}}
				class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
			>
				✕
			</button>
		{/if}
	</div>

	{#if showResults}
		<div class="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">
			{#if loading}
				<div class="p-4 text-center text-gray-500">
					<div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
					<p class="text-sm">Buscando clientes...</p>
				</div>
			{:else if filteredCustomers.length === 0}
				<div class="p-6 text-center">
					<div class="text-4xl mb-2">🔍</div>
					<p class="text-gray-600 font-medium">No se encontraron clientes</p>
					<p class="text-sm text-gray-500 mt-1">
						Intenta con otro término de búsqueda
					</p>
				</div>
			{:else}
				<div class="py-2">
					<div class="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
						{filteredCustomers.length} resultado{filteredCustomers.length !== 1 ? 's' : ''} encontrado{filteredCustomers.length !== 1 ? 's' : ''}
					</div>
					
					{#each filteredCustomers as customer, index (customer.id)}
						<button
							onclick={() => selectCustomer(customer)}
							class="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b last:border-b-0 {index === selectedIndex ? 'bg-blue-50' : ''}"
						>
							<div class="flex justify-between items-start gap-3">
								<div class="flex-1 min-w-0">
									<!-- Nombre -->
									<div class="font-semibold text-gray-900 flex items-center gap-2">
										<span class="truncate">{customer.contact_name}</span>
										<span class="px-2 py-0.5 rounded-full text-xs font-semibold {getTypeBadge(customer.customer_type || 'regular').class}">
											{getTypeBadge(customer.customer_type || 'regular').text}
										</span>
									</div>

									<!-- Empresa -->
									{#if customer.company_name}
										<div class="text-sm text-gray-600 truncate">
											{customer.company_name}
										</div>
									{/if}

									<!-- Contacto -->
									<div class="text-sm text-gray-500 mt-1 space-y-0.5">
										<div class="flex items-center gap-2">
											<span>📧</span>
											<span class="truncate">{customer.email}</span>
										</div>
										{#if customer.phone || customer.mobile}
											<div class="flex items-center gap-2">
												<span>📞</span>
												<span>{customer.phone || customer.mobile}</span>
											</div>
										{/if}
									</div>
								</div>

								<!-- Número de cliente -->
								{#if customer.customer_number}
									<div class="text-xs font-mono text-gray-400 mt-1">
										{customer.customer_number}
									</div>
								{/if}
							</div>
						</button>
					{/each}
				</div>

				<div class="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t">
					💡 Usa ↑↓ para navegar, Enter para seleccionar, Esc para cerrar
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Estilos adicionales si es necesario */
</style>
