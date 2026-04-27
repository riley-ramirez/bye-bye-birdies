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

  $: if ($videoReady) {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.classList.add('done');
      loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    }
  }
</script>

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