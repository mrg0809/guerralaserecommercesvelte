<script lang="ts">
	import { onMount } from 'svelte';
	import { authHeaders } from '$lib/apiAuth';
	import type { MachineDelivery } from '$lib/types/machineDelivery';
	import { DELIVERY_STATUS_LABELS, MACHINERY_TYPE_LABELS, type MachineryType } from '$lib/types/machineDelivery';

	let deliveries = $state<MachineDelivery[]>([]);
	let loading = $state(true);
	let filterStatus = $state('all');

	async function load() {
		loading = true;
		const headers = await authHeaders();
		const url =
			filterStatus === 'all'
				? '/api/machine-deliveries'
				: `/api/machine-deliveries?status=${filterStatus}`;
		const res = await fetch(url, { headers });
		const json = await res.json();
		if (json.success) deliveries = json.deliveries;
		loading = false;
	}

	onMount(load);

	function tipoLabel(t: string | undefined) {
		if (!t) return '—';
		return MACHINERY_TYPE_LABELS[t as MachineryType] || t;
	}

	function statusClass(status: string) {
		const map: Record<string, string> = {
			draft: 'bg-gray-200 text-gray-800',
			in_progress: 'bg-yellow-100 text-yellow-800',
			signed: 'bg-blue-100 text-blue-800',
			emailed: 'bg-green-100 text-green-800'
		};
		return map[status] || 'bg-gray-100';
	}
</script>

<svelte:head>
	<title>Entregas de Máquinas - Admin</title>
</svelte:head>

<div class="p-4 md:p-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
		<h1 class="text-2xl font-bold">Entregas de máquinas</h1>
		<a
			href="/admin/entregas/nueva"
			class="inline-flex justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
		>
			+ Nueva entrega
		</a>
	</div>

	<div class="mb-4">
		<select
			bind:value={filterStatus}
			onchange={load}
			class="px-3 py-2 border rounded-lg bg-white"
		>
			<option value="all">Todos los estados</option>
			{#each Object.entries(DELIVERY_STATUS_LABELS) as [value, label]}
				<option value={value}>{label}</option>
			{/each}
		</select>
	</div>

	{#if loading}
		<p class="text-gray-500">Cargando...</p>
	{:else if deliveries.length === 0}
		<p class="text-gray-500 bg-white rounded-lg p-8 text-center">No hay entregas registradas.</p>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left">Folio</th>
						<th class="px-4 py-3 text-left">Cliente</th>
						<th class="px-4 py-3 text-left">Máquina</th>
						<th class="px-4 py-3 text-left">Serie</th>
						<th class="px-4 py-3 text-left">Fecha</th>
						<th class="px-4 py-3 text-left">Estado</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each deliveries as d}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 font-mono">{d.delivery_number}</td>
							<td class="px-4 py-3">{d.customers?.contact_name || '—'}</td>
							<td class="px-4 py-3">{tipoLabel(d.machinery_type)}</td>
							<td class="px-4 py-3">{d.machine_model}</td>
							<td class="px-4 py-3">{d.serial_number}</td>
							<td class="px-4 py-3">{d.delivery_date}</td>
							<td class="px-4 py-3">
								<span class="px-2 py-1 rounded-full text-xs {statusClass(d.status)}">
									{DELIVERY_STATUS_LABELS[d.status]}
								</span>
							</td>
							<td class="px-4 py-3">
								<a href="/admin/entregas/{d.id}" class="text-blue-600 hover:underline">Ver</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
