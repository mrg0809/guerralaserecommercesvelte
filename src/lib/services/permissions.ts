/**
 * Servicio para gestionar roles y permisos
 */

import { supabase } from '$lib/supabaseClient';
import type { UserRole, Permission, UserPermissions } from '$lib/types/roles';

/**
 * Obtiene los roles de un usuario
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
	console.log('🔍 Llamando RPC get_user_roles para:', userId);
	const startTime = Date.now();
	
	const { data, error } = await supabase.rpc('get_user_roles' as any, {
		user_uuid: userId
	});

	const endTime = Date.now();
	console.log(`🔍 RPC get_user_roles completada en ${endTime - startTime}ms`);

	if (error) {
		console.error('❌ Error en RPC get_user_roles:', error);
		return [];
	}

	console.log('🔍 Datos de roles recibidos:', data);
	return (data || []).map((r: any) => r.role_name as UserRole);
}

/**
 * Verifica si un usuario tiene un permiso específico
 */
export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
	const { data, error } = await supabase.rpc('user_has_permission' as any, {
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
	const { data, error } = await supabase.rpc('user_has_role' as any, {
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
	console.log('🔍 Llamando RPC get_user_permissions para:', userId);
	const startTime = Date.now();
	
	const { data, error } = await supabase.rpc('get_user_permissions' as any, {
		user_uuid: userId
	});

	const endTime = Date.now();
	console.log(`🔍 RPC get_user_permissions completada en ${endTime - startTime}ms`);

	if (error) {
		console.error('❌ Error en RPC get_user_permissions:', error);
		return [];
	}

	console.log('🔍 Datos de permisos recibidos:', data);
	return (data || []).map((p: any) => p.permission_name as Permission);
}

/**
 * Obtiene roles y permisos de un usuario
 */
export async function getUserRolesAndPermissions(userId: string): Promise<UserPermissions> {
	console.log('🔍 Cargando roles y permisos para usuario:', userId);
	const startTime = Date.now();
	
	try {
		// Cargar roles y permisos por separado con timeouts individuales
		console.log('🔍 Cargando roles...');
		const rolesStartTime = Date.now();
		const roles = await Promise.race([
			getUserRoles(userId),
			new Promise<never>((_, reject) => 
				setTimeout(() => reject(new Error('Timeout obteniendo roles')), 10000)
			)
		]);
		const rolesEndTime = Date.now();
		console.log(`✅ Roles cargados en ${rolesEndTime - rolesStartTime}ms`);

		console.log('🔍 Cargando permisos...');
		const permissionsStartTime = Date.now();
		const permissions = await Promise.race([
			getUserPermissions(userId),
			new Promise<never>((_, reject) => 
				setTimeout(() => reject(new Error('Timeout obteniendo permisos')), 10000)
			)
		]);
		const permissionsEndTime = Date.now();
		console.log(`✅ Permisos cargados en ${permissionsEndTime - permissionsStartTime}ms`);

		const endTime = Date.now();
		console.log(`✅ Todos los permisos cargados en ${endTime - startTime}ms total`);
		
		return { roles, permissions };
	} catch (error) {
		console.error('❌ Error cargando roles y permisos:', error);
		// Retornar valores vacíos en caso de error para no bloquear
		return { roles: [], permissions: [] };
	}
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
	const { data: roleData, error: roleError } = await (supabase.from('roles' as any)
		.select('id')
		.eq('name', roleName)
		.single() as any);

	if (roleError || !roleData) {
		return { success: false, error: 'Rol no encontrado' };
	}

	const { error } = await (supabase.from('user_roles' as any).insert({
		user_id: userId,
		role_id: roleData.id,
		assigned_by: assignedBy
	}) as any);

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
	const { data: roleData, error: roleError } = await (supabase.from('roles' as any)
		.select('id')
		.eq('name', roleName)
		.single() as any);

	if (roleError || !roleData) {
		return { success: false, error: 'Rol no encontrado' };
	}

	const { error } = await (supabase
		.from('user_roles' as any)
		.delete()
		.eq('user_id', userId)
		.eq('role_id', roleData.id) as any);

	if (error) {
		return { success: false, error: error.message };
	}

	return { success: true };
}
