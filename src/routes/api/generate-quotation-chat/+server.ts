import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsPDF } from 'jspdf';
import { generateEmbedding, normalizeProductText } from '$lib/utils/embeddings';

// Verificar que GEMINI_API_KEY esté disponible
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
	throw new Error('GEMINI_API_KEY no está configurada en el entorno');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const createSupabaseAdminClient = () => createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

            return { 
                id: v.id, 
                sku: v.sku || 'N/A', 
                description: `${v.product_name} - ${v.variant_name}`, 
                quantity: cantidad, 
                price: finalPrice, 
                discount: finalDiscount 
            };
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

            return { 
                id: p.id, 
                sku: p.sku || 'N/A', 
                description: p.name, 
                quantity: cantidad, 
                price: finalPrice, 
                discount: finalDiscount 
            };
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
        
        return {
            id: v.id,
            sku: v.sku || 'N/A',
            description: `${product.name} - ${v.name}`,
            quantity: cantidad,
            price: finalPrice,
            discount: finalDiscount
        };
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
        
        return {
            id: p.id,
            sku: p.sku || 'N/A',
            description: p.name,
            quantity: cantidad,
            price: finalPrice,
            discount: finalDiscount
        };
    }
    
    console.log(`[LOG] No se encontró nada para "${nombre}"`);
    return null;
}


// --- GENERACIÓN DE PDF ---
async function createPdfDocument(data: any): Promise<jsPDF> {
    const { quotationItems, customerName, quotationValidityDays, notes, shippingCost, installationCost } = data;
    const doc = new jsPDF();
    let currentY = 10;
    const redColor = [220, 38, 38]; const blueColor = [37, 99, 235];
    // El logo se omite en el chat para evitar problemas con el sistema de archivos en producción
    // En el futuro se podría cargar desde una URL o base64 si es necesario
    doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(redColor[0], redColor[1], redColor[2]);
    doc.text('COTIZACIÓN', 200, 15, { align: 'right' });
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(0, 0, 0);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 200, 22, { align: 'right' });
    doc.text(`Vigencia: ${quotationValidityDays || 15} días`, 200, 27, { align: 'right' });
    doc.setFontSize(8).setTextColor(80, 80, 80);
    doc.text('Guerra Laser México', 200, 35, { align: 'right' });
    doc.text('Tel: 33 2015 2372', 200, 39, { align: 'right' });
    doc.text('Cel: 33 3475 8653 | 33 1864 0008', 200, 43, { align: 'right' });
    doc.text('contacto@guerralaser.com', 200, 47, { align: 'right' });
    doc.text('Av. Las Torres 5301, Col. Glorias del Colli', 200, 51, { align: 'right' });
    doc.text('Zapopan, Jalisco CP 45010', 200, 55, { align: 'right' });
    currentY = Math.max(currentY, 62);
    doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]).setLineWidth(0.5).line(10, currentY, 200, currentY); currentY += 6;
    doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(0, 0, 0).text('DATOS DEL CLIENTE', 10, currentY);
    doc.setFont('helvetica', 'normal').setFontSize(9); currentY += 6;
    doc.text(`Nombre: ${customerName || '-'}`, 10, currentY); currentY += 12;
    doc.setDrawColor(redColor[0], redColor[1], redColor[2]).line(10, currentY, 200, currentY); currentY += 5;
    doc.setFillColor(240, 240, 240).rect(10, currentY - 4, 190, 6, 'F');
    doc.setFontSize(9).setFont('helvetica', 'bold');
    doc.text('SKU', 11, currentY); doc.text('Descripción', 32, currentY); doc.text('Cant.', 110, currentY, { align: 'right' }); doc.text('Precio Unit.', 135, currentY, { align: 'right' }); doc.text('Desc.%', 160, currentY, { align: 'right' }); doc.text('Total', 195, currentY, { align: 'right' });
    currentY += 5; doc.setFont('helvetica', 'normal').setFontSize(8);
    for (const item of quotationItems) {
        const lineTotal = (item.quantity * item.price) * (1 - (item.discount || 0) / 100);
        const descLines = doc.splitTextToSize(item.description || '', 75); const rowHeight = descLines.length * 4;
        if (currentY + rowHeight > 270) { doc.addPage(); currentY = 20; }
        doc.text(doc.splitTextToSize(item.sku || '-', 18), 11, currentY); doc.text(descLines, 32, currentY);
        doc.text(String(item.quantity), 110, currentY, { align: 'right' }); doc.text(`$${item.price.toFixed(2)}`, 135, currentY, { align: 'right' }); doc.text(`${(item.discount || 0).toFixed(1)}%`, 160, currentY, { align: 'right' }); doc.text(`$${lineTotal.toFixed(2)}`, 195, currentY, { align: 'right' });
        currentY += rowHeight + 2; doc.setDrawColor(200, 210, 230).setLineWidth(0.1).line(10, currentY, 200, currentY); currentY += 2;
    }
    currentY += 3; doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]).setLineWidth(0.5).line(120, currentY, 200, currentY); currentY += 6;
    const subtotal = quotationItems.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
    const totalDiscountAmount = quotationItems.reduce((sum: number, item: any) => sum + (item.quantity * item.price * (item.discount/100)), 0);
    const finalTotal = subtotal - totalDiscountAmount + (shippingCost || 0) + (installationCost || 0);
    doc.setFontSize(9);
    doc.text('Subtotal:', 155, currentY, { align: 'right' }); doc.text(`$${subtotal.toFixed(2)} MXN`, 195, currentY, { align: 'right' }); currentY += 5;
    doc.text('Descuento:', 155, currentY, { align: 'right' }); doc.text(`-$${totalDiscountAmount.toFixed(2)} MXN`, 195, currentY, { align: 'right' }); currentY += 5;
    if (shippingCost && shippingCost > 0) {
        doc.text('Envío:', 155, currentY, { align: 'right' });
        doc.text(`$${shippingCost.toFixed(2)} MXN`, 195, currentY, { align: 'right' });
        currentY += 5;
    }
    if (installationCost && installationCost > 0) {
        doc.text('Instalación:', 155, currentY, { align: 'right' });
        doc.text(`$${installationCost.toFixed(2)} MXN`, 195, currentY, { align: 'right' });
        currentY += 5;
    }
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    doc.text('Total:', 155, currentY, { align: 'right' }); doc.text(`$${finalTotal.toFixed(2)} MXN`, 195, currentY, { align: 'right' }); currentY += 8;
    doc.setFont('helvetica', 'normal');
    if (notes) { doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(0,0,0).text('Notas:', 10, currentY); const splitNotes = doc.splitTextToSize(notes, 180); doc.setFontSize(8).setFont('helvetica', 'normal').text(splitNotes, 10, currentY + 4); }
    currentY = 260; doc.setDrawColor(redColor[0], redColor[1], redColor[2]).line(10, currentY, 200, currentY);
    doc.setFontSize(7).setTextColor(100, 100, 100).text(`Esta cotización tiene una vigencia de ${quotationValidityDays || 15} días naturales.`, 105, currentY + 4, { align: 'center' });
    doc.text('Gracias por su preferencia - Guerra Laser México', 105, currentY + 8, { align: 'center' });
    return doc;
}

