<script lang="ts">
	import type { AiChatMessage, AiChatSession, QuoteDraft } from '$lib/types/assistant';
	import { aiFetch } from '$lib/assistantApi';
	import ChannelChips from './ChannelChips.svelte';
	import QuoteEditor from './QuoteEditor.svelte';
	import AssistantAdminNav from './AssistantAdminNav.svelte';
	import './assistant.css';

	type AiChannel = { slug: string; label: string; emoji: string };

	let {
		mode = 'admin',
		showBackLink = true,
		initialMode = 'knowledge' as 'knowledge' | 'quotation'
	}: {
		mode?: 'admin' | 'mobile';
		showBackLink?: boolean;
		initialMode?: 'knowledge' | 'quotation';
	} = $props();

	let channels = $state<AiChannel[]>([]);
	let channel = $state('general');
	let sessionType = $state<'knowledge' | 'quotation'>(initialMode);
	let sessions = $state<AiChatSession[]>([]);
	let messages = $state<AiChatMessage[]>([]);
	let sessionId = $state<string | null>(null);
	let input = $state('');
	let loading = $state(false);
	let sidebarOpen = $state(false);
	let teamMembers = $state<{ id: string; display_name: string }[]>([]);
	let teamMemberId = $state('');
	let quoteDraft = $state<QuoteDraft | null>(null);
	let whatsappText = $state('');
	let searchQuery = $state('');
	let fileInput: HTMLInputElement;

	$effect(() => {
		loadSessions();
		loadTeamMembers();
		loadChannels();
		if (typeof localStorage !== 'undefined') {
			const stored = localStorage.getItem('gl_ai_team_member_id');
			if (stored) teamMemberId = stored;
		}
	});

	async function loadChannels() {
		const res = await aiFetch('/api/ai/channels');
		if (res.ok) {
			const data = await res.json();
			channels = data.channels ?? [];
		}
	}

	async function loadTeamMembers() {
		const res = await aiFetch('/api/ai/team-members');
		if (res.ok) {
			const data = await res.json();
			teamMembers = data.members ?? [];
		}
	}

	function onTeamMemberChange(id: string) {
		teamMemberId = id;
		localStorage.setItem('gl_ai_team_member_id', id);
	}

	async function loadSessions() {
		const res = await aiFetch('/api/ai/sessions');
		if (res.ok) {
			const data = await res.json();
			sessions = data.sessions ?? [];
		}
	}

	async function loadMessages(id: string) {
		const res = await aiFetch(`/api/ai/chat?sessionId=${id}`);
		if (res.ok) {
			const data = await res.json();
			messages = data.messages ?? [];
		}
	}

	async function newChat(type: 'knowledge' | 'quotation' = 'knowledge') {
		sessionType = type;
		sessionId = null;
		messages = [];
		quoteDraft = null;
		whatsappText = '';
		input = '';
		sidebarOpen = false;
	}

	async function selectSession(s: AiChatSession) {
		sessionId = s.id;
		sessionType = s.session_type;
		channel = s.channel;
		await loadMessages(s.id);
		sidebarOpen = false;
	}

	async function saveToKnowledge(meta: NonNullable<AiChatMessage['metadata']>) {
		if (!meta.suggestedTitle || !meta.suggestedContent) return;
		await aiFetch('/api/ai/knowledge', {
			method: 'POST',
			body: JSON.stringify({
				title: meta.suggestedTitle,
				content: meta.suggestedContent,
				channel: meta.suggestedChannel ?? channel,
				source_type: 'conversation'
			})
		});
		alert('Guardado en la base de conocimientos del equipo');
	}

	async function sendMessage() {
		const text = input.trim();
		if (!text || loading) return;
		loading = true;
		input = '';

		messages = [...messages, { id: crypto.randomUUID(), role: 'user', content: text, created_at: new Date().toISOString() }];

		try {
			if (sessionType === 'quotation') {
				const res = await aiFetch('/api/ai/quote/parse', {
					method: 'POST',
					body: JSON.stringify({ message: text })
				});
				const data = await res.json();
				if (res.ok) {
					quoteDraft = data.draft;
					messages = [
						...messages,
						{
							id: crypto.randomUUID(),
							role: 'assistant',
							content:
								'Revisa y edita la cotización abajo. Agrega líneas manuales si hace falta, luego genera el texto para WhatsApp.',
							created_at: new Date().toISOString()
						}
					];
				} else {
					messages = [
						...messages,
						{
							id: crypto.randomUUID(),
							role: 'assistant',
							content: `Error: ${data.error}`,
							created_at: new Date().toISOString()
						}
					];
				}
			} else {
				const res = await aiFetch('/api/ai/chat', {
					method: 'POST',
					body: JSON.stringify({ message: text, channel, sessionId, sessionType })
				});
				const data = await res.json();
				if (res.ok) {
					sessionId = data.sessionId;
					messages = [...messages.filter((m) => m.role !== 'assistant' || m.content !== '...'), data.message];
					await loadSessions();
				} else {
					messages = [
						...messages,
						{
							id: crypto.randomUUID(),
							role: 'assistant',
							content: `Error: ${data.error}`,
							created_at: new Date().toISOString()
						}
					];
				}
			}
		} finally {
			loading = false;
		}
	}

	async function confirmQuote(draft: QuoteDraft) {
		loading = true;
		try {
			const res = await aiFetch('/api/ai/quote/format', {
				method: 'POST',
				body: JSON.stringify({ draft })
			});
			const data = await res.json();
			if (res.ok) {
				whatsappText = data.whatsappText;
				messages = [
					...messages,
					{
						id: crypto.randomUUID(),
						role: 'assistant',
						content: data.whatsappText,
						metadata: { whatsappText: data.whatsappText, quoteDraft: draft },
						created_at: new Date().toISOString()
					}
				];
			}
		} finally {
			loading = false;
		}
	}

	async function downloadPdf(draft: QuoteDraft) {
		const res = await aiFetch('/api/ai/quote/pdf', {
			method: 'POST',
			body: JSON.stringify({ draft: quoteDraft ?? draft })
		});
		const data = await res.json();
		if (res.ok && data.downloadUrl) {
			const a = document.createElement('a');
			a.href = data.downloadUrl;
			a.download = data.filename;
			a.click();
		} else {
			alert(data.error || 'No se pudo generar el PDF');
		}
	}

	function copyWhatsapp(text: string) {
		navigator.clipboard.writeText(text);
	}

	async function onFileSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const fd = new FormData();
		fd.append('file', file);
		if (sessionId) fd.append('sessionId', sessionId);
		await aiFetch('/api/ai/upload', { method: 'POST', body: fd });
		input.value = '';
		alert(`Archivo "${file.name}" subido. Menciónalo en tu mensaje.`);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	const filteredSessions = $derived(
		searchQuery
			? sessions.filter((s) => s.title?.toLowerCase().includes(searchQuery.toLowerCase()))
			: sessions
	);
