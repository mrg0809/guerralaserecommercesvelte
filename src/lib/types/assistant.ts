export type AiKnowledgeChannel =
	| 'chillers'
	| 'guias_lineales'
	| 'tubos_laser'
	| 'compresores'
	| 'instalaciones'
	| 'soporte_tecnico'
	| 'general';

export type AiSessionType = 'knowledge' | 'quotation';

export type QuoteLineSource = 'catalog' | 'manual';

export interface QuoteLine {
	id: string;
	source: QuoteLineSource;
	product_id?: string;
	variant_id?: string;
	description: string;
	quantity: number;
	unit_price: number;
	discount_percent?: number;
	sku?: string;
}

export interface QuoteDraft {
	client_name?: string;
	client_id?: string;
	lines: QuoteLine[];
	shipping_amount?: number;
	installation_amount?: number;
	notes?: string;
	validity_days?: number;
}

export interface KnowledgeSource {
	type: 'knowledge' | 'product' | 'web';
	title: string;
	url?: string;
	id?: string;
}

export interface ChatMessageMetadata {
	sources?: KnowledgeSource[];
	canSave?: boolean;
	suggestedTitle?: string;
	suggestedContent?: string;
	suggestedChannel?: AiKnowledgeChannel;
	whatsappText?: string;
	quoteDraft?: QuoteDraft;
}

export interface AiTeamMember {
	id: string;
	display_name: string;
	is_active: boolean;
	sort_order: number;
}

export interface AiChatSession {
	id: string;
	title: string | null;
	channel: AiKnowledgeChannel;
	session_type: AiSessionType;
	updated_at: string;
	created_at: string;
}

export interface AiChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	metadata?: ChatMessageMetadata;
	created_at: string;
}

export const AI_CHANNELS: { id: AiKnowledgeChannel; label: string; emoji: string }[] = [
	{ id: 'general', label: 'General', emoji: '💬' },
	{ id: 'chillers', label: 'Chillers', emoji: '❄️' },
	{ id: 'guias_lineales', label: 'Guías lineales', emoji: '📏' },
	{ id: 'tubos_laser', label: 'Tubos láser', emoji: '🔴' },
	{ id: 'compresores', label: 'Compresores', emoji: '💨' },
	{ id: 'instalaciones', label: 'Instalaciones', emoji: '🔧' },
	{ id: 'soporte_tecnico', label: 'Soporte técnico', emoji: '🛠️' }
];

export const CHANNEL_LABELS: Record<AiKnowledgeChannel, string> = Object.fromEntries(
	AI_CHANNELS.map((c) => [c.id, c.label])
) as Record<AiKnowledgeChannel, string>;
