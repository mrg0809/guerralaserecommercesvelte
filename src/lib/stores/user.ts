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
	
	// Cache para evitar múltiples llamadas
	let cacheTimeout: NodeJS.Timeout | null = null;
	const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
	let lastCacheTime = 0;

	return {
		subscribe,
		/**
		 * Inicializa el store cargando el usuario actual y sus permisos
		 */
		async init() {
			// Si ya está inicializado y el cache es válido, no hacer nada
			if (Date.now() - lastCacheTime < CACHE_DURATION) {
				console.log('🔍 Usando cache de usuario (válido por 5 min)');
				return;
			}

			console.log('🔍 Inicializando userStore...');
			console.log('🔍 Verificando configuración de Supabase...');
			console.log('🔍 Cliente Supabase disponible:', !!supabase);
			
			update((state) => ({ ...state, loading: true }));

			try {
				console.log('🔍 Obteniendo sesión de Supabase...');
				const sessionStartTime = Date.now();
				
				// Timeout para getSession (reducido a 1 segundo para respuesta ultra rápida)
				const sessionPromise = supabase.auth.getSession();
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => reject(new Error('Timeout obteniendo sesión')), 1000);
				});

				const result = await Promise.race([sessionPromise, timeoutPromise]);
				const { data: { session } } = result as any;
				
				const sessionEndTime = Date.now();
				console.log(`🔍 Sesión obtenida en ${sessionEndTime - sessionStartTime}ms`);
				console.log('🔍 Estado de sesión:', session ? 'Usuario autenticado' : 'No hay sesión');

				if (session?.user) {
					console.log('🔍 Usuario encontrado, cargando permisos...');
					const userPermissions = await getUserRolesAndPermissions(session.user.id);
					
					set({
						user: session.user,
						roles: userPermissions.roles,
						permissions: userPermissions.permissions,
						loading: false,
						initialized: true
					});
					
					// Actualizar cache y guardar persistente
					lastCacheTime = Date.now();
					
					// Guardar cache persistente para modo offline
					try {
						localStorage.setItem('user_cache', JSON.stringify({
							user: session.user,
							roles: userPermissions.roles,
							permissions: userPermissions.permissions,
							loading: false,
							initialized: true,
							timestamp: Date.now()
						}));
						console.log('✅ Cache persistente guardado');
					} catch (cacheError) {
						console.warn('No se pudo guardar cache persistente:', cacheError);
					}
					
					console.log('✅ UserStore inicializado con cache');
				} else {
					console.log('🔍 No hay sesión de usuario');
					set({
						user: null,
						roles: [],
						permissions: [],
						loading: false,
						initialized: true
					});
					lastCacheTime = Date.now();
				}
			} catch (error) {
				console.error('❌ Error inicializando usuario:', error);
			
				// Si es timeout de sesión, intentar un enfoque alternativo
				if (error instanceof Error && error.message === 'Timeout obteniendo sesión') {
					console.log('🔍 Timeout en getSession, intentando fallback...');
					try {
						// Intentar obtener usuario directamente (sin sesión completa)
						const { data: { user }, error: userError } = await Promise.race([
							supabase.auth.getUser(),
							new Promise<never>((_, reject) => 
								setTimeout(() => reject(new Error('Timeout obteniendo usuario')), 500)
							)
						]);
						
						if (user && !userError) {
							console.log('🔍 Usuario obtenido via fallback, cargando permisos...');
							const userPermissions = await getUserRolesAndPermissions(user.id);
							
							set({
								user,
								roles: userPermissions.roles,
								permissions: userPermissions.permissions,
								loading: false,
								initialized: true
							});
							lastCacheTime = Date.now();
							return;
						}
					} catch (fallbackError) {
						console.error('❌ Error en fallback:', fallbackError);
					}
				}
			
				// Si todo falla, intentar extraer roles del token JWT (fallback ultra rápido)
				console.log('🔍 Intentando extraer roles del token JWT...');
				try {
					// Intentar obtener token de localStorage directamente (más rápido)
					const token = localStorage.getItem('sb-access-token') || 
								  localStorage.getItem('supabase.auth.token');
					
					if (token) {
						console.log('🔍 Token encontrado en localStorage');
						// Decodificar JWT (sin verificar firma, solo para extraer datos)
						const tokenParts = token.split('.');
						if (tokenParts.length === 3) {
							const payload = JSON.parse(atob(tokenParts[1]));
							console.log('🔍 Payload del token:', payload);
							
							// Extraer roles del token (si existen)
							const roles = payload.user_roles || payload.roles || payload.app_metadata?.roles || [];
							const permissions = payload.permissions || payload.app_metadata?.permissions || [];
							
							if (roles.length > 0 || permissions.length > 0) {
								console.log('🔍 Roles/permisos encontrados en token:', { roles, permissions });
								
								// Reconstruir objeto user básico del payload
								const user: any = {
									id: payload.sub,
									email: payload.email,
									user_metadata: payload.user_metadata || {},
									app_metadata: payload.app_metadata || {}
								};
								
								set({
									user,
									roles: Array.isArray(roles) ? roles : [],
									permissions: Array.isArray(permissions) ? permissions : [],
									loading: false,
									initialized: true
								});
								lastCacheTime = Date.now();
								console.log('✅ Autenticación vía JWT completada');
								return;
							} else {
								console.log('🔍 No se encontraron roles en el token');
							}
						}
					} else {
						console.log('🔍 No se encontró token en localStorage');
					}
				} catch (tokenError) {
					console.warn('Error extrayendo roles del token:', tokenError);
				}

				// Si todo falla, intentar modo offline con cache persistente
				console.log('🔍 Intentando modo offline...');
				try {
					const cached = localStorage.getItem('user_cache');
					if (cached) {
						const { timestamp, ...state } = JSON.parse(cached);
						const age = Date.now() - timestamp;
						
						// Usar cache si tiene menos de 2 minutos
						if (age < 2 * 60 * 1000) {
							console.log(`🔍 Usando modo offline (cache de ${Math.round(age/1000)}s)`);
							set({
								...state,
								loading: false,
								initialized: true
							});
							lastCacheTime = Date.now();
							return;
						}
					}
				} catch (offlineError) {
					console.warn('Error en modo offline:', offlineError);
				}

				// Si todo falla, establecer como no autenticado
				console.log('🔍 Modo offline no disponible, estableciendo como no autenticado');
				set({
					user: null,
					roles: [],
					permissions: [],
					loading: false,
					initialized: true
				});
				lastCacheTime = Date.now();
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
			// Limpiar cache
			lastCacheTime = 0;
		},

		/**
		 * Fuerza la recarga ignorando el cache
		 */
		forceRefresh() {
			console.log('🔍 Forzando refresh de userStore (ignorando cache)');
			lastCacheTime = 0;
			return this.init();
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
