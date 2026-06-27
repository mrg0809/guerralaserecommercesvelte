import { createHash } from 'crypto';
import type { User } from '@supabase/supabase-js';
import {
	getAuthUserFromRequest,
	getSupabaseAdmin,
	getUserRoleNames
} from '$lib/server/deliveryAuth';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

export type AiAuthSource = 'web' | 'mobile';

export interface AiAuthContext {
	source: AiAuthSource;
	userId: string | null;
	teamMemberId: string | null;
	label: string;
	user?: User;
}

function hashToken(token: string): string {
	return createHash('sha256').update(token.trim()).digest('hex');
}

async function userHasAiPermission(userId: string): Promise<boolean> {
	const admin = getSupabaseAdmin();
	const { data } = await admin.rpc('user_has_permission', {
		user_uuid: userId,
		permission_name: 'use_ai_assistant'
	});
	if (data === true) return true;

	const roles = await getUserRoleNames(userId);
	return roles.includes('admin') || roles.includes('superadmin');
}

async function validateMobileToken(token: string): Promise<boolean> {
	const admin = getSupabaseAdmin();
	const tokenHash = hashToken(token);
	const { data, error } = await admin
		.from('mobile_app_tokens')
		.select('id, is_active, expires_at')
		.eq('token_hash', tokenHash)
		.eq('is_active', true)
		.maybeSingle();

	if (error || !data) return false;
	if (data.expires_at && new Date(data.expires_at) < new Date()) return false;

	await admin
		.from('mobile_app_tokens')
		.update({ last_used_at: new Date().toISOString() })
		.eq('id', data.id);

	return true;
}

export async function requireAiAccess(
	request: Request
): Promise<
	{ ok: true; auth: AiAuthContext; admin: ReturnType<typeof getSupabaseAdmin> } | { ok: false; status: number; error: string }
> {
	const admin = getSupabaseAdmin();
	const teamMemberId = request.headers.get('x-team-member-id')?.trim() || null;

	const appToken = request.headers.get('x-app-token')?.trim();
	if (appToken) {
		const valid = await validateMobileToken(appToken);
		if (!valid) {
			return { ok: false, status: 401, error: 'Token de app inválido o revocado' };
		}

		let memberLabel = 'App móvil';
		if (teamMemberId) {
			const { data: member } = await admin
				.from('ai_team_members')
				.select('display_name')
				.eq('id', teamMemberId)
				.eq('is_active', true)
				.maybeSingle();
			if (member) memberLabel = member.display_name;
		}

		return {
			ok: true,
			auth: {
				source: 'mobile',
				userId: null,
				teamMemberId,
				label: memberLabel
			},
			admin
		};
	}

	const user = await getAuthUserFromRequest(request);
	if (!user) {
		return { ok: false, status: 401, error: 'No autorizado' };
	}

	const allowed = await userHasAiPermission(user.id);
	if (!allowed) {
		return { ok: false, status: 403, error: 'No tienes permiso para usar el asistente' };
	}

	return {
		ok: true,
		auth: {
			source: 'web',
			userId: user.id,
			teamMemberId: null,
			label: user.email ?? 'Usuario web',
			user
		},
		admin
	};
}

/** Lista pública de miembros (requiere token móvil o auth web) */
export async function listTeamMembers(): Promise<{ id: string; display_name: string }[]> {
	const admin = getSupabaseAdmin();
	const { data } = await admin
		.from('ai_team_members')
		.select('id, display_name')
		.eq('is_active', true)
		.order('sort_order', { ascending: true });
	return data ?? [];
}

export function createHashForStorage(token: string): string {
	return hashToken(token);
}

/** Helper para validar sesión de chat pertenece al actor */
export async function assertSessionAccess(
	admin: ReturnType<typeof getSupabaseAdmin>,
	sessionId: string,
	auth: AiAuthContext
): Promise<boolean> {
	const { data } = await admin.from('ai_chat_sessions').select('user_id, team_member_id').eq('id', sessionId).maybeSingle();
	if (!data) return false;
	if (auth.source === 'web' && auth.userId) return data.user_id === auth.userId;
	if (auth.source === 'mobile' && auth.teamMemberId) return data.team_member_id === auth.teamMemberId;
	if (auth.source === 'mobile') return true;
	return false;
}

export async function getAuthUserFromRequestOptional(request: Request): Promise<User | null> {
	return getAuthUserFromRequest(request);
}

export { getSupabaseAdmin };
