import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';
import { quotationPdfBase64 } from '$lib/server/ai/quotationPdf';
import { normalizeQuoteDraft } from '$lib/server/ai/quoteUtils';
import type { QuoteDraft } from '$lib/types/assistant';

export const POST: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { draft } = (await request.json()) as { draft: QuoteDraft };
	const quote = normalizeQuoteDraft(draft);
	if (!quote.lines.length) return json({ error: 'Se requiere al menos una línea' }, { status: 400 });

	try {
		const { base64, filename } = await quotationPdfBase64(quote);
		return json({ success: true, downloadUrl: base64, filename });
	} catch (e) {
		const err = e instanceof Error ? e.message : 'Error al generar PDF';
		return json({ error: err }, { status: 500 });
	}
};
