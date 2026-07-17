<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getHeroDesktopMediaUrl,
		getHeroMobileImageUrl,
		getHeroMobileVideoPosterUrl,
		getHeroMobileVideoUrl,
		getImageKitUrl
	} from '$lib/storage';
	import type { HeroBannerSettings } from '$lib/heroBanner';

	interface Props {
		config: HeroBannerSettings;
	}

	let { config }: Props = $props();

	type Viewport = 'mobile' | 'desktop';
	let viewport = $state<Viewport>('mobile');

	const bannerAlt = $derived(config.title || 'Guerra Láser');

	const mobileMediaPath = $derived(
		config.mobile_url || (config.media_type === 'image' ? config.desktop_url : '')
	);

	const mobileVideoUrl = $derived(
		config.mobile_media_type === 'video' && mobileMediaPath
			? getHeroMobileVideoUrl(mobileMediaPath)
			: ''
	);

	const mobileVideoPosterUrl = $derived(
		config.mobile_media_type === 'video' && mobileMediaPath
			? getHeroMobileVideoPosterUrl(mobileMediaPath)
			: ''
	);

	const mobileImageUrl = $derived(
		config.mobile_media_type === 'image'
			? getHeroMobileImageUrl(mobileMediaPath, config.desktop_url)
			: ''
	);

	const desktopVideoUrl = $derived(
		config.media_type === 'video' && config.desktop_url
			? getImageKitUrl(config.desktop_url)
			: ''
	);

	const desktopImageUrl = $derived(
		config.media_type === 'image' && config.desktop_url
			? getHeroDesktopMediaUrl(config.desktop_url, 'image')
			: ''
	);

	onMount(() => {
		const mediaQuery = window.matchMedia('(min-width: 768px)');
		const updateViewport = () => {
			viewport = mediaQuery.matches ? 'desktop' : 'mobile';
		};

		updateViewport();
		mediaQuery.addEventListener('change', updateViewport);

		return () => {
			mediaQuery.removeEventListener('change', updateViewport);
		};
	});
</script>

<section class="relative w-full h-[500px] overflow-hidden">
	{#if viewport === 'mobile'}
		{#if config.mobile_media_type === 'video' && mobileVideoUrl}
			{#if mobileVideoPosterUrl}
				<img
					src={mobileVideoPosterUrl}
					alt={bannerAlt}
					class="absolute inset-0 w-full h-full object-cover"
					fetchpriority="high"
					loading="eager"
					width="800"
					height="500"
				/>
			{/if}
			<video
				autoplay
				loop
				muted
				playsinline
				preload="metadata"
				poster={mobileVideoPosterUrl}
				class="absolute inset-0 w-full h-full object-cover"
				aria-label={bannerAlt}
			>
				<source src={mobileVideoUrl} type="video/mp4" />
				Tu navegador no soporta el elemento de video.
			</video>
		{:else if mobileImageUrl}
			<img
				src={mobileImageUrl}
				alt={bannerAlt}
				class="absolute inset-0 w-full h-full object-cover"
				fetchpriority="high"
				loading="eager"
				width="800"
				height="500"
			/>
		{/if}
	{:else if config.media_type === 'video' && desktopVideoUrl}
		<video
			autoplay
			loop
			muted
			playsinline
			class="absolute inset-0 w-full h-full object-cover"
			aria-label={bannerAlt}
		>
			<source src={desktopVideoUrl} type="video/mp4" />
			Tu navegador no soporta el elemento de video.
		</video>
	{:else if config.media_type === 'image' && desktopImageUrl}
		<img
			src={desktopImageUrl}
			alt={bannerAlt}
			class="absolute inset-0 w-full h-full object-cover"
			width="1920"
			height="500"
		/>
	{/if}

	{#if config.show_overlay_text}
		<div class="absolute inset-0 bg-blue-900 bg-opacity-30"></div>

		<div
			class="relative z-10 container mx-auto px-4 h-full flex flex-col items-center justify-center text-center text-white"
		>
			<h1 class="text-5xl md:text-6xl font-bold mb-6 drop-shadow-lg">{config.title}</h1>
			{#if config.subtitle}
				<p class="text-xl md:text-2xl drop-shadow-lg">{config.subtitle}</p>
			{/if}
		</div>
	{/if}
</section>
