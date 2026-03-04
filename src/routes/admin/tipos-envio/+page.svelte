<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice } from '$lib/utils';

	type ShippingType = {
		id: string;
		name: string;
		description: string | null;
		carrier: string | null;
		service: string | null;
		base_price: number;
		estimated_days: number | null;
		display_order: number | null;
		is_active: boolean | null;
	};

	let shippingTypes = $state<ShippingType[]>([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingType = $state<ShippingType | null>(null);
	let saving = $state(false);
	let error = $state('');

	let formData = $state({
		name: '',
		description: '',
		carrier: '',
		service: '',
		base_price: 0,
		estimated_days: 3,
		display_order: 0,
		is_active: true
	});

	onMount(async () => {
		await loadShippingTypes();
	});

	async function loadShippingTypes() {
		loading = true;
		error = '';

		const { data, error: dbError } = await (supabase as any)
			.from('shipping_types')
			.select('id, name, description, carrier, service, base_price, estimated_days, display_order, is_active')
			.order('display_order', { ascending: true })
			.order('name', { ascending: true });

		if (dbError) {
			error = dbError.message;
			shippingTypes = [];
		} else {
			shippingTypes = data || [];
		}

		loading = false;
	}

	function openModal(shippingType?: ShippingType) {
		if (shippingType) {
			editingType = shippingType;
			formData = {
				name: shippingType.name,
				description: shippingType.description || '',
				carrier: shippingType.carrier || '',
				service: shippingType.service || '',
				base_price: shippingType.base_price || 0,
				estimated_days: shippingType.estimated_days || 0,
				display_order: shippingType.display_order || 0,
				is_active: Boolean(shippingType.is_active)
			};
		} else {
			editingType = null;
			formData = {
				name: '',
				description: '',
				carrier: '',
				service: '',
				base_price: 0,
				estimated_days: 3,
				display_order: shippingTypes.length,
				is_active: true
			};
		}

		error = '';
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingType = null;
	}

	async function saveShippingType() {
		saving = true;
		error = '';

		const payload = {
			name: formData.name.trim(),
			description: formData.description.trim() || null,
			carrier: formData.carrier.trim() || null,
			service: formData.service.trim() || null,
			base_price: Number(formData.base_price || 0),
			estimated_days: Number(formData.estimated_days || 0),
			display_order: Number(formData.display_order || 0),
			is_active: formData.is_active
		};

		if (!payload.name) {
			error = 'El nombre es obligatorio';
			saving = false;
			return;
		}

		let dbError: any;
		if (editingType) {
			const { error: updateError } = await (supabase as any)
				.from('shipping_types')
				.update(payload)
				.eq('id', editingType.id);
			dbError = updateError;
		} else {
			const { error: insertError } = await (supabase as any).from('shipping_types').insert(payload);
			dbError = insertError;
		}

		if (dbError) {
			error = dbError.message;
			saving = false;
			return;
		}

		await loadShippingTypes();
		closeModal();
		saving = false;
	}

	async function deleteShippingType(shippingType: ShippingType) {
		const ok = confirm(`¿Eliminar el tipo de envío "${shippingType.name}"?`);
		if (!ok) return;

		const { error: deleteError } = await (supabase as any)
			.from('shipping_types')
			.delete()
			.eq('id', shippingType.id);
		if (deleteError) {
			alert(`No se pudo eliminar: ${deleteError.message}`);
			return;
		}

		await loadShippingTypes();
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-3xl font-bold">Tipos de Envío</h1>
			<p class="text-gray-600 mt-1">Administra carriers, servicios, precios y tiempos estimados.</p>
		</div>
		<button
			onclick={() => openModal()}
			class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
		>
			+ Nuevo tipo
		</button>
	</div>

	{#if error}
		<div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="bg-white rounded-lg shadow p-8 text-center text-gray-600">Cargando tipos de envío...</div>
	{:else if shippingTypes.length === 0}
		<div class="bg-white rounded-lg shadow p-8 text-center text-gray-600">No hay tipos de envío registrados.</div>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="w-full">
				<thead class="bg-gray-100">
					<tr>
						<th class="px-4 py-3 text-left">Nombre</th>
						<th class="px-4 py-3 text-left">Carrier / Servicio</th>
						<th class="px-4 py-3 text-left">Precio base</th>
						<th class="px-4 py-3 text-left">Días</th>
						<th class="px-4 py-3 text-left">Estado</th>
						<th class="px-4 py-3 text-right">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each shippingTypes as shippingType}
						<tr class="border-t">
							<td class="px-4 py-3">
								<p class="font-semibold">{shippingType.name}</p>
								{#if shippingType.description}
									<p class="text-sm text-gray-600">{shippingType.description}</p>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-gray-700">
								{shippingType.carrier || '-'} / {shippingType.service || '-'}
							</td>
							<td class="px-4 py-3 font-semibold">{formatPrice(shippingType.base_price)}</td>
							<td class="px-4 py-3">{shippingType.estimated_days ?? 0}</td>
							<td class="px-4 py-3">
								<span class="px-2 py-1 rounded-full text-xs {shippingType.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}">
									{shippingType.is_active ? 'Activo' : 'Inactivo'}
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								<button class="text-blue-600 hover:text-blue-800 mr-3" onclick={() => openModal(shippingType)}>Editar</button>
								<button class="text-red-600 hover:text-red-800" onclick={() => deleteShippingType(shippingType)}>Eliminar</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if showModal}
	<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
		<div class="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-bold">{editingType ? 'Editar tipo de envío' : 'Nuevo tipo de envío'}</h2>
				<button class="text-gray-500 hover:text-gray-700 text-2xl" onclick={closeModal}>×</button>
			</div>

			<div class="space-y-4">
				<div>
					<label class="block text-sm font-semibold mb-1" for="shipping-type-name">Nombre *</label>
					<input id="shipping-type-name" bind:value={formData.name} class="w-full px-3 py-2 border rounded-lg" />
				</div>
				<div>
					<label class="block text-sm font-semibold mb-1" for="shipping-type-description">Descripción</label>
					<textarea id="shipping-type-description" bind:value={formData.description} rows="2" class="w-full px-3 py-2 border rounded-lg"></textarea>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-semibold mb-1" for="shipping-type-carrier">Carrier</label>
						<input id="shipping-type-carrier" bind:value={formData.carrier} placeholder="fedex, dhl..." class="w-full px-3 py-2 border rounded-lg" />
					</div>
					<div>
						<label class="block text-sm font-semibold mb-1" for="shipping-type-service">Servicio</label>
						<input id="shipping-type-service" bind:value={formData.service} placeholder="standard, express..." class="w-full px-3 py-2 border rounded-lg" />
					</div>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div>
						<label class="block text-sm font-semibold mb-1" for="shipping-type-price">Precio base (MXN)</label>
						<input id="shipping-type-price" type="number" min="0" step="0.01" bind:value={formData.base_price} class="w-full px-3 py-2 border rounded-lg" />
					</div>
					<div>
						<label class="block text-sm font-semibold mb-1" for="shipping-type-days">Días estimados</label>
						<input id="shipping-type-days" type="number" min="0" bind:value={formData.estimated_days} class="w-full px-3 py-2 border rounded-lg" />
					</div>
					<div>
						<label class="block text-sm font-semibold mb-1" for="shipping-type-order">Orden</label>
						<input id="shipping-type-order" type="number" min="0" bind:value={formData.display_order} class="w-full px-3 py-2 border rounded-lg" />
					</div>
				</div>

				<label class="inline-flex items-center gap-2 text-sm font-medium">
					<input type="checkbox" bind:checked={formData.is_active} class="w-4 h-4" />
					Activo
				</label>
			</div>

			<div class="flex justify-end gap-3 mt-6">
				<button class="px-4 py-2 border rounded-lg hover:bg-gray-50" onclick={closeModal}>Cancelar</button>
				<button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400" onclick={saveShippingType} disabled={saving}>
					{saving ? 'Guardando...' : 'Guardar'}
				</button>
			</div>
		</div>
	</div>
{/if}
