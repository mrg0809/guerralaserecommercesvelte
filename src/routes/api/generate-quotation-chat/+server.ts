import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsPDF } from 'jspdf';
import fs from 'fs';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const createSupabaseAdminClient = () => createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- LÓGICA DE BÚSQUEDA DE PRODUCTOS CON PRECIOS Y DESCUENTOS PERSONALIZADOS ---
async function searchProducts(supabase: SupabaseClient, productInfo: { nombre: string, cantidad: number, precio?: number, descuento?: number }) {
    const { nombre, cantidad, precio, descuento } = productInfo;

    console.log(`[LOG] Iniciando búsqueda para: "${nombre}" (Cantidad: ${cantidad}). Info del prompt: Precio=${precio}, Descuento=${descuento}%`);

    // Limpieza de nombre de producto para evitar palabras genéricas
    const cleanedName = nombre.replace(/máquina|maquina|tubo|pieza|unidad de|un|una|dame|cotiza/gi, '').trim();

    const normalizedQuery = cleanedName
        .toLowerCase()
        .replace(/c02/g, 'co2')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();

    if (!normalizedQuery) {
        console.log('[LOG] La consulta normalizada está vacía.');
        return null;
    }
    
    console.log(`[LOG] Consulta normalizada para FTS: "${normalizedQuery}"`);
    
    // Estrategia 1: Buscar en variantes de productos
    const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, name, sku, price, product:products!inner(id, name, is_active)')
        .eq('product.is_active', true)
        .textSearch('name', normalizedQuery, { config: 'spanish', type: 'plain' })
        .limit(1);

    if (variantsError) console.error('[LOG] Error en FTS de variantes:', variantsError);
    else console.log(`[LOG] Resultado de FTS en variantes: ${JSON.stringify(variants, null, 2)}`);

    if (variants && variants.length > 0) {
        const v = variants[0];
        console.log(`[LOG] Variante encontrada con FTS: ${v.product.name} - ${v.name}`);
        
        const finalPrice = precio !== undefined ? precio : v.price || 0;
        const finalDiscount = descuento !== undefined ? descuento : 0;
        
        console.log(`[LOG] Precio final: ${finalPrice} (DB: ${v.price}), Descuento final: ${finalDiscount}%`);

        return { id: v.id, sku: v.sku || 'N/A', description: `${v.product.name} - ${v.name}`, quantity: cantidad, price: finalPrice, discount: finalDiscount };
    }

    // Estrategia 2: Si no hay variantes, buscar en productos principales
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, base_price, is_active')
        .eq('is_active', true)
        .textSearch('name', normalizedQuery, { config: 'spanish', type: 'plain' })
        .limit(1);

    if (productsError) console.error('[LOG] Error en FTS de productos:', productsError);
    else console.log(`[LOG] Resultado de FTS en productos: ${JSON.stringify(products, null, 2)}`);

    if (products && products.length > 0) {
        const p = products[0];
        console.log(`[LOG] Producto encontrado con FTS: ${p.name}`);
        
        const finalPrice = precio !== undefined ? precio : p.base_price || 0;
        const finalDiscount = descuento !== undefined ? descuento : 0;
        
        console.log(`[LOG] Precio final: ${finalPrice} (DB: ${p.base_price}), Descuento final: ${finalDiscount}%`);

        return { id: p.id, sku: p.sku || 'N/A', description: p.name, quantity: cantidad, price: finalPrice, discount: finalDiscount };
    }

    console.log(`[LOG] No se encontró nada para "${nombre}" con FTS.`);
    return null;
}


// --- GENERACIÓN DE PDF ---
async function createPdfDocument(data: any): Promise<jsPDF> {
    const { quotationItems, customerName, quotationValidityDays, notes, shippingCost, installationCost } = data;
    const doc = new jsPDF();
    let currentY = 10;
    const redColor = [220, 38, 38]; const blueColor = [37, 99, 235];
    try {
        const logoBuffer = fs.readFileSync('static/logorectangular.png');
        // CORRECCIÓN: Usar 0 para el alto para que jsPDF calcule la proporción automáticamente
        doc.addImage(logoBuffer, 'PNG', 10, currentY, 50, 0);
        currentY += 17; // Ajustar el espacio si es necesario
    } catch (e) { console.error("[LOG] Logo no encontrado."); }
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
    const subtotal = quotationItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const totalDiscountAmount = quotationItems.reduce((sum, item) => sum + (item.quantity * item.price * (item.discount/100)), 0);
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const prompt = `
      Extrae la siguiente información del texto que te proporciono:
      - Nombre del cliente.
      - Lista de productos (con cantidad, precio y descuento opcionales).
      - Costo de envío (opcional).
      - Costo de instalación (opcional).

      INSTRUCCIONES PARA EXTRAER LA INFORMACIÓN:
      1.  Al extraer el 'nombre' del producto, enfócate en el modelo o código, descartando palabras genéricas como 'máquina', 'tubo', 'pieza', etc.
      2.  El descuento debe ser un número (porcentaje de 0 a 100).
      3.  Envío e instalación son costos totales, no por producto.

      El formato de salida debe ser estrictamente un JSON, sin texto adicional ni markdown.
      El JSON debe tener las siguientes llaves:
      - cliente: string
      - productos: array de objetos con "nombre", "cantidad", y opcionalmente "precio" y "descuento".
      - envio: number (opcional)
      - instalacion: number (opcional)

      Ejemplo 1 (completo):
      Input: "cotiza para mario perez un tubo puri p10 a 4999 con 5% de descuento y envio de 500 pesos"
      Output:
      {
        "cliente": "mario perez",
        "productos": [
          { "nombre": "puri p10", "cantidad": 1, "precio": 4999, "descuento": 5 }
        ],
        "envio": 500
      }

      Ejemplo 2 (sin extras):
      Input: "Una cotización para Guerralaser de una máquina 4060"
      Output:
      {
        "cliente": "Guerralaser",
        "productos": [
          { "nombre": "4060", "cantidad": 1 }
        ]
      }
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
    const productPromises = parsedResult.productos.map((p: any) => searchProducts(supabase, p));
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
    const pdfName = `cotizacion-chat-${Date.now()}.pdf`;
    const pdfPath = `static/cotizaciones/${pdfName}`;
    const dir = 'static/cotizaciones';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(pdfPath, Buffer.from(pdfDoc.output('arraybuffer')));
    
    console.log(`[LOG] PDF generado: ${pdfPath}`);
    return json({ success: true, pdfUrl: `/cotizaciones/${pdfName}` });

  } catch (error: any) {
    console.error('[LOG] Error CRÍTICO en el proceso:', error);
    if (error instanceof SyntaxError) {
        return json({ success: false, error: `El modelo de IA devolvió una respuesta inválida. Por favor, intenta de nuevo. (Detalle: ${error.message})` }, { status: 500 });
    }
    return json({ success: false, error: error.message || 'Error desconocido' }, { status: 500 });
  }
};