<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import {
		formatWhatsAppDisplay,
		normalizeWhatsAppPhone,
		type WhatsappAgent
	} from '$lib/whatsappRouting';

	type CategoryOption = {
		id: string;
		name: string;
		slug: string;
		parent_id: string | null;
		display_order: number | null;
	};

	type DraftAgent = {
		key: string;
		id?: string;
		label: string;
		phone: string;
		is_default: boolean;
		is_active: boolean;
		category_ids: string[];
	};

	let loading = $state(true);
	let saving = $state(false);
	let agents = $state<DraftAgent[]>([]);
	let categories = $state<CategoryOption[]>([]);
	let message = $state('');
	let errorMsg = $state('');

	async function getSessionToken(): Promise<string | null> {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		return session?.access_token || null;
	}

	function newKey() {
		return typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `tmp_${Date.now()}_${Math.random()}`;
	}

	function toDraft(a: WhatsappAgent): DraftAgent {
		return {
			key: a.id,
			id: a.id,
			label: a.label,
			phone: a.phone,
			is_default: a.is_default,
			is_active: a.is_active,
			category_ids: [...a.category_ids]
		};
	}

	async function load() {
		loading = true;
		errorMsg = '';
		try {
			const token = await getSessionToken();
			if (!token) {
				errorMsg = 'No autorizado';
				return;
			}
			const res = await fetch('/api/admin/settings/whatsapp-routing', {
				headers: { Authorization: `Bearer ${token}` }
			});
			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error || 'No se pudo cargar');
			}
			agents = (data.agents as WhatsappAgent[]).map(toDraft);
			categories = data.categories || [];
			if (agents.length === 0) {
				agents = [
					{
						key: newKey(),
						label: 'Atención general',
						phone: '523334758653',
						is_default: true,
						is_active: true,
						category_ids: []
					}
				];
			}
		} catch (e: any) {
			errorMsg = e?.message || 'Error al cargar';
		} finally {
			loading = false;
		}
	}

	function addAgent() {
		agents = [
			...agents,
			{
				key: newKey(),
				label: '',
				phone: '',
				is_default: agents.every((a) => !a.is_default),
				is_active: true,
				category_ids: []
			}
		];
	}

	function removeAgent(key: string) {
		const next = agents.filter((a) => a.key !== key);
		if (next.length === 0) {
			alert('Debe quedar al menos un número');
			return;
		}
		if (!next.some((a) => a.is_default && a.is_active)) {
			const firstActive = next.find((a) => a.is_active) || next[0];
			firstActive.is_default = true;
		}
		agents = [...next];
	}

	function setDefault(key: string) {
		agents = agents.map((a) => ({
			...a,
			is_default: a.key === key
		}));
	}

	function rootCategories() {
		return categories
			.filter((c) => !c.parent_id)
			.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
	}

	function childCategories(parentId: string) {
		return categories
			.filter((c) => c.parent_id === parentId)
			.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
	}

	function categoryAssignedElsewhere(categoryId: string, currentKey: string): boolean {
		return agents.some((a) => a.key !== currentKey && a.category_ids.includes(categoryId));
	}

	function toggleCategory(agentKey: string, categoryId: string) {
		agents = agents.map((a) => {
			if (a.key !== agentKey) return a;
			const has = a.category_ids.includes(categoryId);
			return {
				...a,
				category_ids: has
					? a.category_ids.filter((id) => id !== categoryId)
					: [...a.category_ids, categoryId]
			};
		});
	}

	async function save() {
		saving = true;
		message = '';
		errorMsg = '';
		try {
			for (const a of agents) {
				if (!a.label.trim()) throw new Error('Todos los números necesitan una etiqueta');
				if (!normalizeWhatsAppPhone(a.phone)) {
					throw new Error(`Teléfono inválido en "${a.label}"`);
				}
			}
			if (!agents.some((a) => a.is_active && a.is_default)) {
				throw new Error('Marca un número activo como predeterminado');
			}

			const token = await getSessionToken();
			if (!token) throw new Error('No autorizado');

			const res = await fetch('/api/admin/settings/whatsapp-routing', {
				method: 'PUT',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					agents: agents.map((a) => ({
						id: a.id,
						label: a.label.trim(),
						phone: a.phone,
						is_default: a.is_default,
						is_active: a.is_active,
						category_ids: a.category_ids
					}))
				})
			});
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.error || 'Error al guardar');

			agents = (data.agents as WhatsappAgent[]).map(toDraft);
			message = 'Configuración de WhatsApp guardada';
		} catch (e: any) {
			errorMsg = e?.message || 'Error al guardar';
		} finally {
			saving = false;
		}
	}

	onMount(load);
