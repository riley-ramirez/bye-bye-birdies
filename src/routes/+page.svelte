<script lang="ts">
  import rawBlocks from '$lib/doc.blocks.json';
  import DocRenderer from '$lib/components/DocRenderer.svelte';
  import type { Block } from '$lib/components/DocRenderer.svelte';
  import { base } from '$app/paths';
  import Hero from '$lib/components/Hero.svelte';

  const blocks = rawBlocks as Block[];
  const PRE_HERO_COUNT = 2; // number of blocks to show before the hero section; 0:html (empty), 1:AnimationsCleaner, 2:html (empty), 3:Background
  const preHeroBlocks = blocks.slice(0, PRE_HERO_COUNT);
  const postHeroBlocks = blocks.slice(PRE_HERO_COUNT);

</script>



<!-- 
Hard-code custom code that should appear BEFORE Google Doc here. 
This code is in +page.svelte and can be manually coded using HTML or Svelte tags.
-->

<!-- Blocks that appear BEFORE the hero (AnimationsCleaner + Background) -->
<DocRenderer blocks={preHeroBlocks} />


<Hero />


<!-- Byline -->
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

<!-- DO NOT EDIT (except to modify classes). This will become code imported from Google Doc. -->
<div class="container">
  <div class="row justify-content-center">
    <div class="col-12 col-sm-10 col-lg-8 col-xxl-6">
      <DocRenderer blocks={postHeroBlocks} />
    </div>
  </div>
</div>


<!-- Hard-code any custom code that should appear AFTER Google Doc below here. -->
<footer class="container-fluid bg-dark text-white p-5">
  <p class="text-center">See template on <a class="text-white" href="https://github.com/jrue/multimedia-template-2026" target="_blank">Github</a></p>
</footer>