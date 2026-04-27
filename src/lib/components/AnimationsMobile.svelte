<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  export let src: string = '';
  export let bodyText: string = '';
  export let mobileSrc: string = '';
  export let mobileBreakpoint: number = 768;
  export let pausePoints: number[] = [];
  export let captions: {
    start: number;
    end: number;
    text: string;
    class?: string;
    persist?: boolean;
  }[] = [];
  export let mobileCaptions: {
    start: number;
    end: number;
    text: string;
    class?: string;
    persist?: boolean;
  }[] = [];
  export let videoLabel: string = 'Tap-to-continue animation';

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

  $: if (!src && bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      src = base + '/' + (parsed.img ?? '');
      mobileSrc = parsed.mobileSrc ? base + '/' + parsed.mobileSrc : '';
      pausePoints = parsed.pausePoints ?? [];
      captions = (parsed.captions ?? []).map((c: typeof captions[0]) => ({
        ...c,
        text: decodeEntities(c.text)
      }));
      mobileCaptions = (parsed.mobileCaptions ?? []).map((c: typeof captions[0]) => ({
        ...c,
        text: decodeEntities(c.text)
      }));
    } catch (e) {
      console.error('AnimationsMobile: could not parse bodyText', e);
    }
  }

  $: activeCaptions = mobileCaptions.length > 0 ? mobileCaptions : captions;

  let video: HTMLVideoElement;
  let container: HTMLDivElement;
  let currentTime = 0;
  let isPaused = false;
  let showTapButton = false;
  let isEnded = false;
  let isLoaded = false;
  let currentPauseIndex = -1;
  let tapButtonTimer: ReturnType<typeof setTimeout>;

  let persistedCaption: typeof captions[0] | null = null;
  let displayCaption: typeof captions[0] | null = null;
  let fadingCaption: typeof captions[0] | null = null;
  let fadeTimer: ReturnType<typeof setTimeout>;
  let captionBlocked = 0;

  $: sortedPauses = [...pausePoints].sort((a, b) => a - b);
  $: progress = video?.duration ? currentTime / video.duration : 0;

  // The single caption shown at any time — either the live one or the one fading out
  $: activeCaption = displayCaption ?? fadingCaption;
  $: isFading = !displayCaption && !!fadingCaption;

  function updateCaption() {
    if (isPaused) return;
    if (captionBlocked > 0 && currentTime < captionBlocked) return;
    if (captionBlocked > 0 && currentTime >= captionBlocked) captionBlocked = 0;

    const found = activeCaptions.find(c => currentTime >= c.start && currentTime <= c.end) ?? null;
    const pastPersisted = activeCaptions.find(c => c.persist && currentTime > c.end) ?? null;
    const beforePersisted = activeCaptions.find(c => c.persist && currentTime < c.start) ?? null;

    if (beforePersisted) {
      persistedCaption = null;
    } else if (pastPersisted) {
      persistedCaption = pastPersisted;
    }

    const next = found ?? persistedCaption;

    if (next !== displayCaption) {
      if (!next && displayCaption) {
        // Caption leaving — fade it out
        fadingCaption = displayCaption;
        clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => { fadingCaption = null; }, 800);
      } else if (next && displayCaption) {
        // Switching captions — cancel any fade, show new one immediately
        fadingCaption = null;
        clearTimeout(fadeTimer);
      }
      displayCaption = next;
    }
  }

  function handleTimeUpdate() {
    if (!video) return;
    currentTime = video.currentTime;

    const nextPauseIdx = currentPauseIndex + 1;
    if (nextPauseIdx < sortedPauses.length) {
      const nextPause = sortedPauses[nextPauseIdx];
      if (currentTime >= nextPause - 0.05) {
        video.pause();
        video.currentTime = nextPause;
        currentTime = nextPause;
        currentPauseIndex = nextPauseIdx;
        isPaused = true;
        showTapButton = false;
        clearTimeout(tapButtonTimer);
        tapButtonTimer = setTimeout(() => { showTapButton = true; }, 400);
      }
    }

    updateCaption();
  }

  function handleEnded() {
    isEnded = true;
    isPaused = false;
    showTapButton = false;
    clearTimeout(tapButtonTimer);
  }

  function handleCanPlay() {
    isLoaded = true;
  }

  function continuePlayback() {
    if (!video || isEnded) return;
    showTapButton = false;
    clearTimeout(tapButtonTimer);
    if (displayCaption) {
      fadingCaption = displayCaption;
      displayCaption = null;
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => { fadingCaption = null; }, 800);
    }
    const currentEnd = activeCaptions.find(c => c.start <= currentTime && c.end >= currentTime)?.end ?? currentTime;
    captionBlocked = currentEnd + 0.1;
    isPaused = false;
    video.play();
  }

  onMount(() => {
    if (!video) return;

    const useMobile = mobileSrc && window.innerWidth < mobileBreakpoint;
    const activeSrc = useMobile ? mobileSrc : src;
    if (activeSrc) {
      const source = video.querySelector('source');
      if (source) source.setAttribute('src', activeSrc);
      video.load();
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isPaused && !isEnded) {
          video.play().catch(() => {
            isPaused = true;
            showTapButton = false;
            tapButtonTimer = setTimeout(() => { showTapButton = true; }, 400);
          });
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(container);

    return () => {
      observer.disconnect();
      clearTimeout(tapButtonTimer);
      clearTimeout(fadeTimer);
    };
  });
</script>

<div class="animation-mobile" class:ended={isEnded} bind:this={container}>
  <div class="sr-only">
    <p>{videoLabel}</p>
    {#each activeCaptions as c (c.start)}
      <p>{c.text}</p>
    {/each}
  </div>

  <video
    bind:this={video}
    preload="auto"
    muted
    playsinline
    disablepictureinpicture
    aria-describedby="amobile-video-desc"
    on:timeupdate={handleTimeUpdate}
    on:ended={handleEnded}
    on:canplay={handleCanPlay}
  >
    <source {src} type="video/mp4" />
  </video>
  <p id="amobile-video-desc" class="sr-only">{videoLabel}</p>

  {#if isLoaded}
    <div class="progress-bar" aria-hidden="true">
      <div class="progress-fill" style="width: {progress * 100}%"></div>
      {#if video?.duration}
        {#each sortedPauses as p (p)}
          <div class="progress-tick" style="left: {(p / video.duration) * 100}%"></div>
        {/each}
      {/if}
    </div>
  {/if}

  {#if activeCaption}
    <div
      class="caption-row caption-row--{activeCaption.class ?? 'default'}"
      class:fading={isFading}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="caption-text">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html activeCaption.text}
      </div>
    </div>
  {/if}

  {#if isPaused && showTapButton && !isEnded}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="tap-overlay" on:click={continuePlayback}>
      <div class="tap-pill">
        <span>tap to continue</span>
        <div class="tap-pill-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
        </div>
      </div>
    </div>
  {/if}

  {#if isEnded}
    <div class="scroll-indicator" aria-hidden="true">
      <span class="scroll-label">Scroll to continue</span>
      <div class="chevrons">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  {/if}
</div>
<div class="animation-mobile-spacer" aria-hidden="true"></div>

<style>
  .animation-mobile {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
    touch-action: manipulation;
  }

  .animation-mobile.ended {
    position: relative;
    height: 100dvh;
  }

  .animation-mobile-spacer {
    width: 100%;
    height: 100dvh;
  }

  .animation-mobile.ended + .animation-mobile-spacer {
    display: none;
  }

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

  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  .progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.25);
    z-index: 4;
  }

  .progress-fill {
    height: 100%;
    background: #fff;
    transition: width 0.1s linear;
  }

  .progress-tick {
    position: absolute;
    top: -2px;
    width: 2px;
    height: 7px;
    background: rgba(255, 255, 255, 0.7);
    transform: translateX(-50%);
  }

  .caption-row {
    position: absolute;
    left: 0;
    width: 100%;
    z-index: 2;
    box-sizing: border-box;
    animation: fadeIn 0.77s ease;
  }

  .caption-row.fading {
    animation: fadeOut 0.8s ease forwards;
  }

  .caption-row--caption-one  { top: 65%; }
  .caption-row--caption-two  { top: 62%; }
  .caption-row--caption-three{ top: 55%; }
  .caption-row--caption-four { top: 18%; }

  .caption-text {
    font-family: 'Azeret Mono', monospace;
    font-weight: 400;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: break-word;
    padding: 0 1rem;
    box-sizing: border-box;
  }

  .caption-row--caption-one .caption-text {
    font-size: 1.4rem;
    line-height: 1.6rem;
    padding-left: 3%;
    margin-left: 7%;
    color: white;
    text-align: left;
  }

  .caption-row--caption-two .caption-text {
    font-size: 0.85rem;
    margin-top: 15%;
    padding-left: 9%;
    line-height: 1.1rem;
    color: black;
    text-align: left;
    justify-content: center;
  }

  .caption-row--caption-three .caption-text {
    font-size: 0.85rem;
    line-height: 1.1rem;
    margin-top: 10%;
    padding-left: 7%;
    color: black;
    text-align: left;
  }

  .caption-row--caption-four .caption-text {
    font-size: 0.85rem;
    line-height: 1.1rem;
    margin-top: 37%;
    color: black;
    text-align: center;
  }

  .caption-text :global(p) {
    margin: 0 0 0.4rem 0;
  }
  .caption-text :global(p:last-child) {
    margin-bottom: 0;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-4px); }
  }

  .tap-overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 8%;
    cursor: pointer;
    animation: overlayIn 0.4s ease;
  }

  @keyframes overlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .tap-pill {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
    background: white;
    border: 2px solid #c8d8f0;
    border-radius: 999px;
    padding: 0.5rem 0.75rem 0.5rem 1.1rem;
    box-shadow: 0 2px 12px rgba(100,140,200,0.18), 0 1px 3px rgba(0,0,0,0.08);
    font-family: 'Azeret Mono', monospace;
    font-size: 0.8rem;
    font-weight: 500;
    color: #111;
    letter-spacing: 0.01em;
  }

  .tap-pill-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    color: #222;
  }

  .tap-pill-icon svg {
    width: 28px;
    height: 28px;
  }

  .scroll-indicator {
    position: absolute;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    color: black;
    pointer-events: none;
    z-index: 5;
    animation: overlayIn 0.6s ease;
  }

  .scroll-label {
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 600;
    font-family: 'Azeret Mono', monospace;
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