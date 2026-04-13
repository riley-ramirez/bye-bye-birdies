<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  export let src: string = '';
  export let bodyText: string = '';
  export let scrubStart: number = 4;
  export let mobileSrc: string = '';
  export let mobileBreakpoint: number = 768;

  $: if (!src && bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      src = base + '/' + (parsed.img ?? '');
      mobileSrc = parsed.mobileSrc ? base + '/' + parsed.mobileSrc : '';
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
  let indicatorTimer: ReturnType<typeof setTimeout>;  // ADD

  function scrub() {
    if (!video || !duration || !isScrubbing) return;
    const { top, height } = container.getBoundingClientRect();
    const progress = Math.min(Math.max(-top / (height - window.innerHeight), 0), 1);
    video.currentTime = scrubStart + progress * (duration - scrubStart);

    if (progress > 0.02) showScrollIndicator = false;
  }

  function handleTimeUpdate() {
    if (!isScrubbing && video.currentTime >= scrubStart) {
      video.pause();
      isScrubbing = true;
      showScrollIndicator = true;
      clearTimeout(indicatorTimer);  // ADD — cancel fallback if video worked
      scrub();
    }
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

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.load();

    // ADD — fallback: show indicator after 5s if video never triggers handleTimeUpdate
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
      { threshold: 0 }
    );
    observer.observe(sticky);

    window.addEventListener('scroll', scrub, { passive: true });
    window.addEventListener('resize', scrub, { passive: true });

    cleanup = () => {
      clearTimeout(indicatorTimer);  // ADD
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
    /* Subtle drop shadow so it reads on any video frame */
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
    /* Staggered bounce animation on the two chevrons */
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