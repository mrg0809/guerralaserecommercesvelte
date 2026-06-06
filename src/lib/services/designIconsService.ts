import { supabase } from '$lib/supabaseClient';
import { DESIGN_ICONS_BUCKET, getDesignIconUrl } from '$lib/storage';
import { slugify, filenameToIconName } from '$lib/design-builder/svgValidation';
import type { IconCategory, IconEntry, IconLibrary } from '$lib/types/design-builder';

export interface DesignIconCategoryRow {
	id: string;
	slug: string;
	label: string;
	display_order: number;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface DesignIconRow {
	id: string;
	category_id: string;
	name: string;
	slug: string;
	storage_path: string;
	display_order: number;
	is_active: boolean;
	tags: string[];
	created_at?: string;
	updated_at?: string;
}

function groupIconsByCategory(
	categories: DesignIconCategoryRow[],
	icons: DesignIconRow[]
): IconCategory[] {
	const iconsByCategory = new Map<string, IconEntry[]>();
	for (const icon of icons) {
		const entry: IconEntry = {
			id: icon.id,
			name: icon.name,
			path: getDesignIconUrl(icon.storage_path),
			storagePath: icon.storage_path
		};
		const list = iconsByCategory.get(icon.category_id) ?? [];
		list.push(entry);
		iconsByCategory.set(icon.category_id, list);
	}

	return categories.map((cat) => ({
		id: cat.slug,
		label: cat.label,
		categoryUuid: cat.id,
		icons: (iconsByCategory.get(cat.id) ?? []).sort((a, b) => a.name.localeCompare(b.name))
	}));
}

export async function fetchIconLibrary(activeOnly = true): Promise<IconLibrary> {
	let catQuery = supabase
		.from('design_icon_categories')
		.select('id, slug, label, display_order, is_active')
		.order('display_order');

	if (activeOnly) {
		catQuery = catQuery.eq('is_active', true);
	}

	const { data: categories, error: catError } = await catQuery;
	if (catError) throw new Error(catError.message);

	let iconQuery = supabase
		.from('design_icons')
		.select('id, category_id, name, slug, storage_path, display_order, is_active, tags')
		.order('display_order');

	if (activeOnly) {
		iconQuery = iconQuery.eq('is_active', true);
	}

	const { data: icons, error: iconError } = await iconQuery;
	if (iconError) throw new Error(iconError.message);

	const activeCategoryIds = new Set((categories ?? []).map((c) => c.id));
	const filteredIcons = (icons ?? []).filter((i) => activeCategoryIds.has(i.category_id));

	return {
		categories: groupIconsByCategory(
			(categories ?? []) as DesignIconCategoryRow[],
			filteredIcons as DesignIconRow[]
		)
	};
}

export async function fetchAllCategoriesAdmin(): Promise<DesignIconCategoryRow[]> {
	const { data, error } = await supabase
		.from('design_icon_categories')
		.select('*')
		.order('display_order');
	if (error) throw new Error(error.message);
	return (data ?? []) as DesignIconCategoryRow[];
}

export async function fetchAllIconsAdmin(categoryId?: string): Promise<DesignIconRow[]> {
	let query = supabase.from('design_icons').select('*').order('display_order');
	if (categoryId) query = query.eq('category_id', categoryId);
	const { data, error } = await query;
	if (error) throw new Error(error.message);
	return (data ?? []) as DesignIconRow[];
}

export async function createCategory(input: {
	label: string;
	slug?: string;
	display_order?: number;
}): Promise<DesignIconCategoryRow> {
	const slug = input.slug?.trim() || slugify(input.label);
	const { data, error } = await supabase
		.from('design_icon_categories')
		.insert({
			label: input.label.trim(),
			slug,
			display_order: input.display_order ?? 0,
			is_active: true
		})
		.select()
		.single();
	if (error) throw new Error(error.message);
	return data as DesignIconCategoryRow;
}

export async function updateCategory(
	id: string,
	input: Partial<Pick<DesignIconCategoryRow, 'label' | 'slug' | 'display_order' | 'is_active'>>
): Promise<void> {
	const { error } = await supabase.from('design_icon_categories').update(input).eq('id', id);
	if (error) throw new Error(error.message);
}

export async function deleteCategory(id: string): Promise<void> {
	const icons = await fetchAllIconsAdmin(id);
	for (const icon of icons) {
		await deleteIcon(icon.id, icon.storage_path);
	}
	const { error } = await supabase.from('design_icon_categories').delete().eq('id', id);
	if (error) throw new Error(error.message);
}

export async function uploadIcon(input: {
	file: File;
	categoryId: string;
	categorySlug: string;
	name: string;
	slug?: string;
	display_order?: number;
}): Promise<DesignIconRow> {
	const iconSlug = input.slug?.trim() || slugify(input.name);
	const storagePath = `${input.categorySlug}/${iconSlug}.svg`;

	const { error: uploadError } = await supabase.storage
		.from(DESIGN_ICONS_BUCKET)
		.upload(storagePath, input.file, {
			contentType: 'image/svg+xml',
			cacheControl: '3600',
			upsert: true
		});

	if (uploadError) throw new Error(uploadError.message);

	const { data, error: insertError } = await supabase
		.from('design_icons')
		.insert({
			category_id: input.categoryId,
			name: input.name.trim(),
			slug: iconSlug,
			storage_path: storagePath,
			display_order: input.display_order ?? 0,
			is_active: true,
			tags: []
		})
		.select()
		.single();

	if (insertError) {
		await supabase.storage.from(DESIGN_ICONS_BUCKET).remove([storagePath]);
		throw new Error(insertError.message);
	}

	return data as DesignIconRow;
}

export interface BatchUploadResult {
	uploaded: number;
	failed: { filename: string; error: string }[];
}

export async function uploadIconsBatch(input: {
	files: File[];
	categoryId: string;
	categorySlug: string;
	startOrder?: number;
}): Promise<BatchUploadResult> {
	const result: BatchUploadResult = { uploaded: 0, failed: [] };
	const usedSlugs = new Set<string>();
	let order = input.startOrder ?? 0;

	for (const file of input.files) {
		const name = filenameToIconName(file.name);
		let slug = slugify(file.name.replace(/\.svg$/i, ''));
		while (usedSlugs.has(slug)) {
			slug = `${slug}-${usedSlugs.size}`;
		}
		usedSlugs.add(slug);

		try {
			await uploadIcon({
				file,
				categoryId: input.categoryId,
				categorySlug: input.categorySlug,
				name,
				slug,
				display_order: order
			});
			result.uploaded++;
			order++;
		} catch (e) {
			result.failed.push({
				filename: file.name,
				error: e instanceof Error ? e.message : 'Error desconocido'
			});
		}
	}

	return result;
}

export async function updateIcon(
	id: string,
	input: Partial<Pick<DesignIconRow, 'name' | 'category_id' | 'display_order' | 'is_active' | 'tags'>>
): Promise<void> {
	const { error } = await supabase.from('design_icons').update(input).eq('id', id);
	if (error) throw new Error(error.message);
}

export async function deleteIcon(id: string, storagePath?: string): Promise<void> {
	if (storagePath) {
		await supabase.storage.from(DESIGN_ICONS_BUCKET).remove([storagePath]);
	}
	const { error } = await supabase.from('design_icons').delete().eq('id', id);
	if (error) throw new Error(error.message);
}

export function iconPublicUrl(storagePath: string): string {
	return getDesignIconUrl(storagePath);
}
