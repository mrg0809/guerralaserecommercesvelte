import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding, normalizeProductText } from '$lib/utils/embeddings';
import { generateJson, generateText } from '$lib/server/ai/geminiClient';
import type { QuoteDraft, QuoteLine } from '$lib/types/assistant';

interface ParsedQuoteRequest {
	cliente?: string;
	productos?: { nombre: string; cantidad: number; precio?: number; descuento?: number }[];
	envio?: number;
	instalacion?: number;
	notas?: string;
}

function newLineId(): string {
	return crypto.randomUUID();
}

async function searchProductLine(
	supabase: SupabaseClient,
	productInfo: { nombre: string; cantidad: number; precio?: number; descuento?: number }
): Promise<QuoteLine | null> {
	const { nombre, cantidad, precio, descuento } = productInfo;
	try {
		const queryEmbedding = await generateEmbedding(normalizeProductText(nombre));

		const { data: variants } = await supabase.rpc('search_product_variants_by_embedding', {
			query_embedding: queryEmbedding,
			match_threshold: 0.55,
			match_count: 1
		});

		if (variants?.[0]) {
			const v = variants[0];
			return {
				id: newLineId(),
				source: 'catalog',
				variant_id: v.id,
				product_id: v.product_id,
				description: `${v.product_name} - ${v.variant_name}`,
				quantity: cantidad,
				unit_price: precio ?? Number(v.price) ?? 0,
				discount_percent: descuento ?? 0,
				sku: v.sku ?? undefined
			};
		}

		const { data: products } = await supabase.rpc('search_products_by_embedding', {
			query_embedding: queryEmbedding,
			match_threshold: 0.55,
			match_count: 1
		});

		if (products?.[0]) {
			const p = products[0];
			return {
				id: newLineId(),
				source: 'catalog',
				product_id: p.id,
				description: p.name,
				quantity: cantidad,
				unit_price: precio ?? Number(p.base_price) ?? 0,
				discount_percent: descuento ?? 0,
				sku: p.sku ?? undefined
			};
		}
	} catch {
		// fallback manual line
	}

	return {
		id: newLineId(),
		source: 'manual',
		description: nombre,
		quantity: cantidad,
		unit_price: precio ?? 0,
		discount_percent: descuento ?? 0
	};
}

const PARSE_PROMPT = `Eres un asistente de cotizaciones para Guerra Láser México.
Extrae del mensaje: cliente, productos (nombre específico, cantidad, precio opcional, descuento opcional), envío, instalación, notas.
Corrige errores ortográficos en nombres de productos láser/refacciones.
JSON: { "cliente": string, "productos": [{ "nombre", "cantidad", "precio?", "descuento?" }], "envio?", "instalacion?", "notas?" }`;

export async function parseQuoteFromMessage(
	supabase: SupabaseClient,
	message: string
): Promise<QuoteDraft> {
	const parsed = await generateJson<ParsedQuoteRequest>(PARSE_PROMPT, message);
	const lines: QuoteLine[] = [];

	for (const p of parsed.productos ?? []) {
		const line = await searchProductLine(supabase, {
			nombre: p.nombre,
			cantidad: p.cantidad || 1,
			precio: p.precio,
			descuento: p.descuento
		});
		if (line) lines.push(line);
	}

	return {
		client_name: parsed.cliente,
		lines,
		shipping_amount: parsed.envio,
		installation_amount: parsed.instalacion,
		notes: parsed.notas,
		validity_days: 7
	};
}

const WHATSAPP_FORMAT_PROMPT = `Formatea la cotización siguiente como mensaje de WhatsApp para enviar al cliente.
Usa emojis relevantes, negritas con asteriscos de WhatsApp (*texto*), desglose claro de líneas, subtotales si aplica, total destacado, vigencia en días.
Tono profesional pero cercano. Solo devuelve el texto del mensaje, sin explicaciones ni markdown de código.
Empresa: Guerra Láser México.`;

export async function formatQuoteForWhatsApp(draft: QuoteDraft): Promise<string> {
	const payload = JSON.stringify(draft, null, 2);
	return generateText(WHATSAPP_FORMAT_PROMPT, `Datos:\n${payload}`);
}

export function calculateQuoteTotals(draft: QuoteDraft) {
	const subtotal = draft.lines.reduce(
		(sum, l) => sum + l.quantity * l.unit_price * (1 - (l.discount_percent ?? 0) / 100),
		0
	);
	const shipping = draft.shipping_amount ?? 0;
	const installation = draft.installation_amount ?? 0;
	return { subtotal, shipping, installation, total: subtotal + shipping + installation };
}
