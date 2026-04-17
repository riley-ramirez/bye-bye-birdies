<!-- src/lib/components/FourTileCollage.svelte -->
<script lang="ts">
  import { base } from '$app/paths';

  export let images: string = '';
  export let alts: string = '';
  export let caption: string = '';
  export let width: string = '95vw';

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
</script>

<div class="collage-bleed">
  <div class="collage-inner" style="width: {width}">

    <!-- ── Top row ── -->
    <div class="row row-top">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <p class="caption">{@html caption}</p>

      <div class="tile tile-1">
        {#if tiles[0]?.type === 'video'}
          <video src={tiles[0].src} aria-label={tiles[0].alt} autoplay muted loop playsinline>
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
          <video src={tiles[1].src} aria-label={tiles[1].alt} autoplay muted loop playsinline>
            <track kind="captions" />
          </video>
        {:else}
          <img src={tiles[1]?.src ?? ''} alt={tiles[1]?.alt ?? ''} />
        {/if}
      </div>

      <div class="right-col-wrapper">

        <div class="tile tile-3">
          {#if tiles[2]?.type === 'video'}
            <video src={tiles[2].src} aria-label={tiles[2].alt} autoplay muted loop playsinline>
              <track kind="captions" />
            </video>
          {:else}
            <img src={tiles[2]?.src ?? ''} alt={tiles[2]?.alt ?? ''} />
          {/if}
        </div>

        <div class="tile-4-wrapper">
          <div class="tile tile-4">
            {#if tiles[3]?.type === 'video'}
              <video src={tiles[3].src} aria-label={tiles[3].alt} autoplay muted loop playsinline>
                <track kind="captions" />
              </video>
            {:else}
              <img src={tiles[3]?.src ?? ''} alt={tiles[3]?.alt ?? ''} />
            {/if}
          </div>
        </div>

      </div>

    </div>

  </div>
</div>

<style>
  .collage-bleed {
    /* break out of article column */
    width: 100vw;
    position: relative;
    left: 50%;
    margin-left: -50vw;
    margin-right: -50vw;
    margin-top: 2.5rem;
    margin-bottom: 2.5rem;
    /* center the inner collage */
    display: flex;
    justify-content: center;
    align-items: flex-start;
    /* reset any inherited figure/block styles */
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
    /* ALL horizontal gaps between tiles use the same --gap */
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
    margin-left: 10rem;
    margin-right: 2.5rem;
    margin-bottom: 1rem;
    padding: 0 8px 4px 0;
    font-size: 0.85rem;
    font-family: Azeret Mono, monospace;
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
    width: 46%;
    aspect-ratio: 5 / 4;
  }

  .tile-2 {
    width: 57%;
    aspect-ratio: 1 / 1;
    flex-shrink: 0;
  }

  .right-col-wrapper {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    /* vertical gap between tile-3 and tile-4 — same variable */
    gap: var(--gap);
    margin: 0;
    padding: 0;
  }

  .tile-3 {
    width: 100%;
    aspect-ratio: 1 / 1;
    margin: 0;
  }

  /* tile-4 inset so its right edge aligns with tile-1's right edge */
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

    .tile-4-wrapper {
      padding-right: 0;
    }
  }
</style>