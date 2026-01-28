import { GoogleGenerativeAI } from '@google/generative-ai';

// Función helper para obtener la instancia de genAI
function getGenAI() {
	// Solo ejecutar en el servidor
	if (typeof window !== 'undefined') {
		throw new Error('Embeddings solo disponible en el servidor');
	}
	
	const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
	if (!GEMINI_API_KEY) {
		throw new Error('GEMINI_API_KEY no está configurada en el entorno');
	}
	return new GoogleGenerativeAI(GEMINI_API_KEY);
}

/**
 * Genera un embedding de texto usando Gemini Embedding Model
 * @param text - Texto para generar el embedding
 * @returns Vector de 768 dimensiones
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error('[EMBEDDINGS] Error generando embedding:', error);
        throw error;
    }
}

/**
 * Genera embeddings para múltiples textos en batch
 * @param texts - Array de textos
 * @returns Array de vectores
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
        const promises = texts.map(text => model.embedContent(text));
        const results = await Promise.all(promises);
        return results.map(result => result.embedding.values);
    } catch (error) {
        console.error('[EMBEDDINGS] Error generando embeddings en batch:', error);
        throw error;
    }
}

/**
 * Normaliza el texto del producto para mejorar la calidad del embedding
 * @param productName - Nombre del producto
 * @param variantName - Nombre de la variante (opcional)
 * @returns Texto normalizado para embedding
 */
export function normalizeProductText(productName: string, variantName?: string): string {
    const fullText = variantName ? `${productName} ${variantName}` : productName;
    
    // Normalizar texto: lowercase, remover caracteres especiales excesivos
    return fullText
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}
