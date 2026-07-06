import { json, type RequestHandler } from '@sveltejs/kit';
import { authenticateAdminRequest } from '$lib/server/adminAuth';
import {
	deleteQuotation,
	getQuotationById,
	saveQuotation
} from '$lib/server/quotations/persistence';
import type { QuotationInput } from '$lib/types/savedQuotation';

export const GET: RequestHandler = async ({ request, params }) => {
	const auth = await authenticateAdminRequest(request, 'view_quotations');
	if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

	try {
		const quotation = await getQuotationById(auth.supabaseAdmin, params.id);
		if (!quotation) {
			return json({ success: false, error: 'Cotización no encontrada' }, { status: 404 });
		}
		return json({ success: true, quotation });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Error al cargar cotización';
		console.error('[ADMIN QUOTATIONS GET]', error);
		return json({ success: false, error: message }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request, params }) => {
	const auth = await authenticateAdminRequest(request, 'edit_quotations');
	if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

	try {
		const body = (await request.json()) as QuotationInput;
		const quotation = await saveQuotation(auth.supabaseAdmin, { ...body, id: params.id });
		return json({ success: true, quotation });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Error al actualizar cotización';
		console.error('[ADMIN QUOTATIONS PATCH]', error);
		return json({ success: false, error: message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const auth = await authenticateAdminRequest(request, 'delete_quotations');
	if (!auth.ok) return json({ success: false, error: auth.error }, { status: auth.status });

	try {
		await deleteQuotation(auth.supabaseAdmin, params.id);
		return json({ success: true });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Error al eliminar cotización';
		console.error('[ADMIN QUOTATIONS DELETE]', error);
		return json({ success: false, error: message }, { status: 500 });
	}
};
