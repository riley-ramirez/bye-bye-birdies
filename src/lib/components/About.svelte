<!-- src/lib/components/About.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  export let bodyHtml: string | undefined = undefined;

  let section: HTMLElement;
  let visible = false;
  let cardY = 100;
  let topFadeStop = '0%';
  let isMobile = true;
  let sectionInView = false;

  onMount(() => {
    isMobile = window.innerWidth < 640;

    function onResize() {
      isMobile = window.innerWidth < 640;
    }

    function onScroll() {
      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top;
      const vh = window.innerHeight;

      if (isMobile) {
        if (sectionTop > 0) {
          const ratio = Math.min(sectionTop / vh, 1);
          const fadePercent = Math.round(30 + ratio * 70);
          topFadeStop = `${fadePercent}%`;
        } else if (sectionTop > -vh) {
          const ratio = 1 - Math.min(-sectionTop / vh, 1);
          const fadePercent = Math.round(ratio * 30);
          topFadeStop = `${fadePercent}%`;
        } else {
          topFadeStop = '0%';
        }
        return;
      }

      // Desktop scroll logic
      if (sectionTop <= 0) {
        visible = true;
        setTimeout(() => { sectionInView = true; }, 1800);
      } else {
        visible = false;
        sectionInView = false;
      }

      const delay = vh * 0.5;
      const scrolledPastDelay = Math.max(0, -sectionTop - delay);
      const raw = 100 - (scrolledPastDelay / vh) * 100;
      cardY = Math.max(0, raw);

      if (sectionTop > 0) {
        const ratio = Math.min(sectionTop / vh, 1);
        const fadePercent = Math.round(ratio * 900);
        topFadeStop = `${fadePercent}%`;
      } else {
        topFadeStop = '0%';
      }
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };
  });
</script>

<div class="about-section" bind:this={section}>
  {#if isMobile}
    <div class="mobile-spacer"></div>
    <div
      class="mobile-sticky-frame"
      style="mask-image: linear-gradient(to bottom, transparent 0%, black {topFadeStop}, black 100%);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black {topFadeStop}, black 100%);"
    >
      <video
        src="{base}/videos/pines.mp4"
        autoplay
        muted
        loop
        playsinline
        preload="auto"
        class="mobile-video"
      ></video>
    </div>
    {#if bodyHtml}
      <div class="mobile-card">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="about-body">{@html bodyHtml}</div>
      </div>
    {/if}


  {:else}
    <!-- DESKTOP: scroll-driven sticky layout -->
    <div
      class="about-sticky-frame"
      style="mask-image: linear-gradient(to bottom, transparent 0%, black {topFadeStop}, black 100%);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black {topFadeStop}, black 100%);"
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
          class:card-visible={sectionInView}
          style="transform: translate(-50%, calc(-50% + {cardY}vh));"
        >
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <div class="about-body">{@html bodyHtml}</div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .about-section {
    position: relative;
    width: 100vw;
    left: 50%;
    transform: translateX(-50%);
    height: 300vh;
    z-index: 0;
  }

  /* ── MOBILE ── */
  @media (max-width: 640px) {
    .about-section {
      height: 500vh;
    }
  }

  .mobile-spacer {
    height: 75vh;
  }

  .mobile-sticky-frame {
    position: sticky;
    top: 0;
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }

  .mobile-video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 1;
  }

  .mobile-card {
    position: relative;
    z-index: 2;
    width: 88%;
    margin: -4rem auto 0;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(10px);
    border-radius: 6px;
    padding: 2rem;
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.2);
  }

  /* ── DESKTOP ── */
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
    opacity: 0.25;
    transition: opacity 1.8s ease-out 0.3s;
  }

  .about-video.visible {
    opacity: 1;
  }

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
    max-height: 90vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(0,0,0,0.2) transparent;
    opacity: 0;
    transition: opacity 1.2s ease-out;
  }

  .about-card.card-visible {
    opacity: 1;
  }

  .about-card::-webkit-scrollbar {
    width: 4px;
  }
  .about-card::-webkit-scrollbar-track {
    background: transparent;
  }
  .about-card::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.2);
    border-radius: 2px;
  }

  /* ── Shared body text ── */
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