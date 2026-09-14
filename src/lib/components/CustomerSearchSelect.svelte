<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { textMatchesSearch } from '$lib/utils';
	import type { Database } from '$lib/types/database.types';

	type Customer = Database['public']['Tables']['customers']['Row'];

	let {
		selected = $bindable<Customer | null>(null),
		onSelect = () => {}
	}: {
		selected?: Customer | null;
		onSelect?: (customer: Customer) => void;
	} = $props();

	let searchTerm = $state('');
	let results = $state<Customer[]>([]);
	let loading = $state(false);
	let showDropdown = $state(false);

	let customersCache: Customer[] | null = null;
	let cacheLoading: Promise<Customer[]> | null = null;
	let searchTimeout: number;

	async function ensureCustomersLoaded(): Promise<Customer[]> {
		if (customersCache) return customersCache;
		if (cacheLoading) return cacheLoading;

		cacheLoading = (async () => {
			const { data, error } = await supabase
				.from('customers')
				.select('*')
				.order('contact_name', { ascending: true });
			if (error) throw error;
			customersCache = data || [];
			return customersCache;
		})();

		try {
			return await cacheLoading;
		} finally {
			cacheLoading = null;
		}
	}

	function customerMatches(customer: Customer, query: string): boolean {
		return [customer.contact_name, customer.email, customer.company_name, customer.phone].some(
			(field) => textMatchesSearch(field, query)
		);
	}

	async function search() {
		clearTimeout(searchTimeout);
		if (searchTerm.length < 2) {
			results = [];
			return;
		}

		searchTimeout = window.setTimeout(async () => {
			loading = true;
			try {
				const all = await ensureCustomersLoaded();
				const term = searchTerm.trim();
				results = all.filter((c) => customerMatches(c, term)).slice(0, 10);
				showDropdown = true;
			} catch {
				results = [];
			} finally {
				loading = false;
			}
		}, 250);
	}

	function pick(customer: Customer) {
		selected = customer;
		searchTerm = customer.contact_name;
		showDropdown = false;
		onSelect(customer);
	}
</script>

<div class="relative">
	<label class="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
	<input
		type="text"
		placeholder="Buscar por nombre, email o empresa..."
		bind:value={searchTerm}
		oninput={search}
		onfocus={() => {
			if (results.length) showDropdown = true;
		}}
		class="w-full px-3 py-2 border rounded-lg"
		required
	/>
	{#if selected}
		<p class="text-xs text-green-700 mt-1">
			Seleccionado: {selected.contact_name} — {selected.email}
		</p>
	{/if}
	{#if showDropdown && (results.length > 0 || loading)}
		<ul
			class="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto"
		>
			{#if loading}
				<li class="px-3 py-2 text-sm text-gray-500">Buscando...</li>
			{:else}
				{#each results as customer}
					<li>
						<button
							type="button"
							class="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
							onclick={() => pick(customer)}
						>
							<span class="font-medium">{customer.contact_name}</span>
							{#if customer.company_name}
								<span class="text-gray-500"> — {customer.company_name}</span>
							{/if}
							<br />
							<span class="text-gray-500 text-xs">{customer.email}</span>
						</button>
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>
