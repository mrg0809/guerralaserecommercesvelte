/**
 * Script de diagnóstico para probar la búsqueda semántica
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Cargar variables de entorno desde .env manualmente
function loadEnvFile() {
    try {
        const envPath = resolve(process.cwd(), '.env');
        const envFile = readFileSync(envPath, 'utf-8');
        const envVars: Record<string, string> = {};
        
        envFile.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...valueParts] = trimmedLine.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                    envVars[key.trim()] = value;
                }
            }
        });
        
        return envVars;
    } catch (error) {
        console.error('❌ Error leyendo archivo .env:', error);
        return {};
    }
}

const envVars = loadEnvFile();
const SUPABASE_URL = envVars.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = envVars.GEMINI_API_KEY || process.env.GEMINI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function generateEmbedding(text: string): Promise<number[]> {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

async function testSemanticSearch() {
    console.log('🔍 Diagnóstico de Búsqueda Semántica\n');
    console.log('=' .repeat(60));

    // 1. Verificar que existan productos con embeddings
    console.log('\n1️⃣ Verificando productos con embeddings...');
    const { data: productsWithEmbeddings, error: prodError } = await supabase
        .from('products')
        .select('id, name, sku, name_embedding')
        .not('name_embedding', 'is', null)
        .limit(5);

    if (prodError) {
        console.error('❌ Error:', prodError);
    } else {
        console.log(`✅ Productos con embeddings: ${productsWithEmbeddings?.length || 0}`);
        productsWithEmbeddings?.forEach(p => {
            console.log(`   - ${p.name} (${p.sku || 'sin SKU'}) - Embedding: ${p.name_embedding ? 'SÍ' : 'NO'}`);
        });
    }

    // 2. Verificar variantes con embeddings
    console.log('\n2️⃣ Verificando variantes con embeddings...');
    const { data: variantsWithEmbeddings, error: varError } = await supabase
        .from('product_variants')
        .select('id, name, sku, name_embedding, product:products(name)')
        .not('name_embedding', 'is', null)
        .limit(5);

    if (varError) {
        console.error('❌ Error:', varError);
    } else {
        console.log(`✅ Variantes con embeddings: ${variantsWithEmbeddings?.length || 0}`);
        variantsWithEmbeddings?.forEach(v => {
            const product = Array.isArray(v.product) ? v.product[0] : v.product;
            console.log(`   - ${product?.name} - ${v.name} (${v.sku || 'sin SKU'}) - Embedding: ${v.name_embedding ? 'SÍ' : 'NO'}`);
        });
    }

    // 3. Verificar que las funciones RPC existan
    console.log('\n3️⃣ Verificando funciones RPC...');
    
    // Probar con un embedding de prueba
    const testQueries = [
        'tubo efr 100w',
        'máquina láser 1040',
        'tubo co2',
        'máquina corte'
    ];

    for (const query of testQueries) {
        console.log(`\n📝 Probando búsqueda: "${query}"`);
        
        try {
            const embedding = await generateEmbedding(query.toLowerCase());
            console.log(`   ✅ Embedding generado (${embedding.length} dimensiones)`);
            
            // Probar búsqueda en variantes
            const { data: variantResults, error: variantError } = await supabase
                .rpc('search_product_variants_by_embedding', {
                    query_embedding: embedding,
                    match_threshold: 0.65,
                    match_count: 3
                });

            if (variantError) {
                console.error(`   ❌ Error en búsqueda de variantes:`, variantError);
            } else {
                console.log(`   📦 Variantes encontradas: ${variantResults?.length || 0}`);
                variantResults?.forEach((v: any) => {
                    console.log(`      - ${v.product_name} - ${v.variant_name} (similitud: ${v.similarity?.toFixed(3)})`);
                });
            }

            // Probar búsqueda en productos
            const { data: productResults, error: productError } = await supabase
                .rpc('search_products_by_embedding', {
                    query_embedding: embedding,
                    match_threshold: 0.65,
                    match_count: 3
                });

            if (productError) {
                console.error(`   ❌ Error en búsqueda de productos:`, productError);
            } else {
                console.log(`   📦 Productos encontrados: ${productResults?.length || 0}`);
                productResults?.forEach((p: any) => {
                    console.log(`      - ${p.name} (similitud: ${p.similarity?.toFixed(3)})`);
                });
            }

            // Si no se encontró nada, probar con umbral más bajo
            if ((!variantResults || variantResults.length === 0) && (!productResults || productResults.length === 0)) {
                console.log(`   🔄 Probando con umbral más bajo (0.50)...`);
                
                const { data: lowThresholdResults } = await supabase
                    .rpc('search_product_variants_by_embedding', {
                        query_embedding: embedding,
                        match_threshold: 0.50,
                        match_count: 5
                    });

                if (lowThresholdResults && lowThresholdResults.length > 0) {
                    console.log(`   📦 Con umbral 0.50 se encontraron ${lowThresholdResults.length} resultados:`);
                    lowThresholdResults.forEach((v: any) => {
                        console.log(`      - ${v.product_name} - ${v.variant_name} (similitud: ${v.similarity?.toFixed(3)})`);
                    });
                } else {
                    console.log(`   ⚠️  Aún con umbral 0.50 no se encontraron resultados`);
                }
            }

        } catch (error: any) {
            console.error(`   ❌ Error:`, error.message);
        }
    }

    // 4. Listar algunos productos para referencia
    console.log('\n4️⃣ Muestra de productos en la base de datos:');
    const { data: sampleProducts } = await supabase
        .from('products')
        .select('name, sku')
        .eq('is_active', true)
        .limit(10);

    sampleProducts?.forEach(p => {
        console.log(`   - ${p.name} (${p.sku || 'sin SKU'})`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnóstico completado\n');
}

testSemanticSearch()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
