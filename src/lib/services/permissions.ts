/**
 * Servicio para gestionar roles y permisos
 */

import { supabase } from '$lib/supabaseClient';
import type { UserRole, Permission, UserPermissions } from '$lib/types/roles';

/**
 * Obtiene los roles de un usuario
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
	console.log('🔍 Obteniendo roles para:', userId);
	const startTime = Date.now();
	
	try {
		// Usar consulta directa que es más rápida que RPC
		const { data: directData, error: directError } = await supabase
			.from('user_roles' as any)
			.select('roles(name)')
			.eq('user_id', userId)
			.limit(10); // Limitar resultados

		if (directError) {
			console.error('❌ Error en consulta directa:', directError);
			return [];
		}

		const endTime = Date.now();
		console.log(`✅ Roles obtenidos via consulta directa en ${endTime - startTime}ms`);
		return (directData || []).map((ur: any) => ur.roles?.name as UserRole).filter(Boolean);
	} catch (error) {
		console.error('❌ Error obteniendo roles:', error);
		return [];
	}
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
	console.log('🔍 Obteniendo permisos para:', userId);
	const startTime = Date.now();
	
	try {
		// Usar consulta directa simplificada
		const { data: directData, error: directError } = await supabase
			.from('user_roles' as any)
			.select('role_id, role_permissions(permissions(name))')
			.eq('user_id', userId)
			.limit(50); // Limitar resultados

		if (directError) {
			console.error('❌ Error en consulta directa:', directError);
			return [];
		}

		const endTime = Date.now();
		console.log(`✅ Permisos obtenidos via consulta directa en ${endTime - startTime}ms`);
		
		// Extraer permisos únicos
		const permissions = new Set<Permission>();
		(directData || []).forEach((ur: any) => {
			if (ur.role_permissions) {
				ur.role_permissions.forEach((rp: any) => {
					if (rp.permissions?.name) {
						permissions.add(rp.permissions.name as Permission);
					}
				});
			}
		});
		
		return Array.from(permissions);
	} catch (error) {
		console.error('❌ Error obteniendo permisos:', error);
		return [];
	}
}

/**
 * Obtiene roles y permisos de un usuario
 */
export async function getUserRolesAndPermissions(userId: string): Promise<UserPermissions> {
	console.log('🔍 Cargando roles y permisos para usuario:', userId);
	const startTime = Date.now();
	
	try {
		// Cargar roles y permisos por separado con timeouts muy cortos
		console.log('🔍 Cargando roles...');
		const rolesStartTime = Date.now();
		const roles = await Promise.race([
			getUserRoles(userId),
			new Promise<never>((_, reject) => 
				setTimeout(() => reject(new Error('Timeout obteniendo roles')), 500)
			)
		]);
		const rolesEndTime = Date.now();
		console.log(`✅ Roles cargados en ${rolesEndTime - rolesStartTime}ms`);

		console.log('🔍 Cargando permisos...');
		const permissionsStartTime = Date.now();
		const permissions = await Promise.race([
			getUserPermissions(userId),
			new Promise<never>((_, reject) => 
				setTimeout(() => reject(new Error('Timeout obteniendo permisos')), 500)
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
