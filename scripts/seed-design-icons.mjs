#!/usr/bin/env node
/**
 * Sube los SVG de static/design-icons/ al bucket design-icons de Supabase.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-design-icons.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const iconsDir = join(root, 'static', 'design-icons');

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
	console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
	process.exit(1);
}

const supabase = createClient(url, key, {
	auth: { autoRefreshToken: false, persistSession: false }
});

function walkSvgs(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			out.push(...walkSvgs(full));
		} else if (name.endsWith('.svg')) {
			out.push(relative(iconsDir, full).replace(/\\/g, '/'));
		}
	}
	return out;
}

const paths = walkSvgs(iconsDir);
console.log(`Subiendo ${paths.length} SVG(s)...`);

for (const storagePath of paths) {
	const body = readFileSync(join(iconsDir, storagePath));
	const { error } = await supabase.storage.from('design-icons').upload(storagePath, body, {
		contentType: 'image/svg+xml',
		upsert: true
	});
	if (error) {
		console.error(`  FAIL ${storagePath}:`, error.message);
	} else {
		console.log(`  OK   ${storagePath}`);
	}
}

console.log('Listo.');
