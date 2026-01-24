/**
 * Script para verificar el estado de los productos y embeddings
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkProductsStatus() {
    console.log('📊 Estado de Productos y Embeddings\n');
    console.log('='.repeat(60));

    // Total de productos activos
    const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

    console.log(`\n📦 Total de productos activos: ${totalProducts || 0}`);

    // Productos con embeddings
    const { count: productsWithEmbeddings } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .not('name_embedding', 'is', null);

    console.log(`✅ Productos con embeddings: ${productsWithEmbeddings || 0}`);
    console.log(`❌ Productos sin embeddings: ${(totalProducts || 0) - (productsWithEmbeddings || 0)}`);

    // Total de variantes activas
    const { count: totalVariants } = await supabase
        .from('product_variants')
        .select('*, product:products!inner(is_active)', { count: 'exact', head: true })
        .eq('product.is_active', true);

    console.log(`\n📦 Total de variantes activas: ${totalVariants || 0}`);

    // Variantes con embeddings
    const { count: variantsWithEmbeddings } = await supabase
        .from('product_variants')
        .select('*, product:products!inner(is_active)', { count: 'exact', head: true })
        .eq('product.is_active', true)
        .not('name_embedding', 'is', null);

    console.log(`✅ Variantes con embeddings: ${variantsWithEmbeddings || 0}`);
    console.log(`❌ Variantes sin embeddings: ${(totalVariants || 0) - (variantsWithEmbeddings || 0)}`);

    // Listar algunos productos sin embeddings
    console.log('\n📋 Productos sin embeddings (primeros 10):');
    const { data: productsWithoutEmbeddings } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('is_active', true)
        .is('name_embedding', null)
        .limit(10);

    if (productsWithoutEmbeddings && productsWithoutEmbeddings.length > 0) {
        productsWithoutEmbeddings.forEach(p => {
            console.log(`   - ${p.name} (${p.sku || 'sin SKU'})`);
        });
    } else {
        console.log('   ✅ Todos los productos tienen embeddings');
    }

    // Listar algunas variantes sin embeddings
    console.log('\n📋 Variantes sin embeddings (primeras 10):');
    const { data: variantsWithoutEmbeddings } = await supabase
        .from('product_variants')
        .select('id, name, sku, product:products!inner(name, is_active)')
        .eq('product.is_active', true)
        .is('name_embedding', null)
        .limit(10);

    if (variantsWithoutEmbeddings && variantsWithoutEmbeddings.length > 0) {
        variantsWithoutEmbeddings.forEach(v => {
            const product = Array.isArray(v.product) ? v.product[0] : v.product;
            console.log(`   - ${product?.name} - ${v.name} (${v.sku || 'sin SKU'})`);
        });
    } else {
        console.log('   ✅ Todas las variantes tienen embeddings');
    }

    console.log('\n' + '='.repeat(60));
}

checkProductsStatus()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
