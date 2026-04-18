<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  export let src: string = '';
  export let bodyText: string = '';
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

  /**
   * overlayContent: items that scroll over the frozen video after scrubbing ends.
   * start/end are in pixels of overlay scroll progress — same idea as caption
   * start/end being in video seconds. Each panel is visible between start and end,
   * with a short fade-in at the start edge and fade-out at the end edge.
   *
   * Example:
   *   { start: 0,   end: 800,  imgSrc: "...", text: "..." }
   *   { start: 700, end: 1500, imgSrc: "...", text: "..." }
   *   { start: 1400, end: 2200, imgSrc: "...", text: "..." }
   *
   * Overlap the ranges slightly (e.g. 100px) so panels cross-fade rather than
   * leaving a gap between them.
   */
  export let overlayContent: {
    start: number;
    end: number;
    text?: string;
    class?: string;
    textClass?: string;
    imgSrc?: string;
    imgClass?: string;
    subCaption?: string;
  }[] = [];

  $: if (!src && bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      src = base + '/' + (parsed.img ?? '');
      mobileSrc = parsed.mobileSrc ? base + '/' + parsed.mobileSrc : '';
      captions = (parsed.captions ?? []).map((c: typeof captions[0]) => ({
        ...c,
        text: decodeEntities(c.text)
      }));
      overlayContent = (parsed.overlayContent ?? []).map((c: typeof overlayContent[0]) => ({
        ...c,
        text: c.text ? decodeEntities(c.text) : c.text
      }));
    } catch (e) {
      console.error('Animations: could not parse bodyText', e);
    }
  }

  // Decode HTML entities (e.g. &mdash; → —) that may come through from the CMS
  function decodeEntities(str: string): string {
    return str
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  const PX_PER_SECOND = 900;
  let container: HTMLDivElement;
  let sticky: HTMLDivElement;
  let video: HTMLVideoElement;
  let duration = 0;
  let scrubScrollHeight = 5000;
  let isScrubbing = false;
  let showScrollIndicator = false;
  let indicatorTimer: ReturnType<typeof setTimeout>;
  let currentTime = 0;
  let persistedCaption: typeof captions[0] | null = null;
  // eslint-disable-next-line no-useless-assignment
  let displayCaption: typeof captions[0] | null = null;
  let fadingCaption: typeof captions[0] | null = null;
  let fadeTimer: ReturnType<typeof setTimeout>;
  let prevDisplay: typeof captions[0] | null = null;

  // How many px past the end of the scrub phase the user has scrolled
  let overlayProgress = 0;

  // px over which each panel fades in at its start edge and fades out at its end edge
  const FADE_PX = 150;

  let overlayPanelHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Total overlay scroll height:
  // last panel's end + a hold period (one viewport) so it sticks before page moves on
  $: lastEnd = overlayContent.length > 0
    ? Math.max(...overlayContent.map(c => c.end))
    : 0;
  $: overlayScrollHeight = overlayContent.length > 0
    ? lastEnd + overlayPanelHeight
    : 0;
  $: totalScrollHeight = scrubScrollHeight + overlayScrollHeight;

  // Reactive array of per-panel styles — re-derives whenever overlayProgress changes.
  function calcPanelStyle(item: typeof overlayContent[0], p: number, isLast: boolean): string {
    if (p < item.start) {
      return 'opacity: 0; transform: translateY(30px); pointer-events: none;';
    }
    // Last panel never fades out — stays visible until the scroll container ends
    if (!isLast && p > item.end) {
      return 'opacity: 0; transform: translateY(0); pointer-events: none;';
    }

    let opacity: number;
    let translateY = 0;
    const fromStart = p - item.start;
    const fromEnd   = item.end - p;

    if (fromStart < FADE_PX) {
      // Fade in + slide up on entry
      opacity    = fromStart / FADE_PX;
      translateY = 30 * (1 - fromStart / FADE_PX);
    } else if (!isLast && fromEnd < FADE_PX) {
      // Fade out on exit (skipped for last panel)
      opacity = fromEnd / FADE_PX;
    } else {
      opacity = 1;
    }

    return `opacity: ${opacity}; transform: translateY(${translateY}px);`;
  }

  // Re-runs whenever overlayProgress or overlayContent changes
  $: panelStyles = overlayContent.map((item, i) =>
    calcPanelStyle(item, overlayProgress, i === overlayContent.length - 1)
  );

  let gifSrcs: string[] = [];

  $: if (overlayContent.length && !gifSrcs.length) {
    gifSrcs = overlayContent.map(item =>
      item.imgSrc?.endsWith('.gif') ? '' : (item.imgSrc ?? '')
    );
  }

  $: {
    overlayContent.forEach((item, i) => {
      if (item.imgSrc && overlayProgress >= item.start - 10 && overlayProgress < item.start + FADE_PX) {
        if (gifSrcs[i] !== item.imgSrc) {
          gifSrcs[i] = '';
          requestAnimationFrame(() => {
            gifSrcs[i] = item.imgSrc ?? '';
            gifSrcs = [...gifSrcs]; // trigger reactivity
          });
        }
      }
    });
  }

  $: {
    const found = captions.find(c => currentTime >= c.start && currentTime <= c.end) ?? null;
    const pastPersisted = captions.find(c => c.persist && currentTime > c.end) ?? null;
    const beforePersisted = captions.find(c => c.persist && currentTime < c.start) ?? null;

    if (beforePersisted) {
      persistedCaption = null;
    } else if (pastPersisted) {
      persistedCaption = pastPersisted;
    }

    displayCaption = found ?? persistedCaption;
  }

  $: handleFade(displayCaption);

  function scrub() {
    if (!video || !duration || !container) return;

    const { top } = container.getBoundingClientRect();
    const scrolledPx = -top;
    const scrubEnd = scrubScrollHeight - window.innerHeight;

    // Overlay starts counting 1 video-second (PX_PER_SECOND px) before scrub ends
    const overlayStartPx = scrubEnd - PX_PER_SECOND;

    // ── Phase 1: scrub the video ──────────────────────────────────────────
    if (scrolledPx <= scrubEnd) {
      // Start overlayProgress early so panels begin appearing in the last second
      overlayProgress = scrolledPx > overlayStartPx ? scrolledPx - overlayStartPx : 0;

      if (!isScrubbing) return;
      if (video.readyState < 2) return;

      const progress = Math.min(Math.max(scrolledPx / scrubEnd, 0), 1);
      const targetTime = scrubStart + progress * (duration - scrubStart);

      const buffered = video.buffered;
      for (let i = 0; i < buffered.length; i++) {
        if (targetTime >= buffered.start(i) && targetTime <= buffered.end(i)) {
          video.currentTime = targetTime;
          break;
        }
      }
      currentTime = targetTime;

      if (progress > 0.05) showScrollIndicator = false;
    } else {
      // ── Phase 2: overlay panels scroll over frozen video ─────────────────
      overlayProgress = scrolledPx - overlayStartPx;
    }
  }

  function startScrubbing() {
    video.pause();
    isScrubbing = true;
    showScrollIndicator = true;
    clearTimeout(indicatorTimer);
    scrub();
  }

  function checkScrubStart() {
    currentTime = video.currentTime;
    if (video.currentTime >= scrubStart) {
      startScrubbing();
    } else {
      video.requestVideoFrameCallback(checkScrubStart);
    }
  }

  function handleTimeUpdate() {
    currentTime = video.currentTime;
    if (!isScrubbing && video.currentTime >= scrubStart) {
      startScrubbing();
    }
  }

  function handleFade(next: typeof captions[0] | null) {
    if (!next && prevDisplay?.class === 'caption-one') {
      fadingCaption = prevDisplay;
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => { fadingCaption = null; }, 1500);
    } else if (next) {
      fadingCaption = null;
      clearTimeout(fadeTimer);
    }
    prevDisplay = next;
  }

  let cleanup: (() => void) | null = null;
  let initialized = false;

  function setupVideo() {
    if (!video || !src || initialized) return;
    initialized = true;

    const activeSrc = (mobileSrc && window.innerWidth < mobileBreakpoint) ? mobileSrc : src;
    video.querySelector('source')?.setAttribute('src', activeSrc);

    video.addEventListener(
      'loadedmetadata',
      () => {
        duration = video.duration;
        scrubScrollHeight = (duration - scrubStart) * PX_PER_SECOND + window.innerHeight;
      },
      { once: true }
    );

    video.addEventListener(
      'canplaythrough',
      () => {
        if (isScrubbing) scrub();
      },
      { once: true }
    );

    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      video.requestVideoFrameCallback(checkScrubStart);
    } else {
      video.addEventListener('timeupdate', handleTimeUpdate);
    }

    video.load();

    indicatorTimer = setTimeout(() => {
      if (!showScrollIndicator) {
        isScrubbing = true;
        showScrollIndicator = true;
      }
    }, 5000);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isScrubbing) {
          video.play();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(sticky);

    window.addEventListener('scroll', scrub, { passive: true });
    window.addEventListener('resize', scrub, { passive: true });

    cleanup = () => {
      clearTimeout(indicatorTimer);
      clearTimeout(fadeTimer);
      window.removeEventListener('scroll', scrub);
      window.removeEventListener('resize', scrub);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      observer.disconnect();
    };
  }

  onMount(() => {
    // Preload the video
    const activeSrc = (mobileSrc && window.innerWidth < mobileBreakpoint) ? mobileSrc : src;
    if (activeSrc) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = activeSrc;
      document.head.appendChild(link);
    }

    return () => cleanup?.();
  });

  $: if (src && video) setupVideo();
