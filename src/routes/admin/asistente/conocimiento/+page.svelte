<script lang="ts">
	import { onMount } from 'svelte';
	import { aiFetch } from '$lib/assistantApi';
	import AssistantAdminNav from '$lib/components/assistant/AssistantAdminNav.svelte';
	import '$lib/components/assistant/assistant.css';

	type Channel = { slug: string; label: string; emoji: string };
	type Article = {
		id: string;
		title: string;
		content: string;
		channel: string;
		source_type: string;
		is_verified: boolean;
	};

	let channels = $state<Channel[]>([]);
	let articles = $state<Article[]>([]);
	let filterChannel = $state('');
	let form = $state({ title: '', content: '', channel: 'general' });
	let editingId = $state<string | null>(null);
	let message = $state('');

	onMount(async () => {
		await loadChannels();
		await loadArticles();
	});

	async function loadChannels() {
		const res = await aiFetch('/api/ai/channels');
		if (res.ok) channels = (await res.json()).channels ?? [];
	}

	async function loadArticles() {
		const url = filterChannel
			? `/api/ai/knowledge?channel=${encodeURIComponent(filterChannel)}`
			: '/api/ai/knowledge';
		const res = await aiFetch(url);
		if (res.ok) articles = (await res.json()).articles ?? [];
	}

	async function saveArticle() {
		if (!form.title.trim() || !form.content.trim()) return;
		const res = await aiFetch('/api/ai/knowledge', {
			method: editingId ? 'PATCH' : 'POST',
			body: JSON.stringify(editingId ? { id: editingId, ...form } : form)
		});
		const data = await res.json();
		if (res.ok) {
			message = editingId ? 'Artículo actualizado' : 'Artículo guardado en la base del equipo';
			form = { title: '', content: '', channel: filterChannel || 'general' };
			editingId = null;
			await loadArticles();
		} else {
			message = data.error ?? 'Error';
		}
	}

	function editArticle(a: Article) {
		editingId = a.id;
		form = { title: a.title, content: a.content, channel: a.channel };
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function deleteArticle(id: string) {
		if (!confirm('¿Eliminar este artículo de la base de conocimientos?')) return;
		await aiFetch(`/api/ai/knowledge?id=${id}`, { method: 'DELETE' });
		await loadArticles();
	}
</script>

<div class="assistant-root min-h-screen">
	<header class="assistant-header">
		<span class="font-medium">Base de conocimientos</span>
		<a href="/admin/asistente" class="text-sm text-[var(--as-accent)] ml-auto">← Chat</a>
	</header>
	<AssistantAdminNav />

	<div class="p-4 max-w-4xl mx-auto space-y-6">
		<p class="text-sm text-[var(--as-text-muted)]">
			Agrega equivalencias, notas técnicas y respuestas curadas por tema. Todo el equipo las ve al
			consultar ese canal en el chat.
		</p>

		{#if message}
			<p class="text-sm text-green-400">{message}</p>
		{/if}

		<div class="assistant-quote-editor">
			<h2 class="font-medium mb-3">{editingId ? 'Editar artículo' : 'Nuevo artículo'}</h2>
			<div class="grid gap-3">
				<label class="text-xs text-[var(--as-text-muted)]">
					Tema
					<select class="assistant-select w-full mt-1" bind:value={form.channel}>
						{#each channels as ch}
							<option value={ch.slug}>{ch.emoji} {ch.label}</option>
						{/each}
					</select>
				</label>
				<label class="text-xs text-[var(--as-text-muted)]">
					Título
					<input class="assistant-select w-full mt-1" bind:value={form.title} placeholder="Ej: Equivalencia tubo Reci W2 → EFR F2" />
				</label>
				<label class="text-xs text-[var(--as-text-muted)]">
					Contenido
					<textarea
						class="assistant-select w-full mt-1 min-h-[120px]"
						bind:value={form.content}
						placeholder="Detalle técnico, precio referencia, compatibilidades..."
					></textarea>
				</label>
				<div class="flex gap-2">
					<button type="button" class="assistant-chip active" onclick={saveArticle}>
						{editingId ? 'Actualizar' : 'Guardar en base'}
					</button>
					{#if editingId}
						<button
							type="button"
							class="assistant-chip"
							onclick={() => {
								editingId = null;
								form = { title: '', content: '', channel: filterChannel || 'general' };
							}}
						>
							Cancelar
						</button>
					{/if}
				</div>
			</div>
		</div>

		<div>
			<label class="text-xs text-[var(--as-text-muted)] mr-2">Filtrar por tema:</label>
			<select
				class="assistant-select"
				bind:value={filterChannel}
				onchange={() => loadArticles()}
			>
				<option value="">Todos</option>
				{#each channels as ch}
					<option value={ch.slug}>{ch.label}</option>
				{/each}
			</select>
		</div>

		<div class="space-y-2">
			{#each articles as a}
				<div class="assistant-quote-editor text-sm">
					<div class="flex justify-between gap-2 mb-1">
						<strong>{a.title}</strong>
						<span class="text-[var(--as-text-muted)] text-xs">{a.channel}</span>
					</div>
					<p class="text-[var(--as-text-muted)] whitespace-pre-wrap line-clamp-3">{a.content}</p>
					<div class="flex gap-2 mt-2">
						<button type="button" class="assistant-chip text-xs" onclick={() => editArticle(a)}>Editar</button>
						<button type="button" class="assistant-chip text-xs text-red-400" onclick={() => deleteArticle(a.id)}>Eliminar</button>
					</div>
				</div>
			{:else}
				<p class="text-[var(--as-text-muted)] text-sm">No hay artículos manuales aún (el catálogo ya está indexado automáticamente).</p>
			{/each}
		</div>
	</div>
</div>
