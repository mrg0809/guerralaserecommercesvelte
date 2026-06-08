<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Canvas as FabricCanvas } from 'fabric';
	import { createDesignCanvas, resizeDesignCanvas } from '$lib/design-builder/fabricCanvas';

	interface Props {
		widthMm: number;
		heightMm: number;
		onReady?: (canvas: FabricCanvas) => void;
	}

	let { widthMm, heightMm, onReady }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let fabricCanvas: FabricCanvas | null = $state(null);

	onMount(() => {
		if (!canvasEl) return;
		fabricCanvas = createDesignCanvas(canvasEl, widthMm, heightMm);
		onReady?.(fabricCanvas);
	});

	onDestroy(() => {
		fabricCanvas?.dispose();
		fabricCanvas = null;
	});

	$effect(() => {
		if (fabricCanvas && widthMm > 0 && heightMm > 0) {
			resizeDesignCanvas(fabricCanvas, widthMm, heightMm);
		}
	});
</script>

<div class="overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
	<div
		class="mx-auto inline-block shadow-md"
		style="width: {widthMm * 3.7795275591}px; height: {heightMm * 3.7795275591}px;"
	>
		<canvas bind:this={canvasEl}></canvas>
	</div>
</div>
