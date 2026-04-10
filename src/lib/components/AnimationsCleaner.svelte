<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  export let src: string = '';
  export let bodyText: string = '';
  export let scrubStart: number = 4;

  $: if (!src && bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      src = base + '/' + (parsed.img ?? '');
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

  function scrub() {
    if (!video || !duration || !isScrubbing) return;
    const { top, height } = container.getBoundingClientRect();
    const progress = Math.min(Math.max(-top / (height - window.innerHeight), 0), 1);
    video.currentTime = scrubStart + progress * (duration - scrubStart);
  }

  function handleTimeUpdate() {
    if (!isScrubbing && video.currentTime >= scrubStart) {
      video.pause();
      isScrubbing = true;
      scrub();
    }
  }

  let cleanup: (() => void) | null = null;
  let initialized = false;

  function setupVideo() {
    if (!video || !src || initialized) return;
    initialized = true;

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

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isScrubbing) {
          video.play();
          observer.disconnect();
        }
      },
      { threshold: 1 }
    );
    observer.observe(sticky);

    window.addEventListener('scroll', scrub, { passive: true });
    window.addEventListener('resize', scrub, { passive: true });

    cleanup = () => {
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
  </div>
</div>

<style>
  .scrolly {
    width: 100vw;
    margin-left: calc(50% - 50vw);
    position: relative;
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
</style>