import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';
import { formatQuoteForWhatsApp } from '$lib/server/ai/quotationService';
import type { QuoteDraft } from '$lib/types/assistant';

export const POST: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { draft } = (await request.json()) as { draft: QuoteDraft };
	if (!draft?.lines?.length) return json({ error: 'Se requiere al menos una línea' }, { status: 400 });

	try {
		const whatsappText = await formatQuoteForWhatsApp(draft);
		return json({ success: true, whatsappText });
	} catch (e) {
		const err = e instanceof Error ? e.message : 'Error al formatear';
		return json({ error: err }, { status: 500 });
	}
};
