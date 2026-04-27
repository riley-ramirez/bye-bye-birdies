<script lang="ts">
  import rawBlocks from '$lib/doc.blocks.json';
  import DocRenderer from '$lib/components/DocRenderer.svelte';
  import type { Block } from '$lib/components/DocRenderer.svelte';
  import { base } from '$app/paths';
  import Hero from '$lib/components/Hero.svelte';
  import { videoReady } from '$lib/stores/videoReady';

  const blocks = rawBlocks as Block[];
  const PRE_HERO_COUNT = 2;
  const preHeroBlocks = blocks.slice(0, PRE_HERO_COUNT);
  const postHeroBlocks = blocks.slice(PRE_HERO_COUNT);
</script>

{#if !$videoReady}
  <div class="page-loader">
    <span></span><span></span><span></span>
  </div>
{/if}

<div class:hidden={!$videoReady}>

  <DocRenderer blocks={preHeroBlocks} />

  <Hero />

  <div class="byline container">
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-lg-8 col-xxl-6">
        <div class="d-flex align-items-center gap-3">
          <img src="{base}/images/headshot-gray.png" alt="Riley Ramirez" style="width: 55px; height: 55px; border-radius: 50%; object-fit: cover;" loading="lazy">
          <p class="mb-0" style="line-height: 1.2;">
            <strong>By Riley Ramirez</strong><br>
            <span style="font-size: 1.1rem; opacity: 0.6;">UC Berkeley Graduate School of Journalism</span>
          </p>
        </div>
        <p class="fw-light mt-2 mb-0" style="font-size: 0.9rem; color: grey; padding-top: 0.1rem;">
          May 5, 2026
        </p>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-lg-8 col-xxl-6">
        <DocRenderer blocks={postHeroBlocks} />
      </div>
    </div>
  </div>

  <footer class="container-fluid bg-dark text-white p-4" style="margin-top: 4rem;">
    <p class="text-center">This project was produced at the UC Berkeley Graduate School of Journalism.</p>
  </footer>

</div>

<style>
  .page-loader {
    position: fixed;
    inset: 0;
    background: url('/animation/first-frame.jpg') center center / cover no-repeat;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    z-index: 9999;
  }

  .page-loader::before {
    content: '';
    position: absolute;
    inset: 0;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(0, 0, 0, 0.15);
    z-index: 0;
  }

  .page-loader span {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    animation: pulse 1.2s ease-in-out infinite;
    position: relative;
    z-index: 1;
  }

  .page-loader span:nth-child(2) { animation-delay: 0.2s; }
  .page-loader span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50%       { opacity: 1;   transform: scale(1.1); }
  }

  .hidden {
    visibility: hidden;
  }
</style>