import type { SupabaseClient } from '@supabase/supabase-js';
import { generateJson, generateText } from '$lib/server/ai/geminiClient';
import { searchProductLine, enrichQuoteLine } from '$lib/server/ai/productCatalogSearch';
import { normalizeQuoteDraft } from '$lib/server/ai/quoteUtils';
import type { QuoteDraft, QuoteLine } from '$lib/types/assistant';

interface ParsedQuoteRequest {
	cliente?: string;
	productos?: { nombre: string; cantidad: number; precio?: number; descuento?: number }[];
	envio?: number;
	instalacion?: number;
	notas?: string;
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
		lines.push(line.product_id ? await enrichQuoteLine(supabase, line) : line);
	}

	return normalizeQuoteDraft({
		client_name: parsed.cliente,
		lines,
		shipping_amount: parsed.envio,
		installation_amount: parsed.instalacion,
		notes: parsed.notas,
		validity_days: 7
	});
}

const WHATSAPP_FORMAT_PROMPT = `Formatea la cotización siguiente como mensaje de WhatsApp para enviar al cliente.
Usa emojis relevantes, negritas con asteriscos de WhatsApp (*texto*), desglose claro de líneas, subtotales si aplica, total destacado, vigencia en días.
Tono profesional pero cercano. Solo devuelve el texto del mensaje, sin explicaciones ni markdown de código.
Empresa: Guerra Láser. Firma siempre como "Guerra Láser", nunca "Guerra Láser México".`;

export async function formatQuoteForWhatsApp(draft: QuoteDraft): Promise<string> {
	const payload = JSON.stringify(normalizeQuoteDraft(draft), null, 2);
	return generateText(WHATSAPP_FORMAT_PROMPT, `Datos:\n${payload}`);
}

export function calculateQuoteTotals(draft: QuoteDraft) {
	const normalized = normalizeQuoteDraft(draft);
	const subtotal = normalized.lines.reduce(
		(sum, l) => sum + l.quantity * l.unit_price * (1 - (l.discount_percent ?? 0) / 100),
		0
	);
	const shipping = normalized.shipping_amount ?? 0;
	const installation = normalized.installation_amount ?? 0;
	return { subtotal, shipping, installation, total: subtotal + shipping + installation };
}
