<script lang="ts">
	interface Props {
		src: string;
		title?: string;
	}

	let { src, title = 'Ubicación Guerra Láser' }: Props = $props();

	let container: HTMLDivElement | undefined = $state();
	let visible = $state(false);

	$effect(() => {
		if (!container) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					visible = true;
					observer.disconnect();
				}
			},
			{ rootMargin: '200px' }
		);

		observer.observe(container);
		return () => observer.disconnect();
	});
</script>

<div bind:this={container} class="w-full h-full min-h-[300px] bg-gray-200 rounded-lg overflow-hidden">
	{#if visible}
		<iframe
			{src}
			width="100%"
			height="100%"
			style="border:0; min-height: 300px;"
			allowfullscreen
			loading="lazy"
			referrerpolicy="no-referrer-when-downgrade"
			{title}
		></iframe>
	{:else}
		<div
			class="w-full h-full min-h-[300px] flex items-center justify-center text-gray-500 text-sm"
			aria-hidden="true"
		>
			Cargando mapa...
		</div>
	{/if}
</div>
