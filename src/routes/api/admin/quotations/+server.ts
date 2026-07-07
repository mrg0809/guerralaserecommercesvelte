import { json, type RequestHandler } from '@sveltejs/kit';
import { authenticateAdminRequest } from '$lib/server/adminAuth';
import { listQuotations, saveQuotation } from '$lib/server/quotations/persistence';
import type { QuotationInput } from '$lib/types/savedQuotation';

export const GET: RequestHandler = async ({ request, url }) => {
	const auth = await authenticateAdminRequest(request, 'view_quotations');
	if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

	try {
		const source = url.searchParams.get('source') ?? 'all';
		const search = url.searchParams.get('search') ?? undefined;
		const quotations = await listQuotations(auth.supabaseAdmin, { source, search });
		return json({ success: true, quotations });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Error al listar cotizaciones';
		console.error('[ADMIN QUOTATIONS LIST]', error);
		return json({ success: false, error: message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const auth = await authenticateAdminRequest(request, 'create_quotations');
	if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

	try {
		const body = (await request.json()) as QuotationInput;
		const quotation = await saveQuotation(auth.supabaseAdmin, body);
		return json({ success: true, quotation });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Error al guardar cotización';
		console.error('[ADMIN QUOTATIONS CREATE]', error);
		return json({ success: false, error: message }, { status: 500 });
	}
};
