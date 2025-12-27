<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import type { 
		SATProductInfo, 
		AmazonListing, 
		MercadoLibreListing,
		CategoryMapping,
		CategoryMappingSchema
	} from '$lib/types/index';

	// Props
	let { 
		productId,
		onSave = () => {}
	}: {
		productId: string;
		onSave?: () => void;
	} = $props();

	// State for PIM data
	let satInfo = $state<Partial<SATProductInfo>>({
		clave_prod_serv: '',
		clave_unidad: '',
		unidad_medida: '',
		material_peligroso: false
	});

	let amazonListing = $state<Partial<AmazonListing>>({
		sku_amazon: '',
		asin: '',
		feed_product_type: '',
		bullet_points: [],
		specific_attributes: {}
	});

	let mlListing = $state<Partial<MercadoLibreListing>>({
		ml_id: '',
		listing_type: 'gold_special',
		attributes: {}
	});

	// Category mappings
	let categoryMappings = $state<CategoryMapping[]>([]);
	let selectedAmazonCategory = $state<string>('');
	let selectedMLCategory = $state<string>('');
	
	// Dynamic fields based on category
	let amazonDynamicFields = $state<any[]>([]);
	let mlDynamicFields = $state<any[]>([]);

	// Loading states
	let loading = $state(true);
	let saving = $state(false);

	// Bullet points for Amazon
	let bulletPoints = $state<string[]>(['', '', '', '', '']);

	// New category template form
	let showNewCategoryForm = $state(false);
	let newCategoryData = $state({
		internal_type: '',
		platform: 'amazon' as 'amazon' | 'mercadolibre' | 'sat',
		external_category_id: '',
		external_category_name: ''
	});

	onMount(async () => {
		await loadPIMData();
		await loadCategoryMappings();
		loading = false;
	});

	async function loadPIMData() {
		try {
			// Load SAT info
			const { data: satData } = await supabase
				.from('sat_product_info')
				.select('*')
				.eq('product_id', productId)
				.single();

			if (satData) {
				satInfo = satData;
			}

			// Load Amazon listing
			const { data: amazonData } = await supabase
				.from('amazon_listings')
				.select('*')
				.eq('product_id', productId)
				.single();

			if (amazonData) {
				amazonListing = amazonData;
				if (Array.isArray(amazonData.bullet_points)) {
					bulletPoints = [...amazonData.bullet_points, '', '', '', '', ''].slice(0, 5);
				}
			}

			// Load ML listing
			const { data: mlData } = await supabase
				.from('mercadolibre_listings')
				.select('*')
				.eq('product_id', productId)
				.single();

			if (mlData) {
				mlListing = mlData;
			}
		} catch (error) {
			console.error('Error loading PIM data:', error);
		}
	}

	async function loadCategoryMappings() {
		try {
			const { data, error } = await supabase
				.from('category_mappings')
				.select('*')
				.order('internal_type');

			if (error) throw error;
			categoryMappings = data || [];
		} catch (error) {
			console.error('Error loading category mappings:', error);
		}
	}

	function onAmazonCategoryChange() {
		const mapping = categoryMappings.find(
			m => m.id === selectedAmazonCategory && m.platform === 'amazon'
		);

		if (mapping && mapping.required_schema) {
			const schema = mapping.required_schema as CategoryMappingSchema;
			amazonDynamicFields = schema.fields || [];
			
			// Initialize specific_attributes with existing values or empty
			if (!amazonListing.specific_attributes) {
				amazonListing.specific_attributes = {};
			}
		} else {
			amazonDynamicFields = [];
		}
	}

	function onMLCategoryChange() {
		const mapping = categoryMappings.find(
			m => m.id === selectedMLCategory && m.platform === 'mercadolibre'
		);

		if (mapping && mapping.required_schema) {
			const schema = mapping.required_schema as CategoryMappingSchema;
			mlDynamicFields = schema.fields || [];
			
			// Initialize attributes with existing values or empty
			if (!mlListing.attributes) {
				mlListing.attributes = {};
			}
		} else {
			mlDynamicFields = [];
		}
	}

	async function saveSATInfo() {
		try {
			saving = true;

			// Validate clave_prod_serv (8 digits)
			if (satInfo.clave_prod_serv && satInfo.clave_prod_serv.length !== 8) {
				alert('La Clave de Producto/Servicio debe tener 8 dígitos');
				saving = false;
				return;
			}

			const dataToSave = {
				product_id: productId,
				clave_prod_serv: satInfo.clave_prod_serv,
				clave_unidad: satInfo.clave_unidad,
				unidad_medida: satInfo.unidad_medida,
				material_peligroso: satInfo.material_peligroso || false
			};

			const { error } = await supabase
				.from('sat_product_info')
				.upsert(dataToSave, { onConflict: 'product_id' });

			if (error) throw error;

			alert('Información SAT guardada correctamente');
			onSave();
		} catch (error) {
			console.error('Error saving SAT info:', error);
			const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
			alert(`Error al guardar información SAT: ${errorMessage}`);
		} finally {
			saving = false;
		}
	}

	async function saveAmazonListing() {
		try {
			saving = true;

			// Filter out empty bullet points
			const filteredBulletPoints = bulletPoints.filter(bp => bp.trim() !== '');

			const dataToSave = {
				product_id: productId,
				sku_amazon: amazonListing.sku_amazon,
				asin: amazonListing.asin,
				feed_product_type: amazonListing.feed_product_type,
				bullet_points: filteredBulletPoints,
				specific_attributes: amazonListing.specific_attributes || {}
			};

			const { error } = await supabase
				.from('amazon_listings')
				.upsert(dataToSave, { onConflict: 'product_id' });

			if (error) throw error;

			alert('Listado de Amazon guardado correctamente');
			onSave();
		} catch (error) {
			console.error('Error saving Amazon listing:', error);
			const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
			alert(`Error al guardar listado de Amazon: ${errorMessage}`);
		} finally {
			saving = false;
		}
	}

	async function saveMLListing() {
		try {
			saving = true;

			const dataToSave = {
				product_id: productId,
				ml_id: mlListing.ml_id,
				listing_type: mlListing.listing_type || 'gold_special',
				attributes: mlListing.attributes || {}
			};

			const { error } = await supabase
				.from('mercadolibre_listings')
				.upsert(dataToSave, { onConflict: 'product_id' });

			if (error) throw error;

			alert('Listado de Mercado Libre guardado correctamente');
			onSave();
		} catch (error) {
			console.error('Error saving ML listing:', error);
			const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
			alert(`Error al guardar listado de Mercado Libre: ${errorMessage}`);
		} finally {
			saving = false;
		}
	}

	async function saveNewCategoryTemplate() {
		try {
			// Create a basic schema
			const basicSchema = {
				fields: [
					{ name: 'custom_field_1', type: 'text', required: false, label: 'Campo Personalizado 1' }
				]
			};

			const { error } = await supabase
				.from('category_mappings')
				.insert({
					internal_type: newCategoryData.internal_type,
					platform: newCategoryData.platform,
					external_category_id: newCategoryData.external_category_id,
					external_category_name: newCategoryData.external_category_name,
					required_schema: basicSchema
				});

			if (error) throw error;

			alert('Plantilla de categoría creada correctamente');
			showNewCategoryForm = false;
			await loadCategoryMappings();
		} catch (error) {
			console.error('Error creating category template:', error);
			const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
			alert(`Error al crear plantilla de categoría: ${errorMessage}`);
		}
	}
