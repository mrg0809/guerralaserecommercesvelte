/**
 * Store para gestionar el usuario actual y sus permisos
 */

import { writable, derived, get } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import type { UserRole, Permission, UserPermissions } from '$lib/types/roles';
import { getUserRolesAndPermissions, hasPermission, hasRole } from '$lib/services/permissions';

interface UserState {
	user: User | null;
	roles: UserRole[];
	permissions: Permission[];
	loading: boolean;
	initialized: boolean;
}

const initialState: UserState = {
	user: null,
	roles: [],
	permissions: [],
	loading: true,
	initialized: false
};

function createUserStore() {
	const { subscribe, set, update } = writable<UserState>(initialState);

	return {
		subscribe,
		/**
		 * Inicializa el store cargando el usuario actual y sus permisos
		 */
		async init() {
			update((state) => ({ ...state, loading: true }));

			try {
				const {
					data: { session }
				} = await supabase.auth.getSession();

				if (session?.user) {
					const userPermissions = await getUserRolesAndPermissions(session.user.id);
					set({
						user: session.user,
						roles: userPermissions.roles,
						permissions: userPermissions.permissions,
						loading: false,
						initialized: true
					});
				} else {
					set({
						user: null,
						roles: [],
						permissions: [],
						loading: false,
						initialized: true
					});
				}
			} catch (error) {
				console.error('Error inicializando usuario:', error);
				set({
					user: null,
					roles: [],
					permissions: [],
					loading: false,
					initialized: true
				});
			}
		},

		/**
		 * Actualiza el usuario y recarga sus permisos
		 */
		async refresh() {
			await this.init();
		},

		/**
		 * Establece el usuario manualmente (útil después de login)
		 */
		async setUser(user: User | null) {
			if (user) {
				const userPermissions = await getUserRolesAndPermissions(user.id);
				set({
					user,
					roles: userPermissions.roles,
					permissions: userPermissions.permissions,
					loading: false,
					initialized: true
				});
			} else {
				set({
					user: null,
					roles: [],
					permissions: [],
					loading: false,
					initialized: true
				});
			}
		},

		/**
		 * Limpia el store (útil para logout)
		 */
		logout() {
			set({
				user: null,
				roles: [],
				permissions: [],
				loading: false,
				initialized: true
			});
		}
	};
}

export const userStore = createUserStore();

/**
 * Store derivado: verifica si el usuario tiene un permiso específico
 */
export function hasPermissionStore(permission: Permission) {
	return derived(userStore, ($user) => {
		if (!$user.user || !$user.initialized) return false;
		return $user.permissions.includes(permission);
	});
}

/**
 * Store derivado: verifica si el usuario tiene un rol específico
 */
export function hasRoleStore(role: UserRole) {
	return derived(userStore, ($user) => {
		if (!$user.user || !$user.initialized) return false;
		return $user.roles.includes(role);
	});
}

/**
 * Store derivado: verifica si el usuario tiene al menos uno de los roles especificados
 */
export function hasAnyRoleStore(roles: UserRole[]) {
	return derived(userStore, ($user) => {
		if (!$user.user || !$user.initialized) return false;
		return roles.some((role) => $user.roles.includes(role));
	});
}

/**
 * Store derivado: verifica si el usuario tiene al menos uno de los permisos especificados
 */
export function hasAnyPermissionStore(permissions: Permission[]) {
	return derived(userStore, ($user) => {
		if (!$user.user || !$user.initialized) return false;
		return permissions.some((permission) => $user.permissions.includes(permission));
	});
}

/**
 * Store derivado: verifica si el usuario tiene todos los permisos especificados
 */
export function hasAllPermissionsStore(permissions: Permission[]) {
	return derived(userStore, ($user) => {
		if (!$user.user || !$user.initialized) return false;
		return permissions.every((permission) => $user.permissions.includes(permission));
	});
}

/**
 * Store derivado: verifica si el usuario puede acceder al panel de admin
 */
export const canAccessAdmin = derived(userStore, ($user) => {
	if (!$user.user || !$user.initialized) return false;
	return $user.permissions.includes('view_admin_panel');
});

/**
 * Helper para verificar permisos de forma síncrona (usa el store)
 */
export function checkPermission(permission: Permission): boolean {
	const state = get(userStore);
	if (!state.user || !state.initialized) return false;
	return state.permissions.includes(permission);
}

/**
 * Helper para verificar roles de forma síncrona (usa el store)
 */
export function checkRole(role: UserRole): boolean {
	const state = get(userStore);
	if (!state.user || !state.initialized) return false;
	return state.roles.includes(role);
}

/**
 * Helper para verificar si tiene al menos uno de los roles
 */
export function checkAnyRole(roles: UserRole[]): boolean {
	const state = get(userStore);
	if (!state.user || !state.initialized) return false;
	return roles.some((role) => state.roles.includes(role));
}

/**
 * Helper para verificar si tiene al menos uno de los permisos
 */
export function checkAnyPermission(permissions: Permission[]): boolean {
	const state = get(userStore);
	if (!state.user || !state.initialized) return false;
	return permissions.some((permission) => state.permissions.includes(permission));
}
