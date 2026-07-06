import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbedding, normalizeProductText } from '$lib/utils/embeddings';
import { buildQuotationPdf, type QuotationPdfItem } from '$lib/server/quotationPdfBuilder';
import { saveQuotation } from '$lib/server/quotations/persistence';
import {
	fetchProductCatalogExtras,
	fetchProductIdForVariant
} from '$lib/server/quotationProductEnrichment';

// Función helper para obtener la instancia de genAI
async function getGenAI() {
	let GEMINI_API_KEY = process.env.GEMINI_API_KEY;
	
	// Fallback para desarrollo: intentar cargar desde .env
	if (!GEMINI_API_KEY) {
		try {
			const fs = await import('fs');
			const path = await import('path');
			const envPath = path.join(process.cwd(), '.env');
			if (fs.existsSync(envPath)) {
				const envContent = fs.readFileSync(envPath, 'utf8');
				const match = envContent.match(/^GEMINI_API_KEY=(.+)$/m);
				if (match) {
					GEMINI_API_KEY = match[1].trim();
					console.log('[LOG] GEMINI_API_KEY cargada desde .env');
				}
			}
		} catch (e) {
			console.log('[LOG] No se pudo cargar .env:', e);
		}
	}
	
	if (!GEMINI_API_KEY) {
		throw new Error('GEMINI_API_KEY no está configurada en el entorno');
	}
	
	return new GoogleGenerativeAI(GEMINI_API_KEY);
}
const createSupabaseAdminClient = () => createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type ChatQuotationItem = QuotationPdfItem & {
	product_id?: string;
	variant_id?: string;
};

async function enrichChatQuotationItem(
	supabase: SupabaseClient,
	item: ChatQuotationItem,
	productId: string | null
): Promise<ChatQuotationItem> {
	if (!productId) return item;
	const extras = await fetchProductCatalogExtras(supabase, productId);
	return {
		...item,
		imageUrl: extras.imageUrl || item.imageUrl,
		includeDetail: item.includeDetail ?? false,
		detailDescription: item.detailDescription ?? ''
	};
}

