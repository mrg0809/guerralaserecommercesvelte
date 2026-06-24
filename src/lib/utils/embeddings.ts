import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY';

function getGenAI() {
	if (typeof window !== 'undefined') {
		throw new Error('Embeddings solo disponible en el servidor');
	}

	const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
	if (!GEMINI_API_KEY) {
		throw new Error('GEMINI_API_KEY no está configurada en el entorno');
	}
	return new GoogleGenerativeAI(GEMINI_API_KEY);
}

async function embedText(text: string, taskType: EmbeddingTaskType): Promise<number[]> {
	const genAI = getGenAI();
	const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
	const result = await model.embedContent({
		content: { parts: [{ text }] },
		taskType,
		outputDimensionality: EMBEDDING_DIMENSIONS
	});
	return result.embedding.values;
}

/** Embedding para búsquedas / consultas del usuario */
export async function generateEmbedding(text: string): Promise<number[]> {
	try {
		return await embedText(text, 'RETRIEVAL_QUERY');
	} catch (error) {
		console.error('[EMBEDDINGS] Error generando embedding:', error);
		throw error;
	}
}

/** Embedding para indexar documentos, productos o artículos KB */
export async function generateDocumentEmbedding(text: string): Promise<number[]> {
	try {
		return await embedText(text, 'RETRIEVAL_DOCUMENT');
	} catch (error) {
		console.error('[EMBEDDINGS] Error generando embedding de documento:', error);
		throw error;
	}
}

export async function generateEmbeddingsBatch(
	texts: string[],
	taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> {
	try {
		const promises = texts.map((text) => embedText(text, taskType));
		return await Promise.all(promises);
	} catch (error) {
		console.error('[EMBEDDINGS] Error generando embeddings en batch:', error);
		throw error;
	}
}

export function normalizeProductText(productName: string, variantName?: string): string {
	const fullText = variantName ? `${productName} ${variantName}` : productName;

	return fullText
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}
