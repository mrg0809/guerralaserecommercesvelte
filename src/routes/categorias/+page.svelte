<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { getImageKitUrl } from '$lib/storage';

	let categories = $state<any[]>([]);
	let loading = $state(true);

	onMount(async () => {
		const { data } = await supabase
			.from('categories')
			.select('id, name, slug, description, image_url, display_order, is_active')
			.eq('is_active', true)
			.order('display_order');

		if (data) {
			categories = data;
		}
		loading = false;
	});
</script>

<svelte:head>
	<title>Categorías - Guerra Láser</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-4xl font-bold mb-8">Todas las Categorías</h1>

	{#if loading}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">Cargando categorías...</p>
		</div>
	{:else if categories.length === 0}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">No hay categorías disponibles.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each categories as category}
				<a
					href="/categorias/{category.slug}"
					class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition"
				>
					{#if category.image_url}
						<img
							src={getImageKitUrl(category.image_url)}
							alt={category.name}
							class="w-full h-48 object-cover"
						/>
					{:else}
						<div class="w-full h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
							<span class="text-white text-4xl">📦</span>
						</div>
					{/if}
					<div class="p-6">
						<h2 class="text-2xl font-bold mb-2">{category.name}</h2>
						{#if category.description}
							<p class="text-gray-600">{category.description}</p>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>