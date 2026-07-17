import type { PageServerLoad } from './$types';
import { getHeroBannerSettings } from '$lib/server/heroBannerSettings';
import { supabaseServer } from '$lib/supabaseServer';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({
		'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
	});

	const [
		heroBanner,
		promotionsResult,
		categoriesResult,
		productsResult,
		videosResult
	] = await Promise.all([
		getHeroBannerSettings(),
		supabaseServer
			.from('promotions')
			.select('*')
			.eq('is_active', true)
			.order('display_order'),
		supabaseServer.from('categories').select('*').eq('is_active', true).order('display_order'),
		supabaseServer
			.from('products')
			.select('*, product_media(*), categories(*), product_variants(*)')
			.eq('is_featured', true)
			.eq('is_active', true)
			.limit(12),
		supabaseServer
			.from('testimonial_videos')
			.select('*')
			.eq('is_active', true)
			.order('display_order')
	]);

	const featuredProducts = (productsResult.data || []).map((p: any) => ({
		...p,
		media: p.product_media,
		category: p.categories
	}));

	const testimonialVideos = (videosResult.data || []).map((video: any) => ({
		...video,
		video_type: video.video_type === 'tiktok' ? 'tiktok' : 'youtube'
	}));

	return {
		heroBanner,
		promotions: promotionsResult.data || [],
		categories: categoriesResult.data || [],
		featuredProducts,
		testimonialVideos
	};
};
