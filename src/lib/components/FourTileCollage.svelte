<!-- src/lib/components/FourTileCollage.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { tick } from 'svelte';

  export let images: string = '';
  export let alts: string = '';
  export let caption: string = '';
  export let width: string = '95vw';

  let sectionEl: HTMLElement;
  let isVisible = false;
  let observer: IntersectionObserver | null = null;
  let videoEls: HTMLVideoElement[] = [];

  function playAll() {
    videoEls.forEach(v => {
      if (v) v.play().catch(() => {/* autoplay blocked, ignore */});
    });
  }

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
      async (entries) => {
        if (!entries[0].isIntersecting) return;
        isVisible = true;
        observer?.disconnect();
        observer = null;
        await tick(); // wait for videos to render
        playAll();
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

      <!-- ── Top row ── -->
      <div class="row row-top">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <p class="caption">{@html caption}</p>

        <div class="tile tile-1">
          {#if tiles[0]?.type === 'video'}
            <video bind:this={videoEls[0]} src={tiles[0].src} aria-label={tiles[0].alt} autoplay muted loop playsinline>
              <track kind="captions" />
            </video>
          {:else}
            <img src={tiles[0]?.src ?? ''} alt={tiles[0]?.alt ?? ''} />
          {/if}
        </div>

        <div class="right-margin"></div>
      </div>

      <!-- ── Bottom row ── -->
      <div class="row row-bottom">

        <div class="tile tile-2">
          {#if tiles[1]?.type === 'video'}
            <video bind:this={videoEls[1]} src={tiles[1].src} aria-label={tiles[1].alt} autoplay muted loop playsinline>
              <track kind="captions" />
            </video>
          {:else}
            <img src={tiles[1]?.src ?? ''} alt={tiles[1]?.alt ?? ''} />
          {/if}
        </div>

        <div class="right-col-wrapper">

          <div class="tile tile-3">
            {#if tiles[2]?.type === 'video'}
              <video bind:this={videoEls[2]} src={tiles[2].src} aria-label={tiles[2].alt} autoplay muted loop playsinline>
                <track kind="captions" />
              </video>
            {:else}
              <img src={tiles[2]?.src ?? ''} alt={tiles[2]?.alt ?? ''} />
            {/if}
          </div>

          <div class="tile-4-wrapper">
            <div class="tile tile-4">
              {#if tiles[3]?.type === 'video'}
                <video bind:this={videoEls[3]} src={tiles[3].src} aria-label={tiles[3].alt} autoplay muted loop playsinline>
                  <track kind="captions" />
                </video>
              {:else}
                <img src={tiles[3]?.src ?? ''} alt={tiles[3]?.alt ?? ''} />
              {/if}
            </div>
          </div>

        </div>

      </div>

    {:else}
      <!-- Placeholder maintains layout height while images haven't loaded -->
      <div class="placeholder">
        <div class="row row-top">
          <div class="placeholder-caption"></div>
          <div class="tile tile-1 placeholder-tile"></div>
          <div class="right-margin"></div>
        </div>
        <div class="row row-bottom">
          <div class="tile tile-2 placeholder-tile"></div>
          <div class="right-col-wrapper">
            <div class="tile tile-3 placeholder-tile"></div>
            <div class="tile-4-wrapper">
              <div class="tile tile-4 placeholder-tile"></div>
            </div>
          </div>
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
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    padding: 0;
    margin: 0;
    box-sizing: border-box;
  }

  .row {
    display: flex;
    gap: var(--gap);
    width: 100%;
    padding: 0;
    margin: 0;
  }

  .row-top    { align-items: flex-end; }
  .row-bottom { align-items: flex-start; }

  .caption {
    flex: 1;
    min-width: 0;
    margin: 0;
    margin-left: 8rem;
    margin-right: 2.5rem;
    margin-bottom: 1rem;
    padding: 0 8px 4px 0;
    font-size: 1.01rem;
    font-family: "lumios-typewriter-new", elegant typewriter light, monospace;
    line-height: 1.6;
    text-align: left;
    align-self: flex-end;
  }

  .right-margin {
    width: 8%;
    flex-shrink: 0;
  }

  .tile {
    overflow: hidden;
    flex-shrink: 0;
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

  .tile-1 {
    width: 54%;
    aspect-ratio: 5 / 4;
  }

  .tile-2 {
    width: 52%;
    aspect-ratio: 1 / 1;
    flex-shrink: 0;
  }

  .right-col-wrapper {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    margin: 0;
    padding: 0;
  }

  .tile-3 {
    width: 95%;
    aspect-ratio: 1 / 1;
    margin: 0;
  }

  .tile-4-wrapper {
    width: 100%;
    padding-right: 19%;
    margin: 0;
  }

  .tile-4 {
    width: 100%;
    aspect-ratio: 5 / 4;
    margin: 0;
  }

  /* Placeholder tiles match the same dimensions so layout doesn't shift */
  .placeholder-tile {
    background: transparent;
  }

  .placeholder-caption {
    flex: 1;
    min-width: 0;
    margin-left: 10rem;
    margin-right: 2.5rem;
    margin-bottom: 1rem;
  }

  @media (max-width: 1180px) {
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

    .row {
      flex-direction: column;
    }

    .row-top { align-items: stretch; }
    .row-bottom { align-items: stretch; }

    .caption {
      max-width: 100%;
      margin-left: 0;
      text-align: left;
      padding: 0 0 8px 0;
    }

    .right-margin { display: none; }

    .tile-1,
    .tile-2 {
      width: 100%;
    }

    .right-col-wrapper {
      width: 100%;
    }

    .tile-3 {
      width: 100%;
    }

    .tile-4-wrapper {
      padding-right: 0;
    }

    .placeholder-caption {
      margin-left: 0;
    }
  }
</style>