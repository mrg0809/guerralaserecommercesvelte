import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from('categories')
  .select('id, name, slug, google_category_id, google_category_name, parent_id')
  .order('name');

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log('\n=== CATEGORÍAS CON MAPEO ===\n');
const withMapping = data.filter(c => c.google_category_id);
withMapping.forEach(c => {
  console.log(`✅ ${c.name} (${c.slug}) → Google ID: ${c.google_category_id}`);
});

console.log(`\nTotal: ${withMapping.length} categorías mapeadas`);

console.log('\n=== CATEGORÍAS SIN MAPEO ===\n');
const withoutMapping = data.filter(c => !c.google_category_id);
withoutMapping.forEach(c => {
  console.log(`⚠️  ${c.name} → slug: "${c.slug}"`);
});

console.log(`\nTotal: ${withoutMapping.length} categorías sin mapear`);
