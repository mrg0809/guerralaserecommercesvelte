import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess, listTeamMembers } from '$lib/server/aiAuth';

export const GET: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const members = await listTeamMembers();
	return json({ members });
};
