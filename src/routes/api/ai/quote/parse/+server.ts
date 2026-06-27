import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';
import { parseQuoteFromMessage } from '$lib/server/ai/quotationService';
import type { QuoteDraft } from '$lib/types/assistant';

export const POST: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { message } = await request.json();
	if (!message?.trim()) return json({ error: 'Mensaje requerido' }, { status: 400 });

	try {
		const draft = await parseQuoteFromMessage(authResult.admin, message);
		return json({ success: true, draft });
	} catch (e) {
		const err = e instanceof Error ? e.message : 'Error al parsear cotización';
		return json({ error: err }, { status: 500 });
	}
};
