import { json, type RequestHandler } from '@sveltejs/kit';
import { getAdminClientAndUser } from '$lib/server/adminAuth';
import { isFullSheetSize, normalizeGrosor, parseSizeFromLabel } from '$lib/acrylicPricing';

type Group = {
	color: string;
	grosor: string;
	color_hex: string;
	image_url: string;
	sheetPrice: number;
	sheetStock: number;
	sheetSku: string;
	sheetName: string;
	keepId?: string;
	cutIds: string[];
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const auth = await getAdminClientAndUser(request);
		if (auth.error) return auth.error;

		const body = await request.json();
		const productId = String(body?.productId || '').trim();
		if (!productId) {
			return json({ success: false, error: 'productId requerido' }, { status: 400 });
		}

		const sb = auth.supabaseAdmin as any;

		const { data: specs, error: specErr } = await sb
			.from('product_specifications')
			.select('specification_key, specification_value')
			.eq('product_id', productId);
		if (specErr) throw specErr;

		const isAcrylic = (specs || []).some(
			(s: any) =>
				String(s.specification_key || '')
					.trim()
					.toLowerCase() === 'tipo_producto' &&
				String(s.specification_value || '')
					.trim()
					.toLowerCase() === 'acrilico'
		);
		if (!isAcrylic) {
			return json(
				{ success: false, error: 'El producto no tiene tipo_producto=acrilico' },
				{ status: 400 }
			);
		}

		const { data: existing, error } = await sb
			.from('product_variants')
			.select('*')
			.eq('product_id', productId);
		if (error) throw error;

		const groups = new Map<string, Group>();

		for (const row of existing || []) {
			const attrs =
				row.attributes && typeof row.attributes === 'object'
					? (row.attributes as Record<string, any>)
					: {};
			const color = String(attrs.color || '').trim() || 'Sin color';
			const grosor = normalizeGrosor(String(attrs.grosor || '')) || 'sin-grosor';
			const key = `${color.toLowerCase()}|${grosor.toLowerCase()}`;
			const parsed = parseSizeFromLabel(String(attrs.tamano || row.name || ''));
			const isSheet =
				attrs.is_sheet === true || (parsed ? isFullSheetSize(parsed.width, parsed.height) : false);

			let g = groups.get(key);
			if (!g) {
				g = {
					color,
					grosor,
					color_hex: String(attrs.color_hex || ''),
					image_url: String(attrs.image_url || ''),
					sheetPrice: 0,
					sheetStock: 0,
					sheetSku: '',
					sheetName: '',
					cutIds: []
				};
				groups.set(key, g);
			}
			if (!g.color_hex && attrs.color_hex) g.color_hex = String(attrs.color_hex);
			if (!g.image_url && attrs.image_url) g.image_url = String(attrs.image_url);

			if (isSheet) {
				g.sheetPrice = Math.max(g.sheetPrice, Number(row.price) || 0);
				g.sheetStock = Number(row.stock_quantity) || g.sheetStock;
				g.sheetSku = row.sku || g.sheetSku;
				g.sheetName = row.name || g.sheetName;
				g.keepId = row.id;
			} else {
				g.sheetPrice = Math.max(g.sheetPrice, Number(row.price) || 0);
				g.cutIds.push(row.id);
			}
		}

		const allCutIds = [...groups.values()].flatMap((g) => g.cutIds);
		const referenced = new Set<string>();
		if (allCutIds.length) {
			const [oi, qi, pos, bi] = await Promise.all([
				sb.from('order_items').select('variant_id').in('variant_id', allCutIds),
				sb.from('quotation_items').select('variant_id').in('variant_id', allCutIds),
				sb.from('pos_sale_items').select('variant_id').in('variant_id', allCutIds),
				sb.from('bundle_items').select('variant_id').in('variant_id', allCutIds)
			]);
			for (const r of [
				...(oi.data || []),
				...(qi.data || []),
				...(pos.data || []),
				...(bi.data || [])
			]) {
				if (r.variant_id) referenced.add(r.variant_id);
			}
		}

		let created = 0;
		let deactivated = 0;
		let deleted = 0;

		for (const g of groups.values()) {
			const colorCode = g.color
				.slice(0, 3)
				.toUpperCase()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/[^A-Z0-9]/g, '');
			const grosorCode = g.grosor.replace(/[^0-9.]/g, '') || 'X';
			const sku =
				g.sheetSku || `MAT-ACR-${colorCode || 'COL'}-${grosorCode}MM-122244`.replace(/MMMM/, 'MM');
			const name = g.sheetName || `${g.color} ${g.grosor} lámina 122x244`;
			const payload = {
				product_id: productId,
				name,
				sku,
				price: g.sheetPrice || 0,
				stock_quantity: g.sheetStock || 0,
				is_active: true,
				attributes: {
					color: g.color,
					color_hex: g.color_hex || undefined,
					grosor: g.grosor,
					image_url: g.image_url || undefined,
					is_sheet: true,
					sheet_width_cm: 122,
					sheet_height_cm: 244
				}
			};

			if (g.keepId) {
				const { error: upErr } = await sb.from('product_variants').update(payload).eq('id', g.keepId);
				if (upErr) throw upErr;
			} else {
				const { error: inErr } = await sb.from('product_variants').insert(payload);
				if (inErr) throw inErr;
				created++;
			}

			const toDelete: string[] = [];
			const toDeactivate: string[] = [];
			for (const id of g.cutIds) {
				if (referenced.has(id)) toDeactivate.push(id);
				else toDelete.push(id);
			}

			if (toDeactivate.length) {
				const { error: dErr } = await sb
					.from('product_variants')
					.update({ is_active: false })
					.in('id', toDeactivate);
				if (dErr) throw dErr;
				deactivated += toDeactivate.length;
			}

			if (toDelete.length) {
				const { error: delErr } = await sb.from('product_variants').delete().in('id', toDelete);
				if (delErr) {
					const { error: fallbackErr } = await sb
						.from('product_variants')
						.update({ is_active: false })
						.in('id', toDelete);
					if (fallbackErr) throw delErr;
					deactivated += toDelete.length;
				} else {
					deleted += toDelete.length;
				}
			}
		}

		const { data: refreshed, error: refreshErr } = await sb
			.from('product_variants')
			.select('*')
			.eq('product_id', productId)
			.eq('is_active', true)
			.order('created_at');
		if (refreshErr) throw refreshErr;

		return json({
			success: true,
			summary: {
				groups: groups.size,
				created,
				deactivated,
				deleted
			},
			variants: refreshed || []
		});
	} catch (error: any) {
		console.error('[acrylic consolidate]', error);
		return json(
			{ success: false, error: error?.message || 'Error al consolidar' },
			{ status: 500 }
		);
	}
};
