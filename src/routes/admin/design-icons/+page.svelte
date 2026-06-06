<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { validateSvgFile, slugify } from '$lib/design-builder/svgValidation';
	import {
		createCategory,
		deleteCategory,
		deleteIcon,
		fetchAllCategoriesAdmin,
		fetchAllIconsAdmin,
		iconPublicUrl,
		updateCategory,
		updateIcon,
		uploadIcon,
		type DesignIconCategoryRow,
		type DesignIconRow
	} from '$lib/services/designIconsService';

	let loading = $state(true);
	let saving = $state(false);
	let errorMsg = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	let categories = $state<DesignIconCategoryRow[]>([]);
	let icons = $state<DesignIconRow[]>([]);
	let selectedCategoryId = $state<string>('');

	let showCategoryModal = $state(false);
	let editingCategory = $state<DesignIconCategoryRow | null>(null);
	let categoryForm = $state({ label: '', slug: '', display_order: 0, is_active: true });

	let uploadName = $state('');
	let uploadOrder = $state(0);
	let selectedFile = $state<File | null>(null);
	let svgPreview = $state('');
	let svgWarnings = $state<string[]>([]);

	const categoryMap = $derived(Object.fromEntries(categories.map((c) => [c.id, c])));

	const filteredIcons = $derived(
		selectedCategoryId ? icons.filter((i) => i.category_id === selectedCategoryId) : icons
	);

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) {
			goto('/login');
			return;
		}
		await reload();
	});

	async function reload() {
		loading = true;
		errorMsg = null;
		try {
			categories = await fetchAllCategoriesAdmin();
			icons = await fetchAllIconsAdmin();
			if (!selectedCategoryId && categories.length) {
				selectedCategoryId = categories[0].id;
			}
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error al cargar biblioteca';
		} finally {
			loading = false;
		}
	}

	function openCategoryModal(cat?: DesignIconCategoryRow) {
		editingCategory = cat ?? null;
		categoryForm = cat
			? {
					label: cat.label,
					slug: cat.slug,
					display_order: cat.display_order,
					is_active: cat.is_active
				}
			: { label: '', slug: '', display_order: categories.length, is_active: true };
		showCategoryModal = true;
	}

	function closeCategoryModal() {
		showCategoryModal = false;
		editingCategory = null;
	}

	async function saveCategory() {
		if (!categoryForm.label.trim()) {
			errorMsg = 'El nombre de la categoría es obligatorio';
			return;
		}
		saving = true;
		errorMsg = null;
		try {
			const slug = categoryForm.slug.trim() || slugify(categoryForm.label);
			if (editingCategory) {
				await updateCategory(editingCategory.id, {
					label: categoryForm.label.trim(),
					slug,
					display_order: categoryForm.display_order,
					is_active: categoryForm.is_active
				});
				successMsg = 'Categoría actualizada';
			} else {
				await createCategory({
					label: categoryForm.label.trim(),
					slug,
					display_order: categoryForm.display_order
				});
				successMsg = 'Categoría creada';
			}
			closeCategoryModal();
			await reload();
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error al guardar categoría';
		} finally {
			saving = false;
		}
	}

	async function handleDeleteCategory(id: string) {
		const cat = categories.find((c) => c.id === id);
		if (!cat || !confirm(`¿Eliminar categoría "${cat.label}" y todos sus iconos?`)) return;
		saving = true;
		errorMsg = null;
		try {
			await deleteCategory(id);
			if (selectedCategoryId === id) selectedCategoryId = '';
			successMsg = 'Categoría eliminada';
			await reload();
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error al eliminar categoría';
		} finally {
			saving = false;
		}
	}

	async function handleFileSelect(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		selectedFile = file ?? null;
		svgPreview = '';
		svgWarnings = [];
		if (!file) return;

		const result = await validateSvgFile(file);
		if (!result.ok) {
			errorMsg = result.error ?? 'SVG inválido';
			selectedFile = null;
			input.value = '';
			return;
		}
		svgWarnings = result.warnings;
		svgPreview = URL.createObjectURL(file);
		if (!uploadName.trim()) {
			uploadName = file.name.replace(/\.svg$/i, '').replace(/[-_]/g, ' ');
		}
		errorMsg = null;
	}

	async function handleUploadIcon() {
		if (!selectedFile || !selectedCategoryId) {
			errorMsg = 'Selecciona categoría y archivo SVG';
			return;
		}
		if (!uploadName.trim()) {
			errorMsg = 'Indica un nombre para el icono';
			return;
		}

		const cat = categoryMap[selectedCategoryId];
		if (!cat) return;

		saving = true;
		errorMsg = null;
		try {
			await uploadIcon({
				file: selectedFile,
				categoryId: cat.id,
				categorySlug: cat.slug,
				name: uploadName.trim(),
				display_order: uploadOrder
			});
			successMsg = 'Icono subido correctamente';
			selectedFile = null;
			svgPreview = '';
			uploadName = '';
			uploadOrder = 0;
			const fileInput = document.getElementById('svg-upload') as HTMLInputElement;
			if (fileInput) fileInput.value = '';
			await reload();
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error al subir icono';
		} finally {
			saving = false;
		}
	}

	async function handleToggleIcon(icon: DesignIconRow) {
		saving = true;
		try {
			await updateIcon(icon.id, { is_active: !icon.is_active });
			await reload();
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error al actualizar icono';
		} finally {
			saving = false;
		}
	}

	async function handleDeleteIcon(icon: DesignIconRow) {
		if (!confirm(`¿Eliminar icono "${icon.name}"?`)) return;
		saving = true;
		try {
			await deleteIcon(icon.id, icon.storage_path);
			successMsg = 'Icono eliminado';
			await reload();
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Error al eliminar icono';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Biblioteca de iconos | Admin</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Biblioteca de iconos SVG</h1>
			<p class="mt-1 text-sm text-gray-600">
				Gestiona formas e iconos para el
				<a href="/admin/design-builder" class="text-blue-600 underline">constructor de diseños</a>.
			</p>
		</div>
		<button
			type="button"
			onclick={() => openCategoryModal()}
			class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
		>
			Nueva categoría
		</button>
	</div>

	{#if errorMsg}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
	{/if}
	{#if successMsg}
		<div class="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
			{successMsg}
		</div>
	{/if}

	<div class="mb-6 rounded-lg border bg-white p-4">
		<h2 class="mb-2 text-sm font-semibold text-gray-800">Guía rápida para láser</h2>
		<ul class="list-inside list-disc space-y-1 text-xs text-gray-600">
			<li>SVG monocromático, trazo negro (#000), sin gradientes ni sombras</li>
			<li>Sin imágenes PNG/JPG embebidas</li>
			<li>En Inkscape: Objeto → a trazo, simplificar trazos, viewBox definido</li>
			<li>Fuentes: SVG Repo, Noun Project (revisar licencia) o dibujos propios</li>
		</ul>
	</div>

	{#if loading}
		<p class="text-sm text-gray-500">Cargando…</p>
	{:else}
		<div class="grid gap-6 lg:grid-cols-[280px_1fr]">
			<aside class="rounded-lg border bg-white p-4">
				<h2 class="mb-3 text-sm font-semibold text-gray-800">Categorías</h2>
				<ul class="space-y-1">
					{#each categories as cat}
						<li class="flex items-center gap-1">
							<button
								type="button"
								onclick={() => (selectedCategoryId = cat.id)}
								class="flex-1 rounded px-2 py-1.5 text-left text-sm {selectedCategoryId === cat.id
									? 'bg-gray-100 font-medium text-gray-900'
									: 'text-gray-600 hover:bg-gray-50'}"
							>
								{cat.label}
								{#if !cat.is_active}
									<span class="text-xs text-amber-600"> (inactiva)</span>
								{/if}
							</button>
							<button
								type="button"
								onclick={() => openCategoryModal(cat)}
								class="rounded px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
								title="Editar"
							>
								✎
							</button>
							<button
								type="button"
								onclick={() => handleDeleteCategory(cat.id)}
								class="rounded px-1.5 py-1 text-xs text-red-500 hover:bg-red-50"
								title="Eliminar"
							>
								×
							</button>
						</li>
					{/each}
				</ul>
			</aside>

			<section class="space-y-6">
				<div class="rounded-lg border bg-white p-4">
					<h2 class="mb-3 text-sm font-semibold text-gray-800">Subir icono SVG</h2>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-3">
							<div>
								<label for="upload-category" class="mb-1 block text-xs font-medium text-gray-600"
									>Categoría</label
								>
								<select
									id="upload-category"
									bind:value={selectedCategoryId}
									class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
								>
									{#each categories as cat}
										<option value={cat.id}>{cat.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="upload-name" class="mb-1 block text-xs font-medium text-gray-600">Nombre</label>
								<input
									id="upload-name"
									type="text"
									bind:value={uploadName}
									class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
								/>
							</div>
							<div>
								<label for="upload-order" class="mb-1 block text-xs font-medium text-gray-600">Orden</label>
								<input
									id="upload-order"
									type="number"
									bind:value={uploadOrder}
									class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
								/>
							</div>
							<div>
								<label for="svg-upload" class="mb-1 block text-xs font-medium text-gray-600">Archivo SVG</label>
								<input
									id="svg-upload"
									type="file"
									accept=".svg,image/svg+xml"
									onchange={handleFileSelect}
									class="w-full text-sm"
								/>
							</div>
							{#each svgWarnings as w}
								<p class="text-xs text-amber-700">{w}</p>
							{/each}
							<button
								type="button"
								onclick={handleUploadIcon}
								disabled={saving || !selectedFile}
								class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
							>
								{saving ? 'Guardando…' : 'Subir icono'}
							</button>
						</div>
						<div class="flex min-h-[120px] items-center justify-center rounded border border-dashed bg-gray-50 p-4">
							{#if svgPreview}
								<img src={svgPreview} alt="Preview" class="max-h-32 max-w-full object-contain" />
							{:else}
								<span class="text-xs text-gray-400">Vista previa del SVG</span>
							{/if}
						</div>
					</div>
				</div>

				<div class="rounded-lg border bg-white p-4">
					<h2 class="mb-3 text-sm font-semibold text-gray-800">
						Iconos
						{#if selectedCategoryId && categoryMap[selectedCategoryId]}
							— {categoryMap[selectedCategoryId].label}
						{/if}
					</h2>
					{#if filteredIcons.length === 0}
						<p class="text-sm text-gray-500">No hay iconos en esta categoría.</p>
					{:else}
						<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
							{#each filteredIcons as icon}
								<div
									class="flex flex-col items-center gap-2 rounded-lg border p-3 {icon.is_active
										? 'border-gray-200'
										: 'border-amber-200 bg-amber-50/50 opacity-70'}"
								>
									<img
										src={iconPublicUrl(icon.storage_path)}
										alt={icon.name}
										class="h-12 w-12 object-contain"
									/>
									<span class="w-full truncate text-center text-xs font-medium">{icon.name}</span>
									<div class="flex gap-1">
										<button
											type="button"
											onclick={() => handleToggleIcon(icon)}
											class="rounded border px-2 py-0.5 text-[10px] hover:bg-gray-50"
										>
											{icon.is_active ? 'Desactivar' : 'Activar'}
										</button>
										<button
											type="button"
											onclick={() => handleDeleteIcon(icon)}
											class="rounded border border-red-200 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
										>
											Eliminar
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</section>
		</div>
	{/if}
</div>

{#if showCategoryModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
		<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
			<h3 class="mb-4 text-lg font-semibold">
				{editingCategory ? 'Editar categoría' : 'Nueva categoría'}
			</h3>
			<div class="space-y-3">
				<div>
					<label for="cat-label" class="mb-1 block text-xs font-medium text-gray-600">Nombre</label>
					<input
						id="cat-label"
						type="text"
						bind:value={categoryForm.label}
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="cat-slug" class="mb-1 block text-xs font-medium text-gray-600">Slug (opcional)</label>
					<input
						id="cat-slug"
						type="text"
						bind:value={categoryForm.slug}
						placeholder="auto desde nombre"
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="cat-order" class="mb-1 block text-xs font-medium text-gray-600">Orden</label>
					<input
						id="cat-order"
						type="number"
						bind:value={categoryForm.display_order}
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
					/>
				</div>
				{#if editingCategory}
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={categoryForm.is_active} />
						Activa
					</label>
				{/if}
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					onclick={closeCategoryModal}
					class="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
				>
					Cancelar
				</button>
				<button
					type="button"
					onclick={saveCategory}
					disabled={saving}
					class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
				>
					Guardar
				</button>
			</div>
		</div>
	</div>
{/if}
