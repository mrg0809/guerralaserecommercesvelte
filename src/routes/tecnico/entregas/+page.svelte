<script lang="ts">
	import { onMount } from 'svelte';
	import { authHeaders } from '$lib/apiAuth';
	import { DELIVERY_STATUS_LABELS, MACHINERY_TYPE_LABELS, type MachineryType, type MachineDelivery } from '$lib/types/machineDelivery';

	let deliveries = $state<MachineDelivery[]>([]);
	let loading = $state(true);

	onMount(async () => {
		const headers = await authHeaders();
		const res = await fetch('/api/machine-deliveries', { headers });
		const json = await res.json();
		if (json.success) deliveries = json.deliveries;
		loading = false;
	});
</script>

<svelte:head>
	<title>Mis entregas - Técnico</title>
</svelte:head>

<h1 class="text-xl font-bold mb-4">Mis entregas asignadas</h1>

{#if loading}
	<p class="text-gray-500">Cargando...</p>
{:else if deliveries.length === 0}
	<p class="bg-white rounded-lg p-6 text-center text-gray-500">No tienes entregas asignadas.</p>
{:else}
	<ul class="space-y-3">
		{#each deliveries as d}
			<li>
				<a
					href="/tecnico/entregas/{d.id}"
					class="block bg-white rounded-xl shadow p-4 active:bg-gray-50"
				>
					<div class="flex justify-between items-start gap-2">
						<div>
							<p class="font-mono text-sm text-blue-600">{d.delivery_number}</p>
							<p class="font-semibold mt-1">{d.customers?.contact_name}</p>
							<p class="text-xs text-gray-500 mt-1">
								{MACHINERY_TYPE_LABELS[d.machinery_type as MachineryType] || ''}
								{d.machinery_type ? ' · ' : ''}{d.machine_model}
							</p>
							<p class="text-xs text-gray-500">Serie: {d.serial_number}</p>
						</div>
						<span class="text-xs px-2 py-1 rounded-full bg-gray-100 shrink-0">
							{DELIVERY_STATUS_LABELS[d.status]}
						</span>
					</div>
					{#if d.status !== 'signed' && d.status !== 'emailed'}
						<p class="text-sm text-blue-600 mt-2 font-medium">Continuar entrega →</p>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
{/if}
