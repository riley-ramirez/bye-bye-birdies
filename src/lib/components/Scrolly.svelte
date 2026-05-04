<script context="module" lang="ts">
	export type { Step } from './scrolly/utils.ts';
</script>

<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { fade } from 'svelte/transition';

	import ScrollyStep from './scrolly/ScrollyStep.svelte';
	import {
		type Step,
		POS_CLASS,
		toNum,
		toMedia,
		tryParseStepsFromBodyHtml
	} from './scrolly/utils.ts';

	// ---- Props ----

	export let steps: Step[] | undefined;
	export let bodyHtml: string | undefined;

	/** Minimum height of each step in vh. */
	export let vhPerStep: number | string | undefined = 100;

	/** Crossfade duration in ms. */
	export let fadeMs: number | string | undefined = 600;

	/** How far up from the bottom the text box sits (vh). 0 = bottom edge. */
	export let textOffsetFromBottomVh: number | string | undefined = 0;

	/**
	 * Fraction of the viewport height (0–1) the last text box must reach before
	 * the background un-sticks and scrolls away with the content.
	 */
	export let lastCarryPoint: number | string | undefined = 0.5;

	// ---- Derived numeric values ----

	$: stepHeightVh = toNum(vhPerStep, 100);
	$: fadeDurationMs = toNum(fadeMs, 600);
	$: textBottomVh = toNum(textOffsetFromBottomVh, 0);
	$: carryPoint = Math.max(0, Math.min(1, toNum(lastCarryPoint, 0.5)));

	// ---- Step resolution ----

	$: resolvedSteps =
		(steps && steps.length ? steps : null) ?? tryParseStepsFromBodyHtml(bodyHtml) ?? [];

	// ---- Background crossfade state ----

	let bgIndex = 0;
	let loadedIndices: Set<number> = new Set();
	let nearViewport = false;

	$: activeAlt = resolvedSteps[bgIndex] ? toMedia(resolvedSteps[bgIndex]).alt : '';

	// ---- DOM refs ----

	let sectionEl: HTMLElement | null = null;
	let textBoxEls: (HTMLElement | null)[] = [];
	let videoEls: (HTMLVideoElement | null)[] = [];
	let overlayVideoEl: HTMLVideoElement | null = null;

	// ---- Per-step video play state ----

	let videoStates: Record<number, 'idle' | 'playing' | 'ended'> = {};

	function stepHasVideoButton(i: number): boolean {
		const step = resolvedSteps[i];
		return !!step?.videoActionText && toMedia(step).kind === 'video';
	}

	async function ensureVideoPlaying(el: HTMLVideoElement | null, stepIndex: number) {
		if (!el) return;
		if (stepHasVideoButton(stepIndex) && (videoStates[stepIndex] ?? 'idle') === 'idle') return;
		if (resolvedSteps[stepIndex]?.pause) return;
		try {
			await tick();
			const p = el.play();
			if (p && typeof (p as Promise<void>).catch === 'function')
				(p as Promise<void>).catch(() => {});
		} catch {
			/* empty */
		}
	}

	function handleVideoEnded(stepIndex: number) {
		if (stepHasVideoButton(stepIndex)) {
			videoStates = { ...videoStates, [stepIndex]: 'ended' };
		}
	}

	async function handleStepVideoPlay(stepIndex: number) {
		const el = videoEls[stepIndex];
		if (!el) return;

		const state = videoStates[stepIndex] ?? 'idle';

		if (state === 'playing') {
			el.pause();
			videoStates = { ...videoStates, [stepIndex]: 'idle' };
			return;
		}

		el.loop = false;
		if (state === 'ended') el.currentTime = 0;

		videoStates = { ...videoStates, [stepIndex]: 'playing' };
		try {
			await tick();
			const p = el.play();
			if (p && typeof (p as Promise<void>).catch === 'function')
				(p as Promise<void>).catch(() => {});
		} catch {
			/* empty */
		}
	}

	// ---- Step transition ----

	function isSectionInView(): boolean {
		if (!sectionEl) return false;
		const rect = sectionEl.getBoundingClientRect();
		return rect.top < window.innerHeight && rect.bottom > 0;
	}

	async function showStep(newIndex: number) {
		if (!resolvedSteps.length) return;

		const clamped = Math.max(0, Math.min(newIndex, resolvedSteps.length - 1));
		if (clamped === bgIndex && loadedIndices.has(clamped)) {
			if (isSectionInView()) {
				const el = videoEls[clamped];
				if (el) {
					el.loop = false;
					await ensureVideoPlaying(el, clamped);
				}
			}
			return;
		}

		// Pause and reset outgoing step's video
		const prevEl = videoEls[bgIndex];
		if (prevEl) {
			prevEl.pause();
			prevEl.currentTime = 0;
		}
		if (stepHasVideoButton(bgIndex)) {
			videoStates = { ...videoStates, [bgIndex]: 'idle' };
		}

		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- SvelteSet.add() is not picked up by legacy {#if} blocks; plain Set + reassignment is required here.
		const next = new Set(loadedIndices);
		for (const n of [clamped - 1, clamped, clamped + 1]) {
			if (n >= 0 && n < resolvedSteps.length) next.add(n);
		}
		loadedIndices = next;
		bgIndex = clamped;

		await tick();

		const el = videoEls[clamped];
		if (el) {
			if (resolvedSteps[clamped]?.pause) {
				el.pause();
				el.currentTime = 0;
			} else {
				el.loop = !resolvedSteps[clamped].videoActionText;
				await ensureVideoPlaying(el, clamped);
			}
		}
	}

	// ---- Scroll / sticky mechanics ----

	let released = false;
	let prevCarryOut = false;
	let carryOut = false;
	let rafPending = false;

	function computePassedIndex(): number {
		const eps = 1;
		let passed = -1;
		const lastIdx = textBoxEls.length - 1;
		const carryY = window.innerHeight * carryPoint;

		for (let i = 0; i < textBoxEls.length; i++) {
			const el = textBoxEls[i];
			if (!el) continue;
			const top = el.getBoundingClientRect().top;
			const threshold = i === lastIdx ? carryY : eps;
			if (top <= threshold) passed = i;
			else break;
		}

		return passed;
	}

	function updateCarryOut() {
		if (!resolvedSteps.length) {
			carryOut = false;
			released = false;
			prevCarryOut = false;
			return;
		}

		const lastIdx = resolvedSteps.length - 1;
		const el = textBoxEls[lastIdx];
		if (!el) {
			carryOut = false;
			released = false;
			prevCarryOut = false;
			return;
		}

		const top = el.getBoundingClientRect().top;
		const carryY = window.innerHeight * carryPoint;

		carryOut = top <= carryY;

		if (carryOut && !prevCarryOut) {
			released = true;
			const el = videoEls[bgIndex];
			if (el) {
				el.pause();
				el.currentTime = 0;
				if (stepHasVideoButton(bgIndex)) {
					videoStates = { ...videoStates, [bgIndex]: 'idle' };
				}
			}
		}

		if (!carryOut && prevCarryOut) {
			released = false;
		}

		prevCarryOut = carryOut;
	}

	function updateFromScroll() {
		rafPending = false;
		if (!resolvedSteps.length) return;

		const passed = computePassedIndex();
		const wantedBg = Math.min(resolvedSteps.length - 1, Math.max(0, passed + 1));
		showStep(wantedBg);
		updateCarryOut();
	}

	function onScrollOrResize() {
		if (!browser || rafPending) return;
		rafPending = true;
		requestAnimationFrame(updateFromScroll);
	}

	// ---- Init when steps change ----

	$: if (resolvedSteps.length) {
		bgIndex = 0;
		if (!nearViewport) loadedIndices = new Set();
		carryOut = false;
		videoStates = {};
		textBoxEls.length = resolvedSteps.length;
		videoEls.length = resolvedSteps.length;
	} else {
		bgIndex = 0;
		loadedIndices = new Set();
		carryOut = false;
		textBoxEls = [];
		videoEls = [];
	}

	// ---- Intersection observer (lazy-load media) ----

	let observer: IntersectionObserver | null = null;

	onMount(() => {
		if (!browser) return;

		window.addEventListener('scroll', onScrollOrResize, { passive: true });
		window.addEventListener('resize', onScrollOrResize);

		observer = new IntersectionObserver(
			async (entries) => {
				if (!entries[0].isIntersecting) return;
				observer?.disconnect();
				observer = null;

				nearViewport = true;
				loadedIndices = new Set([0, 1].filter((i) => i < resolvedSteps.length));

				onScrollOrResize();
			},
			{ rootMargin: '500px 0px' }
		);

		if (sectionEl) observer.observe(sectionEl);
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('scroll', onScrollOrResize);
			window.removeEventListener('resize', onScrollOrResize);
		}
		observer?.disconnect();
	});
