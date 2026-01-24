/**
 * Servicio para gestionar roles y permisos
 */

import { supabase } from '$lib/supabaseClient';
import type { UserRole, Permission, UserPermissions } from '$lib/types/roles';

/**
 * Obtiene los roles de un usuario
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
	const { data, error } = await supabase.rpc('get_user_roles', {
		user_uuid: userId
	});

	if (error) {
		console.error('Error obteniendo roles del usuario:', error);
		return [];
	}

	return (data || []).map((r: { role_name: string }) => r.role_name as UserRole);
}

/**
 * Verifica si un usuario tiene un permiso específico
 */
export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
	const { data, error } = await supabase.rpc('user_has_permission', {
		user_uuid: userId,
		permission_name: permission
	});

	if (error) {
		console.error('Error verificando permiso:', error);
		return false;
	}

	return data === true;
}

/**
 * Verifica si un usuario tiene un rol específico
 */
export async function hasRole(userId: string, role: UserRole): Promise<boolean> {
	const { data, error } = await supabase.rpc('user_has_role', {
		user_uuid: userId,
		role_name: role
	});

	if (error) {
		console.error('Error verificando rol:', error);
		return false;
	}

	return data === true;
}

/**
 * Obtiene todos los permisos de un usuario
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
	const { data, error } = await supabase.rpc('get_user_permissions', {
		user_uuid: userId
	});

	if (error) {
		console.error('Error obteniendo permisos del usuario:', error);
		return [];
	}

	return (data || []).map((p: { permission_name: string }) => p.permission_name as Permission);
}

/**
 * Obtiene roles y permisos de un usuario
 */
export async function getUserRolesAndPermissions(userId: string): Promise<UserPermissions> {
	const [roles, permissions] = await Promise.all([
		getUserRoles(userId),
		getUserPermissions(userId)
	]);

	return { roles, permissions };
}

/**
 * Verifica si un usuario tiene al menos uno de los roles especificados
 */
export async function hasAnyRole(userId: string, roles: UserRole[]): Promise<boolean> {
	for (const role of roles) {
		if (await hasRole(userId, role)) {
			return true;
		}
	}
	return false;
}

/**
 * Verifica si un usuario tiene al menos uno de los permisos especificados
 */
export async function hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
	for (const permission of permissions) {
		if (await hasPermission(userId, permission)) {
			return true;
		}
	}
	return false;
}

/**
 * Verifica si un usuario tiene todos los permisos especificados
 */
export async function hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
	for (const permission of permissions) {
		if (!(await hasPermission(userId, permission))) {
			return false;
		}
	}
	return true;
}

/**
 * Asigna un rol a un usuario (solo superadmin)
 */
export async function assignRoleToUser(
	userId: string,
	roleName: UserRole,
	assignedBy: string
): Promise<{ success: boolean; error?: string }> {
	// Primero obtener el role_id
	const { data: roleData, error: roleError } = await supabase
		.from('roles')
		.select('id')
		.eq('name', roleName)
		.single();

	if (roleError || !roleData) {
		return { success: false, error: 'Rol no encontrado' };
	}

	const { error } = await supabase.from('user_roles').insert({
		user_id: userId,
		role_id: roleData.id,
		assigned_by: assignedBy
	});

	if (error) {
		return { success: false, error: error.message };
	}

	return { success: true };
}

/**
 * Remueve un rol de un usuario (solo superadmin)
 */
export async function removeRoleFromUser(
	userId: string,
	roleName: UserRole
): Promise<{ success: boolean; error?: string }> {
	// Primero obtener el role_id
	const { data: roleData, error: roleError } = await supabase
		.from('roles')
		.select('id')
		.eq('name', roleName)
		.single();

	if (roleError || !roleData) {
		return { success: false, error: 'Rol no encontrado' };
	}

	const { error } = await supabase
		.from('user_roles')
		.delete()
		.eq('user_id', userId)
		.eq('role_id', roleData.id);

	if (error) {
		return { success: false, error: error.message };
	}

	return { success: true };
}
