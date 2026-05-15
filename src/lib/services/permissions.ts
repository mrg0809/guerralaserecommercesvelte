/**
 * Servicio para gestionar roles y permisos
 */

import { supabase } from '$lib/supabaseClient';
import type { UserRole, Permission, UserPermissions } from '$lib/types/roles';

/**
 * Obtiene los roles de un usuario desde la BD
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
	const { data, error } = await supabase.rpc('get_user_roles', { user_uuid: userId });

	if (error) {
		console.error('Error obteniendo roles:', error);
		const { data: rpcData, error: rpcError } = await supabase.rpc(
			'get_user_roles_and_permissions' as never,
			{ user_uuid: userId } as never
		);
		if (!rpcError && rpcData && typeof rpcData === 'object') {
			const roles = (rpcData as { roles?: string[] }).roles || [];
			return roles as UserRole[];
		}
		return [];
	}

	return (data?.map((row: { role_name: string }) => row.role_name) || []) as UserRole[];
}

/**
 * Verifica si un usuario tiene un permiso específico
 */
export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
	const { data, error } = await supabase.rpc('user_has_permission' as never, {
		user_uuid: userId,
		permission_name: permission
	} as never);

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
	const { data, error } = await supabase.rpc('user_has_role' as never, {
		user_uuid: userId,
		role_name: role
	} as never);

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
	const { data, error } = await supabase.rpc('get_user_permissions', { user_uuid: userId });

	if (error) {
		console.error('Error obteniendo permisos:', error);
		const { data: rpcData, error: rpcError } = await supabase.rpc(
			'get_user_roles_and_permissions' as never,
			{ user_uuid: userId } as never
		);
		if (!rpcError && rpcData && typeof rpcData === 'object') {
			const permissions = (rpcData as { permissions?: string[] }).permissions || [];
			return permissions as Permission[];
		}
		return [];
	}

	return (data?.map((row: { permission_name: string }) => row.permission_name) ||
		[]) as Permission[];
}

/**
 * Obtiene roles y permisos de un usuario
 */
export async function getUserRolesAndPermissions(userId: string): Promise<UserPermissions> {
	const { data, error } = await supabase.rpc('get_user_roles_and_permissions' as never, {
		user_uuid: userId
	} as never);

	if (!error && data && typeof data === 'object') {
		const payload = data as { roles?: string[]; permissions?: string[] };
		return {
			roles: (payload.roles || []) as UserRole[],
			permissions: (payload.permissions || []) as Permission[]
		};
	}

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
	const { data: roleData, error: roleError } = await (supabase.from('roles' as never)
		.select('id')
		.eq('name', roleName)
		.single() as never);

	if (roleError || !roleData) {
		return { success: false, error: 'Rol no encontrado' };
	}

	const { error } = await (supabase.from('user_roles' as never).insert({
		user_id: userId,
		role_id: (roleData as { id: string }).id,
		assigned_by: assignedBy
	}) as never);

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
	const { data: roleData, error: roleError } = await (supabase.from('roles' as never)
		.select('id')
		.eq('name', roleName)
		.single() as never);

	if (roleError || !roleData) {
		return { success: false, error: 'Rol no encontrado' };
	}

	const { error } = await (supabase
		.from('user_roles' as never)
		.delete()
		.eq('user_id', userId)
		.eq('role_id', (roleData as { id: string }).id) as never);

	if (error) {
		return { success: false, error: error.message };
	}

	return { success: true };
}

/**
 * Ruta de redirección tras login según rol
 */
export function getPostLoginPath(roles: UserRole[]): string {
	if (roles.includes('tecnico') && !roles.includes('admin') && !roles.includes('superadmin')) {
		return '/tecnico/entregas';
	}
	if (roles.includes('admin') || roles.includes('superadmin')) {
		return '/admin';
	}
	return '/';
}
