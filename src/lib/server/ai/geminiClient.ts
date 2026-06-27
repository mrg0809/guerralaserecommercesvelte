import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import type { KnowledgeSource } from '$lib/types/assistant';

let genAIInstance: GoogleGenAI | null = null;

function getGeminiApiKey(): string {
	const key = process.env.GEMINI_API_KEY;
	if (!key) throw new Error('GEMINI_API_KEY no está configurada');
	return key;
}

export const DEFAULT_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.5-flash';

export function getGenAI(): GoogleGenAI {
	if (!genAIInstance) {
		genAIInstance = new GoogleGenAI({ apiKey: getGeminiApiKey() });
	}
	return genAIInstance;
}

function buildCombinedPrompt(prompt: string, userMessage: string): string {
	return `${prompt}\n\n---\n\n${userMessage}`;
}

export function extractWebSourcesFromResponse(response: GenerateContentResponse): KnowledgeSource[] {
	const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
	const seen = new Set<string>();
	const sources: KnowledgeSource[] = [];

	for (const chunk of chunks) {
		const web = chunk.web;
		if (!web?.uri || seen.has(web.uri)) continue;
		seen.add(web.uri);
		sources.push({
			type: 'web',
			title: web.title ?? web.domain ?? web.uri,
			url: web.uri
		});
	}

	return sources;
}

export async function generateText(
	prompt: string,
	userMessage: string,
	model = DEFAULT_CHAT_MODEL
): Promise<string> {
	const ai = getGenAI();
	const response = await ai.models.generateContent({
		model,
		contents: buildCombinedPrompt(prompt, userMessage)
	});
	return response.text ?? '';
}

export interface GroundedTextResult {
	text: string;
	webSources: KnowledgeSource[];
}

export async function generateTextWithGrounding(
	prompt: string,
	userMessage: string,
	model = DEFAULT_CHAT_MODEL
): Promise<GroundedTextResult> {
	const ai = getGenAI();
	const groundedPrompt = `${prompt}

---

Instrucciones adicionales para búsqueda web:
- Usa Google Search para encontrar información técnica actualizada y verificable.
- Prioriza el contexto local recuperado si existe y es relevante; complementa con web cuando falte detalle.
- Cita fuentes web cuando sea posible.
- No inventes precios ni especificaciones sin respaldo.`;

	const response = await ai.models.generateContent({
		model,
		contents: buildCombinedPrompt(groundedPrompt, userMessage),
		config: {
			tools: [{ googleSearch: {} }]
		}
	});

	return {
		text: response.text ?? '',
		webSources: extractWebSourcesFromResponse(response)
	};
}

export async function* streamText(
	prompt: string,
	userMessage: string,
	model = DEFAULT_CHAT_MODEL
): AsyncGenerator<string> {
	const ai = getGenAI();
	const stream = await ai.models.generateContentStream({
		model,
		contents: buildCombinedPrompt(prompt, userMessage)
	});

	for await (const chunk of stream) {
		const text = chunk.text;
		if (text) yield text;
	}
}

export async function generateJson<T>(
	prompt: string,
	userMessage: string,
	model = DEFAULT_CHAT_MODEL
): Promise<T> {
	const ai = getGenAI();
	const response = await ai.models.generateContent({
		model,
		contents: `${prompt}\n\nResponde ÚNICAMENTE con JSON válido, sin markdown.\n\n---\n\n${userMessage}`
	});
	const raw = (response.text ?? '').trim();
	const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
	return JSON.parse(cleaned) as T;
}