// --- BÚSQUEDA SEMÁNTICA DE PRODUCTOS CON EMBEDDINGS ---
async function searchProductsWithEmbeddings(supabase: SupabaseClient, productInfo: { nombre: string, cantidad: number, precio?: number, descuento?: number }) {
    const { nombre, cantidad, precio, descuento } = productInfo;

    console.log(`[LOG] Iniciando búsqueda semántica para: "${nombre}" (Cantidad: ${cantidad}). Info del prompt: Precio=${precio}, Descuento=${descuento}%`);

    try {
        // Generar embedding del nombre del producto
        const normalizedText = normalizeProductText(nombre);
        console.log(`[LOG] Texto normalizado: "${normalizedText}"`);
        
        const queryEmbedding = await generateEmbedding(normalizedText);
        console.log(`[LOG] Embedding generado (dimensiones: ${queryEmbedding.length})`);

        // Estrategia 1: Buscar en variantes de productos usando similitud semántica
        const { data: variants, error: variantsError } = await supabase
            .rpc('search_product_variants_by_embedding', {
                query_embedding: queryEmbedding,
                match_threshold: 0.60,
                match_count: 3
            });

        if (variantsError) {
            console.error('[LOG] Error en búsqueda semántica de variantes:', variantsError);
        } else {
            console.log(`[LOG] Resultado de búsqueda semántica en variantes: ${JSON.stringify(variants, null, 2)}`);
        }

        if (variants && variants.length > 0) {
            const v = variants[0];
            console.log(`[LOG] Variante encontrada con búsqueda semántica: ${v.product_name} - ${v.variant_name} (similitud: ${v.similarity})`);
            
            const finalPrice = precio !== undefined ? precio : v.price || 0;
            const finalDiscount = descuento !== undefined ? descuento : 0;
            
            console.log(`[LOG] Precio final: ${finalPrice} (DB: ${v.price}), Descuento final: ${finalDiscount}%`);

            return await enrichChatQuotationItem(supabase, { 
                id: v.id,
                product_id: v.product_id,
                variant_id: v.id,
                sku: v.sku || 'N/A', 
                description: `${v.product_name} - ${v.variant_name}`, 
                quantity: cantidad, 
                price: finalPrice, 
                discount: finalDiscount,
                includeDetail: false,
                detailDescription: ''
            }, v.product_id ?? (await fetchProductIdForVariant(supabase, v.id)));
        }

        // Estrategia 2: Si no hay variantes, buscar en productos principales
        const { data: products, error: productsError } = await supabase
            .rpc('search_products_by_embedding', {
                query_embedding: queryEmbedding,
                match_threshold: 0.60,
                match_count: 3
            });

        if (productsError) {
            console.error('[LOG] Error en búsqueda semántica de productos:', productsError);
        } else {
            console.log(`[LOG] Resultado de búsqueda semántica en productos: ${JSON.stringify(products, null, 2)}`);
        }

        if (products && products.length > 0) {
            const p = products[0];
            console.log(`[LOG] Producto encontrado con búsqueda semántica: ${p.name} (similitud: ${p.similarity})`);
            
            const finalPrice = precio !== undefined ? precio : p.base_price || 0;
            const finalDiscount = descuento !== undefined ? descuento : 0;
            
            console.log(`[LOG] Precio final: ${finalPrice} (DB: ${p.base_price}), Descuento final: ${finalDiscount}%`);

            return await enrichChatQuotationItem(supabase, { 
                id: p.id,
                product_id: p.id,
                sku: p.sku || 'N/A', 
                description: p.name, 
                quantity: cantidad, 
                price: finalPrice, 
                discount: finalDiscount,
                includeDetail: false,
                detailDescription: ''
            }, p.id);
        }

        console.log(`[LOG] No se encontró nada para "${nombre}" con búsqueda semántica.`);
        console.log(`[LOG] Intentando fallback a búsqueda por texto...`);
        
        // FALLBACK: Búsqueda por texto si la semántica no funciona
        return await searchProductsByText(supabase, productInfo);
        
    } catch (error) {
        console.error(`[LOG] Error en búsqueda semántica:`, error);
        console.log(`[LOG] Intentando fallback a búsqueda por texto...`);
        return await searchProductsByText(supabase, productInfo);
    }
}

// --- BÚSQUEDA POR TEXTO (FALLBACK) ---
async function searchProductsByText(supabase: SupabaseClient, productInfo: { nombre: string, cantidad: number, precio?: number, descuento?: number }) {
    const { nombre, cantidad, precio, descuento } = productInfo;
    
    console.log(`[LOG] Búsqueda por texto para: "${nombre}"`);
    
    // Limpiar nombre
    const cleanedName = nombre.replace(/máquina|maquina|tubo|pieza|unidad de|un|una|dame|cotiza/gi, '').trim();
    const normalizedQuery = cleanedName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    
    if (!normalizedQuery) {
        console.log('[LOG] Consulta vacía después de normalizar');
        return null;
    }
    
    console.log(`[LOG] Consulta normalizada: "${normalizedQuery}"`);
    
    // Buscar en variantes con ILIKE
    const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, name, sku, price, product:products!inner(id, name, is_active)')
        .eq('product.is_active', true)
        .ilike('name', `%${normalizedQuery}%`)
        .limit(1);
    
    if (variantsError) {
        console.error('[LOG] Error en búsqueda de variantes:', variantsError);
    } else {
        console.log(`[LOG] Variantes encontradas: ${variants?.length || 0}`);
    }
    
    if (variants && variants.length > 0) {
        const v = variants[0];
        const product = Array.isArray(v.product) ? v.product[0] : v.product;
        console.log(`[LOG] Variante encontrada: ${product.name} - ${v.name}`);
        
        const finalPrice = precio !== undefined ? precio : v.price || 0;
        const finalDiscount = descuento !== undefined ? descuento : 0;
        
        return await enrichChatQuotationItem(supabase, {
            id: v.id,
            product_id: product.id,
            variant_id: v.id,
            sku: v.sku || 'N/A',
            description: `${product.name} - ${v.name}`,
            quantity: cantidad,
            price: finalPrice,
            discount: finalDiscount,
            includeDetail: false,
            detailDescription: ''
        }, product.id);
    }
    
    // Buscar en productos con ILIKE
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, base_price')
        .eq('is_active', true)
        .ilike('name', `%${normalizedQuery}%`)
        .limit(1);
    
    if (productsError) {
        console.error('[LOG] Error en búsqueda de productos:', productsError);
    } else {
        console.log(`[LOG] Productos encontrados: ${products?.length || 0}`);
    }
    
    if (products && products.length > 0) {
        const p = products[0];
        console.log(`[LOG] Producto encontrado: ${p.name}`);
        
        const finalPrice = precio !== undefined ? precio : p.base_price || 0;
        const finalDiscount = descuento !== undefined ? descuento : 0;
        
        return await enrichChatQuotationItem(supabase, {
            id: p.id,
            product_id: p.id,
            sku: p.sku || 'N/A',
            description: p.name,
            quantity: cantidad,
            price: finalPrice,
            discount: finalDiscount,
            includeDetail: false,
            detailDescription: ''
        }, p.id);
    }
    
    console.log(`[LOG] No se encontró nada para "${nombre}"`);
    return null;
}


