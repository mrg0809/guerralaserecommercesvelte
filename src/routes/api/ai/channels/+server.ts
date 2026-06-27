import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';
import { getUserRoleNames } from '$lib/server/deliveryAuth';

async function requireWebAdmin(request: Request) {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return authResult;
	if (authResult.auth.source !== 'web' || !authResult.auth.userId) {
		return { ok: false as const, status: 403, error: 'Solo administradores web pueden gestionar temas' };
	}
	const roles = await getUserRoleNames(authResult.auth.userId);
	if (!roles.includes('admin') && !roles.includes('superadmin')) {
		return { ok: false as const, status: 403, error: 'Permiso denegado' };
	}
	return authResult;
}

export const GET: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { data } = await authResult.admin
		.from('ai_channels')
		.select('slug, label, emoji, description, sort_order, is_active')
		.eq('is_active', true)
		.order('sort_order', { ascending: true });

	return json({ channels: data ?? [] });
};

export const POST: RequestHandler = async ({ request }) => {
	const authResult = await requireWebAdmin(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { slug, label, emoji = '💬', description, sort_order = 99 } = await request.json();
	const cleanSlug = String(slug ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '_')
		.replace(/[^a-z0-9_]/g, '');

	if (!cleanSlug || !label?.trim()) {
		return json({ error: 'Slug y nombre requeridos' }, { status: 400 });
	}

	const { data, error } = await authResult.admin
		.from('ai_channels')
		.insert({ slug: cleanSlug, label: label.trim(), emoji, description, sort_order })
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true, channel: data });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const authResult = await requireWebAdmin(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { slug, label, emoji, description, sort_order, is_active } = await request.json();
	if (!slug) return json({ error: 'slug requerido' }, { status: 400 });

	const { data, error } = await authResult.admin
		.from('ai_channels')
		.update({
			...(label !== undefined && { label }),
			...(emoji !== undefined && { emoji }),
			...(description !== undefined && { description }),
			...(sort_order !== undefined && { sort_order }),
			...(is_active !== undefined && { is_active })
		})
		.eq('slug', slug)
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true, channel: data });
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	const authResult = await requireWebAdmin(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const slug = url.searchParams.get('slug');
	if (!slug || slug === 'general') return json({ error: 'No se puede eliminar general' }, { status: 400 });

	const { error } = await authResult.admin.from('ai_channels').update({ is_active: false }).eq('slug', slug);
	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true });
};
