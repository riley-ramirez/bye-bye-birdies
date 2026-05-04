<script lang="ts">
	import { base } from "$app/paths";
  import { onMount } from "svelte";

  // DocRenderer passes these from the shortcode attrs
  export let src: string = '';
  export let bodyText: string = '';

  // Parse src from bodyText if src wasn't passed directly
  $: if (!src && bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      src = base + '/' + (parsed.img ?? '');
    } catch (e) {
      console.error('Animations: could not parse bodyText', e);
    }
  }

  let container: HTMLDivElement | null = null;
  let sticky: HTMLDivElement | null = null;
  let video: HTMLVideoElement | null = null;

  let duration = 0;
  let targetTime = 0;
  let currentTime = 0;
  let rafId: number;
  let isReady = false;
  let isScrollScrubbing = false;
  let scrollHeight = 5000;

  let containerTop = 0;
  let containerH = 0;
  let scrollable = 0;
  let progress = 0;

  const PX_PER_SECOND = 200;

  function updateScroll() {
    if (!container || !duration) return;

    const rect = container.getBoundingClientRect();
    containerTop = rect.top + window.scrollY;
    containerH = container.offsetHeight;
    scrollable = containerH - window.innerHeight;

    const scrolled = window.scrollY - containerTop;
    progress = Math.min(Math.max(scrolled / scrollable, 0), 1);

    if (isScrollScrubbing) {
      targetTime = progress * duration;
    }
  }

  function startScrubLoop() {
    function loop() {
      if (video && isReady && isScrollScrubbing) {
        currentTime += (targetTime - currentTime) * 0.12;
        if (Math.abs(video.currentTime - currentTime) > 0.01) {
          video.currentTime = currentTime;
        }
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function initVideo() {
    if (!video) return;

    duration = video.duration;
    scrollHeight = duration * PX_PER_SECOND + window.innerHeight;
    isReady = true;
    video.currentTime = 0;
    currentTime = 0;
    targetTime = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio >= 0.99) {
          video!.play();
          observer.disconnect();
        }
      },
      { threshold: 0.99 }
    );

    if (sticky) observer.observe(sticky);

    video.addEventListener('ended', () => {
      isScrollScrubbing = true;
      currentTime = duration;
      targetTime = duration;
      updateScroll();
      startScrubLoop();
    }, { once: true });
  }

  onMount(() => {
  console.log('1. onMount fired');
  console.log('2. video element:', video);
  console.log('3. sticky element:', sticky);
  console.log('4. container element:', container);

  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", updateScroll, { passive: true });

  if (video) {
    console.log('5. video found, readyState:', video.readyState);
    if (video.readyState >= 1) {
      console.log('6a. metadata already ready, calling initVideo');
      initVideo();
    } else {
      console.log('6b. waiting for loadedmetadata...');
      video.addEventListener('loadedmetadata', () => {
        console.log('7. loadedmetadata fired!');
        initVideo();
      }, { once: true });
    }
  } else {
    console.log('5. ERROR — video element is null');
  }

  return () => {
    window.removeEventListener("scroll", updateScroll);
    window.removeEventListener("resize", updateScroll);
    cancelAnimationFrame(rafId);
  };
});
</script>

<div class="scrolly" bind:this={container} style="height: {scrollHeight}px;">
  <div class="sticky" bind:this={sticky}>
    <video
      bind:this={video}
      preload="auto"
      muted
      playsinline
      disablepictureinpicture
    >
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