import { GoogleGenerativeAI } from '@google/generative-ai';

let genAIInstance: GoogleGenerativeAI | null = null;

function getGeminiApiKey(): string {
	const key = process.env.GEMINI_API_KEY;
	if (!key) throw new Error('GEMINI_API_KEY no está configurada');
	return key;
}

export function getGenAI(): GoogleGenerativeAI {
	if (!genAIInstance) {
		genAIInstance = new GoogleGenerativeAI(getGeminiApiKey());
	}
	return genAIInstance;
}

export function getChatModel(model = 'gemini-2.5-flash') {
	return getGenAI().getGenerativeModel({ model });
}

export async function generateText(prompt: string, userMessage: string): Promise<string> {
	const model = getChatModel();
	const result = await model.generateContent(`${prompt}\n\n---\n\n${userMessage}`);
	return result.response.text();
}

export async function* streamText(prompt: string, userMessage: string): AsyncGenerator<string> {
	const model = getChatModel();
	const stream = await model.generateContentStream(`${prompt}\n\n---\n\n${userMessage}`);
	for await (const chunk of stream.stream) {
		const text = chunk.text();
		if (text) yield text;
	}
}

export async function generateJson<T>(prompt: string, userMessage: string): Promise<T> {
	const model = getChatModel();
	const result = await model.generateContent(
		`${prompt}\n\nResponde ÚNICAMENTE con JSON válido, sin markdown.\n\n---\n\n${userMessage}`
	);
	const raw = result.response.text().trim();
	const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
	return JSON.parse(cleaned) as T;
}
