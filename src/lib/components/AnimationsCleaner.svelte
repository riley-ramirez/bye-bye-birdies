<!--
  AnimationsCleaner — a scroll-driven storytelling component.

  Two phases as the user scrolls down:
    1. SCRUB — the video plays forward frame-by-frame, locked to scroll position.
       Scrolling back up rewinds it.
    2. PANELS — full-screen sections appear one at a time. CSS scroll-snap
       pins each one to the viewport so the user moves through them cleanly.

  See scroll-snap-bug-findings.md for the full "why this is built this way"
  story (snap targets, sticky runways, mandatory-vs-proximity snap, etc).
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	// `src` and `bodyText` are alternative ways to configure this component:
	//   - `src` + `captions` + `overlayContent` = pass everything as props
	//   - `bodyText` = a JSON blob from the CMS containing all of the above
	// When bodyText is provided, the reactive block below parses it.
	export let src: string = '';
	export let bodyText: string = '';
	// How many seconds of video play before the scroll-driven scrub takes over.
	// Below this point, the video plays normally; past it, scrolling drives time.
	export let scrubStart: number = 4;
	export let mobileSrc: string = '';
	export let mobileBreakpoint: number = 768;
	export let captions: {
		start: number;
		end: number;
		text: string;
		class?: string;
		persist?: boolean;
	}[] = [];

	// start/end are accepted for backwards compatibility with existing CMS data
	// but no longer drive layout — the first item fades in over the video,
	// each subsequent item is its own scroll-snap section.
	export let overlayContent: {
		start?: number;
		end?: number;
		text?: string;
		class?: string;
		textClass?: string;
		imgSrc?: string;
		imgClass?: string;
		subCaption?: string;
	}[] = [];

	// Reactive block (the `$:` prefix) — runs whenever `src` or `bodyText` change.
	// If src wasn't passed directly but bodyText was, we parse the CMS JSON here
	// and split it into the same fields you'd otherwise pass as props.
	$: if (!src && bodyText) {
		try {
			const parsed = JSON.parse(bodyText);
			src = base + '/' + (parsed.img ?? '');
			mobileSrc = parsed.mobileSrc ? base + '/' + parsed.mobileSrc : '';
			captions = (parsed.captions ?? []).map((c: (typeof captions)[0]) => ({
				...c,
				text: decodeEntities(c.text)
			}));
			overlayContent = (parsed.overlayContent ?? []).map((c: (typeof overlayContent)[0]) => ({
				...c,
				text: c.text ? decodeEntities(c.text) : c.text
			}));
		} catch (e) {
			console.error('Animations: could not parse bodyText', e);
		}
	}

	function decodeEntities(str: string): string {
		return str
			.replace(/&mdash;/g, '—')
			.replace(/&ndash;/g, '–')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&nbsp;/g, ' ');
	}

	// How many pixels of scrolling correspond to one second of video.
	// Bigger = the user has to scroll more to advance the same amount of video
	// (slower, more deliberate); smaller = the video scrubs faster.
	const PX_PER_SECOND = 900;
	// The first overlay item fades in over the video across the last
	// FIRST_OVERLAY_FADE_RANGE px of scrub, completing exactly at scrub end.
	// Bigger range = a more gradual fade; smaller = a punchier appearance.
	const FIRST_OVERLAY_FADE_RANGE = 900;

	// `bind:this={...}` (further down in the markup) sets these to the actual
	// DOM nodes once they're rendered — letting us measure their position,
	// attach observers, etc.
	let scrubber: HTMLDivElement;
	let sticky: HTMLDivElement;
	let video: HTMLVideoElement;

	// `duration` and `scrubScrollHeight` get their real values once the video
	// metadata loads (in setupVideo). Until then 5000 is a safe placeholder.
	let duration = 0;
	let scrubScrollHeight = 5000;
	let isScrubbing = false;
	let showScrollIndicator = false;
	let indicatorTimer: ReturnType<typeof setTimeout>;
	// Current playback time of the video. We track it ourselves (rather than
	// reading video.currentTime live) because reading it triggers paint work.
	let currentTime = 0;

	// Caption state. We track three captions because of the "persist" feature:
	// a caption with persist:true keeps showing past its end timestamp until
	// another caption supersedes it, or until the user scrolls back before it.
	let persistedCaption: (typeof captions)[0] | null = null;
	// eslint-disable-next-line no-useless-assignment
	let displayCaption: (typeof captions)[0] | null = null;
	let fadingCaption: (typeof captions)[0] | null = null;
	let fadeTimer: ReturnType<typeof setTimeout>;
	let prevDisplay: (typeof captions)[0] | null = null;

	// First overlay (overlayContent[0]) — sits over the video and fades in
	// based on scroll position. opacity 0 = invisible, 1 = fully covering video.
	let firstOverlayOpacity = 0;
	let firstOverlayImgSrc = '';
	let firstOverlayWasActive = false;

	// Scroll-snap sections (overlayContent.slice(1)) — real DOM sections that
	// each take a full viewport. The user scrolls through them one by one.
	let sectionRefs: HTMLElement[] = [];
	let visibleSections: boolean[] = [];
	let gifSrcs: string[] = [];
	// `inOverlayPhase` controls when mandatory scroll-snap is on. See scrub().
	let inOverlayPhase = false;
	let sectionObserver: IntersectionObserver | null = null;
	// Tracks the user's previous scroll position so we can detect the EXACT
	// frame they cross from scrub → panels (and only fire side-effects once).
	let lastScrolledPx = 0;

	$: sections = overlayContent.slice(1);

	$: if (visibleSections.length !== sections.length) {
		visibleSections = new Array(sections.length).fill(false);
	}

	$: if (sections.length && gifSrcs.length !== sections.length) {
		gifSrcs = sections.map((item) => (item.imgSrc?.endsWith('.gif') ? '' : (item.imgSrc ?? '')));
	}

	// Default the first overlay's image src (non-GIFs only — GIFs are loaded
	// on activation so they play from the first frame).
	$: if (
		overlayContent[0]?.imgSrc &&
		!overlayContent[0].imgSrc.endsWith('.gif') &&
		!firstOverlayImgSrc
	) {
		firstOverlayImgSrc = overlayContent[0].imgSrc;
	}

	// Restart the first overlay's GIF the moment the panel begins fading in.
	$: {
		const isActive = firstOverlayOpacity > 0.02;
		if (isActive && !firstOverlayWasActive) {
			const item = overlayContent[0];
			if (item?.imgSrc?.endsWith('.gif')) {
				firstOverlayImgSrc = '';
				requestAnimationFrame(() => {
					firstOverlayImgSrc = item.imgSrc ?? '';
				});
			}
		}
		// eslint-disable-next-line no-useless-assignment
		firstOverlayWasActive = isActive;
	}

	// Pick which caption (if any) to show right now, based on currentTime.
	// Three buckets:
	//   - `found`: a caption whose start/end currently surrounds currentTime
	//   - `pastPersisted`: a "persist" caption whose end is behind us — we keep
	//     showing it until something else takes over
	//   - `beforePersisted`: a "persist" caption that hasn't started yet — clear
	//     any persisted caption (the user scrolled back before it started)
	$: {
		const found = captions.find((c) => currentTime >= c.start && currentTime <= c.end) ?? null;
		const pastPersisted = captions.find((c) => c.persist && currentTime > c.end) ?? null;
		const beforePersisted = captions.find((c) => c.persist && currentTime < c.start) ?? null;

		if (beforePersisted) {
			persistedCaption = null;
		} else if (pastPersisted) {
			persistedCaption = pastPersisted;
		}

		displayCaption = found ?? persistedCaption;
	}

	$: handleFade(displayCaption);

	// scrub() is the heart of the component. It runs on every scroll event
	// and does four jobs in order:
	//   1. Decide whether mandatory snap should be on (inOverlayPhase)
	//   2. Update the first overlay's opacity based on scroll position
	//   3. Detect the "leaving the scrub" moment and smooth-scroll into panels
	//   4. If still in the scrub phase, seek the video to the right time
	function scrub() {
		if (!video || !duration || !scrubber) return;

		// `getBoundingClientRect().top` is the distance from the viewport's
		// top edge to the element's top edge. As the user scrolls down, the
		// scrubber's top moves up and out of view, so `top` becomes negative.
		// Negating it gives us "how many px of the scrubber have scrolled past
		// the top of the viewport" — a positive, growing number.
		const { top } = scrubber.getBoundingClientRect();
		const scrolledPx = -top;
		// `scrubEnd` is the scroll position at which the video finishes scrubbing.
		// (The scrubber is taller than the video by 1 viewport — see setupVideo —
		// because position:sticky needs that runway to unstick. So scrubEnd is
		// the scrubber's height minus that runway.)
		const scrubEnd = scrubScrollHeight - window.innerHeight;

		// Mandatory snap is active between scrub end and the last section being
		// pinned to top. Outside this window the page scrolls freely — important,
		// because mandatory snap during the scrub would fight the video seek,
		// and after the last section it would trap the user (no more snap targets
		// ahead, so the browser would yank them back).
		const lastSection = sectionRefs[sectionRefs.length - 1];
		const reachedLastSection = !!lastSection && lastSection.getBoundingClientRect().top <= 0;
		inOverlayPhase = scrolledPx > scrubEnd && !reachedLastSection;

		// Drive the first overlay's fade-in across the last FIRST_OVERLAY_FADE_RANGE
		// px of scrub. Opacity hits 1 exactly at scrub end so the panel is fully
		// visible over the final video frame. Math.min/Math.max clamps the result
		// between 0 and 1 (anywhere outside the fade range falls back to 0 or 1).
		if (overlayContent[0]) {
			const fadeStart = scrubEnd - FIRST_OVERLAY_FADE_RANGE;
			firstOverlayOpacity = Math.min(
				Math.max((scrolledPx - fadeStart) / FIRST_OVERLAY_FADE_RANGE, 0),
				1
			);
		}

		// When the user crosses out of the scrub phase, smooth-scroll into the
		// first scroll-snap section. Browsers don't retroactively snap when
		// scroll-snap-type flips to mandatory mid-gesture — without this nudge
		// the user has to scroll a few extra times before snap engages.
		// Comparing `lastScrolledPx` (previous frame) to `scrolledPx` (current)
		// lets us detect the EXACT frame of crossing, so we only fire once.
		const forwardCrossing = scrolledPx > scrubEnd && lastScrolledPx <= scrubEnd;
		if (forwardCrossing && sectionRefs[0]) {
			sectionRefs[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
		lastScrolledPx = scrolledPx;

		// Past scrub end? Done — no video seeking needed.
		if (scrolledPx > scrubEnd) return;
		// Not scrubbing yet? (Video is still in its intro play-through phase.)
		if (!isScrubbing) return;
		// `readyState < 2` means the video doesn't have enough data to seek yet.
		if (video.readyState < 2) return;

		// Map scroll position → video time. progress goes 0..1 across the scrub.
		const progress = Math.min(Math.max(scrolledPx / scrubEnd, 0), 1);
		const targetTime = scrubStart + progress * (duration - scrubStart);

		// Only seek if `targetTime` is in a part of the video that's already
		// downloaded. `video.buffered` is a list of (start, end) ranges
		// representing what's been loaded. Seeking outside those ranges causes
		// a jarring black flash while the browser fetches the data.
		const buffered = video.buffered;
		for (let i = 0; i < buffered.length; i++) {
			if (targetTime >= buffered.start(i) && targetTime <= buffered.end(i)) {
				video.currentTime = targetTime;
				break;
			}
		}
		currentTime = targetTime;

		// Hide the "Scroll to continue" hint once the user has clearly engaged.
		if (progress > 0.05) showScrollIndicator = false;
	}

	// Switch the video from "playing normally" to "scroll-driven scrubbing".
	// We pause it, lock isScrubbing, and immediately call scrub() so the video
	// frame matches the user's current scroll position.
	function startScrubbing() {
		video.pause();
		isScrubbing = true;
		showScrollIndicator = true;
		clearTimeout(indicatorTimer);
		scrub();
	}

	// On each new video frame, check whether playback has reached scrubStart.
	// Once it has, switch from normal playback to scroll-driven scrubbing.
	function checkScrubStart() {
		currentTime = video.currentTime;
		if (video.currentTime >= scrubStart) {
			startScrubbing();
		} else {
			video.requestVideoFrameCallback(checkScrubStart);
		}
	}

	// Fallback for browsers without requestVideoFrameCallback (e.g. older Safari).
	// `timeupdate` fires roughly every 250ms — coarser than per-frame, but enough.
	function handleTimeUpdate() {
		currentTime = video.currentTime;
		if (!isScrubbing && video.currentTime >= scrubStart) {
			startScrubbing();
		}
	}

	// When a "caption-one" caption disappears (no replacement), fade it out
	// gracefully over 1.5s instead of cutting it off. Other caption styles cut.
	function handleFade(next: (typeof captions)[0] | null) {
		if (!next && prevDisplay?.class === 'caption-one') {
			fadingCaption = prevDisplay;
			clearTimeout(fadeTimer);
			fadeTimer = setTimeout(() => {
				fadingCaption = null;
			}, 1500);
		} else if (next) {
			fadingCaption = null;
			clearTimeout(fadeTimer);
		}
		prevDisplay = next;
	}

	let cleanup: (() => void) | null = null;
	let initialized = false;

	// One-time setup that runs as soon as we have a video element AND a src.
	// Wires up listeners, computes the scrubber's height, and attaches the
	// observers that drive autoplay and scroll handling.
	function setupVideo() {
		if (!video || !src || initialized) return;
		initialized = true;

		// Pick the right source for this device. Mobile gets a smaller file.
		const activeSrc = mobileSrc && window.innerWidth < mobileBreakpoint ? mobileSrc : src;
		video.querySelector('source')?.setAttribute('src', activeSrc);

		// `loadedmetadata` fires once we know the video's duration. We use it
		// to set scrubScrollHeight = how tall the scrubber container needs to
		// be in order to give the user (duration - scrubStart) seconds of scroll
		// time, plus one viewport of "runway" for the sticky video to unstick.
		video.addEventListener(
			'loadedmetadata',
			() => {
				duration = video.duration;
				scrubScrollHeight = (duration - scrubStart) * PX_PER_SECOND + window.innerHeight;
			},
			{ once: true }
		);

		// If enough video data has buffered to play through, refresh the scrub
		// position — useful if the user was scrolling while the video loaded.
		video.addEventListener(
			'canplaythrough',
			() => {
				if (isScrubbing) scrub();
			},
			{ once: true }
		);

		// Modern browsers: a callback that runs once per video frame. Best for
		// detecting the moment we cross scrubStart cleanly. Older Safari falls
		// back to the coarser timeupdate event.
		if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
			video.requestVideoFrameCallback(checkScrubStart);
		} else {
			video.addEventListener('timeupdate', handleTimeUpdate);
		}

		video.load();

		// Safety net: if the video never reaches scrubStart for some reason
		// (e.g. autoplay blocked), force scrubbing on after 5s so the user
		// can still drive the experience by scrolling.
		indicatorTimer = setTimeout(() => {
			if (!showScrollIndicator) {
				isScrubbing = true;
				showScrollIndicator = true;
			}
		}, 5000);

		// IntersectionObserver = the browser's "let me know when this element
		// enters/exits the viewport" API. Here: as soon as the video sticky
		// region is at least 50% on-screen, start playing the intro. Then we
		// disconnect — we only need this trigger once.
		const playObserver = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !isScrubbing) {
					video.play();
					playObserver.disconnect();
				}
			},
			{ threshold: 0.5 }
		);
		playObserver.observe(sticky);

		// `passive: true` tells the browser we won't preventDefault() on scroll.
		// This lets it dispatch scroll events without waiting on our handler,
		// which keeps scrolling smooth.
		window.addEventListener('scroll', scrub, { passive: true });

		// Cleanup when the component unmounts. Without this, listeners and
		// observers would keep running after the user navigates away — wasted
		// work and a memory leak.
		cleanup = () => {
			clearTimeout(indicatorTimer);
			clearTimeout(fadeTimer);
			window.removeEventListener('scroll', scrub);
			window.removeEventListener('resize', scrub);
			video.removeEventListener('timeupdate', handleTimeUpdate);
			playObserver.disconnect();
			sectionObserver?.disconnect();
			// Remove the snap class from <html> so it doesn't leak into other pages.
			document.documentElement.classList.remove('snap-overlay');
		};
	}

	// Watches each scroll-snap section to know when to trigger its fade-in
	// animation and (if applicable) restart its GIF.
	//
	// `rootMargin: '0px 0px 200px 0px'` extends the bottom edge of the
	// "viewport" used for intersection detection by 200px downward. So a
	// section is reported as "intersecting" 200px BEFORE it actually enters
	// the visible viewport — which kicks off its fade-in slightly early and
	// gives us a small overlap with the previous panel.
	function setupSectionObserver() {
		sectionObserver?.disconnect();
		if (!sectionRefs.length || sectionRefs.some((s) => !s)) return;

		sectionObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					// Find which section index this entry belongs to. (The observer
					// reports entries in arbitrary order, so we look it up by element.)
					const idx = sectionRefs.indexOf(entry.target as HTMLElement);
					if (idx === -1 || !entry.isIntersecting) continue;

					// Mark this section visible. The trailing self-assignment is
					// Svelte's idiom for "tell the framework this array changed,
					// please re-render anything that depends on it."
					visibleSections[idx] = true;
					visibleSections = visibleSections;

					// GIF restart trick: if this section has a GIF, briefly clear
					// its src and re-set it on the next frame. That forces the
					// browser to reload the file, which restarts the animation
					// from frame 1 — otherwise the GIF could be mid-loop when
					// the user reaches the section.
					const item = sections[idx];
					if (item?.imgSrc?.endsWith('.gif')) {
						gifSrcs[idx] = '';
						requestAnimationFrame(() => {
							gifSrcs[idx] = item.imgSrc ?? '';
							gifSrcs = [...gifSrcs];
						});
					}
				}
			},
			{ rootMargin: '0px 0px 200px 0px', threshold: 0 }
		);

		sectionRefs.forEach((s) => sectionObserver!.observe(s));
	}

	// onMount runs once after the component is rendered. We use it to ask the
	// browser to start downloading the video as soon as possible — sooner than
	// the <video> tag itself would normally trigger — so the experience feels
	// responsive when the user reaches it.
	onMount(() => {
		const activeSrc = mobileSrc && window.innerWidth < mobileBreakpoint ? mobileSrc : src;
		if (activeSrc) {
			const link = document.createElement('link');
			link.rel = 'preload';
			link.as = 'video';
			link.href = activeSrc;
			document.head.appendChild(link);
		}

		// Returning a function from onMount = "run this on unmount."
		return () => cleanup?.();
	});

	// These reactive declarations re-run whenever their dependencies change.
	// Svelte tracks the variables read inside automatically.

	// Run setupVideo as soon as we have BOTH a src and a bound video element.
	// (`initialized` inside setupVideo prevents it from running twice.)
	$: if (src && video) setupVideo();

	// Re-attach the section observer whenever the number of bound section refs
	// matches the number of sections we expect — i.e. once they're all rendered.
	$: if (typeof window !== 'undefined' && sectionRefs.length === sections.length) {
		setupSectionObserver();
	}

	// Toggle the snap class on <html>. We use <html> (not <body> or a wrapper)
	// because that's the actual scrolling container at the page level — only
	// the scroll container's `scroll-snap-type` is honoured by the browser.
	$: if (typeof document !== 'undefined') {
		document.documentElement.classList.toggle('snap-overlay', inOverlayPhase);
	}