</script>

<div
  class="scrolly"
  bind:this={container}
  style="height: {totalScrollHeight}px;"
>
  <div class="sticky" bind:this={sticky}>

    <!-- Video: always behind everything, covers full viewport -->
    <video
      bind:this={video}
      preload="auto"
      muted
      playsinline
      disablepictureinpicture
    >
      <source {src} type="video/mp4" />
    </video>

    <!-- Captions: visible during scrub phase -->
    {#if displayCaption}
      <div class="caption {displayCaption.class ?? ''}" role="status">
        {displayCaption.text}
      </div>
    {:else if fadingCaption}
      <div class="caption {fadingCaption.class ?? ''} fading" role="status">
        {fadingCaption.text}
      </div>
    {/if}

    <!-- Scroll indicator -->
    <div class="scroll-indicator" class:visible={showScrollIndicator} aria-hidden="true">
      <span class="scroll-label">Scroll to continue</span>
      <div class="chevrons">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>

    <!-- Overlay panels: each fades+slides in independently, then fades out -->
    {#if overlayContent.length > 0}
      <div class="overlay-stack">
        {#each overlayContent as item, i (i)}
          <div
            class="overlay-panel {item.class ?? ''}"
            data-block={item.class?.replace('block-', '') ?? ''}
            style={panelStyles[i]}
          >
            {#if item.imgSrc}
              {#if item.subCaption}
                <div class="img-with-caption">
                  <img
                    src={gifSrcs[i] ?? item.imgSrc}
                    alt=""
                    class="overlay-image {item.imgClass ?? ''}"
                  />
                  <p class="sub-caption">{item.subCaption}</p>
                </div>
              {:else}
                <img
                  src={gifSrcs[i] ?? item.imgSrc}
                  alt=""
                  class="overlay-image {item.imgClass ?? ''}"
                />
              {/if}
            {/if}
            {#if item.text}
              <p class="overlay-text {item.textClass ?? ''}">{item.text}</p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>

<style>
  /* ── Outer scroll container ──────────────────────────────────────────── */
  .scrolly {
    width: 100%;
    position: relative;
    left: 50%;
    right: 50%;
    margin-left: -50%;
    margin-right: -50%;
  }

  /* ── Sticky viewport panel ───────────────────────────────────────────── */
  .sticky {
    position: sticky;
    top: 0;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  /* ── Video ───────────────────────────────────────────────────────────── */
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
    from { opacity: 0; transform: translateX(-50%) translateY(6px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  :global(.fading) {
    animation: fadeOut 1.5s ease forwards !important;
  }

  @keyframes fadeOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  /* ── Per-caption overrides ───────────────────────────────────────────── */
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

  /* ── Overlay stack ───────────────────────────────────────────────────── */
  .overlay-stack {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }

  /* ── Overlay panel base — default layout: image left, text right ─────── */
  .overlay-panel {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 2rem;
    padding: 4rem 6rem;
    box-sizing: border-box;
    will-change: opacity, transform;
    pointer-events: none;
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
    font-size: 0.60rem;
    font-weight: 300;
    margin-top: 0.3rem;
    margin-left: 7rem;
    text-align: left;
    max-width: 100%;
  }

  /* ── Per-image size overrides ────────────────────────────────────────── */
  :global(.overlay-img-one) { width: 60%; }
  :global(.overlay-img-two) { width: 60%; }

  /* ── Block three: text centered, small image underneath ─────────────── */
  /*
    Using a data attribute on the panel element lets us target it from
    inside the scoped style block without needing :global or !important.
  */
  .overlay-panel[data-block="three"] {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-top: 5%;
  }

  .overlay-panel[data-block="three"] .overlay-text {
    text-align: left;
    max-width: 50%;
    z-index: 2;
  }

  .overlay-panel[data-block="three"] .overlay-image {
    width: 25%;
    object-fit: contain;
    margin-top: -5rem;
    margin-left: 55%;
    order: 2;
    z-index: 1;
  }

  .overlay-panel[data-block="three"] .overlay-text {
    order: 1;
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
    font-family: Azeret Mono, monospace;
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
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(5px); }
  }
</style>