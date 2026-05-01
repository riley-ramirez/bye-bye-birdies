<!-- src/lib/components/About.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  export let bodyHtml: string | undefined = undefined;

  let section: HTMLElement;
  let visible = false;
  let cardY = 100; // vh offset from center, counts down to 0
  let topFadeStop = '0%'; // how far down the fade goes on the top edge

  onMount(() => {
    const fadeObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          visible = true;
          fadeObserver.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    fadeObserver.observe(section);

    function onScroll() {
      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top;
      const vh = window.innerHeight;

      // Card starts moving 30vh after video fills screen
      const delay = vh * 0.3;
      const scrolledPastDelay = Math.max(0, -sectionTop - delay);
      const raw = 100 - (scrolledPastDelay / vh) * 100;
      cardY = Math.max(0, raw);

      // Top fade: when user scrolls back up and sectionTop becomes positive,
      // fade the top edge of the frame so outro text above is readable
      if (sectionTop > 0) {
        const ratio = Math.min(sectionTop / vh, 1);
        const fadePercent = Math.round(ratio * 900);
        topFadeStop = `${fadePercent}%`;
      } else {
        topFadeStop = '0%';
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      fadeObserver.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  });
</script>

<div class="about-section" bind:this={section}>
  <!-- Video and card share the same sticky container so they move together -->
  <div
    class="about-sticky-frame"
    style="mask-image: linear-gradient(to bottom, transparent 0%, black {topFadeStop}, black 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black {topFadeStop}, black 100%);"
  >
    <video
      src="{base}/videos/pines.mp4"
      autoplay
      muted
      loop
      playsinline
      preload="auto"
      class="about-video"
      class:visible
    ></video>

    {#if bodyHtml}
      <div
        class="about-card"
        style="transform: translate(-50%, calc(-50% + {cardY}vh));"
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="about-body">{@html bodyHtml}</div>
      </div>
    {/if}
  </div>
</div>

<style>
  .about-section {
    position: relative;
    width: 100vw;
    left: 50%;
    transform: translateX(-50%);
    /*
      100vh: video fills screen, card offscreen below
      100vh: card scrolls up to center
      100vh: video + card scroll away together
    */
    height: 300vh;
    z-index: 0;
  }

  /* Single sticky frame — video AND card are children so they exit together */
  .about-sticky-frame {
    position: sticky;
    top: 0;
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }

  .about-video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 1.8s ease-out 0.3s;
  }

  .about-video.visible {
    opacity: 1;
  }

  /* Card is absolutely positioned inside the sticky frame */
  .about-card {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 90%;
    max-width: 590px;
    z-index: 1;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(10px);
    border-radius: 6px;
    padding: 2.5rem;
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.2);
  }

  .about-body :global(p) {
    font-size: 0.9rem;
    font-family: sans-serif;
    line-height: 1.3;
    color: #000000;
  }

  .about-body :global(p:empty) {
    display: none;
  }

  .about-body :global(p + p:has(strong)) {
    margin-top: 2rem;
  }

  .about-body :global(p:last-child) {
    margin-bottom: 0;
  }
</style>