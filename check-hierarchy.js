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

// Función para resolver categoría con herencia
function resolveGoogleCategory(categories, categoryId) {
  if (!categoryId) return null;
  
  let current = categories.find(c => c.id === categoryId);
  const path = [];
  
  while (current) {
    path.push(current.name);
    if (current.google_category_id) {
      return { category: current, path: path.reverse() };
    }
    if (current.parent_id) {
      current = categories.find(c => c.id === current.parent_id);
    } else {
      break;
    }
  }
  
  return { category: null, path: path.reverse() };
}

console.log('\n=== EJEMPLOS DE HERENCIA JERÁRQUICA ===\n');

// Ejemplos específicos
const examples = [
  'refacciones-y-consumibles-tubos-laser-tubos-reci',
  'refacciones-y-consumibles-tubos-laser-tubos-efr',
  'joyeria-plata-925-anillos',
  'maquinas-laser-co2-industriales'
];

examples.forEach(slug => {
  const cat = data.find(c => c.slug === slug);
  if (cat) {
    const result = resolveGoogleCategory(data, cat.id);
    if (result.category) {
      console.log(`✅ ${cat.name}`);
      console.log(`   Ruta: ${result.path.join(' → ')}`);
      console.log(`   Google ID: ${result.category.google_category_id} (heredado de "${result.category.name}")`);
      console.log('');
    } else {
      console.log(`❌ ${cat.name}`);
      console.log(`   Ruta: ${result.path.join(' → ')}`);
      console.log(`   Sin mapeo en toda la jerarquía`);
      console.log('');
    }
  }
});

console.log('\n=== RESUMEN ===\n');

let withDirectMapping = 0;
let withInheritedMapping = 0;
let withoutMapping = 0;

data.forEach(cat => {
  if (cat.google_category_id) {
    withDirectMapping++;
  } else {
    const result = resolveGoogleCategory(data, cat.id);
    if (result.category) {
      withInheritedMapping++;
    } else {
      withoutMapping++;
    }
  }
});

console.log(`✅ Categorías con mapeo directo: ${withDirectMapping}`);
console.log(`✅ Categorías con mapeo heredado: ${withInheritedMapping}`);
console.log(`⚠️  Categorías sin mapeo: ${withoutMapping}`);
console.log(`\nTotal: ${data.length} categorías`);
