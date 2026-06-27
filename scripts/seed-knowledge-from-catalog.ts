/**
 * Indexa productos activos como artículos iniciales en knowledge_articles.
 * Uso: npx tsx scripts/seed-knowledge-from-catalog.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { generateDocumentEmbedding } from '../src/lib/utils/embeddings.ts';

function loadEnv() {
	const envPath = join(process.cwd(), '.env');
	if (!existsSync(envPath)) throw new Error('No se encontró .env');
	const content = readFileSync(envPath, 'utf8');
	const vars: Record<string, string> = {};
	for (const line of content.split('\n')) {
		const m = line.match(/^([^#=]+)=(.*)$/);
		if (m) vars[m[1].trim()] = m[2].trim();
	}
	return vars;
}

async function main() {
	const env = loadEnv();
	process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
	const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const { data: products } = await supabase
		.from('products')
		.select('id, name, description, short_description, base_price, sku')
		.eq('is_active', true);

	let count = 0;
	for (const p of products ?? []) {
		const text = [p.name, p.short_description, p.description, `SKU: ${p.sku}`, `Precio base: $${p.base_price}`]
			.filter(Boolean)
			.join('\n');

		const { data: existing } = await supabase
			.from('knowledge_articles')
			.select('id')
			.eq('product_id', p.id)
			.maybeSingle();

		if (existing) continue;

		let embedding: number[];
		for (let attempt = 0; attempt < 5; attempt++) {
			try {
				embedding = await generateDocumentEmbedding(text);
				break;
			} catch (e: unknown) {
				const err = e as { status?: number };
				if (err.status === 429 && attempt < 4) {
					const wait = 60_000 * (attempt + 1);
					console.log(`⏳ Cuota embeddings, esperando ${wait / 1000}s...`);
					await new Promise((r) => setTimeout(r, wait));
					continue;
				}
				throw e;
			}
		}

		await new Promise((r) => setTimeout(r, 700));
		const { error } = await supabase.from('knowledge_articles').insert({
			title: p.name,
			content: text,
			channel: 'general',
			source_type: 'catalog',
			product_id: p.id,
			embedding,
			is_verified: true
		});

		if (!error) {
			count++;
			console.log(`+ ${p.name}`);
		}
	}

	console.log(`\n✅ ${count} artículos indexados desde catálogo`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
