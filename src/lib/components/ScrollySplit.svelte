<script context="module" lang="ts">
	export type { Step } from './scrolly/utils.ts';
</script>

<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { SvelteSet } from 'svelte/reactivity';

	import ScrollySplitStep from './ScrollySplitStep.svelte';
	import { type Step, toNum, toMedia, tryParseStepsFromBodyHtml } from './scrolly/utils.ts';

	// ---- Props ----

	export let steps: Step[] | undefined;
	export let bodyHtml: string | undefined;

	export let vhPerStep: number | string | undefined = 110;
	export let fadeMs: number | string | undefined = 500;
	export let header: string | undefined;
	export let videoTopPx: number | string | undefined = 0;

	// ---- Derived ----

	$: stepHeightVh = toNum(vhPerStep, 120);
	$: fadeDurationMs = toNum(fadeMs, 500);
	$: videoTop = toNum(videoTopPx, 0);

	$: resolvedSteps =
		(steps && steps.length ? steps : null) ?? tryParseStepsFromBodyHtml(bodyHtml) ?? [];

	// ---- Video state ----

	let bgIndex = 0;
	let loadedIndices: SvelteSet<number>;
	let videoProgress: number[];

	let sectionEl: HTMLElement | null = null;
	let videoEls: (HTMLVideoElement | null)[] = [];
	let sentinelEl: HTMLElement | null = null;
	let videoInnerEl: HTMLElement | null = null;
	let layerEls: (HTMLElement | null)[] = [];
	let videoBox = { top: 0, left: 0, width: 0, height: 0 };
	let slideDistancePx: number = 0;

	async function showStep(newIndex: number) {
		if (!resolvedSteps.length) return;
		const clamped = Math.max(0, Math.min(newIndex, resolvedSteps.length - 1));

		const next = new SvelteSet(loadedIndices);
		for (const n of [clamped - 1, clamped, clamped + 1]) {
			if (n >= 0 && n < resolvedSteps.length) next.add(n);
		}
		loadedIndices = next;
		bgIndex = clamped;

		await tick();

		// Only play if section is actually in the viewport
		const inView = sectionEl
			? sectionEl.getBoundingClientRect().bottom > 0 &&
			  sectionEl.getBoundingClientRect().top < window.innerHeight
			: false;

		for (let i = 0; i < videoEls.length; i++) {
			const el = videoEls[i];
			if (!el) continue;
			if (i === clamped && inView) {
				el.loop = true;
				try {
					const p = el.play();
					if (p) p.catch(() => {});
				} catch { /* noop */ }
			} else {
				el.pause();
			}
		}
	}

	// ---- Scroll logic ----

	let textBoxEls: (HTMLElement | null)[] = [];
	let rafPending = false;

	function computeProgressAndActive() {
		if (!resolvedSteps.length) return;

		const vh = window.innerHeight;
		if (videoInnerEl) {
			const rect = videoInnerEl.getBoundingClientRect();
			videoBox = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
			slideDistancePx = vh - rect.top;
		}

		const triggerBottom = vh * 1;
		const triggerTop = videoBox.top > 0 ? videoBox.top : videoTop;

		let newActive = 0;
		const newProgress = resolvedSteps.map((_, i) => {
			if (i === 0) return 0;

			const el = textBoxEls[i];
			if (!el) return 1;

			const cardTop = el.getBoundingClientRect().top;

			if (cardTop >= triggerBottom) return 1;
			if (cardTop <= triggerTop) return 0;

			const range = triggerBottom - triggerTop;
			return (cardTop - triggerTop) / range;
		});

		for (let i = 0; i < newProgress.length; i++) {
			if (newProgress[i] < 1) newActive = i;
		}

		videoProgress = newProgress;

		for (let i = 0; i < newProgress.length - 1; i++) {
			const el = layerEls[i];
			if (!el) continue;
			const coveredByAbove = newProgress.slice(i + 1).some(p => p === 0);
			el.style.visibility = coveredByAbove ? 'hidden' : 'visible';
		}

		if (newActive !== bgIndex) showStep(newActive);
	}

	function updateFromScroll() {
		rafPending = false;
		computeProgressAndActive();
	}

	function onScrollOrResize() {
		if (!browser || rafPending) return;
		rafPending = true;
		requestAnimationFrame(updateFromScroll);
	}

	// ---- Sentinel measurement ----

	function measureSentinel() {
		if (!sentinelEl || !browser) return;
		const lastIdx = resolvedSteps.length - 1;
		const lastCard = textBoxEls[lastIdx];
		if (!lastCard || !sectionEl) return;

		const sectionTop = sectionEl.getBoundingClientRect().top + window.scrollY;
		const cardTop = lastCard.getBoundingClientRect().top + window.scrollY;

		const currentSectionHeight = sectionEl.offsetHeight;
		const neededSectionHeight = (cardTop - sectionTop) + window.innerHeight - (2 * videoTop);
		const sentinelHeight = Math.max(0, neededSectionHeight - currentSectionHeight + sentinelEl.offsetHeight);

		sentinelEl.style.height = sentinelHeight + 'px';
	}

	// ---- Init when steps change ----

	$: if (resolvedSteps.length) {
		bgIndex = 0;
		loadedIndices = new SvelteSet([0, 1].filter(i => i < resolvedSteps.length));
		textBoxEls.length = resolvedSteps.length;
		videoEls.length = resolvedSteps.length;
		layerEls.length = resolvedSteps.length;
		videoProgress = resolvedSteps.map((_, i) => (i === 0 ? 0 : 1));
	} else {
		bgIndex = 0;
		loadedIndices = new SvelteSet();
		textBoxEls = [];
		videoEls = [];
		layerEls = [];
		videoProgress = [];
	}

	// ---- Lifecycle ----

	let observer: IntersectionObserver | null = null;
	let visibilityObserver: IntersectionObserver | null = null;

	onMount(() => {
		if (!browser) return;
		window.addEventListener('scroll', onScrollOrResize, { passive: true });
		window.addEventListener('resize', onScrollOrResize);
		window.addEventListener('resize', measureSentinel);

		observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0].isIntersecting) return;
				observer?.disconnect();
				observer = null;
				onScrollOrResize();
				requestAnimationFrame(measureSentinel);
			},
			{ rootMargin: '400px 0px' }
		);

		showStep(0);
		if (sectionEl) observer.observe(sectionEl);

		visibilityObserver = new IntersectionObserver(
			(entries) => {
				const inView = entries[0].isIntersecting;
				document.body.classList.toggle('scrolly-split-active', inView);
				if (inView) {
					showStep(bgIndex);
				} else {
					videoEls.forEach(el => el?.pause());
				}
			},
			{ threshold: 0 }
		);
		if (sectionEl) visibilityObserver.observe(sectionEl);
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('scroll', onScrollOrResize);
			window.removeEventListener('resize', onScrollOrResize);
			window.removeEventListener('resize', measureSentinel);
			document.body.classList.remove('scrolly-split-active');
		}
		observer?.disconnect();
		visibilityObserver?.disconnect();
	});
