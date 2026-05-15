import { createClient, type User } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { UserRole } from '$lib/types/roles';

export function getSupabaseAdmin() {
	return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

export async function getAuthUserFromRequest(request: Request): Promise<User | null> {
	const authHeader = request.headers.get('authorization');
	if (!authHeader?.startsWith('Bearer ')) return null;

	const token = authHeader.replace('Bearer ', '');
	const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	const {
		data: { user },
		error
	} = await client.auth.getUser(token);

	if (error || !user) return null;
	return user;
}

export async function getUserRoleNames(userId: string): Promise<string[]> {
	const admin = getSupabaseAdmin();
	const { data } = await admin
		.from('user_roles')
		.select('roles(name)')
		.eq('user_id', userId)
		.eq('is_active', true);

	return (data?.map((row: { roles: { name: string } | null }) => row.roles?.name).filter(Boolean) ||
		[]) as string[];
}

export function isAdminRole(roles: string[]): boolean {
	return roles.includes('admin') || roles.includes('superadmin');
}

export function isTechnicianRole(roles: string[]): boolean {
	return roles.includes('tecnico');
}

export async function requireAdmin(request: Request): Promise<
	| { ok: true; user: User; roles: string[]; admin: ReturnType<typeof getSupabaseAdmin> }
	| { ok: false; status: number; error: string }
> {
	const user = await getAuthUserFromRequest(request);
	if (!user) return { ok: false, status: 401, error: 'No autorizado' };

	const roles = await getUserRoleNames(user.id);
	if (!isAdminRole(roles)) {
		return { ok: false, status: 403, error: 'No tienes permisos de administrador' };
	}

	return { ok: true, user, roles, admin: getSupabaseAdmin() };
}

export async function requireDeliveryAccess(
	request: Request,
	deliveryId: string
): Promise<
	| {
			ok: true;
			user: User;
			roles: string[];
			admin: ReturnType<typeof getSupabaseAdmin>;
			isAdmin: boolean;
			delivery: Record<string, unknown>;
	  }
	| { ok: false; status: number; error: string }
> {
	const user = await getAuthUserFromRequest(request);
	if (!user) return { ok: false, status: 401, error: 'No autorizado' };

	const roles = await getUserRoleNames(user.id);
	const admin = getSupabaseAdmin();

	const { data: delivery, error } = await admin
		.from('machine_deliveries')
		.select('*, customers(*)')
		.eq('id', deliveryId)
		.single();

	if (error || !delivery) {
		return { ok: false, status: 404, error: 'Entrega no encontrada' };
	}

	const isAdmin = isAdminRole(roles);
	const isAssignedTech =
		isTechnicianRole(roles) && delivery.assigned_technician_id === user.id;

	if (!isAdmin && !isAssignedTech) {
		return { ok: false, status: 403, error: 'No tienes acceso a esta entrega' };
	}

	return { ok: true, user, roles, admin, isAdmin, delivery };
}

import { formatCustomerAddress as formatAddr, getDeliveryPhotoPublicUrl as photoUrl } from '$lib/customers';

export { formatAddr as formatCustomerAddress };

export function getDeliveryPhotoPublicUrl(storagePath: string): string {
	return photoUrl(storagePath, PUBLIC_SUPABASE_URL);
}
