<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { generateSlug } from '$lib/utils';
	import type { Category } from '$lib/types';

	let categories: Category[] = $state([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingCategory = $state<Category | null>(null);

	let formData = $state({
		name: '',
		slug: '',
		description: '',
		image_url: '',
		display_order: 0,
		is_active: true
	});

	onMount(async () => {
		await loadCategories();
	});

	async function loadCategories() {
		loading = true;
		const { data } = await supabase
			.from('categories')
			.select('*')
			.order('display_order');

		if (data) {
			categories = data;
		}
		loading = false;
	}

	function openModal(category?: Category) {
		if (category) {
			editingCategory = category;
			formData = {
				name: category.name,
				slug: category.slug,
				description: category.description || '',
				image_url: category.image_url || '',
				display_order: category.display_order,
				is_active: category.is_active
			};
		} else {
			editingCategory = null;
			formData = {
				name: '',
				slug: '',
				description: '',
				image_url: '',
				display_order: 0,
				is_active: true
			};
		}
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingCategory = null;
	}

	function updateSlug() {
		if (formData.name && !editingCategory) {
			formData.slug = generateSlug(formData.name);
		}
	}

	async function saveCategory() {
		try {
			if (editingCategory) {
				const { error } = await supabase
					.from('categories')
					.update(formData)
					.eq('id', editingCategory.id);

				if (error) throw error;
			} else {
				const { error } = await supabase.from('categories').insert([formData]);

				if (error) throw error;
			}

			closeModal();
			await loadCategories();
		} catch (error: any) {
			alert('Error al guardar categoría: ' + error.message);
		}
	}

	async function deleteCategory(id: string) {
		if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;

		try {
			const { error } = await supabase.from('categories').delete().eq('id', id);

			if (error) throw error;

			await loadCategories();
		} catch (error: any) {
			alert('Error al eliminar categoría: ' + error.message);
		}
	}

	async function toggleActive(category: Category) {
		try {
			const { error } = await supabase
				.from('categories')
				.update({ is_active: !category.is_active })
				.eq('id', category.id);

			if (error) throw error;

			await loadCategories();
		} catch (error: any) {
			alert('Error al actualizar categoría: ' + error.message);
		}
	}
</script>

<svelte:head>
	<title>Gestión de Categorías - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-4xl font-bold">Gestión de Categorías</h1>
		<div class="flex gap-4">
			<a
				href="/admin"
				class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
			>
				← Volver
			</a>
			<button
				onclick={() => openModal()}
				class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
			>
				+ Nueva Categoría
			</button>
		</div>
	</div>

	{#if loading}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">Cargando categorías...</p>
		</div>
	{:else if categories.length === 0}
		<div class="bg-gray-50 rounded-lg p-8 text-center">
			<p class="text-xl text-gray-600 mb-4">No hay categorías registradas</p>
			<button
				onclick={() => openModal()}
				class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
			>
				Crear Primera Categoría
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each categories as category}
				<div class="bg-white rounded-lg shadow-md overflow-hidden">
					{#if category.image_url}
						<img src={category.image_url} alt={category.name} class="w-full h-48 object-cover" />
					{:else}
						<div class="w-full h-48 bg-gray-200 flex items-center justify-center">
							<span class="text-gray-400">Sin imagen</span>
						</div>
					{/if}
					<div class="p-4">
						<div class="flex items-start justify-between mb-2">
							<div>
								<h3 class="text-xl font-bold">{category.name}</h3>
								<p class="text-sm text-gray-600">{category.slug}</p>
							</div>
							<button
								onclick={() => toggleActive(category)}
								class="px-2 py-1 rounded text-xs {category.is_active
									? 'bg-green-100 text-green-800'
									: 'bg-red-100 text-red-800'}"
							>
								{category.is_active ? 'Activo' : 'Inactivo'}
							</button>
						</div>
						{#if category.description}
							<p class="text-gray-600 text-sm mb-4">{category.description}</p>
						{/if}
						<div class="flex gap-2">
							<button
								onclick={() => openModal(category)}
								class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
							>
								Editar
							</button>
							<button
								onclick={() => deleteCategory(category.id)}
								class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
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
		<div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
			<div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
				<h2 class="text-2xl font-bold">
					{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
				</h2>
				<button onclick={closeModal} class="text-gray-500 hover:text-gray-700 text-2xl">
					×
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); saveCategory(); }} class="p-6 space-y-4">
				<div>
					<label class="block text-sm font-semibold mb-2">Nombre *</label>
					<input
						type="text"
						bind:value={formData.name}
						onblur={updateSlug}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Slug *</label>
					<input
						type="text"
						bind:value={formData.slug}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Descripción</label>
					<textarea
						bind:value={formData.description}
						rows="4"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">URL de Imagen</label>
					<input
						type="url"
						bind:value={formData.image_url}
						placeholder="https://ejemplo.com/imagen.jpg"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-semibold mb-2">Orden de Visualización</label>
					<input
						type="number"
						bind:value={formData.display_order}
						min="0"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={formData.is_active} class="w-4 h-4" />
						<span class="text-sm">Categoría Activa</span>
					</label>
				</div>

				<div class="flex gap-4 pt-4">
					<button
						type="submit"
						class="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
					>
						{editingCategory ? 'Actualizar' : 'Crear'} Categoría
					</button>
					<button
						type="button"
						onclick={closeModal}
						class="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
					>
						Cancelar
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}