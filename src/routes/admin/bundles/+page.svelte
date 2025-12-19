<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice } from '$lib/utils';
	import { goto } from '$app/navigation';

	let bundles = $state<any[]>([]);
	let products = $state<any[]>([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingBundle = $state<any>(null);

	// Form fields
	let selectedProductId = $state('');
	let bundleName = $state('');
	let bundleDescription = $state('');
	let bundleSku = $state('');
	let bundlePrice = $state(0);
	let bundleStock = $state(0);
	let bundleActive = $state(true);
	let bundleItems = $state<any[]>([]);

	$effect(() => {
		loadData();
	});

	async function loadData() {
		loading = true;
		
		// Cargar productos
		const { data: productsData } = await supabase
			.from('products')
			.select('id, name, slug, base_price')
			.eq('is_active', true)
			.order('name');
		products = productsData || [];

		// Cargar bundles con sus items
		const { data: bundlesData } = await supabase
			.from('product_bundles')
			.select(`
				*,
				products (id, name, slug),
				bundle_items (
					*,
					products (id, name, base_price),
					product_variants (id, name, price)
				)
			`)
			.order('created_at', { ascending: false });

		bundles = bundlesData || [];
		loading = false;
	}

	function openCreateModal() {
		editingBundle = null;
		resetForm();
		showModal = true;
	}

	function openEditModal(bundle: any) {
		editingBundle = bundle;
		selectedProductId = bundle.product_id;
		bundleName = bundle.name;
		bundleDescription = bundle.description || '';
		bundleSku = bundle.sku || '';
		bundlePrice = bundle.bundle_price;
		bundleStock = bundle.stock_quantity;
		bundleActive = bundle.is_active;
		bundleItems = bundle.bundle_items?.map((item: any) => ({
			product_id: item.product_id,
			variant_id: item.variant_id,
			quantity: item.quantity,
			display_order: item.display_order
		})) || [];
		showModal = true;
	}

	function resetForm() {
		selectedProductId = '';
		bundleName = '';
		bundleDescription = '';
		bundleSku = '';
		bundlePrice = 0;
		bundleStock = 0;
		bundleActive = true;
		bundleItems = [];
	}

	function addBundleItem() {
		bundleItems = [...bundleItems, {
			product_id: '',
			variant_id: null,
			quantity: 1,
			display_order: bundleItems.length
		}];
	}

	function removeBundleItem(index: number) {
		bundleItems = bundleItems.filter((_, i) => i !== index);
	}

	async function saveBundle() {
		if (!selectedProductId || !bundleName || bundlePrice <= 0) {
			alert('Por favor completa todos los campos requeridos');
			return;
		}

		if (bundleItems.length === 0) {
			alert('Agrega al menos un producto al bundle');
			return;
		}

		const bundleData = {
			product_id: selectedProductId,
			name: bundleName,
			description: bundleDescription || null,
			sku: bundleSku || null,
			bundle_price: bundlePrice,
			stock_quantity: bundleStock,
			is_active: bundleActive
		};

		try {
			if (editingBundle) {
				// Actualizar bundle existente
				const { error: updateError } = await supabase
					.from('product_bundles')
					.update(bundleData)
					.eq('id', editingBundle.id);

				if (updateError) throw updateError;

				// Eliminar items antiguos
				await supabase
					.from('bundle_items')
					.delete()
					.eq('bundle_id', editingBundle.id);

				// Insertar nuevos items
				const itemsToInsert = bundleItems.map(item => ({
					bundle_id: editingBundle.id,
					...item
				}));

				const { error: itemsError } = await supabase
					.from('bundle_items')
					.insert(itemsToInsert);

				if (itemsError) throw itemsError;

			} else {
				// Crear nuevo bundle
				const { data: newBundle, error: insertError } = await supabase
					.from('product_bundles')
					.insert(bundleData)
					.select()
					.single();

				if (insertError) throw insertError;

				// Insertar items
				const itemsToInsert = bundleItems.map(item => ({
					bundle_id: newBundle.id,
					...item
				}));

				const { error: itemsError } = await supabase
					.from('bundle_items')
					.insert(itemsToInsert);

				if (itemsError) throw itemsError;
			}

			showModal = false;
			await loadData();
			alert('Bundle guardado exitosamente');
		} catch (error) {
			console.error('Error guardando bundle:', error);
			alert('Error al guardar el bundle');
		}
	}

	async function deleteBundle(bundleId: string) {
		if (!confirm('¿Estás seguro de eliminar este bundle?')) return;

		const { error } = await supabase
			.from('product_bundles')
			.delete()
			.eq('id', bundleId);

		if (error) {
			alert('Error al eliminar el bundle');
			return;
		}

		await loadData();
	}

	async function toggleActive(bundleId: string, isActive: boolean) {
		const { error } = await supabase
			.from('product_bundles')
			.update({ is_active: !isActive })
			.eq('id', bundleId);

		if (!error) {
			await loadData();
		}
	}

	async function loadProductVariants(productId: string): Promise<any[]> {
		const { data } = await supabase
			.from('product_variants')
			.select('*')
			.eq('product_id', productId)
			.eq('is_active', true);
		return data || [];
	}
</script>

<svelte:head>
	<title>Gestión de Bundles - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-4xl font-bold">Gestión de Bundles/Paquetes</h1>
		<button
			onclick={openCreateModal}
			class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
		>
			+ Crear Bundle
		</button>
	</div>

	{#if loading}
		<p class="text-center py-8">Cargando...</p>
	{:else if bundles.length === 0}
		<div class="bg-gray-50 rounded-lg p-8 text-center">
			<p class="text-gray-600 mb-4">No hay bundles creados</p>
			<button
				onclick={openCreateModal}
				class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
			>
				Crear Primer Bundle
			</button>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each bundles as bundle}
				<div class="bg-white rounded-lg shadow-md p-6">
					<div class="flex justify-between items-start">
						<div class="flex-1">
							<div class="flex items-center gap-3 mb-2">
								<h3 class="text-xl font-bold">{bundle.name}</h3>
								<span class="px-2 py-1 text-xs rounded {bundle.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
									{bundle.is_active ? 'Activo' : 'Inactivo'}
								</span>
							</div>
							
							<p class="text-gray-600 mb-2">
								Producto: <a href="/productos/{bundle.products?.slug}" class="text-blue-600 hover:underline">
									{bundle.products?.name}
								</a>
							</p>
							
							{#if bundle.description}
								<p class="text-gray-700 mb-3">{bundle.description}</p>
							{/if}

							<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
								<div>
									<span class="text-gray-600">Precio:</span>
									<span class="font-semibold ml-2">{formatPrice(bundle.bundle_price)}</span>
								</div>
								<div>
									<span class="text-gray-600">Stock:</span>
									<span class="font-semibold ml-2">{bundle.stock_quantity}</span>
								</div>
								{#if bundle.sku}
									<div>
										<span class="text-gray-600">SKU:</span>
										<span class="font-semibold ml-2">{bundle.sku}</span>
									</div>
								{/if}
								<div>
									<span class="text-gray-600">Items:</span>
									<span class="font-semibold ml-2">{bundle.bundle_items?.length || 0}</span>
								</div>
							</div>

							{#if bundle.bundle_items && bundle.bundle_items.length > 0}
								<div class="bg-gray-50 rounded p-3">
									<p class="text-sm font-semibold mb-2">Productos incluidos:</p>
									<ul class="list-disc list-inside text-sm text-gray-700">
										{#each bundle.bundle_items as item}
											<li>
												{item.quantity}x {item.products?.name}
												{#if item.product_variants}
													<span class="text-gray-600">({item.product_variants.name})</span>
												{/if}
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>

						<div class="flex gap-2">
							<button
								onclick={() => toggleActive(bundle.id, bundle.is_active)}
								class="px-4 py-2 rounded {bundle.is_active ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}"
							>
								{bundle.is_active ? 'Desactivar' : 'Activar'}
							</button>
							<button
								onclick={() => openEditModal(bundle)}
								class="px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
							>
								Editar
							</button>
							<button
								onclick={() => deleteBundle(bundle.id)}
								class="px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
							>
								Eliminar
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal -->
{#if showModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
			<div class="p-6">
				<h2 class="text-2xl font-bold mb-6">
					{editingBundle ? 'Editar Bundle' : 'Crear Nuevo Bundle'}
				</h2>

				<div class="space-y-4">
					<!-- Producto -->
					<div>
						<label class="block font-semibold mb-2">Producto Principal *</label>
						<select bind:value={selectedProductId} class="w-full border rounded-lg px-4 py-2">
							<option value="">Selecciona un producto</option>
							{#each products as product}
								<option value={product.id}>{product.name}</option>
							{/each}
						</select>
					</div>

					<!-- Nombre -->
					<div>
						<label class="block font-semibold mb-2">Nombre del Bundle *</label>
						<input
							type="text"
							bind:value={bundleName}
							placeholder="ej: Kit Completo"
							class="w-full border rounded-lg px-4 py-2"
						/>
					</div>

					<!-- Descripción -->
					<div>
						<label class="block font-semibold mb-2">Descripción</label>
						<textarea
							bind:value={bundleDescription}
							placeholder="Descripción del bundle"
							class="w-full border rounded-lg px-4 py-2"
							rows="3"
						></textarea>
					</div>

					<!-- Precio y Stock -->
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<label class="block font-semibold mb-2">Precio del Bundle *</label>
							<input
								type="number"
								bind:value={bundlePrice}
								step="0.01"
								min="0"
								class="w-full border rounded-lg px-4 py-2"
							/>
						</div>
						<div>
							<label class="block font-semibold mb-2">Stock</label>
							<input
								type="number"
								bind:value={bundleStock}
								min="0"
								class="w-full border rounded-lg px-4 py-2"
							/>
						</div>
						<div>
							<label class="block font-semibold mb-2">SKU (opcional)</label>
							<input
								type="text"
								bind:value={bundleSku}
								placeholder="BUNDLE-001"
								class="w-full border rounded-lg px-4 py-2"
							/>
						</div>
					</div>

					<!-- Activo -->
					<div class="flex items-center">
						<input
							type="checkbox"
							bind:checked={bundleActive}
							id="bundleActive"
							class="mr-2"
						/>
						<label for="bundleActive" class="font-semibold">Bundle Activo</label>
					</div>

					<!-- Items del Bundle -->
					<div class="border-t pt-4">
						<div class="flex justify-between items-center mb-4">
							<h3 class="text-lg font-bold">Productos Incluidos</h3>
							<button
								onclick={addBundleItem}
								class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
							>
								+ Agregar Producto
							</button>
						</div>

						{#if bundleItems.length === 0}
							<p class="text-gray-600 text-center py-4">No hay productos agregados</p>
						{:else}
							<div class="space-y-3">
								{#each bundleItems as item, index}
									<div class="flex gap-3 items-start bg-gray-50 p-3 rounded">
										<div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
											<select
												bind:value={item.product_id}
												class="border rounded px-3 py-2"
											>
												<option value="">Selecciona producto</option>
												{#each products as product}
													<option value={product.id}>{product.name}</option>
												{/each}
											</select>

											<input
												type="number"
												bind:value={item.quantity}
												min="1"
												placeholder="Cantidad"
												class="border rounded px-3 py-2"
											/>

											<input
												type="number"
												bind:value={item.display_order}
												min="0"
												placeholder="Orden"
												class="border rounded px-3 py-2"
											/>
										</div>
										<button
											onclick={() => removeBundleItem(index)}
											class="px-3 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
										>
											Eliminar
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Botones -->
				<div class="flex gap-3 mt-6 justify-end">
					<button
						onclick={() => showModal = false}
						class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
					>
						Cancelar
					</button>
					<button
						onclick={saveBundle}
						class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
					>
						{editingBundle ? 'Actualizar' : 'Crear'} Bundle
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