</script>

{#if resolvedSteps.length}
	<section
		bind:this={sectionEl}
		class="scrolly-split full-bleed"
		style="--fade-ms:{fadeDurationMs}ms; --video-top:{videoTop}px;"
	>
		<div class="split-body">
			<div class="split-text">
				{#each resolvedSteps as step, i (i)}
					<ScrollySplitStep
						{step}
						{stepHeightVh}
						active={i === bgIndex}
						bind:textBoxEl={textBoxEls[i]}
					/>
				{/each}
				<div class="split-text-sentinel" bind:this={sentinelEl} aria-hidden="true"></div>
			</div>

			<div class="split-video-col">
				<div class="split-video-group">
					{#if header}
						<h2 class="split-video-header">{header}</h2>
					{/if}
					<div class="split-video-inner" bind:this={videoInnerEl}>
					{#each resolvedSteps as step, i (i)}
						{@const m = toMedia(step)}
						<div
							class="video-layer"
							bind:this={layerEls[i]}
							style="position: fixed; 
							top: {videoBox.top}px; 
							left: {videoBox.left}px; 
							width: {videoBox.width}px; 
							height: {videoBox.height}px; 
							transform: translateY({(videoProgress[i] ?? (i === 0 ? 0 : 1)) * slideDistancePx}px); 
							z-index: {i + 1}; overflow: hidden; display: {videoBox.width === 0 ? 'none' : 'block'}; 
							border: 15px solid #fff; 
							box-sizing: border-box;"
						>
							{#if loadedIndices.has(i)}
								{#if m.kind === 'image'}
									<div
										class="video-media image"
										style="background-image:url('{encodeURI(m.url)}')"
									></div>
								{:else}
									<video
										class="video-media"
										bind:this={videoEls[i]}
										src={m.url}
										muted
										playsinline
										preload="metadata"
										loop
									></video>
								{/if}
							{/if}
						</div>
					{/each}
					</div>
				</div>
			</div>
		</div>
	</section>
{/if}

<style>
	.scrolly-split {
		position: relative;
		margin-top: 10rem;
		margin-bottom: 10rem;
	}

	.split-video-header {
		margin: 0 0 1rem 0;
		font-size: 2rem;
		font-family: Azeret Mono, monospace;
		font-weight: 600;
		padding: 0 2.5rem 0 0;
		text-align: left;
	}

	.split-body {
		display: grid;
		grid-template-columns: 410px 1fr;
		gap: 1rem;
		align-items: start;
	}

	.split-text {
		position: relative;
		z-index: 2;
		pointer-events: none;
		margin-left: 1rem;
	}

	.split-text :global(.step-card) {
		pointer-events: auto;
	}

	.split-video-col {
		position: sticky;
		top: var(--video-top);
		align-self: start;
		height: calc(100vh - var(--video-top));
		padding: 0rem 2rem 3rem 1rem;
		box-sizing: border-box;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.split-video-group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: 100%;
	}

	.split-video-inner {
		position: relative;
		height: calc(100vh - var(--video-top) - 7rem);
		width: calc((100vh - var(--video-top) - 7rem) * (12 / 9));
		max-width: 100%;
		overflow: hidden;
		box-shadow: 10px 15px 32px rgba(0,0,0,0.18);
	}

	.video-layer {
		position: fixed;
		inset: 0;
		will-change: transform;
	}

	.video-media {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}

	.video-media.image {
		background-size: cover;
		background-position: center;
	}

	.split-text-sentinel {
		height: 0;
	}

	@media (max-width: 768px) {
		.split-body {
			grid-template-columns: 1fr;
		}

		.split-video-col {
			position: relative;
			top: 0;
			height: auto;
			padding: 0 0 1rem 0;
		}

		.split-video-inner {
			aspect-ratio: 12 / 9;
			width: 100%;
			max-height: none;
		}

		.split-text {
			padding: 0;
		}
	}
</style>