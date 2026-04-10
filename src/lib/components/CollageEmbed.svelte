<!-- CollageEmbed.svelte -->
<script lang="ts">
  import { base } from '$app/paths';

  export let images: string = '';
  export let alts: string = '';
  export let caption: string = '';
  export let layout: 'masonry' | 'asymmetric' | 'grid' = 'masonry';
  export let columns: number = 3;
  // Comma-separated aspect ratios per image e.g. "1/1, 4/3, 2/3, 16/9"
  export let sizes: string = '';
  // How wide to stretch beyond the column e.g. "100vw", "80vw", "120%"
  export let width: string = '80vw';

  $: imageList = images.split(',').map(s => s.trim()).filter(Boolean);
  $: altList = alts.split(',').map(s => s.trim());
  $: sizeList = sizes.split(',').map(s => s.trim());
  $: getAlt = (i: number) => altList[i] ?? '';
  $: getSize = (i: number) => sizeList[i] ?? '1/1';
</script>

<figure class="collage-embed layout-{layout}" style="--cols: {columns}; --width: {width}">
  {#each imageList as img, i}
    <div class="collage-item" style="--ratio: {getSize(i)}">
      <img src="{base}/{img}" alt={getAlt(i)} />
    </div>
  {/each}
  {#if caption}
    <figcaption>{caption}</figcaption>
  {/if}
</figure>

<style>
  .collage-embed {
    /* Break out of text column */
    width: var(--width);
    position: relative;
    left: 50%;
    transform: translateX(-50%);
    margin: 0 0 2rem;
  }

  /* Grid layout — respects individual aspect ratios */
  .layout-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 0.5rem;
  }

  .layout-grid .collage-item {
    aspect-ratio: var(--ratio);
    overflow: hidden;
  }

  /* Masonry — natural heights, CSS columns */
  .layout-masonry {
    columns: var(--cols);
    column-gap: 0.5rem;
  }

  .layout-masonry .collage-item {
    break-inside: avoid;
    margin-bottom: 0.5rem;
    aspect-ratio: var(--ratio);
    overflow: hidden;
  }

  /* Asymmetric — first image large, rest fill right column */
  .layout-asymmetric {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 0.5rem;
  }

  .layout-asymmetric .collage-item:first-child {
    grid-row: 1 / 3;
    aspect-ratio: var(--ratio);
  }

  .layout-asymmetric .collage-item:not(:first-child) {
    aspect-ratio: var(--ratio);
    overflow: hidden;
  }

  .collage-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .layout-masonry .collage-item img {
    height: 100%;
  }

  figcaption {
    font-size: 0.85rem;
    opacity: 0.7;
    margin-top: 0.5rem;
  }
</style>