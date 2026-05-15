<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { authHeaders } from '$lib/apiAuth';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import { getDeliveryPhotoPublicUrl } from '$lib/customers';
	import {
		ACCESSORY_LABELS,
		DELIVERY_STATUS_LABELS,
		MACHINERY_TYPE_LABELS,
		type MachineryType,
		type MachineDelivery
	} from '$lib/types/machineDelivery';

	let delivery = $state<MachineDelivery | null>(null);
	let loading = $state(true);
	let resending = $state(false);
	let technicians = $state<{ id: string; email: string }[]>([]);
	let technicianId = $state('');

	const id = $derived($page.params.id);

	async function load() {
		loading = true;
		const headers = await authHeaders();
		const res = await fetch(`/api/machine-deliveries/${id}`, { headers });
		const json = await res.json();
		if (json.success) {
			delivery = json.delivery;
			technicianId = json.delivery.assigned_technician_id || '';
		}
		loading = false;
	}

	async function loadTechnicians() {
		const headers = await authHeaders();
		const res = await fetch('/api/users/list', { headers });
		const json = await res.json();
		if (json.success) {
			technicians = json.users
				.filter((u: { roles: string[] }) => u.roles?.includes('tecnico'))
				.map((u: { id: string; email: string }) => ({ id: u.id, email: u.email }));
		}
	}

	async function reassignTechnician() {
		const headers = await authHeaders();
		await fetch(`/api/machine-deliveries/${id}`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify({
				assigned_technician_id: technicianId || null,
				status: technicianId ? 'in_progress' : 'draft'
			})
		});
		await load();
	}

	async function resendEmail() {
		resending = true;
		const headers = await authHeaders();
		const res = await fetch(`/api/machine-deliveries/${id}/resend-email`, {
			method: 'POST',
			headers
		});
		const json = await res.json();
		resending = false;
		alert(json.success ? 'Correo enviado' : json.error || 'Error');
		if (json.success) await load();
	}

	function pdfUrl() {
		if (!delivery?.pdf_storage_path) return null;
		return getDeliveryPhotoPublicUrl(delivery.pdf_storage_path, PUBLIC_SUPABASE_URL);
	}

	onMount(() => {
		load();
		loadTechnicians();
	});
</script>

<svelte:head>
	<title>Entrega {delivery?.delivery_number || ''} - Admin</title>
</svelte:head>

<div class="p-4 md:p-6 max-w-4xl">
	<a href="/admin/entregas" class="text-blue-600 text-sm mb-4 inline-block">← Volver</a>

	{#if loading}
		<p>Cargando...</p>
	{:else if !delivery}
		<p>Entrega no encontrada</p>
	{:else}
		<div class="flex flex-wrap items-start justify-between gap-4 mb-6">
			<div>
				<h1 class="text-2xl font-bold">{delivery.delivery_number}</h1>
				<span class="text-sm text-gray-600">{DELIVERY_STATUS_LABELS[delivery.status]}</span>
			</div>
			{#if delivery.status === 'signed' || delivery.status === 'emailed'}
				<button
					type="button"
					class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
					disabled={resending}
					onclick={resendEmail}
				>
					{resending ? 'Enviando...' : 'Reenviar acta por email'}
				</button>
			{/if}
		</div>

		<div class="grid md:grid-cols-2 gap-6">
			<section class="bg-white rounded-lg shadow p-5 space-y-3">
				<h2 class="font-semibold text-lg">Cliente</h2>
				<p><strong>{delivery.customers?.contact_name}</strong></p>
				<p class="text-sm text-gray-600">{delivery.customers?.email}</p>
				<p class="text-sm">{delivery.delivery_address}</p>
			</section>

			<section class="bg-white rounded-lg shadow p-5 space-y-3">
				<h2 class="font-semibold text-lg">Equipo</h2>
				<p>
					Tipo:
					{delivery.machinery_type
						? MACHINERY_TYPE_LABELS[delivery.machinery_type as MachineryType]
						: '—'}
				</p>
				<p>Modelo: {delivery.machine_model}</p>
				<p>Serie: {delivery.serial_number}</p>
				<p>Fecha: {delivery.delivery_date}</p>
				<p>Instalación: {delivery.installation_completed ? 'Sí' : 'No'}</p>
				<p>Operativo: {delivery.left_operational ? 'Sí' : 'No'}</p>
				<p>Capacitación: {delivery.training_provided ? 'Sí' : 'No'}</p>
			</section>
		</div>

		<section class="bg-white rounded-lg shadow p-5 mt-6">
			<h2 class="font-semibold mb-3">Técnico asignado</h2>
			<div class="flex gap-2 flex-wrap">
				<select bind:value={technicianId} class="flex-1 px-3 py-2 border rounded-lg">
					<option value="">Sin asignar</option>
					{#each technicians as t}
						<option value={t.id}>{t.email}</option>
					{/each}
				</select>
				<button
					type="button"
					class="px-4 py-2 bg-blue-600 text-white rounded-lg"
					onclick={reassignTechnician}
				>
					Guardar
				</button>
			</div>
			{#if delivery.status === 'draft' || delivery.status === 'in_progress'}
				<p class="text-sm text-gray-500 mt-2">
					El técnico completará la entrega desde
					<a href="/tecnico/entregas/{delivery.id}" class="text-blue-600">panel móvil</a>.
				</p>
			{/if}
		</section>

		{#if delivery.machine_delivery_accessories?.length}
			<section class="bg-white rounded-lg shadow p-5 mt-6">
				<h2 class="font-semibold mb-3">Accesorios</h2>
				<ul class="list-disc pl-5 space-y-1">
					{#each delivery.machine_delivery_accessories as acc}
						<li>
							{ACCESSORY_LABELS[acc.accessory_type]}
							{#if acc.serial_number} — S/N: {acc.serial_number}{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if delivery.machine_delivery_photos?.length}
			<section class="bg-white rounded-lg shadow p-5 mt-6">
				<h2 class="font-semibold mb-3">Fotos</h2>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
					{#each delivery.machine_delivery_photos as photo}
						<img
							src={getDeliveryPhotoPublicUrl(photo.storage_path, PUBLIC_SUPABASE_URL)}
							alt="Foto instalación"
							class="rounded-lg border object-cover aspect-square"
						/>
					{/each}
				</div>
			</section>
		{/if}

		{#if pdfUrl()}
			<section class="mt-6">
				<a
					href={pdfUrl()}
					target="_blank"
					rel="noopener"
					class="text-blue-600 font-medium"
				>
					Descargar acta PDF →
				</a>
			</section>
		{/if}

		{#if delivery.technician_observations || delivery.customer_observations}
			<section class="bg-white rounded-lg shadow p-5 mt-6 space-y-4">
				{#if delivery.technician_observations}
					<div>
						<h3 class="font-medium">Observaciones técnico</h3>
						<p class="text-sm text-gray-700">{delivery.technician_observations}</p>
					</div>
				{/if}
				{#if delivery.customer_observations}
					<div>
						<h3 class="font-medium">Observaciones cliente</h3>
						<p class="text-sm text-gray-700">{delivery.customer_observations}</p>
					</div>
				{/if}
			</section>
		{/if}
	{/if}
</div>
