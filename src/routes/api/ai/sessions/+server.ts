import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';

export const GET: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { auth, admin } = authResult;

	let query = admin
		.from('ai_chat_sessions')
		.select('id, title, channel, session_type, updated_at, created_at')
		.order('updated_at', { ascending: false })
		.limit(40);

	if (auth.source === 'web' && auth.userId) {
		query = query.eq('user_id', auth.userId);
	} else if (auth.teamMemberId) {
		query = query.eq('team_member_id', auth.teamMemberId);
	}

	const { data, error } = await query;
	if (error) return json({ error: error.message }, { status: 500 });
	return json({ sessions: data ?? [] });
};

export const POST: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { channel = 'general', sessionType = 'knowledge', title = 'Nueva conversación' } =
		await request.json();

	const { data, error } = await authResult.admin
		.from('ai_chat_sessions')
		.insert({
			user_id: authResult.auth.userId,
			team_member_id: authResult.auth.teamMemberId,
			channel,
			session_type: sessionType,
			title
		})
		.select('id')
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ sessionId: data.id });
};
