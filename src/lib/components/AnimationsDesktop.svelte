<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { videoReady } from '$lib/stores/videoReady';

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

  export let overlayContent: {
    start: number;
    end: number;
    text?: string;
    class?: string;
    textClass?: string;
    imgSrc?: string;
    imgClass?: string;
    subCaption?: string;
    alt?: string;
  }[] = [];

  export let videoLabel: string = 'Scrollable animation';

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

  const PX_PER_SECOND = 900;
  const VIDEO_FADE_PX = 400;
  const VIDEO_FADE_EARLY = 200;

  let container: HTMLDivElement;
  let sticky: HTMLDivElement;
  let video: HTMLVideoElement;
  let videoLoaded = false;
  let duration = 0;
  let scrubScrollHeight = 5000;

  // --- scroll-lock state ---
  // True while the first ~scrubStart seconds are playing (before scrubbing begins)
  let scrollLocked = false;
  // The scroll position where the lock was engaged (top of container)
  let lockScrollY = 0;

  let isScrubbing = false;
  let showScrollIndicator = false;
  let currentTime = 0;
  let persistedCaption: typeof captions[0] | null = null;
  let displayCaption: typeof captions[0] | null = null;
  let fadingCaption: typeof captions[0] | null = null;
  let fadeTimer: ReturnType<typeof setTimeout>;
  let prevDisplay: typeof captions[0] | null = null;

  // 0–1: how far through the video-fade-out transition we are
  // 0 = video fully visible, 1 = video fully faded (bg visible)
  let videoFadeProgress = 0;

  let overlayProgress = 0;
  const FADE_PX = 150;
  // Initialized to 0; set to window.innerHeight in onMount to avoid SSR/hydration mismatch
  let overlayPanelHeight = 0;
  let mounted = false;

  // Whether the last panel has fully faded in — shows the exit block
  let lastPanelFullyVisible = false;

  $: lastEnd = overlayContent.length > 0
    ? Math.max(...overlayContent.map(c => c.end))
    : 0;
  $: overlayScrollHeight = overlayContent.length > 0
    ? lastEnd + overlayPanelHeight * 0.5
    : 0;
  $: totalScrollHeight = scrubScrollHeight + overlayScrollHeight;

  // Scroll position (within the container) at which the overlay section begins
  $: scrubEndPx = scrubScrollHeight - overlayPanelHeight;
  $: overlayStartPx = scrubEndPx - PX_PER_SECOND;

  // Video fade begins VIDEO_FADE_EARLY px before scrub ends — slightly early.
  $: videoFadeStartPx = scrubEndPx - VIDEO_FADE_EARLY;
  $: videoFadeEndPx = videoFadeStartPx + VIDEO_FADE_PX;

  // Container-relative scroll position where the last panel starts
  $: lastPanelStartPx = overlayStartPx + (overlayContent.length > 0
    ? overlayContent[overlayContent.length - 1].start
    : 0);
  // The last panel is fully faded in FADE_PX after it starts.
  // We hold the sticky for LAST_PANEL_LOCK_PX more px after that,
  // then release — but see below: we don't release the sticky at all.
  // Instead we use a separate flowing block for the last panel exit.
  $: lastPanelFullyInPx = lastPanelStartPx + FADE_PX;

  $: snapPositions = overlayContent.map(item =>
    overlayStartPx + item.start - overlayPanelHeight * 0.1
  );

  function calcPanelStyle(item: typeof overlayContent[0], p: number, isLast: boolean): string {
    if (p < item.start) {
      return 'opacity: 0; transform: translateY(30px); pointer-events: none;';
    }
    if (!isLast && p > item.end) {
      return 'opacity: 0; transform: translateY(0); pointer-events: none;';
    }
    if (isLast && p >= item.start + FADE_PX) {
      return 'opacity: 1; transform: translateY(0);';
    }

    let opacity: number;
    let translateY = 0;
    const fromStart = p - item.start;
    const fromEnd   = item.end - p;

    if (fromStart < FADE_PX) {
      opacity    = fromStart / FADE_PX;
      translateY = 30 * (1 - fromStart / FADE_PX);
    } else if (!isLast && fromEnd < FADE_PX) {
      opacity = fromEnd / FADE_PX;
    } else {
      opacity = 1;
    }

    return `opacity: ${opacity}; transform: translateY(${translateY}px);`;
  }

  function isPanelVisible(item: typeof overlayContent[0], p: number, isLast: boolean): boolean {
    if (p < item.start) return false;
    if (!isLast && p > item.end) return false;
    return true;
  }

  $: panelStyles = overlayContent.map((item, i) =>
    calcPanelStyle(item, overlayProgress, i === overlayContent.length - 1)
  );

  $: panelVisible = overlayContent.map((item, i) =>
    isPanelVisible(item, overlayProgress, i === overlayContent.length - 1)
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
            gifSrcs = [...gifSrcs];
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

  // ─── body class helper (sticky background) ────────────────────────────────
  // Activates the fixed background layer from layout.svelte while the overlay
  // section is in view, and removes it once the last panel scrolls away.

  let splitActive = false;

  let splitActivePending: ReturnType<typeof requestAnimationFrame> | null = null;

  function setSplitActive(active: boolean) {
    if (active === splitActive) return;
    // Delay activation by one rAF so the video layer has painted before the
    // background switches — prevents the single-frame flash on Safari/Chrome.
    if (active) {
      if (splitActivePending) return; // already scheduled
      splitActivePending = requestAnimationFrame(() => {
        splitActivePending = null;
        if (splitActive) return; // already active, no-op
        splitActive = true;
        document.body.classList.add('scrolly-split-active');
      });
    } else {
      // Deactivation is immediate — we want the background to go away promptly
      if (splitActivePending) {
        cancelAnimationFrame(splitActivePending);
        splitActivePending = null;
      }
      splitActive = false;
      document.body.classList.remove('scrolly-split-active');
    }
  }

  // ─── scroll lock helpers ───────────────────────────────────────────────────

  function lockScroll() {
    if (scrollLocked) return;
    scrollLocked = true;
    lockScrollY = window.scrollY;
    // Prevent the page from moving while locked
    document.body.style.overflow = 'hidden';
  }

  function unlockScroll() {
    if (!scrollLocked) return;
    scrollLocked = false;
    document.body.style.overflow = '';
  }

  // ─── main scrub handler ────────────────────────────────────────────────────

  function scrub() {
    if (!video || !duration || !container) return;
    if (scrollLocked) {
      window.scrollTo(0, lockScrollY);
      return;
    }

    const { top } = container.getBoundingClientRect();
    const scrolledPx = -top;

    // --- video-fade-out progress ---
    // Don't start fading until overlayProgress has started (first panel appearing),
    // so the video stays solid during the scrub-end pause moment.
    if (overlayProgress > 0 && scrolledPx >= videoFadeStartPx) {
      videoFadeProgress = Math.min(
        (scrolledPx - videoFadeStartPx) / VIDEO_FADE_PX,
        1
      );
    } else {
      videoFadeProgress = 0;
    }

    // --- overlay progress ---
    if (scrolledPx <= scrubEndPx) {
      overlayProgress = scrolledPx > overlayStartPx ? scrolledPx - overlayStartPx : 0;

      if (!isScrubbing) return;
      if (video.readyState < 2) return;

      const progress = Math.min(Math.max(scrolledPx / scrubEndPx, 0), 1);
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
      overlayProgress = scrolledPx - overlayStartPx;
    }

    // --- track last panel fully visible ---
    lastPanelFullyVisible = scrolledPx >= lastPanelFullyInPx;

    // --- sticky background ---
    // Activate once the first overlay panel has started fading in — this is a
    // clean scroll-position signal that can't glitch at the scrub boundary.
    // Deactivate once the exit block has scrolled off.
    const exitBlockGone = scrolledPx >= totalScrollHeight - overlayPanelHeight;
    const overlayVisible = overlayProgress > 0 && !exitBlockGone;
    setSplitActive(overlayVisible);
  }

  // ─── video playback callbacks ──────────────────────────────────────────────

  function startScrubbing() {
    video.pause();
    video.currentTime = scrubStart;
    isScrubbing = true;
    showScrollIndicator = true;
    unlockScroll();
    scrub();
  }

  function checkScrubStart() {
    currentTime = video.currentTime;
    if (video.currentTime >= scrubStart) {
      startScrubbing();
    } else {
      // Still playing the intro — keep scroll locked
      video.requestVideoFrameCallback(checkScrubStart);
    }
  }

  function handleTimeUpdate() {
    currentTime = video.currentTime;
    if (!isScrubbing && video.currentTime >= scrubStart) {
      startScrubbing();
    }
  }

  // ─── setup ────────────────────────────────────────────────────────────────

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

    video.addEventListener('canplaythrough', () => {
      videoLoaded = true;
      videoReady.set(true);
    }, { once: true });

    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      video.requestVideoFrameCallback(checkScrubStart);
    } else {
      video.addEventListener('timeupdate', handleTimeUpdate);
    }

    video.load();

    // Check if we're restoring to a position past the animation intro.
    // If so, jump straight to scrubbing mode without playing the locked intro.
    const restoredY = parseFloat(sessionStorage.getItem(SCROLL_KEY) ?? '0');
    const containerTop = container?.getBoundingClientRect().top ?? 0;
    const restoredScrolledPx = restoredY - (window.scrollY + containerTop);

    if (restoredY > 10 && restoredScrolledPx > scrubStart * PX_PER_SECOND * 0.1) {
      // User was past the intro — skip lock, go straight to scrubbing
      video.addEventListener('loadedmetadata', () => {
        startScrubbing();
      }, { once: true });
    }

    // Intersection observer fires the play + lock (only if not already scrubbing)
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isScrubbing) {
          lockScroll();
          video.play().then(() => {
            video.requestVideoFrameCallback(checkScrubStart);
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(sticky);

    window.addEventListener('scroll', scrub, { passive: true });

    cleanup = () => {
      clearTimeout(fadeTimer);
      unlockScroll();
      setSplitActive(false);
      window.removeEventListener('scroll', scrub);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      observer.disconnect();
    };
  }

  // Key used to save scroll position in sessionStorage so reloads restore position
  const SCROLL_KEY = 'animationsDesktop_scrollY';

  onMount(() => {
    overlayPanelHeight = window.innerHeight;
    mounted = true;

    // (preload link removed — as="video" is not a valid preload type)

    // Save scroll position before the page unloads so we can restore on reload
    const saveScroll = () => sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    window.addEventListener('beforeunload', saveScroll);

    // Restore scroll position if the user was past the animation on last visit.
    // We wait one tick so the container height is painted before scrolling.
    const savedY = parseFloat(sessionStorage.getItem(SCROLL_KEY) ?? '0');
    if (savedY > 10) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, behavior: 'instant' });
      });
    }

    return () => {
      window.removeEventListener('beforeunload', saveScroll);
      cleanup?.();
    };
  });

  $: if (src && video) setupVideo();

  // ─── derived opacity values ────────────────────────────────────────────────

  // Video fades from 1→0 as videoFadeProgress goes 0→1
  $: videoOpacity = 1 - videoFadeProgress;
