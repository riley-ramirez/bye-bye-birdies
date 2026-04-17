<script lang="ts">
  import { base } from '$app/paths';
  import VideoEmbed from '$lib/components/VideoEmbed.svelte';
  import CollageEmbed from '$lib/components/CollageEmbed.svelte';

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
    const re = /\[\[(VideoEmbed|GifEmbed|CollageEmbed|ImageEmbed)([\s\S]*?)\]\]/g;
    let cursor = 0;
    let match;

    while ((match = re.exec(flat)) !== null) {
      const attrs: Record<string, string> = {};
      const attrRe = /([A-Za-z_][\w-]*)="([^"]*)"/g;
      let a;
      while ((a = attrRe.exec(match[2])) !== null) {
        attrs[a[1]] = a[2];
      }

      const isInlineImage =
        match[1] === 'ImageEmbed' &&
        (attrs.size === 'inline-left' || attrs.size === 'inline-right');

      if (isInlineImage) {
        // Grab text on the same line before the shortcode
        const before = flat.slice(cursor, match.index).trimEnd();
        const lastBreak = before.lastIndexOf('\n');
        const leadingText = lastBreak === -1 ? before : before.slice(lastBreak + 1);
        const precedingText = lastBreak === -1 ? '' : before.slice(0, lastBreak).trim();

        // Flush paragraphs before the inline line
        if (precedingText) {
          chunks.push({ type: 'html', html: `<p>${precedingText.replace(/\n+/g, '</p><p>')}</p>` });
        }

        // Grab text after the shortcode up to the next paragraph break
        const after = flat.slice(match.index + match[0].length);
        const nextBreak = after.search(/\n\n|\[\[/);
        const trailingText = (nextBreak === -1 ? after : after.slice(0, nextBreak)).trim();

        const floatDir = attrs.size === 'inline-left' ? 'left' : 'right';
        const imgTag = `<img src="${attrs.src}" alt="${attrs.alt ?? ''}" class="img-inline-float img-inline-float--${floatDir}" />`;

        const combined = [leadingText, imgTag, trailingText].filter(Boolean).join('');
        chunks.push({ type: 'html', html: `<p>${combined}</p>` });

        cursor = match.index + match[0].length + (nextBreak === -1 ? after.length : nextBreak);

      } else if (match[1] === 'ImageEmbed') {
        // Non-inline ImageEmbed: flush preceding text, then render as constrained figure
        if (match.index > cursor) {
          const text = flat.slice(cursor, match.index).trim();
          if (text) chunks.push({ type: 'html', html: `<p>${text.replace(/\n+/g, '</p><p>')}</p>` });
        }
        const caption = attrs.caption
          ? `<figcaption class="img-block-caption">${attrs.caption}</figcaption>`
          : '';
        chunks.push({
          type: 'html',
          html: `<figure class="img-block"><img src="${attrs.src}" alt="${attrs.alt ?? ''}" />${caption}</figure>`
        });
        cursor = match.index + match[0].length;

      } else {
        // VideoEmbed, GifEmbed, CollageEmbed
        if (match.index > cursor) {
          const text = flat.slice(cursor, match.index).trim();
          if (text) chunks.push({ type: 'html', html: `<p>${text.replace(/\n+/g, '</p><p>')}</p>` });
        }
        chunks.push({ type: match[1] as 'VideoEmbed' | 'GifEmbed' | 'CollageEmbed', attrs });
        cursor = match.index + match[0].length;
      }
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
  <div class="background-content container">
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

  .background-section {
    position: relative;
    width: 100vw;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 4rem;
  }

  .background-content {
    position: relative;
    z-index: 1;
    padding: 3rem 4.5rem 0rem;
    color: black;
    font-family: Azeret Mono, monospace;
    font-size: large;
  }

  .background-content :global(p) {
    margin-bottom: 1.5rem;
  }

  /* Non-inline ImageEmbed: constrained to column, never bleeds out */
  .background-content :global(.img-block) {
    margin: 1.5rem 0 2rem;
    width: 100%;
  }

  .background-content :global(.img-block img) {
    width: 100%;
    height: auto;
    display: block;
  }

  .background-content :global(.img-block-caption) {
    font-size: 0.85rem;
    opacity: 0.7;
    margin-top: 0.5rem;
  }

  /* Inline float ImageEmbed */
  .background-content :global(.img-inline-float) {
    width: 33%;
    height: auto;
    display: block;
    margin-top: 0.5rem;
  }

  .background-content :global(.img-inline-float--left) {
    float: left;
    margin-right: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .background-content :global(.img-inline-float--right) {
    float: right;
    margin-left: 1.25rem;
    margin-bottom: 0.5rem;
  }

  /* Clearfix so floats don't bleed into following blocks */
  :global(.background-content p:has(.img-inline-float)) {
    overflow: hidden;
  }

  .embed-wrap {
    margin: 2rem 0;
  }

  .gif-embed {
    margin: 1.5rem 0 3rem;
    width: 100%;
  }

  .gif-embed img {
    width: 100%;
    height: auto;
    display: block;
    padding: 1rem 0;
  }

  .gif-embed.full {
    width: 100vw;
    position: relative;
    left: 50%;
    transform: translateX(-50%);
  }

  .gif-embed.fit img {
    width: 110%;
    margin-left: -6.5%;
    height: auto;
  }

  .gif-embed figcaption {
    font-size: 0.85rem;
    opacity: 0.7;
    margin-top: -0.5rem;
    margin-bottom: 3rem;
    max-width: 95%;
  }
</style>