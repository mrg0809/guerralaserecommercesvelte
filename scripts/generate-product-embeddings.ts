/**
 * Script para generar embeddings de productos existentes en la base de datos
 * 
 * Uso:
 * 1. Asegúrate de haber ejecutado la migración enable_pgvector_embeddings.sql
 * 2. Ejecuta: npx tsx scripts/generate-product-embeddings.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { generateDocumentEmbedding, normalizeProductText } from '../src/lib/utils/embeddings.ts';

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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
    console.error('❌ Error: Faltan variables de entorno necesarias');
    console.error('Asegúrate de tener configuradas en tu archivo .env:');
    console.error('  - PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.error('  - GEMINI_API_KEY');
    console.error('\nVariables encontradas:');
    console.error(`  - PUBLIC_SUPABASE_URL: ${SUPABASE_URL ? '✓' : '✗'}`);
    console.error(`  - SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗'}`);
    console.error(`  - GEMINI_API_KEY: ${GEMINI_API_KEY ? '✓' : '✗'}`);
    process.exit(1);
}

process.env.GEMINI_API_KEY = GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function generateProductEmbeddings() {
    console.log('🚀 Iniciando generación de embeddings para productos...\n');

    try {
        // 1. Obtener todos los productos activos sin embedding
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, sku')
            .eq('is_active', true)
            .is('name_embedding', null);

        if (productsError) {
            throw new Error(`Error obteniendo productos: ${productsError.message}`);
        }

        console.log(`📦 Productos encontrados: ${products?.length || 0}`);

        if (products && products.length > 0) {
            let processedProducts = 0;
            let failedProducts = 0;

            for (const product of products) {
                try {
                    const normalizedText = normalizeProductText(product.name);
                    console.log(`  Procesando: ${product.name} (${product.sku || 'sin SKU'})`);
                    
                    const embedding = await generateDocumentEmbedding(normalizedText);
                    
                    const { error: updateError } = await supabase
                        .from('products')
                        .update({ name_embedding: embedding })
                        .eq('id', product.id);

                    if (updateError) {
                        console.error(`    ❌ Error actualizando producto ${product.id}: ${updateError.message}`);
                        failedProducts++;
                    } else {
                        console.log(`    ✅ Embedding generado (${embedding.length} dimensiones)`);
                        processedProducts++;
                    }

                    // Pequeña pausa para no saturar la API
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error: any) {
                    console.error(`    ❌ Error procesando producto ${product.id}: ${error.message}`);
                    failedProducts++;
                }
            }

            console.log(`\n✅ Productos procesados: ${processedProducts}`);
            if (failedProducts > 0) {
                console.log(`⚠️  Productos fallidos: ${failedProducts}`);
            }
        }

        // 2. Obtener todas las variantes activas sin embedding
        const { data: variants, error: variantsError } = await supabase
            .from('product_variants')
            .select('id, name, sku, product:products!inner(id, name, is_active)')
            .eq('product.is_active', true)
            .is('name_embedding', null);

        if (variantsError) {
            throw new Error(`Error obteniendo variantes: ${variantsError.message}`);
        }

        console.log(`\n📦 Variantes encontradas: ${variants?.length || 0}`);

        if (variants && variants.length > 0) {
            let processedVariants = 0;
            let failedVariants = 0;

            for (const variant of variants) {
                try {
                    const product = Array.isArray(variant.product) ? variant.product[0] : variant.product;
                    const normalizedText = normalizeProductText(
                        product.name,
                        variant.name
                    );
                    console.log(`  Procesando: ${product.name} - ${variant.name} (${variant.sku || 'sin SKU'})`);
                    
                    const embedding = await generateDocumentEmbedding(normalizedText);
                    
                    const { error: updateError } = await supabase
                        .from('product_variants')
                        .update({ name_embedding: embedding })
                        .eq('id', variant.id);

                    if (updateError) {
                        console.error(`    ❌ Error actualizando variante ${variant.id}: ${updateError.message}`);
                        failedVariants++;
                    } else {
                        console.log(`    ✅ Embedding generado (${embedding.length} dimensiones)`);
                        processedVariants++;
                    }

                    // Pequeña pausa para no saturar la API
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error: any) {
                    console.error(`    ❌ Error procesando variante ${variant.id}: ${error.message}`);
                    failedVariants++;
                }
            }

            console.log(`\n✅ Variantes procesadas: ${processedVariants}`);
            if (failedVariants > 0) {
                console.log(`⚠️  Variantes fallidas: ${failedVariants}`);
            }
        }

        console.log('\n🎉 Proceso completado exitosamente!');
        console.log('\n📝 Próximos pasos:');
        console.log('   1. Verifica que los embeddings se hayan generado correctamente');
        console.log('   2. Prueba el chat de cotizaciones con búsqueda semántica');
        console.log('   3. Ajusta el match_threshold si es necesario (actualmente 0.65)');

    } catch (error: any) {
        console.error('\n❌ Error crítico:', error.message);
        process.exit(1);
    }
}

// Ejecutar el script
generateProductEmbeddings()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
