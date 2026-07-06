import { supabase } from '$lib/supabaseClient';
import type { QuoteDraft } from '$lib/types/assistant';
import type { QuotationInput, QuotationListRow, QuotationSource, SavedQuotation } from '$lib/types/savedQuotation';
import { quoteDraftToQuotationInput } from '$lib/utils/quotationConverters';

async function authHeaders(): Promise<HeadersInit> {
	const {
		data: { session }
	} = await supabase.auth.getSession();
	if (!session) throw new Error('Sesión no válida');
	return {
		Authorization: `Bearer ${session.access_token}`,
		'Content-Type': 'application/json'
	};
}

export async function listSavedQuotations(opts?: {
	source?: string;
	search?: string;
}): Promise<QuotationListRow[]> {
	const params = new URLSearchParams();
	if (opts?.source) params.set('source', opts.source);
	if (opts?.search) params.set('search', opts.search);

	const res = await fetch(`/api/admin/quotations?${params}`, {
		headers: await authHeaders()
	});
	const data = await res.json();
	if (!res.ok || !data.success) {
		throw new Error(data.error || 'Error al cargar cotizaciones');
	}
	return data.quotations;
}

export async function getSavedQuotation(id: string): Promise<SavedQuotation> {
	const res = await fetch(`/api/admin/quotations/${id}`, {
		headers: await authHeaders()
	});
	const data = await res.json();
	if (!res.ok || !data.success) {
		throw new Error(data.error || 'Error al cargar cotización');
	}
	return data.quotation;
}

export async function saveQuotationInput(input: QuotationInput): Promise<SavedQuotation> {
	const isUpdate = Boolean(input.id);
	const url = isUpdate ? `/api/admin/quotations/${input.id}` : '/api/admin/quotations';
	const res = await fetch(url, {
		method: isUpdate ? 'PATCH' : 'POST',
		headers: await authHeaders(),
		body: JSON.stringify(input)
	});
	const data = await res.json();
	if (!res.ok || !data.success) {
		throw new Error(data.error || 'Error al guardar cotización');
	}
	return data.quotation;
}

export async function deleteSavedQuotation(id: string): Promise<void> {
	const res = await fetch(`/api/admin/quotations/${id}`, {
		method: 'DELETE',
		headers: await authHeaders()
	});
	const data = await res.json();
	if (!res.ok || !data.success) {
		throw new Error(data.error || 'Error al eliminar cotización');
	}
}

export async function saveQuoteDraft(
	draft: QuoteDraft,
	source: QuotationSource = 'ai_assistant',
	existingId?: string
): Promise<SavedQuotation> {
	const input = quoteDraftToQuotationInput(draft, source, existingId);
	return saveQuotationInput(input);
}

export {
	adminFormToQuotationInput,
	savedQuotationToAdminForm,
	quotationToQuoteDraft
} from '$lib/utils/quotationConverters';
