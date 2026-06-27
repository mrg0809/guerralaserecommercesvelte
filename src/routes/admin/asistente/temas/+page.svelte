<script lang="ts">
	import { onMount } from 'svelte';
	import { aiFetch } from '$lib/assistantApi';
	import AssistantAdminNav from '$lib/components/assistant/AssistantAdminNav.svelte';
	import '$lib/components/assistant/assistant.css';

	type Channel = {
		slug: string;
		label: string;
		emoji: string;
		description?: string;
		sort_order: number;
		is_active: boolean;
	};

	let channels = $state<Channel[]>([]);
	let form = $state({ slug: '', label: '', emoji: '💬', description: '' });
	let message = $state('');

	onMount(load);

	async function load() {
		const res = await aiFetch('/api/ai/channels');
		if (res.ok) {
			const data = await res.json();
			channels = data.channels ?? [];
		}
	}

	async function addChannel() {
		const res = await aiFetch('/api/ai/channels', {
			method: 'POST',
			body: JSON.stringify(form)
		});
		const data = await res.json();
		if (res.ok) {
			message = `Tema "${data.channel.label}" creado`;
			form = { slug: '', label: '', emoji: '💬', description: '' };
			await load();
		} else {
			message = data.error ?? 'Error';
		}
	}

	async function deactivate(slug: string) {
		if (!confirm(`¿Desactivar tema "${slug}"?`)) return;
		await aiFetch(`/api/ai/channels?slug=${slug}`, { method: 'DELETE' });
		await load();
	}
</script>

<div class="assistant-root min-h-screen">
	<header class="assistant-header">
		<span class="font-medium">Temas del asistente</span>
		<a href="/admin/asistente" class="text-sm text-[var(--as-accent)] ml-auto">← Chat</a>
	</header>
	<AssistantAdminNav />

	<div class="p-4 max-w-3xl mx-auto space-y-6">
		<p class="text-sm text-[var(--as-text-muted)]">
			Los temas aparecen como chips en el chat. Al elegir uno, la IA prioriza artículos de ese tema
			(+ General).
		</p>

		{#if message}
			<p class="text-sm text-green-400">{message}</p>
		{/if}

		<div class="assistant-quote-editor">
			<h2 class="font-medium mb-3">Agregar tema</h2>
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="text-xs text-[var(--as-text-muted)]">
					ID (slug)
					<input class="assistant-select w-full mt-1" bind:value={form.slug} placeholder="extractores" />
				</label>
				<label class="text-xs text-[var(--as-text-muted)]">
					Nombre visible
					<input class="assistant-select w-full mt-1" bind:value={form.label} placeholder="Extractores" />
				</label>
				<label class="text-xs text-[var(--as-text-muted)]">
					Emoji
					<input class="assistant-select w-full mt-1 w-20" bind:value={form.emoji} />
				</label>
				<label class="text-xs text-[var(--as-text-muted)] sm:col-span-2">
					Descripción (opcional)
					<input class="assistant-select w-full mt-1" bind:value={form.description} />
				</label>
			</div>
			<button type="button" class="assistant-chip active mt-3" onclick={addChannel}>Crear tema</button>
		</div>

		<div class="space-y-2">
			<h2 class="font-medium text-sm">Temas activos</h2>
			{#each channels as ch}
				<div class="assistant-quote-editor flex items-center justify-between text-sm">
					<span>{ch.emoji} <strong>{ch.label}</strong> <code class="text-xs opacity-60">{ch.slug}</code></span>
					{#if ch.slug !== 'general'}
						<button type="button" class="assistant-chip text-xs" onclick={() => deactivate(ch.slug)}>Desactivar</button>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>
