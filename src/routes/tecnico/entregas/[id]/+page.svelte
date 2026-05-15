<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { authHeaders } from '$lib/apiAuth';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import { getDeliveryPhotoPublicUrl } from '$lib/customers';
	import SignaturePad from '$lib/components/SignaturePad.svelte';
	import {
		MACHINERY_TYPE_LABELS,
		type MachineryType,
		type MachineDelivery
	} from '$lib/types/machineDelivery';

	const id = $derived($page.params.id);

	let delivery = $state<MachineDelivery | null>(null);
	let step = $state(1);
	let loading = $state(true);
	let submitting = $state(false);

	let installation_completed = $state(false);
	let left_operational = $state(false);
	let training_provided = $state(false);
	let training_notes = $state('');
	let technician_observations = $state('');
	let customer_observations = $state('');
	let customer_signature = $state('');
	let uploading = $state(false);

	const totalSteps = 5;

	async function load() {
		loading = true;
		const headers = await authHeaders();
		const res = await fetch(`/api/machine-deliveries/${id}`, { headers });
		const json = await res.json();
		if (json.success && json.delivery) {
			const d = json.delivery as MachineDelivery;
			delivery = d;
			installation_completed = d.installation_completed;
			left_operational = d.left_operational;
			training_provided = d.training_provided;
			training_notes = d.training_notes || '';
			technician_observations = d.technician_observations || '';
			if (d.status === 'signed' || d.status === 'emailed') {
				step = 5;
			}
		}
		loading = false;
	}

	onMount(load);

	async function uploadPhoto(file: File) {
		if (!delivery) return;
		uploading = true;
		const ext = file.name.split('.').pop() || 'jpg';
		const path = `photos/${delivery.id}/${Date.now()}.${ext}`;

		const { error: upErr } = await supabase.storage.from('delivery-photos').upload(path, file, {
			cacheControl: '3600',
			upsert: false
		});

		if (upErr) {
			alert('Error al subir foto: ' + upErr.message);
			uploading = false;
			return;
		}

		const headers = await authHeaders();
		await fetch(`/api/machine-deliveries/${id}/photos`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ storage_path: path, sort_order: delivery.machine_delivery_photos?.length || 0 })
		});

		await load();
		uploading = false;
	}

	async function handlePhotoInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		if (!files?.length) return;
		for (const file of Array.from(files)) {
			await uploadPhoto(file);
		}
		input.value = '';
	}

	async function saveChecklist() {
		const headers = await authHeaders();
		await fetch(`/api/machine-deliveries/${id}`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify({
				installation_completed,
				left_operational,
				training_provided,
				training_notes,
				technician_observations,
				status: 'in_progress'
			})
		});
	}

	async function confirmDelivery() {
		if (!customer_signature) {
			alert('Se requiere la firma del cliente');
			return;
		}
		submitting = true;
		const headers = await authHeaders();
		const res = await fetch(`/api/machine-deliveries/${id}/complete`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				customer_signature,
				customer_observations,
				technician_observations,
				installation_completed,
				left_operational,
				training_provided,
				training_notes
			})
		});
		const json = await res.json();
		submitting = false;

		if (json.success) {
			const msg = json.emailSent
				? 'Entrega confirmada y acta enviada al cliente por correo.'
				: `Entrega confirmada. ${json.emailError ? 'No se pudo enviar el correo: ' + json.emailError : ''}`;
			alert(msg);
			goto('/tecnico/entregas');
		} else {
			alert(json.error || 'Error al confirmar');
		}
	}

	function onSignature(dataUrl: string) {
		customer_signature = dataUrl;
	}
</script>

<svelte:head>
	<title>Entrega en campo - Técnico</title>
</svelte:head>

