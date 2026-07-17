<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getHeroDesktopMediaUrl,
		getHeroLcpImageUrl,
		getHeroMobileVideoUrl,
		getImageKitUrl
	} from '$lib/storage';
	import type { HeroBannerSettings } from '$lib/heroBanner';

	interface Props {
		config: HeroBannerSettings;
		lcpImageUrl?: string;
	}

	let { config, lcpImageUrl: lcpImageUrlProp }: Props = $props();

	type Viewport = 'mobile' | 'desktop';
	let viewport = $state<Viewport>('mobile');
	let showMobileVideo = $state(false);
	let mobileVideoRef = $state<HTMLVideoElement | null>(null);

	const bannerAlt = $derived(config.title || 'Guerra Láser');

	const mobileMediaPath = $derived(
		config.mobile_url || (config.media_type === 'image' ? config.desktop_url : '')
	);

	const lcpImageUrl = $derived(lcpImageUrlProp || getHeroLcpImageUrl(config));

	const mobileVideoUrl = $derived(
		config.mobile_media_type === 'video' && mobileMediaPath
			? getHeroMobileVideoUrl(mobileMediaPath)
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

		if (config.mobile_media_type === 'video' && mobileVideoUrl) {
			const mountVideo = () => {
				showMobileVideo = true;
			};

			if (document.readyState === 'complete') {
				mountVideo();
			} else {
				window.addEventListener('load', mountVideo, { once: true });
			}
		}

		return () => {
			mediaQuery.removeEventListener('change', updateViewport);
		};
	});

	$effect(() => {
		if (showMobileVideo && mobileVideoRef) {
			mobileVideoRef.preload = 'auto';
			void mobileVideoRef.play().catch(() => {});
		}
	});
</script>

<section class="relative w-full h-[500px] overflow-hidden">
	{#if viewport === 'mobile'}
		{#if lcpImageUrl}
			<img
				src={lcpImageUrl}
				alt={bannerAlt}
				class="absolute inset-0 w-full h-full object-cover"
				loading="eager"
				fetchpriority="high"
				decoding="sync"
				width="412"
				height="260"
				sizes="100vw"
			/>
		{/if}
		{#if showMobileVideo && mobileVideoUrl}
			<video
				bind:this={mobileVideoRef}
				autoplay
				loop
				muted
				playsinline
				preload="none"
				poster={lcpImageUrl}
				class="absolute inset-0 w-full h-full object-cover"
				aria-label={bannerAlt}
			>
				<source src={mobileVideoUrl} type="video/mp4" />
				Tu navegador no soporta el elemento de video.
			</video>
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
