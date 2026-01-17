<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import type { Database } from '$lib/types/database.types';

	type Customer = Database['public']['Tables']['customers']['Row'];

	// Estado reactivo
	let customers = $state<Customer[]>([]);
	let filteredCustomers = $state<Customer[]>([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingCustomer = $state<Customer | null>(null);
	let searchTerm = $state('');
	let filterType = $state<string>('all');

	// Estado del formulario
	let formData = $state({
		company_name: '',
		contact_name: '',
		email: '',
		phone: '',
		mobile: '',
		rfc: '',
		street: '',
		neighborhood: '',
		city: '',
		state: '',
		zip_code: '',
		customer_type: 'regular' as 'regular' | 'vip' | 'wholesale',
		notes: ''
	});

	// Cargar clientes
	async function loadCustomers() {
		loading = true;
		try {
			const { data, error } = await supabase
				.from('customers')
				.select('*')
				.order('created_at', { ascending: false });

			if (error) throw error;
			customers = data || [];
			applyFilters();
		} catch (error) {
			console.error('Error cargando clientes:', error);
			alert('Error al cargar clientes');
		} finally {
			loading = false;
		}
	}

	// Filtrar clientes
	function applyFilters() {
		filteredCustomers = customers.filter((customer) => {
			const matchesSearch =
				searchTerm === '' ||
				customer.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
				customer.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				customer.phone?.includes(searchTerm) ||
				customer.mobile?.includes(searchTerm) ||
				customer.customer_number?.includes(searchTerm);

			const matchesType = filterType === 'all' || customer.customer_type === filterType;

			return matchesSearch && matchesType;
		});
	}

	// Observar cambios en búsqueda y filtros
	$effect(() => {
		applyFilters();
		searchTerm; // Trigger reactivity
		filterType; // Trigger reactivity
	});

	// Abrir modal para nuevo cliente
	function openNewCustomerModal() {
		editingCustomer = null;
		formData = {
			company_name: '',
			contact_name: '',
			email: '',
			phone: '',
			mobile: '',
			rfc: '',
			street: '',
			neighborhood: '',
			city: '',
			state: '',
			zip_code: '',
			customer_type: 'regular',
			notes: ''
		};
		showModal = true;
	}

	// Abrir modal para editar
	function openEditModal(customer: Customer) {
		editingCustomer = customer;
		formData = {
			company_name: customer.company_name || '',
			contact_name: customer.contact_name,
			email: customer.email,
			phone: customer.phone || '',
			mobile: customer.mobile || '',
			rfc: customer.rfc || '',
			street: customer.street || '',
			neighborhood: customer.neighborhood || '',
			city: customer.city || '',
			state: customer.state || '',
			zip_code: customer.zip_code || '',
			customer_type: (customer.customer_type as any) || 'regular',
			notes: customer.notes || ''
		};
		showModal = true;
	}

	// Guardar cliente
	async function saveCustomer() {
		if (!formData.contact_name || !formData.email) {
			alert('El nombre de contacto y el email son requeridos');
			return;
		}

		try {
			if (editingCustomer) {
				// Actualizar
				const { error } = await supabase
					.from('customers')
					.update(formData)
					.eq('id', editingCustomer.id);

				if (error) throw error;
				alert('✅ Cliente actualizado exitosamente');
			} else {
				// Crear nuevo - generar número de cliente
				const { data: numberData } = await supabase.rpc('generate_customer_number');
				
				const customerData = {
					...formData,
					customer_number: numberData || `CLI-${new Date().getFullYear()}-${String(customers.length + 1).padStart(4, '0')}`
				};

				const { error } = await supabase.from('customers').insert([customerData]);

				if (error) throw error;
				alert('✅ Cliente creado exitosamente');
			}

			showModal = false;
			await loadCustomers();
		} catch (error: any) {
			console.error('Error guardando cliente:', error);
			alert('❌ Error al guardar: ' + (error.message || 'Error desconocido'));
		}
	}

	// Eliminar cliente
	async function deleteCustomer(customer: Customer) {
		const confirm = window.confirm(
			`¿Estás seguro de eliminar al cliente:\n${customer.contact_name}?\n\nEsta acción no se puede deshacer.`
		);
		if (!confirm) return;

		try {
			const { error } = await supabase.from('customers').delete().eq('id', customer.id);

			if (error) throw error;
			alert('✅ Cliente eliminado exitosamente');
			await loadCustomers();
		} catch (error: any) {
			console.error('Error eliminando cliente:', error);
			alert('❌ Error al eliminar: ' + (error.message || 'Error desconocido'));
		}
	}

	// Obtener badge de tipo
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

	onMount(() => {
		loadCustomers();
	});
</script>

<div class="p-6 max-w-7xl mx-auto">
	<!-- Header -->
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">👥 Clientes</h1>
			<p class="text-gray-600 mt-1">Gestiona tu base de datos de clientes</p>
		</div>
		<button
			onclick={openNewCustomerModal}
			class="bg-gradient-to-r from-red-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-red-700 hover:to-blue-700 font-semibold shadow-lg"
		>
			➕ Nuevo Cliente
		</button>
	</div>

	<!-- Estadísticas -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
		<div class="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
			<div class="text-sm text-gray-600">Total Clientes</div>
			<div class="text-2xl font-bold text-gray-900">{customers.length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow border-l-4 border-gray-500">
			<div class="text-sm text-gray-600">Regular</div>
			<div class="text-2xl font-bold text-gray-900">
				{customers.filter((c) => c.customer_type === 'regular').length}
			</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
			<div class="text-sm text-gray-600">VIP</div>
			<div class="text-2xl font-bold text-gray-900">
				{customers.filter((c) => c.customer_type === 'vip').length}
			</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
			<div class="text-sm text-gray-600">Mayoreo</div>
			<div class="text-2xl font-bold text-gray-900">
				{customers.filter((c) => c.customer_type === 'wholesale').length}
			</div>
		</div>
	</div>

	<!-- Filtros y búsqueda -->
	<div class="bg-white p-4 rounded-lg shadow mb-6">
		<div class="flex flex-col md:flex-row gap-4">
			<div class="flex-1">
				<input
					type="text"
					bind:value={searchTerm}
					placeholder="🔍 Buscar por nombre, email, teléfono, empresa..."
					class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
			<select
				bind:value={filterType}
				class="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
			>
				<option value="all">Todos los tipos</option>
				<option value="regular">Regular</option>
				<option value="vip">VIP</option>
				<option value="wholesale">Mayoreo</option>
			</select>
		</div>
	</div>

	<!-- Lista de clientes -->
	{#if loading}
		<div class="text-center py-12">
			<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			<p class="mt-4 text-gray-600">Cargando clientes...</p>
		</div>
	{:else if filteredCustomers.length === 0}
		<div class="bg-white p-12 rounded-lg shadow text-center">
			<div class="text-6xl mb-4">📋</div>
			<h3 class="text-xl font-semibold text-gray-900 mb-2">
				{searchTerm || filterType !== 'all' ? 'No se encontraron clientes' : 'No hay clientes registrados'}
			</h3>
			<p class="text-gray-600 mb-4">
				{searchTerm || filterType !== 'all'
					? 'Intenta con otros términos de búsqueda'
					: 'Comienza agregando tu primer cliente'}
			</p>
			{#if !searchTerm && filterType === 'all'}
				<button
					onclick={openNewCustomerModal}
					class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
				>
					➕ Agregar Primer Cliente
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
			{#each filteredCustomers as customer (customer.id)}
				<div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border">
					<!-- Header con tipo -->
					<div class="flex justify-between items-start mb-3">
						<div class="flex-1">
							<h3 class="font-bold text-lg text-gray-900">{customer.contact_name}</h3>
							{#if customer.company_name}
								<p class="text-sm text-gray-600">{customer.company_name}</p>
							{/if}
						</div>
						<span class="px-2 py-1 rounded-full text-xs font-semibold {getTypeBadge(customer.customer_type || 'regular').class}">
							{getTypeBadge(customer.customer_type || 'regular').text}
						</span>
					</div>

					<!-- Número de cliente -->
					{#if customer.customer_number}
						<div class="text-xs font-mono text-gray-500 mb-3">
							{customer.customer_number}
						</div>
					{/if}

					<!-- Información de contacto -->
					<div class="space-y-2 mb-4 text-sm">
						<div class="flex items-center text-gray-700">
							<span class="w-5">📧</span>
							<a href="mailto:{customer.email}" class="hover:text-blue-600 truncate">
								{customer.email}
							</a>
						</div>
						{#if customer.phone}
							<div class="flex items-center text-gray-700">
								<span class="w-5">📞</span>
								<a href="tel:{customer.phone}" class="hover:text-blue-600">
									{customer.phone}
								</a>
							</div>
						{/if}
						{#if customer.mobile}
							<div class="flex items-center text-gray-700">
								<span class="w-5">📱</span>
								<a href="tel:{customer.mobile}" class="hover:text-blue-600">
									{customer.mobile}
								</a>
							</div>
						{/if}
						{#if customer.city || customer.state}
							<div class="flex items-center text-gray-700">
								<span class="w-5">📍</span>
								<span class="truncate">
									{[customer.city, customer.state].filter(Boolean).join(', ')}
								</span>
							</div>
						{/if}
					</div>

					<!-- Acciones -->
					<div class="flex gap-2 pt-3 border-t">
						<button
							onclick={() => openEditModal(customer)}
							class="flex-1 bg-blue-50 text-blue-600 px-4 py-2 rounded hover:bg-blue-100 font-medium text-sm"
						>
							✏️ Editar
						</button>
						<button
							onclick={() => deleteCustomer(customer)}
							class="bg-red-50 text-red-600 px-4 py-2 rounded hover:bg-red-100 font-medium text-sm"
						>
							🗑️
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal de formulario -->
{#if showModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onclick={(e) => e.target === e.currentTarget && (showModal = false)}>
		<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
			<div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
				<h2 class="text-2xl font-bold text-gray-900">
					{editingCustomer ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}
				</h2>
				<button
					onclick={() => (showModal = false)}
					class="text-gray-500 hover:text-gray-700 text-2xl"
				>
					✕
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); saveCustomer(); }} class="p-6 space-y-4">
				<!-- Tipo de cliente -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">
						Tipo de Cliente <span class="text-red-500">*</span>
					</label>
					<select
						bind:value={formData.customer_type}
						required
						class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
					>
						<option value="regular">Regular</option>
						<option value="vip">VIP</option>
						<option value="wholesale">Mayoreo</option>
					</select>
				</div>

				<!-- Nombre de contacto -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">
						Nombre de Contacto <span class="text-red-500">*</span>
					</label>
					<input
						type="text"
						bind:value={formData.contact_name}
						required
						class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
						placeholder="Juan Pérez"
					/>
				</div>

				<!-- Empresa -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
					<input
						type="text"
						bind:value={formData.company_name}
						class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
						placeholder="Empresa S.A. de C.V."
					/>
				</div>

				<!-- Email -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">
						Email <span class="text-red-500">*</span>
					</label>
					<input
						type="email"
						bind:value={formData.email}
						required
						class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
						placeholder="correo@ejemplo.com"
					/>
				</div>

				<!-- Teléfonos -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
						<input
							type="tel"
							bind:value={formData.phone}
							class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
							placeholder="33 1234 5678"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Celular</label>
						<input
							type="tel"
							bind:value={formData.mobile}
							class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
							placeholder="33 1234 5678"
						/>
					</div>
				</div>

				<!-- RFC -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">RFC</label>
					<input
						type="text"
						bind:value={formData.rfc}
						maxlength="13"
						class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
						placeholder="XAXX010101000"
					/>
				</div>

				<!-- Dirección -->
				<div class="border-t pt-4">
					<h3 class="font-semibold text-gray-900 mb-3">📍 Dirección</h3>
					
					<div class="space-y-3">
						<input
							type="text"
							bind:value={formData.street}
							class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
							placeholder="Calle y Número"
						/>
						<input
							type="text"
							bind:value={formData.neighborhood}
							class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
							placeholder="Colonia"
						/>
						<div class="grid grid-cols-2 gap-3">
							<input
								type="text"
								bind:value={formData.city}
								class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
								placeholder="Ciudad"
							/>
							<input
								type="text"
								bind:value={formData.state}
								class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
								placeholder="Estado"
							/>
						</div>
						<input
							type="text"
							bind:value={formData.zip_code}
							maxlength="10"
							class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
							placeholder="Código Postal"
						/>
					</div>
				</div>

				<!-- Notas -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Notas</label>
					<textarea
						bind:value={formData.notes}
						rows="3"
						class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
						placeholder="Notas adicionales sobre el cliente..."
					></textarea>
				</div>

				<!-- Botones -->
				<div class="flex gap-3 pt-4">
					<button
						type="submit"
						class="flex-1 bg-gradient-to-r from-red-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-red-700 hover:to-blue-700 font-semibold"
					>
						{editingCustomer ? '💾 Actualizar Cliente' : '➕ Crear Cliente'}
					</button>
					<button
						type="button"
						onclick={() => (showModal = false)}
						class="px-6 py-3 border rounded-lg hover:bg-gray-50 font-semibold"
					>
						Cancelar
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