</script>

<div class="assistant-root">
	<div class="flex flex-1 min-h-0">
		{#if sidebarOpen}
			<button class="assistant-sidebar-overlay md:hidden" aria-label="Cerrar" onclick={() => (sidebarOpen = false)}></button>
		{/if}

		<aside class="assistant-sidebar {sidebarOpen ? 'open' : ''} hidden md:flex">
			<div class="p-3 border-b border-[var(--as-border)]">
				<button type="button" class="assistant-chip active w-full justify-center" onclick={() => newChat('knowledge')}>
					+ Nuevo chat
				</button>
				<button type="button" class="assistant-chip w-full justify-center mt-2" onclick={() => newChat('quotation')}>
					💰 Cotizar
				</button>
			</div>
			<div class="p-2 flex-1 overflow-y-auto">
				{#each filteredSessions as s}
					<button
						type="button"
						class="assistant-session-item {sessionId === s.id ? 'active' : ''}"
						onclick={() => selectSession(s)}
					>
						{s.session_type === 'quotation' ? '💰 ' : ''}{s.title || 'Sin título'}
					</button>
				{:else}
					<p class="text-xs text-[var(--as-text-muted)] p-2">Sin conversaciones aún</p>
				{/each}
			</div>
		</aside>

		<div class="assistant-main">
			{#if mode === 'admin'}
				<AssistantAdminNav />
			{/if}
			<header class="assistant-header">
				<button type="button" class="assistant-btn md:hidden" onclick={() => (sidebarOpen = true)} aria-label="Menú">☰</button>
				<img src="/favicon.png" alt="" class="w-7 h-7 rounded" />
				<span class="font-medium text-sm flex-1 truncate">Guerra Láser Asistente</span>

				{#if mode === 'mobile' && teamMembers.length}
					<select
						class="assistant-select max-w-[140px]"
						value={teamMemberId}
						onchange={(e) => onTeamMemberChange(e.currentTarget.value)}
					>
						<option value="">¿Quién eres?</option>
						{#each teamMembers as m}
							<option value={m.id}>{m.display_name}</option>
						{/each}
					</select>
				{/if}

				{#if showBackLink && mode === 'admin'}
					<a href="/admin" class="text-xs text-[var(--as-text-muted)] hover:underline hidden sm:inline">Admin</a>
					<a href="/admin/asistente/conocimiento" class="text-xs text-[var(--as-accent)] hover:underline">⚙️</a>
				{/if}

				<button type="button" class="assistant-chip md:hidden" onclick={() => newChat('knowledge')}>+ Nuevo</button>
			</header>

			{#if sessionType === 'knowledge'}
				<ChannelChips {channels} bind:activeChannel={channel} />
			{:else}
				<div class="px-4 py-2 text-sm text-[var(--as-accent)]">Modo cotización — describe lo que necesitas cotizar</div>
			{/if}

			<div class="px-4 pb-2">
				<input
					type="search"
					class="assistant-select w-full max-w-3xl mx-auto block"
					placeholder="Buscar en historial..."
					bind:value={searchQuery}
				/>
			</div>

			<div class="assistant-messages">
				<div class="assistant-messages-inner">
					{#if messages.length === 0 && !quoteDraft}
						<div class="text-center py-16 text-[var(--as-text-muted)]">
							<p class="text-lg mb-2">¿En qué te ayudo?</p>
							<p class="text-sm">Pregunta sobre refacciones, equivalencias o cotizaciones</p>
						</div>
					{/if}

					{#each messages as msg (msg.id)}
						<div class="assistant-message {msg.role}">
							<div class="assistant-message-content">
								{msg.content}
								{#if msg.metadata?.sources?.length}
									<div class="mt-2">
										{#each msg.metadata.sources as src}
											<span class="assistant-source-chip">{src.title}</span>
										{/each}
									</div>
								{/if}
								{#if msg.metadata?.canSave}
									<button
										type="button"
										class="assistant-chip mt-2 text-xs"
										onclick={() => saveToKnowledge(msg.metadata!)}
									>
										💾 Guardar en base de conocimientos
									</button>
								{/if}
								{#if msg.metadata?.whatsappText}
									<div class="flex flex-wrap gap-2 mt-3">
										<button
											type="button"
											class="assistant-chip active"
											onclick={() => copyWhatsapp(msg.metadata!.whatsappText!)}
										>
											📋 Copiar para WhatsApp
										</button>
										{#if msg.metadata.quoteDraft}
											<button
												type="button"
												class="assistant-chip"
												onclick={() => downloadPdf(msg.metadata!.quoteDraft!)}
											>
												📄 Descargar PDF formal
											</button>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{/each}

					{#if loading}
						<div class="assistant-message">
							<div class="assistant-message-content text-[var(--as-text-muted)]">Pensando...</div>
						</div>
					{/if}

					{#if quoteDraft}
						<QuoteEditor bind:draft={quoteDraft} onconfirm={confirmQuote} />
					{/if}
				</div>
			</div>

			<div class="assistant-composer-wrap">
				<div class="assistant-composer">
					<button type="button" class="assistant-btn" onclick={() => fileInput?.click()} title="Adjuntar" disabled={loading}>
						📎
					</button>
					<input bind:this={fileInput} type="file" accept="image/*,.pdf" class="hidden" onchange={onFileSelected} />
					<textarea
					 rows="1"
					 placeholder={sessionType === 'quotation' ? 'Ej: Cotiza para Juan: 2 tubos W2 y envío...' : 'Escribe tu pregunta...'}
					 bind:value={input}
					 onkeydown={onKeydown}
					 disabled={loading}
					></textarea>
					<button
						type="button"
						class="assistant-btn assistant-btn-primary"
					 onclick={sendMessage}
					 disabled={loading || !input.trim()}
					 title="Enviar"
					>
						➤
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
