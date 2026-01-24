<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { userStore, checkPermission, checkRole } from '$lib/stores/user';
	import { getAllRoles, assignRole, removeRole } from '$lib/services/users';
	import type { UserRole } from '$lib/types/roles';
	import { ROLE_DISPLAY_NAMES } from '$lib/types/roles';

	interface UserWithRoles {
		id: string;
		email: string;
		created_at: string;
		last_sign_in_at: string | null;
		roles: UserRole[];
	}

	// Estado reactivo
	let users = $state<UserWithRoles[]>([]);
	let filteredUsers = $state<UserWithRoles[]>([]);
	let loading = $state(true);
	let showCreateModal = $state(false);
	let showRolesModal = $state(false);
	let selectedUser = $state<UserWithRoles | null>(null);
	let searchTerm = $state('');
	let availableRoles = $state<Array<{ id: string; name: string; display_name: string }>>([]);

	// Estado del formulario de creación
	let formData = $state({
		email: '',
		password: '',
		confirmPassword: ''
	});
	let creating = $state(false);
	let createError = $state('');

	// Verificar permisos
	let canManageUsers = $state(false);
	let canViewUsers = $state(false);

	onMount(async () => {
		// Verificar permisos
		const state = userStore;
		canManageUsers = checkPermission('manage_users');
		canViewUsers = checkPermission('view_admin_panel') || checkPermission('manage_users');

		if (!canViewUsers) {
			window.location.href = '/admin';
			return;
		}

		await loadUsers();
		await loadRoles();
	});

	// Cargar usuarios
	async function loadUsers() {
		loading = true;
		try {
			// Obtener el token del usuario actual
			const { data: { session } } = await supabase.auth.getSession();
			if (!session) {
				throw new Error('No hay sesión activa');
			}

			const response = await fetch('/api/users/list', {
				headers: {
					'Authorization': `Bearer ${session.access_token}`
				}
			});
			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'Error al cargar usuarios');
			}

			users = result.users || [];
			applyFilters();
		} catch (error: any) {
			console.error('Error cargando usuarios:', error);
			alert('Error al cargar usuarios: ' + error.message);
		} finally {
			loading = false;
		}
	}

	// Cargar roles disponibles
	async function loadRoles() {
		try {
			console.log('Cargando roles disponibles...');
			availableRoles = await getAllRoles();
			console.log('Roles cargados:', availableRoles);
		} catch (error) {
			console.error('Error cargando roles:', error);
			availableRoles = [];
		}
	}

	// Filtrar usuarios
	function applyFilters() {
		filteredUsers = users.filter((user) => {
			const matchesSearch =
				searchTerm === '' ||
				user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
				user.roles.some((r) => r.toLowerCase().includes(searchTerm.toLowerCase()));
			return matchesSearch;
		});
	}

	// Observar cambios en búsqueda
	$effect(() => {
		applyFilters();
		searchTerm; // Trigger reactivity
	});

	// Abrir modal de creación
	function openCreateModal() {
		formData = { email: '', password: '', confirmPassword: '' };
		createError = '';
		showCreateModal = true;
	}

	// Crear usuario
	async function createUser() {
		if (!formData.email || !formData.password) {
			createError = 'Email y contraseña son requeridos';
			return;
		}

		if (formData.password !== formData.confirmPassword) {
			createError = 'Las contraseñas no coinciden';
			return;
		}

		if (formData.password.length < 6) {
			createError = 'La contraseña debe tener al menos 6 caracteres';
			return;
		}

		creating = true;
		createError = '';

		try {
			// Obtener el token del usuario actual
			const { data: { session } } = await supabase.auth.getSession();
			if (!session) {
				throw new Error('No hay sesión activa');
			}

			const response = await fetch('/api/users/create', {
				method: 'POST',
				headers: { 
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session.access_token}`
				},
				body: JSON.stringify({
					email: formData.email,
					password: formData.password
				})
			});

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'Error al crear usuario');
			}

			showCreateModal = false;
			await loadUsers();
			alert('Usuario creado exitosamente');
		} catch (error: any) {
			createError = error.message || 'Error al crear usuario';
		} finally {
			creating = false;
		}
	}

	// Abrir modal de roles
	function openRolesModal(user: UserWithRoles) {
		selectedUser = user;
		showRolesModal = true;
	}

	// Asignar rol
	async function handleAssignRole(roleName: UserRole) {
		if (!selectedUser) return;

		let currentUser = null;
		const unsubscribe = userStore.subscribe(state => {
			currentUser = state.user;
		});
		unsubscribe();

		if (!currentUser) return;

		try {
			const result = await assignRole(selectedUser.id, roleName, currentUser.id);

			if (!result.success) {
				throw new Error(result.error || 'Error al asignar rol');
			}

			await loadUsers();
			// Actualizar usuario seleccionado
			const updatedUser = users.find((u) => u.id === selectedUser!.id);
			if (updatedUser) {
				selectedUser = updatedUser;
			}
		} catch (error: any) {
			alert('Error: ' + error.message);
		}
	}

	// Remover rol
	async function handleRemoveRole(roleName: UserRole) {
		if (!selectedUser) return;

		if (!confirm(`¿Estás seguro de remover el rol "${ROLE_DISPLAY_NAMES[roleName]}" de este usuario?`)) {
			return;
		}

		try {
			const result = await removeRole(selectedUser.id, roleName);

			if (!result.success) {
				throw new Error(result.error || 'Error al remover rol');
			}

			await loadUsers();
			// Actualizar usuario seleccionado
			const updatedUser = users.find((u) => u.id === selectedUser!.id);
			if (updatedUser) {
				selectedUser = updatedUser;
			}
		} catch (error: any) {
			alert('Error: ' + error.message);
		}
	}

	// Formatear fecha
	function formatDate(dateString: string | null): string {
		if (!dateString) return 'Nunca';
		const date = new Date(dateString);
		return date.toLocaleDateString('es-MX', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Obtener badge de rol
	function getRoleBadge(role: UserRole): { class: string; text: string } {
		const badges: Record<UserRole, { class: string; text: string }> = {
			cliente: { class: 'bg-gray-100 text-gray-800', text: 'Cliente' },
			admin: { class: 'bg-blue-100 text-blue-800', text: 'Admin' },
			superadmin: { class: 'bg-purple-100 text-purple-800', text: 'Super Admin' },
			tecnico: { class: 'bg-green-100 text-green-800', text: 'Técnico' }
		};
		return badges[role] || { class: 'bg-gray-100 text-gray-800', text: role };
	}
</script>

<svelte:head>
	<title>Gestión de Usuarios - Guerra Láser Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">👥 Usuarios</h1>
			<p class="text-gray-600 mt-1">Gestiona usuarios y sus roles del sistema</p>
		</div>
		{#if canManageUsers}
			<button
				onclick={openCreateModal}
				class="bg-gradient-to-r from-red-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-red-700 hover:to-blue-700 font-semibold shadow-lg"
			>
				➕ Nuevo Usuario
			</button>
		{/if}
	</div>

	<!-- Estadísticas -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
		<div class="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
			<div class="text-sm text-gray-600">Total Usuarios</div>
			<div class="text-2xl font-bold text-gray-900">{users.length}</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
			<div class="text-sm text-gray-600">Super Admins</div>
			<div class="text-2xl font-bold text-gray-900">
				{users.filter((u) => u.roles.includes('superadmin')).length}
			</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
			<div class="text-sm text-gray-600">Admins</div>
			<div class="text-2xl font-bold text-gray-900">
				{users.filter((u) => u.roles.includes('admin') && !u.roles.includes('superadmin')).length}
			</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
			<div class="text-sm text-gray-600">Técnicos</div>
			<div class="text-2xl font-bold text-gray-900">
				{users.filter((u) => u.roles.includes('tecnico')).length}
			</div>
		</div>
	</div>

	<!-- Búsqueda -->
	<div class="bg-white p-4 rounded-lg shadow mb-6">
		<input
			type="text"
			bind:value={searchTerm}
			placeholder="🔍 Buscar por email o rol..."
			class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
		/>
	</div>

	<!-- Lista de usuarios -->
	{#if loading}
		<div class="text-center py-12">
			<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			<p class="mt-4 text-gray-600">Cargando usuarios...</p>
		</div>
	{:else if filteredUsers.length === 0}
		<div class="bg-white p-12 rounded-lg shadow text-center">
			<div class="text-6xl mb-4">👤</div>
			<h3 class="text-xl font-semibold text-gray-900 mb-2">
				{searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
			</h3>
			<p class="text-gray-600 mb-4">
				{searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando tu primer usuario'}
			</p>
			{#if !searchTerm && canManageUsers}
				<button
					onclick={openCreateModal}
					class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
				>
					➕ Agregar Primer Usuario
				</button>
			{/if}
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Usuario
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Roles
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Último Acceso
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Fecha Creación
						</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
							Acciones
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each filteredUsers as user (user.id)}
						<tr class="hover:bg-gray-50">
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900">{user.email}</div>
								<div class="text-sm text-gray-500">ID: {user.id.substring(0, 8)}...</div>
							</td>
							<td class="px-6 py-4">
								<div class="flex flex-wrap gap-2">
									{#if user.roles.length === 0}
										<span class="text-xs text-gray-400">Sin roles</span>
									{:else}
										{#each user.roles as role}
											<span
												class="px-2 py-1 rounded-full text-xs font-semibold {getRoleBadge(role).class}"
											>
												{getRoleBadge(role).text}
											</span>
										{/each}
									{/if}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
								{formatDate(user.last_sign_in_at)}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
								{formatDate(user.created_at)}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
								{#if canManageUsers}
									<button
										onclick={() => openRolesModal(user)}
										class="text-blue-600 hover:text-blue-900 mr-4"
									>
										⚙️ Roles
									</button>
								{:else}
									<span class="text-gray-400">Ver solo</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Modal de Crear Usuario -->
{#if showCreateModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
			<div class="p-6">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-2xl font-bold text-gray-900">Nuevo Usuario</h2>
					<button
						onclick={() => (showCreateModal = false)}
						class="text-gray-400 hover:text-gray-600"
					>
						✕
					</button>
				</div>

				{#if createError}
					<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
						{createError}
					</div>
				{/if}

				<form onsubmit={(e) => { e.preventDefault(); createUser(); }} class="space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
						<input
							id="email"
							type="email"
							bind:value={formData.email}
							required
							class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
							placeholder="usuario@ejemplo.com"
						/>
					</div>

					<div>
						<label for="password" class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
						<input
							id="password"
							type="password"
							bind:value={formData.password}
							required
							minlength="6"
							class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
							placeholder="Mínimo 6 caracteres"
						/>
					</div>

					<div>
						<label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">Confirmar Contraseña</label>
						<input
							id="confirmPassword"
							type="password"
							bind:value={formData.confirmPassword}
							required
							minlength="6"
							class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
							placeholder="Repite la contraseña"
						/>
					</div>

					<div class="flex gap-3 pt-4">
						<button
							type="button"
							onclick={() => (showCreateModal = false)}
							class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
							disabled={creating}
						>
							Cancelar
						</button>
						<button
							type="submit"
							class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
							disabled={creating}
						>
							{creating ? 'Creando...' : 'Crear Usuario'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de Gestión de Roles -->
{#if showRolesModal && selectedUser}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
			<div class="p-6">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-2xl font-bold text-gray-900">Gestionar Roles</h2>
					<button
						onclick={() => (showRolesModal = false)}
						class="text-gray-400 hover:text-gray-600"
					>
						✕
					</button>
				</div>

				<div class="mb-4">
					<p class="text-sm text-gray-600 mb-2">Usuario:</p>
					<p class="font-medium text-gray-900">{selectedUser.email}</p>
				</div>

				<div class="mb-6">
					<p class="text-sm font-medium text-gray-700 mb-3">Roles Asignados:</p>
					{#if selectedUser.roles.length === 0}
						<p class="text-sm text-gray-500">Sin roles asignados</p>
					{:else}
						<div class="flex flex-wrap gap-2 mb-4">
							{#each selectedUser.roles as role}
								<div class="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
									<span class="text-sm font-medium text-gray-800">{ROLE_DISPLAY_NAMES[role]}</span>
									<button
										onclick={() => handleRemoveRole(role)}
										class="text-red-600 hover:text-red-800 text-xs"
										title="Remover rol"
									>
										✕
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div>
					<p class="text-sm font-medium text-gray-700 mb-3">Asignar Nuevo Rol:</p>
					{#if availableRoles.length === 0}
						<p class="text-sm text-gray-500">No hay roles disponibles para asignar</p>
						<p class="text-xs text-gray-400">Debug: availableRoles está vacío</p>
					{:else}
						<div class="space-y-2">
							{#each availableRoles as role}
								{#if !selectedUser.roles.includes(role.name as UserRole)}
									<button
										onclick={() => handleAssignRole(role.name as UserRole)}
										class="w-full text-left px-4 py-2 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
									>
										<div class="font-medium text-gray-900">{role.display_name}</div>
										<div class="text-xs text-gray-500">{role.name}</div>
									</button>
								{/if}
							{/each}
						</div>
					{/if}
				</div>

				<div class="mt-6 pt-4 border-t">
					<button
						onclick={() => (showRolesModal = false)}
						class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
					>
						Cerrar
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
