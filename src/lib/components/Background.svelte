<script lang="ts">
  import { base } from '$app/paths';
  import VideoEmbed from '$lib/components/VideoEmbed.svelte';

  export let img = '';
  export let bodyHtml = '';

  type HtmlChunk = { type: 'html'; html: string };
  type VideoChunk = { type: 'VideoEmbed'; attrs: Record<string, string> };
  type Chunk = HtmlChunk | VideoChunk;

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
  const re = /\[\[VideoEmbed([\s\S]*?)\]\]/g;
  let cursor = 0;
  let match;

  while ((match = re.exec(flat)) !== null) {
    if (match.index > cursor) {
      // Wrap plain text in paragraphs for proper rendering
      const text = flat.slice(cursor, match.index).trim();
      if (text) chunks.push({ type: 'html', html: `<p>${text.replace(/\n+/g, '</p><p>')}</p>` });
    }

    const attrs: Record<string, string> = {};
    const attrRe = /([A-Za-z_][\w-]*)="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(match[1])) !== null) {
      attrs[a[1]] = a[2];
    }
    chunks.push({ type: 'VideoEmbed', attrs });
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

<div class="background-section" style="background-image: url('{base}/{img}')">
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-12 col-sm-10 col-lg-8 col-xxl-6">
        {#each chunks as chunk, i (i)}
          {#if chunk.type === 'html'}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html chunk.html}
          {:else if chunk.type === 'VideoEmbed'}
            <div style="margin: 2rem 0;">
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
          {/if}
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .background-section {
    background-size: cover;
    background-position: center;
    min-height: 100vh;
    padding: 4rem 0;
    color: white;
    font-family: Azeret Mono, monospace;
    
    /* Break out of parent container */
    width: 100vw;
    position: relative;
    left: 50%;
    transform: translateX(-50%);
  }
</style>