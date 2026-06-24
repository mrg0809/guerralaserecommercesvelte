import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';
import { generateEmbedding } from '$lib/utils/embeddings';
import type { AiKnowledgeChannel } from '$lib/types/assistant';

export const POST: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { auth, admin } = authResult;
	const body = await request.json();
	const { title, content, channel = 'general', source_type = 'manual', source_url } = body as {
		title: string;
		content: string;
		channel?: AiKnowledgeChannel;
		source_type?: string;
		source_url?: string;
	};

	if (!title?.trim() || !content?.trim()) {
		return json({ error: 'Título y contenido requeridos' }, { status: 400 });
	}

	const embedding = await generateEmbedding(`${title}\n${content}`);

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
		.select('id, title, channel, source_type, usage_count, created_at')
		.order('created_at', { ascending: false })
		.limit(50);

	if (channel) query = query.eq('channel', channel);

	const { data } = await query;
	return json({ articles: data ?? [] });
};
