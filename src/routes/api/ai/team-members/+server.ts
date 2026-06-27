import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';
import { getUserRoleNames } from '$lib/server/deliveryAuth';

async function requireWebAdmin(request: Request) {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return authResult;
	if (authResult.auth.source !== 'web' || !authResult.auth.userId) {
		return { ok: false as const, status: 403, error: 'Solo administradores web' };
	}
	const roles = await getUserRoleNames(authResult.auth.userId);
	if (!roles.includes('admin') && !roles.includes('superadmin')) {
		return { ok: false as const, status: 403, error: 'Permiso denegado' };
	}
	return authResult;
}

export const GET: RequestHandler = async ({ request, url }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const all = url.searchParams.get('all') === '1';
	let query = authResult.admin
		.from('ai_team_members')
		.select('id, display_name, is_active, sort_order')
		.order('sort_order', { ascending: true });

	if (!all) query = query.eq('is_active', true);

	const { data } = await query;
	return json({ members: data ?? [] });
};

export const POST: RequestHandler = async ({ request }) => {
	const authResult = await requireWebAdmin(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { display_name, sort_order = 99 } = await request.json();
	if (!display_name?.trim()) return json({ error: 'Nombre requerido' }, { status: 400 });

	const { data, error } = await authResult.admin
		.from('ai_team_members')
		.insert({ display_name: display_name.trim(), sort_order })
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true, member: data });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const authResult = await requireWebAdmin(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { id, display_name, sort_order, is_active } = await request.json();
	if (!id) return json({ error: 'id requerido' }, { status: 400 });

	const { data, error } = await authResult.admin
		.from('ai_team_members')
		.update({
			...(display_name !== undefined && { display_name }),
			...(sort_order !== undefined && { sort_order }),
			...(is_active !== undefined && { is_active })
		})
		.eq('id', id)
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true, member: data });
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	const authResult = await requireWebAdmin(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const id = url.searchParams.get('id');
	if (!id) return json({ error: 'id requerido' }, { status: 400 });

	const { error } = await authResult.admin.from('ai_team_members').update({ is_active: false }).eq('id', id);
	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true });
};
