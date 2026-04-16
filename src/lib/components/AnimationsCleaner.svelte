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

  $: if (!src && bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      src = base + '/' + (parsed.img ?? '');
      mobileSrc = parsed.mobileSrc ? base + '/' + parsed.mobileSrc : '';
      captions = parsed.captions ?? [];
    } catch (e) {
      console.error('Animations: could not parse bodyText', e);
    }
  }

  const PX_PER_SECOND = 900;
  let container: HTMLDivElement;
  let sticky: HTMLDivElement;
  let video: HTMLVideoElement;
  let duration = 0;
  let scrollHeight = 5000;
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
    if (!video || !duration || !isScrubbing) return;
    if (video.readyState < 2) return;

    const { top, height } = container.getBoundingClientRect();
    const progress = Math.min(Math.max(-top / (height - window.innerHeight), 0), 1);
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
        scrollHeight = (duration - scrubStart) * PX_PER_SECOND + window.innerHeight;
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
    return () => cleanup?.();
  });

  $: if (src && video) setupVideo();
</script>

<div class="scrolly" bind:this={container} style="height: {scrollHeight}px;">
  <div class="sticky" bind:this={sticky}>
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
</div>

<style>
  .scrolly {
    width: 100%;
    position: relative;
    left: 50%;
    right: 50%;
    margin-left: -50%;
    margin-right: -50%;
  }
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
    color: white;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.6s ease;
    filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.5));
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

  /* Base caption styles — shared by all captions */
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

  /* Per-caption overrides — add as many classes as you need */
  :global(.caption-two) {
    bottom: auto !important;
    top: 71% !important;
    left: 30% !important;
    font-size: 1.12rem !important;
    color: black !important;
    line-height: 1.5rem !important;
    font-weight: 200 !important;
  }
</style>