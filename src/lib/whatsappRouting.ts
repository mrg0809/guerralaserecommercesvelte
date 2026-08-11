export const DEFAULT_WHATSAPP_PHONE = '523334758653';

export type WhatsappAgent = {
	id: string;
	label: string;
	phone: string;
	is_default: boolean;
	is_active: boolean;
	category_ids: string[];
};

export type WhatsappRoutingConfig = {
	defaultPhone: string;
	/** categoryId -> phone digits */
	categoryPhoneMap: Record<string, string>;
};

type CategoryLike = {
	id: string;
	slug: string;
	parent_id: string | null;
};

/** Normaliza a dígitos internacionales (MX: antepone 52 si vienen 10 dígitos). */
export function normalizeWhatsAppPhone(input: string): string | null {
	const digits = String(input || '').replace(/\D/g, '');
	if (!digits) return null;
	if (digits.length === 10) return `52${digits}`;
	if (digits.length === 12 && digits.startsWith('52')) return digits;
	if (digits.length === 13 && digits.startsWith('521')) return digits; // formato móvil legacy
	if (digits.length >= 11 && digits.length <= 15) return digits;
	return null;
}

export function formatWhatsAppDisplay(phoneDigits: string): string {
	const d = phoneDigits.replace(/\D/g, '');
	if (d.startsWith('52') && d.length === 12) {
		return `${d.slice(2, 4)} ${d.slice(4, 8)} ${d.slice(8)}`;
	}
	return phoneDigits;
}

export function buildWhatsAppRoutingConfig(agents: WhatsappAgent[]): WhatsappRoutingConfig {
	const active = agents.filter((a) => a.is_active);
	const defaultAgent = active.find((a) => a.is_default) || active[0];
	const defaultPhone = normalizeWhatsAppPhone(defaultAgent?.phone || '') || DEFAULT_WHATSAPP_PHONE;

	const categoryPhoneMap: Record<string, string> = {};
	for (const agent of active) {
		const phone = normalizeWhatsAppPhone(agent.phone);
		if (!phone) continue;
		for (const categoryId of agent.category_ids) {
			categoryPhoneMap[categoryId] = phone;
		}
	}

	return { defaultPhone, categoryPhoneMap };
}

export function findCategoryBySlug(
	categories: CategoryLike[],
	slug: string
): CategoryLike | undefined {
	return categories.find((c) => c.slug === slug);
}

/** Sube por parent_id hasta encontrar una categoría con número asignado. */
export function resolvePhoneForCategoryId(
	categoryId: string | null | undefined,
	categories: CategoryLike[],
	routing: WhatsappRoutingConfig
): string {
	if (!categoryId) return routing.defaultPhone;

	const byId = new Map(categories.map((c) => [c.id, c]));
	let current: CategoryLike | undefined = byId.get(categoryId);
	const seen = new Set<string>();

	while (current && !seen.has(current.id)) {
		seen.add(current.id);
		const phone = routing.categoryPhoneMap[current.id];
		if (phone) return phone;
		current = current.parent_id ? byId.get(current.parent_id) : undefined;
	}

	return routing.defaultPhone;
}

export function resolveWhatsAppPhoneFromPath(
	pathname: string,
	categories: CategoryLike[],
	routing: WhatsappRoutingConfig,
	productCategoryId?: string | null
): string {
	const categoryMatch = pathname.match(/^\/categorias\/([^/?#]+)/);
	if (categoryMatch?.[1]) {
		const cat = findCategoryBySlug(categories, categoryMatch[1]);
		return resolvePhoneForCategoryId(cat?.id, categories, routing);
	}

	if (pathname.match(/^\/productos\/[^/?#]+/)) {
		return resolvePhoneForCategoryId(productCategoryId, categories, routing);
	}

	return routing.defaultPhone;
}
