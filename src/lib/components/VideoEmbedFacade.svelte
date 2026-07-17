<script lang="ts">
	interface Props {
		videoUrl: string;
		videoType: 'youtube' | 'tiktok';
		title: string;
		thumbnailUrl?: string | null;
		active?: boolean;
	}

	let { videoUrl, videoType, title, thumbnailUrl = null, active = true }: Props = $props();

	let activated = $state(false);

	$effect(() => {
		if (!active) {
			activated = false;
		}
	});

	function extractYoutubeId(url: string): string | null {
		const patterns = [
			/youtube\.com\/embed\/([^?&/]+)/,
			/youtube\.com\/watch\?v=([^&]+)/,
			/youtu\.be\/([^?&/]+)/,
			/youtube\.com\/shorts\/([^?&/]+)/
		];
		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match?.[1]) return match[1];
		}
		return null;
	}

	const thumbnail = $derived.by(() => {
		if (thumbnailUrl) return thumbnailUrl;
		if (videoType === 'youtube') {
			const id = extractYoutubeId(videoUrl);
			if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
		}
		return null;
	});

	const embedUrl = $derived.by(() => {
		if (!activated) return '';
		const separator = videoUrl.includes('?') ? '&' : '?';
		if (videoType === 'youtube') {
			return `${videoUrl}${separator}autoplay=1`;
		}
		return videoUrl;
	});

	function activate() {
		activated = true;
	}
</script>

<div class="w-full h-full">
	{#if activated}
		<iframe
			src={embedUrl}
			{title}
			class="w-full h-full"
			frameborder="0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
		></iframe>
	{:else}
		<button
			type="button"
			class="relative w-full h-full group cursor-pointer bg-black"
			onclick={activate}
			aria-label="Reproducir {title}"
		>
			{#if thumbnail}
				<img src={thumbnail} alt="" class="w-full h-full object-cover" />
			{:else}
				<div
					class="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-400"
				>
					<svg class="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M8 5v14l11-7z" />
					</svg>
				</div>
			{/if}

			<div
				class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center group-hover:bg-opacity-50 transition-all"
			>
				<div
					class="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg"
				>
					<svg class="w-8 h-8 text-blue-600 ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M8 5v14l11-7z" />
					</svg>
				</div>
			</div>
		</button>
	{/if}
</div>
