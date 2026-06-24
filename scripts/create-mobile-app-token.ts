/**
 * Genera un token para el APK móvil y lo guarda hasheado en Supabase.
 * Uso: npx tsx scripts/create-mobile-app-token.ts
 */
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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

function hashToken(token: string) {
	return createHash('sha256').update(token.trim()).digest('hex');
}

async function main() {
	const env = loadEnv();
	const url = env.PUBLIC_SUPABASE_URL;
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');

	const supabase = createClient(url, key);
	const plainToken = `gl_mob_${randomBytes(32).toString('hex')}`;

	await supabase.from('mobile_app_tokens').update({ is_active: false }).eq('is_active', true);

	const { error } = await supabase.from('mobile_app_tokens').insert({
		label: 'Equipo Guerra Láser',
		token_hash: hashToken(plainToken),
		is_active: true
	});

	if (error) throw error;

	console.log('\n✅ Token móvil creado (guárdalo ahora, no se mostrará de nuevo):\n');
	console.log(plainToken);
	console.log('\nAñade a .env:\n');
	console.log(`PUBLIC_MOBILE_APP_TOKEN=${plainToken}\n`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