{#if loading}
	<p class="text-center text-gray-500 py-12">Cargando...</p>
{:else if !delivery}
	<p>Entrega no encontrada</p>
{:else if delivery.status === 'signed' || delivery.status === 'emailed'}
	<div class="bg-white rounded-xl p-6 text-center">
		<p class="text-green-700 font-semibold text-lg">✓ Entrega completada</p>
		<p class="text-sm text-gray-600 mt-2">{delivery.delivery_number}</p>
		<a href="/tecnico/entregas" class="inline-block mt-4 text-blue-600">Volver al listado</a>
	</div>
{:else}
	<div class="mb-4">
		<p class="text-xs text-gray-500">Paso {step} de {totalSteps}</p>
		<div class="h-2 bg-gray-200 rounded-full mt-1">
			<div
				class="h-2 bg-blue-600 rounded-full transition-all"
				style="width: {(step / totalSteps) * 100}%"
			></div>
		</div>
	</div>

	{#if step === 1}
		<section class="bg-white rounded-xl shadow p-5 space-y-3">
			<h2 class="font-bold text-lg">Resumen</h2>
			<p><span class="text-gray-500">Cliente:</span> {delivery.customers?.contact_name}</p>
			<p>
				<span class="text-gray-500">Tipo:</span>
				{delivery.machinery_type
					? MACHINERY_TYPE_LABELS[delivery.machinery_type as MachineryType]
					: '—'}
			</p>
			<p><span class="text-gray-500">Máquina:</span> {delivery.machine_model}</p>
			<p><span class="text-gray-500">Serie:</span> {delivery.serial_number}</p>
			<p class="text-sm">{delivery.delivery_address}</p>
			<button
				type="button"
				class="w-full py-3 mt-4 bg-blue-600 text-white rounded-xl font-medium"
				onclick={() => (step = 2)}
			>
				Continuar
			</button>
		</section>
	{:else if step === 2}
		<section class="bg-white rounded-xl shadow p-5">
			<h2 class="font-bold text-lg mb-3">Fotos del equipo instalado</h2>
			<input
				type="file"
				accept="image/*"
				capture="environment"
				multiple
				class="w-full text-sm"
				onchange={handlePhotoInput}
				disabled={uploading}
			/>
			{#if uploading}
				<p class="text-sm text-gray-500 mt-2">Subiendo...</p>
			{/if}
			{#if delivery.machine_delivery_photos?.length}
				<div class="grid grid-cols-2 gap-2 mt-4">
					{#each delivery.machine_delivery_photos as photo}
						<img
							src={getDeliveryPhotoPublicUrl(photo.storage_path, PUBLIC_SUPABASE_URL)}
							alt="Instalación"
							class="rounded-lg border aspect-square object-cover"
						/>
					{/each}
				</div>
			{/if}
			<div class="flex gap-2 mt-6">
				<button type="button" class="flex-1 py-3 border rounded-xl" onclick={() => (step = 1)}>
					Atrás
				</button>
				<button type="button" class="flex-1 py-3 bg-blue-600 text-white rounded-xl" onclick={() => (step = 3)}>
					Continuar
				</button>
			</div>
		</section>
	{:else if step === 3}
		<section class="bg-white rounded-xl shadow p-5 space-y-4">
			<h2 class="font-bold text-lg">Checklist en sitio</h2>
			<label class="flex items-center gap-3 py-2">
				<input type="checkbox" bind:checked={installation_completed} class="w-5 h-5" />
				<span>Instalación realizada</span>
			</label>
			<label class="flex items-center gap-3 py-2">
				<input type="checkbox" bind:checked={left_operational} class="w-5 h-5" />
				<span>Equipo operativo</span>
			</label>
			<label class="flex items-center gap-3 py-2">
				<input type="checkbox" bind:checked={training_provided} class="w-5 h-5" />
				<span>Capacitación dada</span>
			</label>
			{#if training_provided}
				<textarea
					bind:value={training_notes}
					placeholder="Notas de capacitación"
					rows="2"
					class="w-full border rounded-lg px-3 py-2"
				></textarea>
			{/if}
			<label class="block">
				<span class="text-sm font-medium">Observaciones del técnico</span>
				<textarea
					bind:value={technician_observations}
					rows="3"
					class="w-full mt-1 border rounded-lg px-3 py-2"
				></textarea>
			</label>
			<div class="flex gap-2">
				<button type="button" class="flex-1 py-3 border rounded-xl" onclick={() => (step = 2)}>
					Atrás
				</button>
				<button
					type="button"
					class="flex-1 py-3 bg-blue-600 text-white rounded-xl"
					onclick={async () => {
						await saveChecklist();
						step = 4;
					}}
				>
					Continuar
				</button>
			</div>
		</section>
	{:else if step === 4}
		<section class="bg-white rounded-xl shadow p-5">
			<h2 class="font-bold text-lg mb-2">Firma del cliente</h2>
			<p class="text-sm text-gray-600 mb-4">Pida al cliente firmar con el dedo o stylus:</p>
			<SignaturePad onConfirm={onSignature} height={260} />
			{#if customer_signature}
				<p class="text-green-600 text-sm mt-2">✓ Firma capturada</p>
			{/if}
			<label class="block mt-4">
				<span class="text-sm font-medium">Observaciones del cliente</span>
				<textarea
					bind:value={customer_observations}
					rows="3"
					class="w-full mt-1 border rounded-lg px-3 py-2"
					placeholder="Opcional"
				></textarea>
			</label>
			<div class="flex gap-2 mt-6">
				<button type="button" class="flex-1 py-3 border rounded-xl" onclick={() => (step = 3)}>
					Atrás
				</button>
				<button
					type="button"
					class="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium disabled:opacity-50"
					disabled={!customer_signature || submitting}
					onclick={confirmDelivery}
				>
					{submitting ? 'Enviando...' : 'Confirmar y enviar acta'}
				</button>
			</div>
		</section>
	{/if}
{/if}