// --- ENDPOINT PRINCIPAL ---
export const POST: RequestHandler = async ({ request }) => {
  const { message } = await request.json();
  if (!message) return json({ success: false, error: 'No message provided.' }, { status: 400 });

  console.log(`[LOG] Mensaje recibido: "${message}"`);

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
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

    const pdfDoc = await createPdfDocument({
        quotationItems: productosEncontrados,
        customerName: parsedResult.cliente || 'Cliente Chat',
        notes: 'Cotización generada por asistente de IA.',
        shippingCost: parsedResult.envio,
        installationCost: parsedResult.instalacion
    });
    
    // Generar PDF en memoria y devolverlo como base64
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
    const pdfBase64 = pdfBuffer.toString('base64');
    const pdfName = `cotizacion-chat-${Date.now()}.pdf`;
    
    console.log(`[LOG] PDF generado en memoria: ${pdfName}`);
    return json({ 
        success: true, 
        pdfData: pdfBase64,
        pdfName: pdfName,
        downloadUrl: `data:application/pdf;base64,${pdfBase64}`
    });

  } catch (error: any) {
    console.error('[LOG] Error CRÍTICO en el proceso:', error);
    if (error instanceof SyntaxError) {
        return json({ success: false, error: `El modelo de IA devolvió una respuesta inválida. Por favor, intenta de nuevo. (Detalle: ${error.message})` }, { status: 500 });
    }
    return json({ success: false, error: error.message || 'Error desconocido' }, { status: 500 });
  }
};