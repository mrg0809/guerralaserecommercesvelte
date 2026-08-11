import { json, type RequestHandler } from '@sveltejs/kit';
import { getAdminClientAndUser } from '$lib/server/adminAuth';
import { normalizeWhatsAppPhone, type WhatsappAgent } from '$lib/whatsappRouting';

async function loadAgents(supabaseAdmin: any): Promise<WhatsappAgent[]> {
	const { data: agents, error } = await supabaseAdmin
		.from('whatsapp_agents')
		.select('id, label, phone, is_default, is_active, created_at')
		.order('created_at', { ascending: true });

	if (error) throw error;

	const { data: links, error: linksError } = await supabaseAdmin
		.from('whatsapp_agent_categories')
		.select('agent_id, category_id');

	if (linksError) throw linksError;

	const byAgent = new Map<string, string[]>();
	for (const link of links || []) {
		const list = byAgent.get(link.agent_id) || [];
		list.push(link.category_id);
		byAgent.set(link.agent_id, list);
	}

	return (agents || []).map((a: any) => ({
		id: a.id,
		label: a.label,
		phone: a.phone,
		is_default: !!a.is_default,
		is_active: a.is_active !== false,
		category_ids: byAgent.get(a.id) || []
	}));
}

export const GET: RequestHandler = async ({ request }) => {
	try {
		const auth = await getAdminClientAndUser(request);
		if (auth.error) return auth.error;

		const agents = await loadAgents(auth.supabaseAdmin);
		const { data: categories, error: catError } = await (auth.supabaseAdmin as any)
			.from('categories')
			.select('id, name, slug, parent_id, is_active, display_order')
			.eq('is_active', true)
			.order('display_order');

		if (catError) {
			return json({ success: false, error: catError.message }, { status: 500 });
		}

		return json({ success: true, agents, categories: categories || [] });
	} catch (error: any) {
		return json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const auth = await getAdminClientAndUser(request);
		if (auth.error) return auth.error;

		const payload = await request.json();
		const agentsInput = Array.isArray(payload?.agents) ? payload.agents : null;
		if (!agentsInput) {
			return json({ success: false, error: 'Payload inválido' }, { status: 400 });
		}

		const normalized: Array<{
			id?: string;
			label: string;
			phone: string;
			is_default: boolean;
			is_active: boolean;
			category_ids: string[];
		}> = [];

		const usedCategories = new Set<string>();

		for (const raw of agentsInput) {
			const label = String(raw?.label || '').trim();
			const phone = normalizeWhatsAppPhone(String(raw?.phone || ''));
			const is_default = !!raw?.is_default;
			const is_active = raw?.is_active !== false;
			const category_ids = Array.isArray(raw?.category_ids)
				? [...new Set(raw.category_ids.map((id: unknown) => String(id)).filter(Boolean))]
				: [];

			if (!label) {
				return json({ success: false, error: 'Cada número necesita un nombre/etiqueta' }, { status: 400 });
			}
			if (!phone) {
				return json(
					{ success: false, error: `Teléfono inválido para "${label || 'sin nombre'}"` },
					{ status: 400 }
				);
			}

			for (const catId of category_ids) {
				if (usedCategories.has(catId)) {
					return json(
						{
							success: false,
							error: 'Una categoría no puede asignarse a más de un número de WhatsApp'
						},
						{ status: 400 }
					);
				}
				usedCategories.add(catId);
			}

			normalized.push({
				id: raw?.id ? String(raw.id) : undefined,
				label,
				phone,
				is_default,
				is_active,
				category_ids
			});
		}

		const activeDefaults = normalized.filter((a) => a.is_active && a.is_default);
		if (activeDefaults.length === 0) {
			return json(
				{ success: false, error: 'Debes marcar un número activo como predeterminado' },
				{ status: 400 }
			);
		}
		if (activeDefaults.length > 1) {
			return json(
				{ success: false, error: 'Solo puede haber un número predeterminado activo' },
				{ status: 400 }
			);
		}

		const sb = auth.supabaseAdmin as any;

		// Desmarcar defaults actuales para poder reasignar
		await sb.from('whatsapp_agents').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');

		const { data: existing } = await sb.from('whatsapp_agents').select('id');
		const existingIds = new Set((existing || []).map((r: any) => r.id as string));
		const keepIds = new Set<string>();

		for (const agent of normalized) {
			let agentId = agent.id && existingIds.has(agent.id) ? agent.id : null;

			if (agentId) {
				const { error } = await sb
					.from('whatsapp_agents')
					.update({
						label: agent.label,
						phone: agent.phone,
						is_default: agent.is_default,
						is_active: agent.is_active,
						updated_at: new Date().toISOString()
					})
					.eq('id', agentId);
				if (error) throw error;
			} else {
				const { data, error } = await sb
					.from('whatsapp_agents')
					.insert({
						label: agent.label,
						phone: agent.phone,
						is_default: agent.is_default,
						is_active: agent.is_active
					})
					.select('id')
					.single();
				if (error) throw error;
				agentId = data.id;
			}

			keepIds.add(agentId!);

			await sb.from('whatsapp_agent_categories').delete().eq('agent_id', agentId);
			if (agent.category_ids.length > 0) {
				const { error: linkError } = await sb.from('whatsapp_agent_categories').insert(
					agent.category_ids.map((category_id) => ({
						agent_id: agentId,
						category_id
					}))
				);
				if (linkError) throw linkError;
			}
		}

		const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
		if (toDelete.length > 0) {
			const { error: delError } = await sb.from('whatsapp_agents').delete().in('id', toDelete);
			if (delError) throw delError;
		}

		const agents = await loadAgents(sb);
		return json({ success: true, agents });
	} catch (error: any) {
		return json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
	}
};