</script>

{#if resolvedSteps.length}
	<section
		bind:this={sectionEl}
		class="scrolly full-bleed"
		style={`--fade-ms:${fadeDurationMs}ms; --text-bottom:${textBottomVh}vh;`}
	>
		<div
			class={'scrolly-bg ' + (released ? 'unstick' : '')}
			class:blurred={resolvedSteps[bgIndex]?.overlay === 'dark'}
			role="img"
			aria-label={activeAlt}
			style="height: 100vh; width: 100vw;"
		>
			{#each resolvedSteps as step, i (i)}
				{@const m = toMedia(step)}
				<div class="layer" class:active={i === bgIndex} aria-hidden="true">
					{#if loadedIndices.has(i)}
						{#if m.kind === 'image'}
							<div
								class="media image"
								style={`background-image:url("${encodeURI(m.url)}")`}
							></div>
						{:else}
							<video
								class="media video"
								bind:this={videoEls[i]}
								src={m.url}
								muted
								playsinline
								preload="metadata"
								on:ended={() => handleVideoEnded(i)}
							></video>
						{/if}
					{/if}
				</div>
			{/each}

			{#if resolvedSteps[bgIndex]?.overlay === 'dark'}
				<div class="dark-overlay" aria-hidden="true"></div>
				{#if resolvedSteps[bgIndex]?.overlayVideo}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						transition:fade={{ duration: 400 }}
						class="overlay-video"
						bind:this={overlayVideoEl}
						src={resolvedSteps[bgIndex].overlayVideo}
						controls
						playsinline
					></video>
				{/if}
			{/if}
		</div>

		<div class="scrolly-steps">
			{#each resolvedSteps as step, i (i)}
				<ScrollyStep
					{step}
					{stepHeightVh}
					posClass={step.overlay === 'dark'
						? POS_CLASS[step.pos ?? 'center'].replace('bg-body-secondary ', '')
						: POS_CLASS[step.pos ?? 'center']}
					vState={videoStates[i] ?? 'idle'}
					hasVideoButton={stepHasVideoButton(i)}
					overlay={step.overlay}
					bind:textBoxEl={textBoxEls[i]}
					on:videoplay={() => handleStepVideoPlay(i)}
				/>
			{/each}
		</div>
	</section>
{/if}

<style>
	.scrolly {
		position: relative;
		margin-top: 3rem;
		margin-bottom: 3rem;
	}

	.scrolly-bg {
		position: sticky;
		top: 0;
		left: 0;
		overflow: hidden;
		z-index: 0;
	}

	.layer {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity var(--fade-ms) ease;
		transform: translateZ(0);
	}

	.layer.active {
		opacity: 1;
	}

	.media {
		position: absolute;
		inset: 0;
	}

	.media.image {
		background-size: cover;
		background-position: center;
	}

	.media.video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}

	.scrolly-steps {
		position: relative;
		z-index: 2;
		pointer-events: none;
	}

	.scrolly-steps :global(.col-10) {
		pointer-events: auto;
	}

	.scrolly-bg.blurred .media {
		filter: blur(4px);
		transform: scale(1.05);
	}

	.dark-overlay {
		position: absolute;
		inset: 0;
		background: black;
		opacity: 0.6;
		pointer-events: none;
		z-index: 1;
	}

	.overlay-video {
		position: absolute;
		z-index: 10;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 60%;
		max-width: 800px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		pointer-events: auto;
	}
</style>