<script lang="ts">
  import { base } from '$app/paths';
  import VideoEmbed from '$lib/components/VideoEmbed.svelte';
  import CollageEmbed from '$lib/components/CollageEmbed.svelte';

  export let img = '';
  export let bodyHtml = '';

  type HtmlChunk = { type: 'html'; html: string };
  type VideoChunk = { type: 'VideoEmbed'; attrs: Record<string, string> };
  type GifChunk = { type: 'GifEmbed'; attrs: Record<string, string> };
  type CollageChunk = { type: 'CollageEmbed'; attrs: Record<string, string> };
  type Chunk = HtmlChunk | VideoChunk | GifChunk | CollageChunk;

  function parseChunks(html: string): Chunk[] {
    const flat = html
      .replace(/<\/p>\s*<p>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const chunks: Chunk[] = [];
    const re = /\[\[(VideoEmbed|GifEmbed|CollageEmbed)([\s\S]*?)\]\]/g;
    let cursor = 0;
    let match;

    while ((match = re.exec(flat)) !== null) {
      if (match.index > cursor) {
        const text = flat.slice(cursor, match.index).trim();
        if (text) chunks.push({ type: 'html', html: `<p>${text.replace(/\n+/g, '</p><p>')}</p>` });
      }

      const attrs: Record<string, string> = {};
      const attrRe = /([A-Za-z_][\w-]*)="([^"]*)"/g;
      let a;
      while ((a = attrRe.exec(match[2])) !== null) {
        attrs[a[1]] = a[2];
      }
      chunks.push({ type: match[1] as 'VideoEmbed' | 'GifEmbed', attrs });
      cursor = match.index + match[0].length;
    }

    if (cursor < flat.length) {
      const text = flat.slice(cursor).trim();
      if (text) chunks.push({ type: 'html', html: `<p>${text.replace(/\n+/g, '</p><p>')}</p>` });
    }

    return chunks;
  }

  $: chunks = parseChunks(bodyHtml);
</script>

<section class="background-section">
  <div class="bg-clip">
    <img class="bg" src="{base}/{img}" alt="" aria-hidden="true" />
  </div>
  <div class="content container">
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-lg-6 col-xxl-7">
        {#each chunks as chunk, i (i)}
          {#if chunk.type === 'html'}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html chunk.html}
          {:else if chunk.type === 'VideoEmbed'}
            <div class="embed-wrap">
              <VideoEmbed
                src={chunk.attrs.src}
                caption={chunk.attrs.caption}
                captions={chunk.attrs.captions}
                credit={chunk.attrs.credit}
                title={chunk.attrs.title ?? ''}
                size={(chunk.attrs.size as 'full' | 'large' | 'fit') ?? 'large'}
                autoplay={chunk.attrs.autoplay}
                controls={chunk.attrs.controls}
                playsinline={chunk.attrs.playsinline}
                mute={chunk.attrs.mute}
              />
            </div>
          {:else if chunk.type === 'GifEmbed'}
            <figure
              class="gif-embed"
              class:full={chunk.attrs.size === 'full'}
              class:fit={chunk.attrs.size === 'fit'}
            >
              <img src="{base}/{chunk.attrs.src}" alt={chunk.attrs.alt ?? ''} />
              {#if chunk.attrs.caption}
                <figcaption>{chunk.attrs.caption}</figcaption>
              {/if}
            </figure>
          {:else if chunk.type === 'CollageEmbed'}
            <figure class="collage-wrap">
              <CollageEmbed
                images={chunk.attrs.images}
                alts={chunk.attrs.alts ?? ''}
                caption={chunk.attrs.caption ?? ''}
                layout={(chunk.attrs.layout as 'masonry' | 'asymmetric' | 'grid') ?? 'masonry'}
                columns={Number(chunk.attrs.columns ?? 3)}
              />
            </figure>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .bg-clip {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    /* 1920x2160 = 2:1 height ratio, so at full viewport width: */
    height: 112.5vw; 
    overflow: hidden;
    z-index: 0;
    /* Critical: don't let this affect layout */
    pointer-events: none;
  }

  .bg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    pointer-events: none;
    user-select: none;
  }

  .background-section {
    position: relative;
    width: 100vw;
    left: 50%;
    transform: translateX(-50%);
    /* Must be at least as tall as the image */
    min-height: 112.5vw;
    margin-bottom: 5rem;
  }

  .content {
    position: relative;
    z-index: 1;
    padding: 6rem 4.5rem;
    color: black;
    font-family: Azeret Mono, monospace;
    font-size: large;
  }

  .embed-wrap {
    margin: 2rem 0;
  }

  .gif-embed {
    margin: 2rem 0 2rem;
    width: 100%;
  }

  .gif-embed img {
    width: 100%;
    height: auto;
    display: block;
  }

  .gif-embed.full {
    width: 100vw;
    position: relative;
    left: 50%;
    transform: translateX(-50%);
  }

  .gif-embed.fit img {
    width: 106%;
    margin-left: -5.5%;
    height: auto;
  }

  .gif-embed figcaption {
    font-size: 0.85rem;
    opacity: 0.7;
    margin-top: 0.5rem;
  }
</style>