</script>

<!--
  Scrubber: a tall container whose height = how much scrolling we want for
  the video scrub. Inside it, the .sticky element stays glued to the top of
  the viewport while the parent scrolls past — that's how the video appears
  to "stay put" while we scrub through it.
-->
<div class="scrubber" bind:this={scrubber} style="height: {scrubScrollHeight}px;">
	<div class="sticky" bind:this={sticky}>
		<!-- muted + playsinline are required for autoplay on most browsers -->
		<video bind:this={video} preload="auto" muted playsinline disablepictureinpicture>
			<source {src} type="video/mp4" />
		</video>

		{#if displayCaption}
			<div class="caption {displayCaption.class ?? ''}" role="status">
				{displayCaption.text}
			</div>
		{:else if fadingCaption}
			<div class="caption {fadingCaption.class ?? ''} fading" role="status">
				{fadingCaption.text}
			</div>
		{/if}

		<!-- First overlay panel: rendered over the video, opacity scroll-driven -->
		{#if overlayContent[0]}
			<div
				class="first-overlay {overlayContent[0].class ?? ''}"
				data-block={overlayContent[0].class?.replace('block-', '') ?? ''}
				style="opacity: {firstOverlayOpacity};"
			>
				<div class="overlay-panel first-overlay-panel">
					{#if overlayContent[0].imgSrc}
						{#if overlayContent[0].subCaption}
							<div class="img-with-caption">
								<img
									src={firstOverlayImgSrc || overlayContent[0].imgSrc}
									alt=""
									class="overlay-image {overlayContent[0].imgClass ?? ''}"
									loading="lazy"
								/>
								<p class="sub-caption">{overlayContent[0].subCaption}</p>
							</div>
						{:else}
							<img
								src={firstOverlayImgSrc || overlayContent[0].imgSrc}
								alt=""
								class="overlay-image {overlayContent[0].imgClass ?? ''}"
								loading="lazy"
							/>
						{/if}
					{/if}
					{#if overlayContent[0].text}
						<p class="overlay-text {overlayContent[0].textClass ?? ''}">{overlayContent[0].text}</p>
					{/if}
				</div>
			</div>
		{/if}

		<div class="scroll-indicator" class:visible={showScrollIndicator} aria-hidden="true">
			<span class="scroll-label">Scroll to continue</span>
			<div class="chevrons">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</div>
		</div>
	</div>
</div>

<!--
  Scroll-snap sections: overlayContent items from index 1 onwards. Each is
  a full-viewport section. `bind:this={sectionRefs[i]}` populates the
  sectionRefs array so we can observe each section in JS. `class:visible`
  toggles the .visible class based on the matching boolean — this is what
  triggers the CSS fade-in when the IntersectionObserver fires.
-->
{#each sections as item, i (i)}
	<section
		bind:this={sectionRefs[i]}
		class="overlay-section {item.class ?? ''}"
		class:visible={visibleSections[i]}
		data-block={item.class?.replace('block-', '') ?? ''}
	>
		<div class="overlay-panel">
			{#if item.imgSrc}
				{#if item.subCaption}
					<div class="img-with-caption">
						<img
							src={gifSrcs[i] ?? item.imgSrc}
							alt=""
							class="overlay-image {item.imgClass ?? ''}"
							loading="lazy"
						/>
						<p class="sub-caption">{item.subCaption}</p>
					</div>
				{:else}
					<img
						src={gifSrcs[i] ?? item.imgSrc}
						alt=""
						class="overlay-image {item.imgClass ?? ''}"
						loading="lazy"
					/>
				{/if}
			{/if}
			{#if item.text}
				<p class="overlay-text {item.textClass ?? ''}">{item.text}</p>
			{/if}
		</div>
	</section>
{/each}

<style>
	/* ── Scrubber container ──────────────────────────────────────────────── */
	.scrubber {
		width: 100%;
		position: relative;
		left: 50%;
		right: 50%;
		margin-left: -50%;
		margin-right: -50%;
	}

	/* Mandatory snap is only active between scrub end and the last section
     being pinned to top — toggled by JS so the scrub phase and content
     past the last section are never affected. */
	:global(html.snap-overlay) {
		scroll-snap-type: y mandatory;
	}

	/* ── Sticky viewport for the video + first overlay ───────────────────── */
	.sticky {
		position: sticky;
		top: 0;
		height: 100vh;
		width: 100vw;
		overflow: hidden;
	}

	.sticky video {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
		z-index: 0;
	}

	/* ── First overlay panel: over the video, scroll-driven opacity ──────── */
	.first-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		pointer-events: none;
	}

	/* The first-overlay panel inherits opacity from its parent — the panel
     itself stays fully opaque and skips the section.visible fade animation. */
	.first-overlay .first-overlay-panel {
		opacity: 1;
		transform: none;
		transition: none;
	}

	/* ── Captions ────────────────────────────────────────────────────────── */
	.caption {
		position: absolute;
		bottom: 44%;
		left: 26.5%;
		transform: translateX(-50%);
		color: white;
		font-family: 'Azeret Mono', monospace;
		font-size: 2rem;
		font-weight: 550;
		text-align: left;
		max-width: 40%;
		padding: 0.5rem 1rem;
		animation: fadeIn 0.77s ease;
		line-height: 2rem;
		z-index: 2;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	:global(.fading) {
		animation: fadeOut 1.5s ease forwards !important;
	}

	@keyframes fadeOut {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	:global(.caption-two) {
		bottom: auto !important;
		top: 50% !important;
		left: 75% !important;
		font-size: 1.5rem !important;
		color: black !important;
		line-height: 1.7rem !important;
		font-weight: 200 !important;
		width: 40% !important;
		max-width: 100% !important;
	}

	/* ── Overlay sections (siblings after the scrubber) ──────────────────── */
	.overlay-section {
		position: relative;
		width: 100%;
		height: 100vh;
		overflow: hidden;
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}

	/* Panel inside .overlay-section: fade + slide on .visible */
	.overlay-panel {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		gap: 2rem;
		padding: 4rem 6rem;
		box-sizing: border-box;
		opacity: 0;
		transform: translateY(30px);
		transition:
			opacity 0.6s ease,
			transform 0.6s ease;
		will-change: opacity, transform;
	}

	.overlay-section.visible .overlay-panel {
		opacity: 1;
		transform: translateY(0);
	}

	.overlay-image {
		height: auto;
		display: block;
		flex-shrink: 0;
	}

	.overlay-text {
		color: rgb(0, 0, 0);
		font-family: 'Azeret Mono', monospace;
		font-size: 1.5rem;
		font-weight: 300;
		line-height: 1.8rem;
		max-width: 40%;
		margin: 0;
	}

	.img-with-caption {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		flex-shrink: 0;
		max-width: 60%;
	}

	.img-with-caption .overlay-image {
		width: 100%;
		height: auto;
	}

	.sub-caption {
		color: rgb(0, 0, 0);
		font-family: 'Azeret Mono', monospace;
		font-size: 0.6rem;
		font-weight: 300;
		margin-top: 0.3rem;
		margin-left: 7rem;
		text-align: left;
		max-width: 100%;
	}

	:global(.overlay-img-one) {
		width: 60%;
	}
	:global(.overlay-img-two) {
		width: 60%;
	}

	/* ── Block three: text centered, small image underneath ─────────────── */
	/* Applied to both first overlay and scroll-snap sections that carry the
     data-block="three" attribute. */
	.first-overlay[data-block='three'] .overlay-panel,
	.overlay-section[data-block='three'] .overlay-panel {
		flex-direction: column;
		align-items: center;
		justify-content: center;
		margin-top: 5%;
	}

	.first-overlay[data-block='three'] .overlay-text,
	.overlay-section[data-block='three'] .overlay-text {
		text-align: left;
		max-width: 50%;
		z-index: 2;
		order: 1;
	}

	.first-overlay[data-block='three'] .overlay-image,
	.overlay-section[data-block='three'] .overlay-image {
		width: 25%;
		object-fit: contain;
		margin-top: -6rem;
		margin-left: 55%;
		order: 2;
		z-index: 1;
	}

	/* ── Scroll indicator ────────────────────────────────────────────────── */
	.scroll-indicator {
		position: absolute;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		color: white;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.6s ease;
		filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.5));
		z-index: 3;
	}

	.scroll-indicator.visible {
		opacity: 1;
	}

	.scroll-label {
		font-size: 0.75rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 600;
		font-family:
			Azeret Mono,
			monospace;
	}

	.chevrons {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.chevrons svg {
		width: 1.5rem;
		height: 1.5rem;
		animation: bounce 1.4s ease-in-out infinite;
	}

	.chevrons svg:first-child {
		opacity: 0.5;
		animation-delay: 0s;
		margin-bottom: -0.5rem;
	}

	.chevrons svg:last-child {
		animation-delay: 0.2s;
	}

	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(5px);
		}
	}
</style>
