<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, page } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { supabaseServer } from '$lib/supabaseServer';
	import { getProductSpecifications } from '$lib/specifications';
	import type { Product, ProductSpecification } from '$lib/types';

	let product: Product | null = $state(null);
	let specifications: ProductSpecification[] = $state([]);
	let loading = $state(true);
	let isAuthorized = $state(false);
	let showModal = $state(false);
	let editingSpec: ProductSpecification | null = $state(null);

	let formData = $state({
		specification_key: '',
		specification_value: '',
		data_type: 'text' as 'text' | 'number' | 'boolean' | 'select'
	});

	const productId = $page.params.id;

	onMount(async () => {
		// Check if user is logged in
		const {
			data: { session }
		} = await supabase.auth.getSession();

		if (!session) {
			goto('/login');
			return;
		}

		isAuthorized = true;
		await loadProductAndSpecifications();
	});

	async function loadProductAndSpecifications() {
		loading = true;

		// Load product
		const { data: productData } = await supabase
			.from('products')
			.select('*')
			.eq('id', productId)
			.single();

		if (productData) {
			product = productData;
		}

		// Load specifications
		specifications = await getProductSpecifications(productId);

		loading = false;
	}

	async function saveSpecification() {
		if (!formData.specification_key.trim() || !formData.specification_value.trim()) {
			alert('Por favor completa todos los campos');
			return;
		}

		try {
			if (editingSpec) {
				// Update
				const { error } = await supabaseServer
					.from('product_specifications')
					.update({
						specification_key: formData.specification_key,
						specification_value: formData.specification_value,
						data_type: formData.data_type
					})
					.eq('id', editingSpec.id);

				if (error) throw error;
			} else {
				// Insert
				const { error } = await supabaseServer
					.from('product_specifications')
					.insert([
						{
							product_id: productId,
							specification_key: formData.specification_key,
							specification_value: formData.specification_value,
							data_type: formData.data_type
						}
					]);

				if (error) throw error;
			}

			resetForm();
			await loadProductAndSpecifications();
		} catch (error: any) {
			alert('Error: ' + error.message);
		}
	}

	function editSpecification(spec: ProductSpecification) {
		editingSpec = spec;
		formData = {
			specification_key: spec.specification_key,
			specification_value: spec.specification_value,
			data_type: spec.data_type as any
		};
		showModal = true;
	}

	async function deleteSpecification(id: string) {
		if (!confirm('¿Eliminar esta especificación?')) return;

		try {
			const { error } = await supabaseServer
				.from('product_specifications')
				.delete()
				.eq('id', id);

			if (error) throw error;

			await loadProductAndSpecifications();
		} catch (error: any) {
			alert('Error: ' + error.message);
		}
	}

	function resetForm() {
		formData = {
			specification_key: '',
			specification_value: '',
			data_type: 'text'
		};
		editingSpec = null;
		showModal = false;
	}
</script>

<svelte:head>
	<title>Especificaciones del Producto - Guerra Láser</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<div>
			<h1 class="text-4xl font-bold">Especificaciones del Producto</h1>
			{#if product}
				<p class="text-gray-600 mt-2">{product.name}</p>
			{/if}
		</div>
		<div class="flex gap-4">
			<a
				href="/admin/productos"
				class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
			>
				← Volver
			</a>
			<button
				onclick={() => {
					resetForm();
					showModal = true;
				}}
				class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-md"
			>
				+ Nueva Especificación
			</button>
		</div>
	</div>

	{#if loading}
		<div class="text-center py-8">
			<p class="text-gray-600">Cargando especificaciones...</p>
		</div>
	{:else if specifications.length === 0}
		<div class="text-center py-12 bg-gray-50 rounded-lg">
			<p class="text-gray-600 mb-4">No hay especificaciones agregadas</p>
			<button
				onclick={() => {
					resetForm();
					showModal = true;
				}}
				class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
			>
				Agregar Primera Especificación
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each specifications as spec}
				<div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
					<div class="flex justify-between items-start mb-4">
						<div>
							<p class="text-sm text-gray-500">{spec.specification_key}</p>
							<p class="text-2xl font-bold text-gray-900">{spec.specification_value}</p>
							<p class="text-xs text-gray-400 mt-2">Tipo: {spec.data_type}</p>
						</div>
						<div class="flex gap-2">
							<button
								onclick={() => editSpecification(spec)}
								class="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
								title="Editar"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
								</svg>
							</button>
							<button
								onclick={() => deleteSpecification(spec.id)}
								class="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
								title="Eliminar"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Modal -->
	{#if showModal}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div class="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
				<h2 class="text-2xl font-bold mb-6">
					{editingSpec ? 'Editar Especificación' : 'Nueva Especificación'}
				</h2>

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Clave (ej: Potencia, Velocidad)
						</label>
						<input
							type="text"
							bind:value={formData.specification_key}
							placeholder="Nombre del atributo"
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Valor (ej: 40W, 100mm/s)
						</label>
						<input
							type="text"
							bind:value={formData.specification_value}
							placeholder="Valor del atributo"
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Tipo de Dato
						</label>
						<select
							bind:value={formData.data_type}
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
						>
							<option value="text">Texto</option>
							<option value="number">Número</option>
							<option value="boolean">Sí/No</option>
							<option value="select">Selección</option>
						</select>
					</div>
				</div>

				<div class="flex gap-3 mt-8">
					<button
						onclick={resetForm}
						class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
					>
						Cancelar
					</button>
					<button
						onclick={saveSpecification}
						class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
					>
						{editingSpec ? 'Actualizar' : 'Agregar'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	</div>
