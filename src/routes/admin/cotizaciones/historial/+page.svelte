<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		deleteSavedQuotation,
		listSavedQuotations
	} from '$lib/services/quotationApi';
	import {
		QUOTATION_SOURCE_LABELS,
		type QuotationListRow
	} from '$lib/types/savedQuotation';

	let quotations = $state<QuotationListRow[]>([]);
	let loading = $state(true);
	let filterSource = $state<string>('all');
	let searchQuery = $state('');
	let deletingId = $state<string | null>(null);

	$effect(() => {
		loadQuotations();
	});

	async function loadQuotations() {
		loading = true;
		try {
			quotations = await listSavedQuotations({
				source: filterSource,
				search: searchQuery.trim() || undefined
			});
		} catch (error) {
			console.error(error);
			alert(error instanceof Error ? error.message : 'Error al cargar cotizaciones');
			quotations = [];
		} finally {
			loading = false;
		}
	}

	function sourceBadge(source: string) {
		const map: Record<string, { label: string; class: string }> = {
			manual: { label: '📝 Manual', class: 'bg-gray-100 text-gray-700' },
			ai_assistant: { label: '🤖 Asistente IA', class: 'bg-purple-100 text-purple-700' },
			ai_chat: { label: '📱 Chat IA', class: 'bg-blue-100 text-blue-700' }
		};
		return map[source] ?? { label: source, class: 'bg-gray-100 text-gray-700' };
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString('es-MX', {
			dateStyle: 'short',
			timeStyle: 'short'
		});
	}

	function editQuotation(q: QuotationListRow) {
		if (q.source === 'ai_assistant' || q.source === 'ai_chat') {
			goto(`/admin/asistente?mode=quote&edit=${q.id}`);
		} else {
			goto(`/admin/cotizaciones?edit=${q.id}`);
		}
	}

	async function removeQuotation(id: string, number: string) {
		if (!confirm(`¿Eliminar la cotización ${number}? Esta acción no se puede deshacer.`)) return;
		deletingId = id;
		try {
			await deleteSavedQuotation(id);
			quotations = quotations.filter((q) => q.id !== id);
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Error al eliminar');
		} finally {
			deletingId = null;
		}
	}

	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	function onSearchInput(value: string) {
		searchQuery = value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(loadQuotations, 350);
	}
</script>

<svelte:head>
	<title>Cotizaciones guardadas - Admin</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="container mx-auto px-4 py-6 max-w-7xl">
		<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold">Cotizaciones guardadas</h1>
				<p class="text-gray-600 mt-1">Consulta, edita y gestiona cotizaciones manuales y generadas con IA</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<a href="/admin/cotizaciones" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
					+ Nueva manual
				</a>
				<a href="/admin/asistente?mode=quote" class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
					🤖 Asistente IA
				</a>
				<a href="/admin" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">← Dashboard</a>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-wrap gap-4 items-end">
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1">Origen</label>
				<select
					class="border rounded-md px-3 py-2"
					bind:value={filterSource}
					onchange={loadQuotations}
				>
					<option value="all">Todos</option>
					{#each Object.entries(QUOTATION_SOURCE_LABELS) as [value, label]}
						<option value={value}>{label}</option>
					{/each}
				</select>
			</div>
			<div class="flex-1 min-w-[200px]">
				<label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
				<input
					type="search"
					class="w-full border rounded-md px-3 py-2"
					placeholder="Cliente, empresa o número..."
					value={searchQuery}
					oninput={(e) => onSearchInput(e.currentTarget.value)}
				/>
			</div>
			<button
				type="button"
				class="px-4 py-2 border rounded-lg hover:bg-gray-50"
				onclick={loadQuotations}
			>
				🔄 Actualizar
			</button>
		</div>

		<div class="bg-white rounded-lg shadow-md overflow-hidden">
			{#if loading}
				<p class="p-8 text-center text-gray-500">Cargando cotizaciones...</p>
			{:else if quotations.length === 0}
				<div class="p-12 text-center text-gray-500">
					<p class="text-lg mb-2">No hay cotizaciones guardadas</p>
					<p class="text-sm">Crea una manual o guárdala desde el asistente IA</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 border-b">
							<tr>
								<th class="text-left px-4 py-3 font-semibold">Número</th>
								<th class="text-left px-4 py-3 font-semibold">Cliente</th>
								<th class="text-left px-4 py-3 font-semibold">Origen</th>
								<th class="text-right px-4 py-3 font-semibold">Total</th>
								<th class="text-left px-4 py-3 font-semibold">Estado</th>
								<th class="text-left px-4 py-3 font-semibold">Fecha</th>
								<th class="text-right px-4 py-3 font-semibold">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{#each quotations as q (q.id)}
								{@const badge = sourceBadge(q.source)}
								<tr class="border-b hover:bg-gray-50">
									<td class="px-4 py-3 font-mono text-xs">{q.quotation_number}</td>
									<td class="px-4 py-3">
										<div class="font-medium">{q.customer_name}</div>
										{#if q.customer_company}
											<div class="text-xs text-gray-500">{q.customer_company}</div>
										{/if}
									</td>
									<td class="px-4 py-3">
										<span class="inline-block px-2 py-0.5 rounded text-xs {badge.class}">{badge.label}</span>
									</td>
									<td class="px-4 py-3 text-right font-medium">${q.total_amount.toFixed(2)}</td>
									<td class="px-4 py-3 capitalize">{q.status}</td>
									<td class="px-4 py-3 text-gray-600">{formatDate(q.created_at)}</td>
									<td class="px-4 py-3 text-right">
										<div class="flex justify-end gap-2">
											<button
												type="button"
												class="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded"
												onclick={() => editQuotation(q)}
											>
												✏️ Editar
											</button>
											<button
												type="button"
												class="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
												disabled={deletingId === q.id}
												onclick={() => removeQuotation(q.id, q.quotation_number)}
											>
												{deletingId === q.id ? '...' : '🗑️'}
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