</script>

<div class="p-6 max-w-5xl mx-auto">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-gray-900">WhatsApp por categoría</h1>
		<p class="text-gray-600 mt-1">
			Asigna números a categorías. Si el cliente está en una categoría (o un producto de esa
			rama), el botón flotante enviará el mensaje a ese número. En el resto del sitio se usa el
			número predeterminado.
		</p>
	</div>

	{#if loading}
		<div class="bg-white rounded-lg shadow p-8 text-center text-gray-600">Cargando...</div>
	{:else}
		{#if errorMsg}
			<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
				{errorMsg}
			</div>
		{/if}
		{#if message}
			<div class="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700 text-sm">
				{message}
			</div>
		{/if}

		<div class="space-y-4">
			{#each agents as agent (agent.key)}
				<div class="bg-white rounded-lg shadow border border-gray-100 p-5">
					<div class="flex flex-wrap items-start justify-between gap-3 mb-4">
						<div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-w-[240px]">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Nombre / área</label>
								<input
									class="w-full border rounded-lg px-3 py-2"
									placeholder="Ej. Maquinaria"
									bind:value={agent.label}
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
								<input
									class="w-full border rounded-lg px-3 py-2"
									placeholder="33 3475 8653 o 523334758653"
									bind:value={agent.phone}
								/>
								{#if normalizeWhatsAppPhone(agent.phone)}
									<p class="text-xs text-gray-500 mt-1">
										Se usará: {formatWhatsAppDisplay(normalizeWhatsAppPhone(agent.phone)!)} ({normalizeWhatsAppPhone(agent.phone)})
									</p>
								{/if}
							</div>
						</div>
						<button
							type="button"
							class="text-red-600 hover:text-red-800 text-sm"
							onclick={() => removeAgent(agent.key)}
						>
							Eliminar
						</button>
					</div>

					<div class="flex flex-wrap gap-4 mb-4 text-sm">
						<label class="inline-flex items-center gap-2">
							<input
								type="radio"
								name="default-whatsapp"
								checked={agent.is_default}
								onchange={() => setDefault(agent.key)}
							/>
							Predeterminado
						</label>
						<label class="inline-flex items-center gap-2">
							<input type="checkbox" bind:checked={agent.is_active} />
							Activo
						</label>
					</div>

					<div>
						<div class="text-sm font-medium text-gray-800 mb-2">Categorías a cargo</div>
						<p class="text-xs text-gray-500 mb-3">
							Puedes marcar la categoría raíz o subcategorías. Al visitar un producto o
							subcategoría, se busca hacia arriba hasta encontrar asignación.
						</p>
						<div class="space-y-3 max-h-72 overflow-auto border rounded-lg p-3 bg-gray-50">
							{#each rootCategories() as root}
								<div>
									<label
										class="inline-flex items-center gap-2 font-medium text-gray-900 {categoryAssignedElsewhere(root.id, agent.key) ? 'opacity-40' : ''}"
									>
										<input
											type="checkbox"
											checked={agent.category_ids.includes(root.id)}
											disabled={categoryAssignedElsewhere(root.id, agent.key)}
											onchange={() => toggleCategory(agent.key, root.id)}
										/>
										{root.name}
									</label>
									{#if childCategories(root.id).length > 0}
										<div class="ml-6 mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
											{#each childCategories(root.id) as child}
												<label
													class="inline-flex items-center gap-2 text-sm text-gray-700 {categoryAssignedElsewhere(child.id, agent.key) ? 'opacity-40' : ''}"
												>
													<input
														type="checkbox"
														checked={agent.category_ids.includes(child.id)}
														disabled={categoryAssignedElsewhere(child.id, agent.key)}
														onchange={() => toggleCategory(agent.key, child.id)}
													/>
													{child.name}
												</label>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-6 flex flex-wrap gap-3">
			<button
				type="button"
				class="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
				onclick={addAgent}
			>
				+ Agregar número
			</button>
			<button
				type="button"
				class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
				disabled={saving}
				onclick={save}
			>
				{saving ? 'Guardando...' : 'Guardar'}
			</button>
		</div>
	{/if}
</div>