// --- ENDPOINT PRINCIPAL ---
export const POST: RequestHandler = async ({ request }) => {
  const { message } = await request.json();
  if (!message) return json({ success: false, error: 'No message provided.' }, { status: 400 });

  console.log(`[LOG] Mensaje recibido: "${message}"`);

  try {
    const genAI = await getGenAI();
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    
    // Prompt con Chain of Thought (CoT) para mejor análisis
    const prompt = `
Eres un asistente experto en procesamiento de cotizaciones para una ferretería/tienda de equipos láser.

Tu tarea es analizar el mensaje del usuario y extraer información estructurada siguiendo un proceso de pensamiento paso a paso.

**PROCESO DE ANÁLISIS (Chain of Thought):**

Paso 1: IDENTIFICACIÓN
- Lee cuidadosamente el mensaje completo
- Identifica el nombre del cliente
- Identifica cada producto mencionado y su cantidad
- Identifica costos adicionales (envío, instalación)

Paso 2: CORRECCIÓN Y NORMALIZACIÓN
- Corrige posibles errores ortográficos en nombres de productos
- Considera el contexto de ferretería/equipos láser para inferir productos correctos
- Ejemplos de correcciones comunes:
  * "hoja fierro bordes" → "lámina antiderrapante"
  * "tubo c02" → "tubo co2"
  * "maquina corte" → "máquina de corte láser"
  * "puri" → "puri" (marca conocida)
- Normaliza cantidades y precios a números
- Descarta palabras genéricas como "máquina", "tubo", "pieza" del nombre del producto

Paso 3: EXTRACCIÓN ESTRUCTURADA
- Genera la lista final de productos con:
  * nombre: modelo o código específico del producto (sin palabras genéricas)
  * cantidad: número de unidades
  * precio: precio unitario (opcional, solo si se menciona)
  * descuento: porcentaje de descuento 0-100 (opcional, solo si se menciona)
- Extrae costos adicionales:
  * envio: costo total de envío (opcional)
  * instalacion: costo total de instalación (opcional)

**FORMATO DE SALIDA:**
Debes responder ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones.

Estructura del JSON:
{
  "cliente": "nombre del cliente",
  "productos": [
    { 
      "nombre": "modelo o código específico", 
      "cantidad": número,
      "precio": número (opcional),
      "descuento": número 0-100 (opcional)
    }
  ],
  "envio": número (opcional),
  "instalacion": número (opcional)
}

**EJEMPLOS:**

Ejemplo 1:
Input: "cotiza para mario perez un tubo puri p10 a 4999 con 5% de descuento y envio de 500 pesos"
Output:
{
  "cliente": "mario perez",
  "productos": [
    { "nombre": "puri p10", "cantidad": 1, "precio": 4999, "descuento": 5 }
  ],
  "envio": 500
}

Ejemplo 2:
Input: "Una cotización para Guerralaser de una máquina 4060"
Output:
{
  "cliente": "Guerralaser",
  "productos": [
    { "nombre": "4060", "cantidad": 1 }
  ]
}

Ejemplo 3:
Input: "necesito 2 hojas de fierro con bordes antiderrapantes para Juan Lopez"
Output:
{
  "cliente": "Juan Lopez",
  "productos": [
    { "nombre": "lámina antiderrapante", "cantidad": 2 }
  ]
}

Ahora procesa el siguiente mensaje:
    `;

    const result = await model.generateContent([prompt, message].join('\n'));
    let text = (await result.response).text();
    console.log(`[LOG] Respuesta de Gemini (cruda): ${text}`);
    
    const firstBracket = text.indexOf('{');
    const lastBracket = text.lastIndexOf('}');
    if (firstBracket !== -1 && lastBracket !== -1) {
        text = text.substring(firstBracket, lastBracket + 1);
    }

    const parsedResult = JSON.parse(text);
    console.log(`[LOG] Resultado de Gemini (parseado): ${JSON.stringify(parsedResult, null, 2)}`);

    const supabase = createSupabaseAdminClient();
    const productPromises = parsedResult.productos.map((p: any) => searchProductsWithEmbeddings(supabase, p));
    const productosEncontrados = (await Promise.all(productPromises)).filter(p => p !== null) as any[];

    if (productosEncontrados.length === 0) {
        console.log('[LOG] Final: No se encontró ningún producto.');
        return json({ success: false, error: 'No se encontraron productos que coincidan.' }, { status: 404 });
    }
    console.log(`[LOG] Final: Productos encontrados: ${JSON.stringify(productosEncontrados, null, 2)}`);

    const pdfDoc = await buildQuotationPdf({
        customerName: parsedResult.cliente || 'Cliente Chat',
        notes: 'Cotización generada por asistente de IA.',
        validityDays: 15,
        shippingCost: parsedResult.envio ?? 0,
        installationCost: parsedResult.instalacion ?? 0,
        items: productosEncontrados.map((item) => ({
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            imageUrl: item.imageUrl,
            includeDetail: item.includeDetail,
            detailDescription: item.detailDescription
        }))
    });
    
    // Generar PDF en memoria y devolverlo como base64
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
    const pdfBase64 = pdfBuffer.toString('base64');
    const pdfName = `cotizacion-chat-${Date.now()}.pdf`;
    
    console.log(`[LOG] PDF generado en memoria: ${pdfName}`);

    let savedQuotation: { id: string; quotation_number: string } | null = null;
    try {
        const saved = await saveQuotation(supabase, {
            source: 'ai_chat',
            customer_name: parsedResult.cliente || 'Cliente Chat',
            shipping_cost: parsedResult.envio ?? 0,
            installation_cost: parsedResult.instalacion ?? 0,
            validity_days: 15,
            notes: 'Cotización generada por chat IA.',
            items: productosEncontrados.map((item) => ({
                product_id: item.product_id ?? null,
                variant_id: item.variant_id ?? null,
                sku: item.sku,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.price,
                line_discount_percentage: item.discount ?? 0,
                image_url: item.imageUrl,
                include_detail: item.includeDetail ?? false,
                detail_description: item.detailDescription
            }))
        });
        savedQuotation = { id: saved.id, quotation_number: saved.quotation_number };
        console.log(`[LOG] Cotización guardada: ${saved.quotation_number}`);
    } catch (saveError) {
        console.error('[LOG] No se pudo guardar la cotización en BD:', saveError);
    }

    return json({ 
        success: true, 
        pdfData: pdfBase64,
        pdfName: pdfName,
        downloadUrl: `data:application/pdf;base64,${pdfBase64}`,
        quotationId: savedQuotation?.id ?? null,
        quotationNumber: savedQuotation?.quotation_number ?? null
    });

  } catch (error: any) {
    console.error('[LOG] Error CRÍTICO en el proceso:', error);
    if (error instanceof SyntaxError) {
        return json({ success: false, error: `El modelo de IA devolvió una respuesta inválida. Por favor, intenta de nuevo. (Detalle: ${error.message})` }, { status: 500 });
    }
    return json({ success: false, error: error.message || 'Error desconocido' }, { status: 500 });
  }
};