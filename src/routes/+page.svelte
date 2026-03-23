<script lang="ts">
  import rawBlocks from '$lib/doc.blocks.json';
  import DocRenderer from '$lib/components/DocRenderer.svelte';
  import type { Block } from '$lib/components/DocRenderer.svelte';
  const blocks = rawBlocks as Block[];
</script>



<!-- 
Hard-code custom code that should appear BEFORE Google Doc here. 
This code is in +page.svelte and can be manually coded using HTML or Svelte tags.
-->
<header class="container-fluid vh-100 mb-4 position-relative overflow-hidden">

  <!-- Video -->
  <video autoplay muted loop playsinline class="bg-video">
    <source src="videos/0_hero_stablized.mp4" type="video/mp4">
  </video>

  <!-- Text content -->
  <div class="hero-content text-white">
    <h1 class="hero-title">
      <span class="line1">Bye Bye</span><br>
      <span class="line2">Birdies</span>
    </h1>

   <p class="fw-light" style="margin-top: 2.5rem; font-size: 1.15rem;">
      Six years after scientists reported that billions of birds vanished from 
      the North American landscape since 1970, conservationists are still racing 
      to reverse catastrophic losses that show no sign of slowing down.
    </p>

    <p class="fw-light">
      By Riley Ramirez
    </p>
  </div> 

</header>


<!-- DO NOT EDIT (except to modify classes). This will become code imported from Google Doc. -->
<div class="container">
  <div class="row justify-content-center">
    <div class="col-12 col-sm-10 col-lg-8 col-xxl-6">
      <DocRenderer {blocks} />
    </div>
  </div>
</div>


<!-- Hard-code any custom code that should appear AFTER Google Doc below here. -->
<footer class="container-fluid bg-dark text-white p-5">
  <p class="text-center">See template on <a class="text-white" href="https://github.com/jrue/multimedia-template-2026" target="_blank">Github</a></p>
</footer>