</script>

<div class="space-y-6">
	{#if loading}
		<p class="text-center text-gray-600">Cargando información PIM...</p>
	{:else}
		<!-- SAT Tab -->
		<div class="border rounded-lg p-6">
			<h3 class="text-xl font-bold mb-4">Información SAT (Fiscal)</h3>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="block text-sm font-medium mb-2">Clave Producto/Servicio (8 dígitos)</label>
					<input
						type="text"
						bind:value={satInfo.clave_prod_serv}
						maxlength="8"
						pattern="[0-9]{8}"
						class="w-full px-3 py-2 border rounded"
						placeholder="43211500"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-2">Clave Unidad</label>
					<input
						type="text"
						bind:value={satInfo.clave_unidad}
						class="w-full px-3 py-2 border rounded"
						placeholder="H87"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-2">Unidad de Medida</label>
					<input
						type="text"
						bind:value={satInfo.unidad_medida}
						class="w-full px-3 py-2 border rounded"
						placeholder="Pieza"
					/>
				</div>
				<div>
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							bind:checked={satInfo.material_peligroso}
							class="rounded"
						/>
						<span class="text-sm font-medium">Material Peligroso</span>
					</label>
				</div>
			</div>
			<button
				onclick={saveSATInfo}
				disabled={saving}
				class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
			>
				{saving ? 'Guardando...' : 'Guardar Información SAT'}
			</button>
		</div>

		<!-- Amazon Tab -->
		<div class="border rounded-lg p-6">
			<h3 class="text-xl font-bold mb-4">Amazon Listing</h3>
			
			<!-- Category Selector -->
			<div class="mb-4">
				<label class="block text-sm font-medium mb-2">Categoría de Producto</label>
				<select
					bind:value={selectedAmazonCategory}
					onchange={onAmazonCategoryChange}
					class="w-full px-3 py-2 border rounded"
				>
					<option value="">Seleccionar categoría...</option>
					{#each categoryMappings.filter(m => m.platform === 'amazon') as mapping}
						<option value={mapping.id}>
							{mapping.external_category_name || mapping.external_category_id}
						</option>
					{/each}
				</select>
				<button
					onclick={() => { showNewCategoryForm = true; newCategoryData.platform = 'amazon'; }}
					class="mt-2 text-sm text-blue-600 hover:underline"
				>
					+ Crear nueva plantilla de categoría
				</button>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="block text-sm font-medium mb-2">SKU Amazon</label>
					<input
						type="text"
						bind:value={amazonListing.sku_amazon}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-2">ASIN</label>
					<input
						type="text"
						bind:value={amazonListing.asin}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div class="col-span-2">
					<label class="block text-sm font-medium mb-2">Feed Product Type</label>
					<input
						type="text"
						bind:value={amazonListing.feed_product_type}
						class="w-full px-3 py-2 border rounded"
						placeholder="Home, HomeImprovement, etc."
					/>
				</div>
			</div>

			<!-- Bullet Points -->
			<div class="mt-4">
				<label class="block text-sm font-medium mb-2">Bullet Points</label>
				{#each bulletPoints as _, i}
					<input
						type="text"
						bind:value={bulletPoints[i]}
						class="w-full px-3 py-2 border rounded mb-2"
						placeholder={`Bullet point ${i + 1}`}
					/>
				{/each}
			</div>

			<!-- Dynamic Fields -->
			{#if amazonDynamicFields.length > 0}
				<div class="mt-4">
					<h4 class="font-medium mb-2">Atributos Específicos</h4>
					<div class="grid grid-cols-2 gap-4">
						{#each amazonDynamicFields as field}
							<div>
								<label class="block text-sm font-medium mb-2">
									{field.label}
									{#if field.required}<span class="text-red-500">*</span>{/if}
								</label>
								{#if field.type === 'select' && field.options}
									<select
										bind:value={amazonListing.specific_attributes[field.name]}
										class="w-full px-3 py-2 border rounded"
									>
										<option value="">Seleccionar...</option>
										{#each field.options as option}
											<option value={option}>{option}</option>
										{/each}
									</select>
								{:else if field.type === 'number'}
									<input
										type="number"
										bind:value={amazonListing.specific_attributes[field.name]}
										class="w-full px-3 py-2 border rounded"
									/>
								{:else}
									<input
										type="text"
										bind:value={amazonListing.specific_attributes[field.name]}
										class="w-full px-3 py-2 border rounded"
									/>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<button
				onclick={saveAmazonListing}
				disabled={saving}
				class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
			>
				{saving ? 'Guardando...' : 'Guardar Listado Amazon'}
			</button>
		</div>

		<!-- Mercado Libre Tab -->
		<div class="border rounded-lg p-6">
			<h3 class="text-xl font-bold mb-4">Mercado Libre Listing</h3>
			
			<!-- Category Selector -->
			<div class="mb-4">
				<label class="block text-sm font-medium mb-2">Categoría de Producto</label>
				<select
					bind:value={selectedMLCategory}
					onchange={onMLCategoryChange}
					class="w-full px-3 py-2 border rounded"
				>
					<option value="">Seleccionar categoría...</option>
					{#each categoryMappings.filter(m => m.platform === 'mercadolibre') as mapping}
						<option value={mapping.id}>
							{mapping.external_category_name || mapping.external_category_id}
						</option>
					{/each}
				</select>
				<button
					onclick={() => { showNewCategoryForm = true; newCategoryData.platform = 'mercadolibre'; }}
					class="mt-2 text-sm text-blue-600 hover:underline"
				>
					+ Crear nueva plantilla de categoría
				</button>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="block text-sm font-medium mb-2">ML ID</label>
					<input
						type="text"
						bind:value={mlListing.ml_id}
						class="w-full px-3 py-2 border rounded"
						placeholder="MLM123456789"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-2">Tipo de Publicación</label>
					<select
						bind:value={mlListing.listing_type}
						class="w-full px-3 py-2 border rounded"
					>
						<option value="gold_special">Gold Special</option>
						<option value="gold_pro">Gold Pro</option>
						<option value="gold">Gold</option>
						<option value="free">Gratis</option>
					</select>
				</div>
			</div>

			<!-- Dynamic Fields -->
			{#if mlDynamicFields.length > 0}
				<div class="mt-4">
					<h4 class="font-medium mb-2">Atributos del Producto</h4>
					<div class="grid grid-cols-2 gap-4">
						{#each mlDynamicFields as field}
							<div>
								<label class="block text-sm font-medium mb-2">
									{field.label}
									{#if field.required}<span class="text-red-500">*</span>{/if}
								</label>
								{#if field.type === 'select' && field.options}
									<select
										bind:value={mlListing.attributes[field.name]}
										class="w-full px-3 py-2 border rounded"
									>
										<option value="">Seleccionar...</option>
										{#each field.options as option}
											<option value={option}>{option}</option>
										{/each}
									</select>
								{:else if field.type === 'number'}
									<input
										type="number"
										bind:value={mlListing.attributes[field.name]}
										class="w-full px-3 py-2 border rounded"
									/>
								{:else}
									<input
										type="text"
										bind:value={mlListing.attributes[field.name]}
										class="w-full px-3 py-2 border rounded"
									/>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<button
				onclick={saveMLListing}
				disabled={saving}
				class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
			>
				{saving ? 'Guardando...' : 'Guardar Listado ML'}
			</button>
		</div>

		<!-- New Category Template Modal -->
		{#if showNewCategoryForm}
			<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
				<div class="bg-white rounded-lg p-6 max-w-md w-full">
					<h3 class="text-xl font-bold mb-4">Nueva Plantilla de Categoría</h3>
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium mb-2">Tipo Interno</label>
							<input
								type="text"
								bind:value={newCategoryData.internal_type}
								class="w-full px-3 py-2 border rounded"
								placeholder="sensor, laser, etc."
							/>
						</div>
						<div>
							<label class="block text-sm font-medium mb-2">Plataforma</label>
							<select
								bind:value={newCategoryData.platform}
								class="w-full px-3 py-2 border rounded"
							>
								<option value="amazon">Amazon</option>
								<option value="mercadolibre">Mercado Libre</option>
								<option value="sat">SAT</option>
							</select>
						</div>
						<div>
							<label class="block text-sm font-medium mb-2">ID de Categoría Externa</label>
							<input
								type="text"
								bind:value={newCategoryData.external_category_id}
								class="w-full px-3 py-2 border rounded"
							/>
						</div>
						<div>
							<label class="block text-sm font-medium mb-2">Nombre de Categoría</label>
							<input
								type="text"
								bind:value={newCategoryData.external_category_name}
								class="w-full px-3 py-2 border rounded"
							/>
						</div>
					</div>
					<div class="flex gap-2 mt-6">
						<button
							onclick={saveNewCategoryTemplate}
							class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
						>
							Crear Plantilla
						</button>
						<button
							onclick={() => { showNewCategoryForm = false; }}
							class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
						>
							Cancelar
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
