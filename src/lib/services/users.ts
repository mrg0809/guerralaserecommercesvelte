/**
 * Servicio para gestionar usuarios del sistema
 */

import { supabase } from '$lib/supabaseClient';
import type { UserRole } from '$lib/types/roles';
import { assignRoleToUser, removeRoleFromUser } from './permissions';

export interface UserWithRoles {
	id: string;
	email: string;
	created_at: string;
	last_sign_in_at: string | null;
	roles: UserRole[];
	raw_user_meta_data?: Record<string, any>;
}

/**
 * Obtiene todos los usuarios con sus roles
 */
export async function getAllUsers(): Promise<UserWithRoles[]> {
	try {
		// Obtener token de sesión
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			throw new Error('No hay sesión activa');
		}

		const response = await fetch('/api/users/list', {
			headers: {
				Authorization: `Bearer ${session.access_token}`
			}
		});

		const result = await response.json();

		if (!result.success) {
			throw new Error(result.error || 'Error al cargar usuarios');
		}

		return result.users || [];
	} catch (error: any) {
		console.error('Error obteniendo usuarios:', error);
		throw error;
	}
}

/**
 * Fallback: obtener usuarios desde user_roles
 */
async function getUsersFromRoles(): Promise<UserWithRoles[]> {
	const { data: userRoles, error } = await (supabase as any)
		.from('user_roles')
		.select(`
			user_id,
			roles (
				name,
				display_name
			)
		`)
		.eq('is_active', true);

	if (error) {
		console.error('Error obteniendo usuarios desde roles:', error);
		return [];
	}

	// Agrupar por usuario
	const usersMap = new Map<string, UserWithRoles>();

	if (userRoles) {
		for (const ur of userRoles) {
			const userId = ur.user_id as string;
			const role = ur.roles as { name: string; display_name: string };

			if (!usersMap.has(userId)) {
				usersMap.set(userId, {
					id: userId,
					email: '', // No tenemos email aquí, necesitamos función SQL
					created_at: '',
					last_sign_in_at: null,
					roles: []
				});
			}

			const user = usersMap.get(userId)!;
			user.roles.push(role.name as UserRole);
		}
	}

	return Array.from(usersMap.values());
}

/**
 * Crea un nuevo usuario (requiere endpoint del servidor)
 */
export async function createUser(
	email: string,
	password: string,
	metadata?: Record<string, any>
): Promise<{ success: boolean; userId?: string; error?: string }> {
	try {
		// Obtener token de sesión
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			return { success: false, error: 'No hay sesión activa' };
		}

		const response = await fetch('/api/users/create', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${session.access_token}`
			},
			body: JSON.stringify({ email, password, metadata })
		});

		const result = await response.json();
		return result;
	} catch (error: any) {
		return { success: false, error: error.message || 'Error al crear usuario' };
	}
}

/**
 * Actualiza un usuario
 */
export async function updateUser(
	userId: string,
	updates: { email?: string; metadata?: Record<string, any> }
): Promise<{ success: boolean; error?: string }> {
	// Esto también requiere privilegios de admin
	return {
		success: false,
		error: 'La actualización de usuarios debe hacerse desde el servidor'
	};
}

/**
 * Elimina un usuario (desactiva)
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
	return {
		success: false,
		error: 'La eliminación de usuarios debe hacerse desde el servidor'
	};
}

/**
 * Obtiene los roles de un usuario
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
	const { data, error } = await (supabase as any).rpc('get_user_roles', {
		user_uuid: userId
	});

	if (error) {
		console.error('Error obteniendo roles del usuario:', error);
		return [];
	}

	return (data || []).map((r: { role_name: string }) => r.role_name as UserRole);
}

/**
 * Obtiene todos los roles disponibles
 */
export async function getAllRoles(): Promise<Array<{ id: string; name: string; display_name: string }>> {
	try {
		// Obtener token de sesión
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			console.error('No hay sesión activa para obtener roles');
			return [];
		}

		const response = await fetch('/api/users/roles', {
			headers: {
				Authorization: `Bearer ${session.access_token}`
			}
		});

		const result = await response.json();

		if (!result.success) {
			console.error('Error en respuesta de roles:', result.error);
			return [];
		}

		return result.roles || [];
	} catch (error: any) {
		console.error('Error obteniendo roles:', error);
		return [];
	}
}

/**
 * Asigna un rol a un usuario
 */
export async function assignRole(
	userId: string,
	roleName: UserRole,
	assignedBy: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Obtener token de sesión
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			return { success: false, error: 'No hay sesión activa' };
		}

		const response = await fetch('/api/users/assign-role', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${session.access_token}`
			},
			body: JSON.stringify({ userId, roleName })
		});

		const result = await response.json();
		return result;
	} catch (error: any) {
		return { success: false, error: error.message || 'Error al asignar rol' };
	}
}

/**
 * Remueve un rol de un usuario
 */
export async function removeRole(userId: string, roleName: UserRole): Promise<{ success: boolean; error?: string }> {
	try {
		// Obtener token de sesión
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			return { success: false, error: 'No hay sesión activa' };
		}

		const response = await fetch('/api/users/remove-role', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${session.access_token}`
			},
			body: JSON.stringify({ userId, roleName })
		});

		const result = await response.json();
		return result;
	} catch (error: any) {
		return { success: false, error: error.message || 'Error al remover rol' };
	}
}
