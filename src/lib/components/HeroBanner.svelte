<script lang="ts">
	import {
		getHeroDesktopMediaUrl,
		getHeroMobileImageUrl,
		getHeroMobileVideoUrl,
		getImageKitUrl
	} from '$lib/storage';
	import type { HeroBannerSettings } from '$lib/heroBanner';

	interface Props {
		config: HeroBannerSettings;
	}

	let { config }: Props = $props();

	const mobileMediaPath = $derived(
		config.mobile_url || (config.media_type === 'image' ? config.desktop_url : '')
	);

	const mobileVideoUrl = $derived(
		config.mobile_media_type === 'video' && mobileMediaPath
			? getHeroMobileVideoUrl(mobileMediaPath)
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
</script>

<section class="relative w-full h-[500px] overflow-hidden">
	{#if config.mobile_media_type === 'video' && mobileVideoUrl}
		<video
			autoplay
			loop
			muted
			playsinline
			preload="auto"
			class="absolute inset-0 w-full h-full object-cover md:hidden"
		>
			<source src={mobileVideoUrl} type="video/mp4" />
			Tu navegador no soporta el elemento de video.
		</video>
	{:else if mobileImageUrl}
		<img
			src={mobileImageUrl}
			alt={config.title}
			class="absolute inset-0 w-full h-full object-cover md:hidden"
			fetchpriority="high"
			width="800"
			height="500"
		/>
	{/if}

	{#if config.media_type === 'video' && desktopVideoUrl}
		<video
			autoplay
			loop
			muted
			playsinline
			class="absolute inset-0 w-full h-full object-cover hidden md:block"
		>
			<source src={desktopVideoUrl} type="video/mp4" />
			Tu navegador no soporta el elemento de video.
		</video>
	{:else if config.media_type === 'image' && desktopImageUrl}
		<img
			src={desktopImageUrl}
			alt={config.title}
			class="absolute inset-0 w-full h-full object-cover hidden md:block"
			width="1920"
			height="500"
		/>
	{/if}

	<div class="absolute inset-0 bg-blue-900 bg-opacity-30"></div>

	<div
		class="relative z-10 container mx-auto px-4 h-full flex flex-col items-center justify-center text-center text-white"
	>
		<h1 class="text-5xl md:text-6xl font-bold mb-6 drop-shadow-lg">{config.title}</h1>
		{#if config.subtitle}
			<p class="text-xl md:text-2xl drop-shadow-lg">{config.subtitle}</p>
		{/if}
	</div>
</section>
