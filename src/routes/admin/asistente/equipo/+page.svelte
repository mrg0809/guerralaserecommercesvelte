<script lang="ts">
	import { onMount } from 'svelte';
	import { aiFetch } from '$lib/assistantApi';
	import AssistantAdminNav from '$lib/components/assistant/AssistantAdminNav.svelte';
	import '$lib/components/assistant/assistant.css';

	type Member = { id: string; display_name: string; is_active: boolean; sort_order: number };

	let members = $state<Member[]>([]);
	let newName = $state('');
	let message = $state('');

	onMount(load);

	async function load() {
		const res = await aiFetch('/api/ai/team-members?all=1');
		if (res.ok) members = (await res.json()).members ?? [];
	}

	async function addMember() {
		if (!newName.trim()) return;
		const res = await aiFetch('/api/ai/team-members', {
			method: 'POST',
			body: JSON.stringify({ display_name: newName.trim() })
		});
		if (res.ok) {
			newName = '';
			message = 'Miembro agregado — aparecerá en el selector de la app móvil';
			await load();
		}
	}

	async function deactivate(id: string) {
		await aiFetch('/api/ai/team-members', {
			method: 'PATCH',
			body: JSON.stringify({ id, is_active: false })
		});
		await load();
	}
</script>

<div class="assistant-root min-h-screen">
	<header class="assistant-header">
		<span class="font-medium">Equipo — selector móvil</span>
		<a href="/admin/asistente" class="text-sm text-[var(--as-accent)] ml-auto">← Chat</a>
	</header>
	<AssistantAdminNav />

	<div class="p-4 max-w-2xl mx-auto space-y-6">
		<p class="text-sm text-[var(--as-text-muted)]">
			En la <strong>app móvil</strong>, cada quien elige su nombre al abrir (sin contraseña). Eso
			solo sirve para saber quién hizo cada consulta en el historial — el conocimiento es
			<strong>compartido para todos</strong>.
			<br /><br />
			En la <strong>web</strong>, el chat queda ligado a tu usuario de login Supabase automáticamente.
		</p>

		{#if message}
			<p class="text-sm text-green-400">{message}</p>
		{/if}

		<div class="assistant-quote-editor flex gap-2">
			<input class="assistant-select flex-1" bind:value={newName} placeholder="Nombre del vendedor o técnico" />
			<button type="button" class="assistant-chip active" onclick={addMember}>Agregar</button>
		</div>

		<ul class="space-y-2">
			{#each members.filter((m) => m.is_active) as m}
				<li class="assistant-quote-editor flex justify-between items-center text-sm">
					<span>{m.display_name}</span>
					<button type="button" class="assistant-chip text-xs" onclick={() => deactivate(m.id)}>Desactivar</button>
				</li>
			{/each}
		</ul>
	</div>
</div>
