import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding } from '$lib/utils/embeddings';
import type { KnowledgeSource } from '$lib/types/assistant';

export interface RetrievedContext {
	sources: KnowledgeSource[];
	contextText: string;
	bestScore: number;
	usedWeb: boolean;
}

const CHANNEL_CONTEXT: Record<string, string> = {
	general: 'Equipos láser, refacciones y servicio técnico industrial.',
	maquinas: 'Máquinas láser CO2, fibra óptica, híbridas, plasma — modelos Guerra Láser y compatibilidades.',
	extractores: 'Extractores de humo, filtros, capacidades CFM/W, instalación y mantenimiento.',
	chillers: 'Enfriadores (chillers) para máquinas láser: CW-3000, CW-5000, CW-5200, capacidad, compatibilidad.',
	guias_lineales: 'Guías lineales, rieles, carros, HIWIN, compatibilidades y medidas.',
	tubos_laser: 'Tubos láser CO2: Reci, SP, EFR, potencias, diámetros, equivalencias entre marcas.',
	compresores: 'Compresores de aire para láser, presión, caudal, compatibilidad con máquinas.',
	instalaciones: 'Instalación de máquinas láser, requerimientos eléctricos, ventilación, espacio.',
	soporte_tecnico: 'Diagnóstico de fallas, mantenimiento, calibración, soporte post-venta.'
};

export function getChannelSystemPrompt(channel: string): string {
	const label = CHANNEL_CONTEXT[channel] ?? channel;
	return `Eres el asistente técnico interno de Guerra Láser México.
Canal activo: ${channel}.
Contexto del canal: ${label}

Reglas:
- Responde en español, claro y directo para el equipo de ventas/técnicos.
- Si hay contexto de la base de conocimientos o catálogo, úsalo y cítalo.
- Si no hay información suficiente, indica qué falta y sugiere investigar.
- Para equivalencias de marcas, sé específico con modelos y medidas.
- No inventes precios; si no tienes precio en contexto, dilo.`;
}

export async function retrieveLocalContext(
	supabase: SupabaseClient,
	query: string,
	channel: string
): Promise<{ sources: KnowledgeSource[]; contextText: string; bestScore: number }> {
	const embedding = await generateEmbedding(query);
	const sources: KnowledgeSource[] = [];
	const parts: string[] = [];
	let bestScore = 0;

	const { data: articles } = await supabase.rpc('search_knowledge_by_embedding', {
		query_embedding: embedding,
		filter_channel: channel === 'general' ? null : channel,
		match_threshold: 0.55,
		match_count: 5
	});

	for (const a of articles ?? []) {
		const score = a.similarity as number;
		if (score > bestScore) bestScore = score;
		sources.push({
			type: 'knowledge',
			title: a.title,
			id: a.id,
			url: a.source_url ?? undefined
		});
		parts.push(`[KB] ${a.title}\n${a.content}`);
	}

	const { data: variants } = await supabase.rpc('search_product_variants_by_embedding', {
		query_embedding: embedding,
		match_threshold: 0.55,
		match_count: 3
	});

	for (const v of variants ?? []) {
		const score = v.similarity as number;
		if (score > bestScore) bestScore = score;
		sources.push({
			type: 'product',
			title: `${v.product_name} - ${v.variant_name}`,
			id: v.id
		});
		parts.push(
			`[Producto] ${v.product_name} - ${v.variant_name} | SKU: ${v.sku ?? 'N/A'} | Precio: $${v.price}`
		);
	}

	if (!variants?.length) {
		const { data: products } = await supabase.rpc('search_products_by_embedding', {
			query_embedding: embedding,
			match_threshold: 0.55,
			match_count: 3
		});
		for (const p of products ?? []) {
			const score = p.similarity as number;
			if (score > bestScore) bestScore = score;
			sources.push({ type: 'product', title: p.name, id: p.id });
			parts.push(`[Producto] ${p.name} | SKU: ${p.sku ?? 'N/A'} | Precio base: $${p.base_price}`);
		}
	}

	return {
		sources,
		contextText: parts.join('\n\n'),
		bestScore
	};
}

export function buildRagPrompt(
	channel: string,
	contextText: string,
	attachmentTexts: string[] = []
): string {
	let prompt = getChannelSystemPrompt(channel);
	if (contextText) {
		prompt += `\n\n--- CONTEXTO RECUPERADO (priorizar sobre conocimiento general) ---\n${contextText}`;
	}
	if (attachmentTexts.length) {
		prompt += `\n\n--- ADJUNTOS DEL USUARIO ---\n${attachmentTexts.join('\n\n')}`;
	}
	return prompt;
}

export function shouldSuggestWebFallback(bestScore: number, hasContext: boolean): boolean {
	return !hasContext || bestScore < 0.62;
}