</script>

<!--
  Layout strategy
  ───────────────
  ONE sticky element covers the entire scrolly section.
  It NEVER releases — it stays sticky until the .scrolly container itself
  scrolls past. This means the background stays pinned correctly.

  The last overlay panel's "scroll away" effect is achieved by a SECOND copy
  of that panel in a normal-flow div placed directly after the sticky inside
  .scrolly. Once lastPanelFullyVisible, this copy is shown (opacity:1) and
  the sticky copy holds at opacity:1 behind it. Because the flow div has
  height:100vh, it pushes the rest of the page down naturally and scrolls away.

  overlayScrollHeight accounts for all overlay scroll distance including the
  last panel's exit viewport.
-->
<div
  class="scrolly"
  bind:this={container}
  style={mounted ? `height: ${totalScrollHeight}px;` : ''}
>
  <!-- ── Sticky layer (never releases) ── -->
  <div
    class="sticky"
    bind:this={sticky}
  >
    {#if mounted}
      <!-- ── Video layer (fades out after scrub) ── -->
      <div
        class="video-layer"
        style="opacity: {videoOpacity};"
        aria-hidden={videoOpacity === 0 ? 'true' : 'false'}
      >
        {#if !videoLoaded}
          <div class="video-loader" aria-label="Video loading">
            <span></span>
            <span></span>
            <span></span>
          </div>
        {/if}

        <video
          bind:this={video}
          preload="auto"
          muted
          playsinline
          disablepictureinpicture
          aria-describedby="video-description"
        >
          <source {src} type="video/mp4" />
        </video>
        <p id="video-description" class="sr-only">{videoLabel}</p>

        {#key displayCaption?.text ?? ''}
          {#if displayCaption}
            <div
              class="caption {displayCaption.class ?? ''}"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {displayCaption.text}
            </div>
          {:else if fadingCaption}
            <div
              class="caption {fadingCaption.class ?? ''} fading"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {fadingCaption.text}
            </div>
          {/if}
        {/key}

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
      </div>

      <!-- ── Overlay panels ── -->
      {#if overlayContent.length > 0}
        <!-- Screen-reader text -->
        <div class="sr-only">
          {#each captions as caption, i (i)}
            <p>{caption.text}</p>
          {/each}
          {#each overlayContent as item, i (i)}
            {#if item.text}<div>{@html item.text}</div>{/if}
            {#if item.alt}<p>{item.alt}</p>{/if}
            {#if item.subCaption}<p>{item.subCaption}</p>{/if}
          {/each}
        </div>

        <div class="overlay-stack" aria-hidden="true">
          {#each overlayContent as item, i (i)}
            <div
              class="overlay-panel {item.class ?? ''}"
              data-block={item.class?.replace('block-', '') ?? ''}
              style={panelStyles[i]}
              aria-hidden={panelVisible[i] ? 'false' : 'true'}
            >
              {#if item.imgSrc}
                {#if item.subCaption}
                  <div class="img-with-caption">
                    <img src={gifSrcs[i] ?? item.imgSrc} alt={item.alt ?? ''} class="overlay-image {item.imgClass ?? ''}" loading="lazy" />
                    <p class="sub-caption">{item.subCaption}</p>
                  </div>
                {:else}
                  <img src={gifSrcs[i] ?? item.imgSrc} alt={item.alt ?? ''} class="overlay-image {item.imgClass ?? ''}" loading="lazy" />
                {/if}
              {/if}
              {#if item.text}
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                <div class="overlay-text {item.textClass ?? ''}">{@html item.text}</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}

  </div><!-- /.sticky -->

  <!--
    Last-panel exit block — sits in normal document flow right after the sticky.
    Height is 100vh so it exactly fills the viewport as it scrolls away.
    Once lastPanelFullyVisible it becomes visible, creating the illusion that
    the last panel (and background) are scrolling away naturally with the page.
    The sticky behind it continues to show the last panel at opacity:1,
    so there's no visual discontinuity.
  -->
  {#if mounted && overlayContent.length > 0}
    {@const lastItem = overlayContent[overlayContent.length - 1]}
    <div
      class="last-panel-exit"
      aria-hidden="true"
      style="opacity: {lastPanelFullyVisible ? 1 : 0};"
    >
      <div
        class="overlay-panel {lastItem.class ?? ''}"
        data-block={lastItem.class?.replace('block-', '') ?? ''}
      >
        {#if lastItem.imgSrc}
          {#if lastItem.subCaption}
            <div class="img-with-caption">
              <img src={lastItem.imgSrc} alt={lastItem.alt ?? ''} class="overlay-image {lastItem.imgClass ?? ''}" loading="lazy" />
              <p class="sub-caption">{lastItem.subCaption}</p>
            </div>
          {:else}
            <img src={lastItem.imgSrc} alt={lastItem.alt ?? ''} class="overlay-image {lastItem.imgClass ?? ''}" loading="lazy" />
          {/if}
        {/if}
        {#if lastItem.text}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <div class="overlay-text {lastItem.textClass ?? ''}">{@html lastItem.text}</div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Snap targets (only rendered client-side; positions depend on window.innerHeight) -->
  {#if mounted}
    {#each snapPositions as pos (pos)}
      <div class="snap-target" style="top: {pos}px;"></div>
    {/each}
  {/if}

</div>

<style>
  /* ── Utilities ─────────────────────────────────────────── */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ── Container ─────────────────────────────────────────── */
  .scrolly {
    width: 100%;
    position: relative;
    left: 50%;
    right: 50%;
    margin-left: -50%;
    margin-right: -50%;
  }

  /* ── Snap ──────────────────────────────────────────────── */
  :global(html) {
    scroll-snap-type: y proximity;
  }

  .snap-target {
    position: absolute;
    left: 0;
    width: 1px;
    height: 1px;
    scroll-snap-align: start;
    pointer-events: none;
  }

  /* ── Single sticky element (never releases) ───────────────── */
  .sticky {
    position: sticky;
    top: 0;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  /* ── Last-panel exit block ─────────────────────────────────
   * Normal-flow 100vh block placed right after .sticky inside .scrolly.
   * When visible it overlays the sticky perfectly (same content, same look)
   * and scrolls naturally upward, giving the "scrolls away with the page" effect.
   * The background (body.scrolly-split-active → #app-background-fixed) is still
   * active at this point so it looks identical to what was in the sticky.
   * setSplitActive(false) fires as the scrolly container itself scrolls away.
   */
  .last-panel-exit {
    position: relative;
    height: 10vh;
    width: 100vw;
    overflow: hidden;
    transition: opacity 0.15s ease;
  }

  /* ── Video layer (inside sticky) ───────────────────────── */
  .video-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    /* opacity driven by JS; small transition smooths the fade */
    transition: opacity 0.1s linear;
  }

  .video-layer video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  /* ── Overlay panels ────────────────────────────────────── */
  .overlay-stack {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }

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

  /* ── Caption ───────────────────────────────────────────── */
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

  /* ── Overlay images / text ─────────────────────────────── */
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

  .overlay-text :global(p) {
    margin: 0 0 1rem 0;
  }
  .overlay-text :global(p:last-child) {
    margin-bottom: 0;
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
    font-size: 0.70rem;
    font-weight: 300;
    margin-top: 0.3rem;
    margin-left: 10%;
    text-align: left;
    max-width: 100%;
  }

  :global(.overlay-img-one) { width: 60%; }
  :global(.overlay-img-two) { width: 60%; }

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
    margin-top: -6rem;
    margin-left: 55%;
    order: 2;
    z-index: 1;
  }

  .overlay-panel[data-block="three"] .overlay-text {
    order: 1;
  }

  /* ── Scroll indicator ──────────────────────────────────── */
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

  /* ── Video loader ──────────────────────────────────────── */
  .video-loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    gap: 0.6rem;
    z-index: 10;
    transition: opacity 0.6s ease;
  }

  .video-loader span {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .video-loader span:nth-child(2) { animation-delay: 0.2s; }
  .video-loader span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50%       { opacity: 1;   transform: scale(1.1); }
  }
</style>