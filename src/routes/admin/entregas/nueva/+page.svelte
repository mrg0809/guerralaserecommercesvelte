<script lang="ts">
	import { goto } from '$app/navigation';
	import CustomerSearchSelect from '$lib/components/CustomerSearchSelect.svelte';
	import { authHeaders } from '$lib/apiAuth';
	import { formatCustomerAddress } from '$lib/customers';
	import type { Database } from '$lib/types/database.types';
	import {
		ACCESSORY_LABELS,
		MACHINERY_TYPE_OPTIONS,
		type AccessoryType,
		type MachineryType,
		type MachineDeliveryAccessory
	} from '$lib/types/machineDelivery';

	type Customer = Database['public']['Tables']['customers']['Row'];

	let selectedCustomer = $state<Customer | null>(null);
	let technicians = $state<{ id: string; email: string }[]>([]);
	let saving = $state(false);

	let form = $state({
		machinery_type: MACHINERY_TYPE_OPTIONS[0].value as MachineryType,
		assigned_technician_id: '',
		machine_model: '',
		serial_number: '',
		delivery_address: '',
		delivery_date: new Date().toISOString().slice(0, 10),
		installation_completed: false,
		left_operational: false,
		training_provided: false,
		training_notes: ''
	});

	const accessoryTypes = Object.keys(ACCESSORY_LABELS) as AccessoryType[];
	let selectedAccessories = $state<Record<AccessoryType, { enabled: boolean; serial: string; notes: string }>>(
		Object.fromEntries(
			accessoryTypes.map((t) => [t, { enabled: false, serial: '', notes: '' }])
		) as Record<AccessoryType, { enabled: boolean; serial: string; notes: string }>
	);

	async function loadTechnicians() {
		const headers = await authHeaders();
		const res = await fetch('/api/users/list', { headers });
		const json = await res.json();
		if (json.success && json.users) {
			technicians = json.users
				.filter((u: { roles: string[] }) => u.roles?.includes('tecnico'))
				.map((u: { id: string; email: string }) => ({ id: u.id, email: u.email }));
		}
	}

	$effect(() => {
		loadTechnicians();
	});

	function onCustomerSelect(c: Customer) {
		form.delivery_address = formatCustomerAddress(c);
	}

	async function submit(e: Event) {
		e.preventDefault();
		if (!selectedCustomer) {
			alert('Selecciona un cliente');
			return;
		}

		const accessories: MachineDeliveryAccessory[] = accessoryTypes
			.filter((t) => selectedAccessories[t].enabled)
			.map((t) => ({
				accessory_type: t,
				serial_number: selectedAccessories[t].serial || undefined,
				notes: selectedAccessories[t].notes || undefined
			}));

		saving = true;
		const headers = await authHeaders();
		const res = await fetch('/api/machine-deliveries', {
			method: 'POST',
			headers,
			body: JSON.stringify({
				customer_id: selectedCustomer.id,
				...form,
				assigned_technician_id: form.assigned_technician_id || undefined,
				accessories
			})
		});
		const json = await res.json();
		saving = false;

		if (json.success) {
			goto(`/admin/entregas/${json.delivery.id}`);
		} else {
			alert(json.error || 'Error al crear');
		}
	}
</script>

<svelte:head>
	<title>Nueva entrega - Admin</title>
</svelte:head>

<div class="p-4 md:p-6 max-w-3xl">
	<a href="/admin/entregas" class="text-blue-600 text-sm mb-4 inline-block">← Volver</a>
	<h1 class="text-2xl font-bold mb-6">Nueva entrega de máquina</h1>

	<form onsubmit={submit} class="space-y-6 bg-white rounded-lg shadow p-6">
		<label class="block">
			<span class="text-sm font-medium">Tipo de maquinaria *</span>
			<select
				bind:value={form.machinery_type}
				required
				class="w-full mt-1 px-3 py-2 border rounded-lg bg-white"
			>
				{#each MACHINERY_TYPE_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>

		<CustomerSearchSelect bind:selected={selectedCustomer} onSelect={onCustomerSelect} />

		<div class="grid md:grid-cols-2 gap-4">
			<label class="block">
				<span class="text-sm font-medium">Modelo de máquina *</span>
				<input bind:value={form.machine_model} required class="w-full mt-1 px-3 py-2 border rounded-lg" />
			</label>
			<label class="block">
				<span class="text-sm font-medium">Número de serie *</span>
				<input bind:value={form.serial_number} required class="w-full mt-1 px-3 py-2 border rounded-lg" />
			</label>
		</div>

		<label class="block">
			<span class="text-sm font-medium">Dirección de instalación *</span>
			<textarea bind:value={form.delivery_address} required rows="2" class="w-full mt-1 px-3 py-2 border rounded-lg"></textarea>
		</label>

		<div class="grid md:grid-cols-2 gap-4">
			<label class="block">
				<span class="text-sm font-medium">Fecha de entrega</span>
				<input type="date" bind:value={form.delivery_date} class="w-full mt-1 px-3 py-2 border rounded-lg" />
			</label>
			<label class="block">
				<span class="text-sm font-medium">Técnico asignado</span>
				<select bind:value={form.assigned_technician_id} class="w-full mt-1 px-3 py-2 border rounded-lg">
					<option value="">Sin asignar</option>
					{#each technicians as tech}
						<option value={tech.id}>{tech.email}</option>
					{/each}
				</select>
			</label>
		</div>

		<fieldset class="border rounded-lg p-4">
			<legend class="text-sm font-semibold px-2">Accesorios instalados</legend>
			<div class="space-y-3 mt-2">
				{#each accessoryTypes as type}
					<div class="flex flex-wrap items-start gap-3 border-b pb-3 last:border-0">
						<label class="flex items-center gap-2 min-w-[140px]">
							<input type="checkbox" bind:checked={selectedAccessories[type].enabled} />
							{ACCESSORY_LABELS[type]}
						</label>
						{#if selectedAccessories[type].enabled}
							<input
								placeholder="S/N (opcional)"
								bind:value={selectedAccessories[type].serial}
								class="flex-1 min-w-[120px] px-2 py-1 border rounded text-sm"
							/>
							<input
								placeholder="Notas"
								bind:value={selectedAccessories[type].notes}
								class="flex-1 min-w-[120px] px-2 py-1 border rounded text-sm"
							/>
						{/if}
					</div>
				{/each}
			</div>
		</fieldset>

		<fieldset class="border rounded-lg p-4 space-y-2">
			<legend class="text-sm font-semibold px-2">Checklist</legend>
			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={form.installation_completed} />
				Instalación realizada
			</label>
			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={form.left_operational} />
				Equipo operativo
			</label>
			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={form.training_provided} />
				Capacitación proporcionada
			</label>
			{#if form.training_provided}
				<textarea
					bind:value={form.training_notes}
					placeholder="Notas de capacitación"
					rows="2"
					class="w-full px-3 py-2 border rounded-lg text-sm"
				></textarea>
			{/if}
		</fieldset>

		<button
			type="submit"
			disabled={saving}
			class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
		>
			{saving ? 'Guardando...' : 'Crear entrega'}
		</button>
	</form>
</div>
