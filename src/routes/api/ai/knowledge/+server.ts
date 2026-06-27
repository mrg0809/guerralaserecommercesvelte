import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';
import { generateEmbedding, generateDocumentEmbedding } from '$lib/utils/embeddings';
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

export const POST: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { auth, admin } = authResult;
	const body = await request.json();
	const { title, content, channel = 'general', source_type = 'manual', source_url } = body as {
		title: string;
		content: string;
		channel?: string;
		source_type?: string;
		source_url?: string;
	};

	if (!title?.trim() || !content?.trim()) {
		return json({ error: 'Título y contenido requeridos' }, { status: 400 });
	}

	const embedding = await generateDocumentEmbedding(`${title}\n${content}`);

	const { data, error } = await admin
		.from('knowledge_articles')
		.insert({
			title: title.trim(),
			content: content.trim(),
			channel,
			source_type,
			source_url: source_url ?? null,
			embedding,
			created_by: auth.userId,
			team_member_id: auth.teamMemberId,
			is_verified: auth.source === 'web'
		})
		.select('id, title, channel, created_at')
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true, article: data });
};

export const GET: RequestHandler = async ({ request, url }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const q = url.searchParams.get('q')?.trim();
	const channel = url.searchParams.get('channel');

	if (q) {
		const embedding = await generateEmbedding(q);
		const { data } = await authResult.admin.rpc('search_knowledge_by_embedding', {
			query_embedding: embedding,
			filter_channel: channel || null,
			match_threshold: 0.5,
			match_count: 10
		});
		return json({ results: data ?? [] });
	}

	let query = authResult.admin
		.from('knowledge_articles')
		.select('id, title, content, channel, source_type, usage_count, is_verified, created_at')
		.order('created_at', { ascending: false })
		.limit(100);

	if (channel) query = query.eq('channel', channel);

	const { data } = await query;
	return json({ articles: data ?? [] });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const authResult = await requireWebAdmin(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { id, title, content, channel, is_verified } = await request.json();
	if (!id) return json({ error: 'id requerido' }, { status: 400 });

	const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (title !== undefined) updates.title = title;
	if (content !== undefined) updates.content = content;
	if (channel !== undefined) updates.channel = channel;
	if (is_verified !== undefined) updates.is_verified = is_verified;

	if (title !== undefined || content !== undefined) {
		const { data: existing } = await authResult.admin
			.from('knowledge_articles')
			.select('title, content')
			.eq('id', id)
			.single();
		const t = title ?? existing?.title ?? '';
		const c = content ?? existing?.content ?? '';
		updates.embedding = await generateDocumentEmbedding(`${t}\n${c}`);
	}

	const { data, error } = await authResult.admin
		.from('knowledge_articles')
		.update(updates)
		.eq('id', id)
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true, article: data });
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	const authResult = await requireWebAdmin(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const id = url.searchParams.get('id');
	if (!id) return json({ error: 'id requerido' }, { status: 400 });

	const { error } = await authResult.admin.from('knowledge_articles').delete().eq('id', id);
	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true });
};
