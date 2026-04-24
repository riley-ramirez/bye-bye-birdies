<!-- src/lib/components/ThreeTileCollage.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  export let images: string = '';
  export let alts: string = '';
  export let caption: string = '';
  export let width: string = '95vw';

  let sectionEl: HTMLElement;
  let isVisible = false;
  let observer: IntersectionObserver | null = null;

  function normalizeStaticPath(raw: string): string {
    const s = raw.trim();
    if (!s) return '';
    if (/^data:/i.test(s) || /^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return base + s;
    return base + '/' + s;
  }

  function inferType(src: string): 'video' | 'image' {
    return /\.(mp4|webm|ogg|mov)$/i.test(src.trim()) ? 'video' : 'image';
  }

  type Tile = { src: string; type: 'video' | 'image'; alt: string; };

  $: tiles = ((): Tile[] => {
    const srcs = images.split(',').map(s => s.trim());
    const altList = alts.split(',').map(s => s.trim());
    return srcs.map((src, i) => ({
      src: normalizeStaticPath(src),
      type: inferType(src),
      alt: altList[i] ?? '',
    }));
  })();

  onMount(() => {
    if (!browser) return;

    observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        isVisible = true;
        observer?.disconnect();
        observer = null;
      },
      { rootMargin: '500px 0px' }
    );

    if (sectionEl) observer.observe(sectionEl);
  });

  onDestroy(() => {
    observer?.disconnect();
  });
</script>

<div class="collage-bleed" bind:this={sectionEl}>
  <div class="collage-inner" style="width: {width}">

    {#if isVisible}
      <div class="grid">

        <!-- Left column: tile 1 + tile 3 stacked, gap always exactly --gap -->
        <div class="left-col-wrapper">
          <div class="tile tile-1">
            {#if tiles[0]?.type === 'video'}
              <video src={tiles[0].src} aria-label={tiles[0].alt} autoplay muted loop playsinline>
                <track kind="captions" />
              </video>
            {:else}
              <img src={tiles[0]?.src ?? ''} alt={tiles[0]?.alt ?? ''} />
            {/if}
          </div>

          <div class="tile-3-wrapper">
            <div class="tile tile-3">
              {#if tiles[2]?.type === 'video'}
                <video src={tiles[2].src} aria-label={tiles[2].alt} autoplay muted loop playsinline>
                  <track kind="captions" />
                </video>
              {:else}
                <img src={tiles[2]?.src ?? ''} alt={tiles[2]?.alt ?? ''} />
              {/if}
            </div>
          </div>
        </div>

        <!-- Right column: spacer + tile 2 + caption -->
        <div class="right-col">
          <div class="tile-2-spacer"></div>
          <div class="tile tile-2">
            {#if tiles[1]?.type === 'video'}
              <video src={tiles[1].src} aria-label={tiles[1].alt} autoplay muted loop playsinline>
                <track kind="captions" />
              </video>
            {:else}
              <img src={tiles[1]?.src ?? ''} alt={tiles[1]?.alt ?? ''} />
            {/if}
          </div>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          <p class="caption">{@html caption}</p>
        </div>

      </div>

    {:else}
      <div class="grid">
        <div class="left-col-wrapper">
          <div class="tile tile-1 placeholder-tile"></div>
          <div class="tile-3-wrapper">
            <div class="tile tile-3 placeholder-tile"></div>
          </div>
        </div>
        <div class="right-col">
          <div class="tile-2-spacer"></div>
          <div class="tile tile-2 placeholder-tile"></div>
          <div class="placeholder-caption"></div>
        </div>
      </div>
    {/if}

  </div>
</div>

<style>
  .collage-bleed {
    width: 100vw;
    position: relative;
    left: 50%;
    margin-left: -50vw;
    margin-right: -50vw;
    margin-top: 8rem;
    margin-bottom: 8rem;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 0;
    border: none;
    background: none;
    box-sizing: border-box;
  }

  .collage-inner {
    --gap: 10px;
    padding: 0;
    margin: 0 auto;
    box-sizing: border-box;
  }

  /* Two flex columns side by side */
  .grid {
    display: flex;
    gap: var(--gap);
    width: 100%;
    align-items: flex-start;
  }

  /* Left column: tile 1 stacked above tile 3 — gap is always exactly --gap */
  .left-col-wrapper {
    flex: 0 0 55%;
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    min-width: 0;
  }

  .tile-1 {
    width: 100%;
    aspect-ratio: 5 / 4;
  }

  .tile-3-wrapper {
    display: flex;
    justify-content: flex-end;
  }

  .tile-3 {
    width: 80%;
    aspect-ratio: 1 / 1;
    flex-shrink: 0;
  }

  /* Right column: spacer + tile 2 + caption */
  .right-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  /*
   * Spacer pushes tile 2 down to ~26% of tile 1 height.
   * Tile 1 h = 55% * (4/5) = 44% of collage-inner.
   * Right col w = 45% of collage-inner.
   * 26% of tile1_h as % of right col = (0.44 * 0.26) / 0.45 * 100 = 25.4%
   */
  .tile-2-spacer {
    width: 100%;
    padding-top: 35%;
    flex-shrink: 0;
  }

  .tile-2 {
    width: 100%;
    aspect-ratio: 1 / 1;
    flex-shrink: 0;
  }

  .caption {
    margin: 1rem 0 0 5rem;
    padding-left: 1.5rem;
    width: 100%;
    font-size: 0.85rem;
    font-family: Azeret Mono, monospace;
    line-height: 1.6;
    text-align: left;
  }

  /* ── Shared tile styles ── */
  .tile {
    overflow: hidden;
    margin: 0;
    padding: 0;
  }

  .tile img,
  .tile video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .placeholder-tile {
    background: transparent;
  }

  .placeholder-caption {
    height: 2rem;
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .collage-bleed {
      width: 100%;
      position: static;
      left: auto;
      margin-left: 0;
      margin-right: 0;
    }

    .collage-inner {
      width: 100% !important;
    }

    .grid {
      flex-direction: column;
    }

    .left-col-wrapper {
      flex: none;
      width: 100%;
    }

    .right-col {
      width: 100%;
      align-items: flex-start;
    }

    .tile-2-spacer {
      display: none;
    }

    .tile-3-wrapper {
      justify-content: flex-start;
    }

    .tile-1,
    .tile-2,
    .tile-3 {
      width: 100%;
    }
  }
</style>