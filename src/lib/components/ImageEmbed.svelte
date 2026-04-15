<!-- src/lib/components/ImageEmbed.svelte -->
<script lang="ts">
  export let src: string | undefined;
  export let alt: string | undefined;
  export let caption: string | undefined;
  export let size: 'full' | 'large' | 'fit' | 'inline-left' | 'inline-right' | 'margin-left' | 'margin-right' = 'large';

  let embeddedSrc: string | null = null;
  let embeddedAlt: string | null = null;

  import { base } from '$app/paths';

  function normalizeStaticPath(raw: string) {
    const s = raw.trim();
    if (/^data:/i.test(s) || /^https?:\/\//i.test(s)) return s;

    if (s.startsWith('/')) return base + s;
    return base + '/' + s;
  }

  import { onMount } from 'svelte';
  let hostEl: HTMLElement | null = null;

  onMount(() => {
    if (src) return;

    const el = hostEl;
    if (!el) return;

    let n: Node | null = el.nextSibling;

    while (n) {
      if (n.nodeType === 1) {
        const elem = n as Element;

        if (elem.tagName.toLowerCase() === 'img') {
          embeddedSrc = (elem as HTMLImageElement).getAttribute('src');
          embeddedAlt = (elem as HTMLImageElement).getAttribute('alt');
          elem.remove();
          break;
        }

        if (elem.tagName.toLowerCase() === 'figure') {
          const img = elem.querySelector('img');
          if (img) {
            embeddedSrc = img.getAttribute('src');
            embeddedAlt = img.getAttribute('alt');
            elem.remove();
            break;
          }
        }
      }
      n = n.nextSibling;
    }
  });

  $: finalSrc = src
  ? normalizeStaticPath(src)
  : embeddedSrc
    ? normalizeStaticPath(embeddedSrc)
    : null;
    
  $: finalAlt = (alt && alt.trim().length ? alt : embeddedAlt) ?? '';
  $: shouldRender = !!(finalSrc && finalSrc.trim().length);
  $: isInline = size === 'inline-left' || size === 'inline-right';
  $: isMargin = size === 'margin-left' || size === 'margin-right';
</script>

<!-- anchor node so we can locate the DOM position -->
<span bind:this={hostEl} style="display:none"></span>

{#if shouldRender}
  {#if size === 'full'}
    <figure class="my-3 full-bleed">
      <img src={finalSrc} alt={finalAlt} class="img-fluid border" />
      {#if caption}
        <figcaption class="mt-2 text-muted small">{caption}</figcaption>
      {/if}
    </figure>

  {:else if size === 'large'}
    <!-- svelte-ignore a11y_figcaption_parent -->
    <figure class="my-3 full-bleed">
      <div class="container-fluid">
        <div class="row justify-content-center">
          <div class="col-12 col-lg-10 col-xxl-8">
            <img src={finalSrc} alt={finalAlt} class="img-fluid border" />
            {#if caption}
              <figcaption class="mt-2 text-muted small">{caption}</figcaption>
            {/if}
          </div>
        </div>
      </div>
    </figure>

  {:else if isInline}
    <figure class="img-inline img-inline--{size === 'inline-left' ? 'left' : 'right'}">
      <img src={finalSrc} alt={finalAlt} class="img-fluid" />
      {#if caption}
        <figcaption class="mt-2 text-muted small">{caption}</figcaption>
      {/if}
    </figure>

  {:else if isMargin}
    <figure class="img-margin img-margin--{size === 'margin-left' ? 'left' : 'right'}">
      <img src={finalSrc} alt={finalAlt} class="img-fluid" />
      {#if caption}
        <figcaption class="mt-2 text-muted small">{caption}</figcaption>
      {/if}
    </figure>

  {:else}
    <!-- fit -->
    <figure class="my-3">
      <img src={finalSrc} alt={finalAlt} class="img-fluid border" />
      {#if caption}
        <figcaption class="mt-2 text-muted small">{caption}</figcaption>
      {/if}
    </figure>
  {/if}
{/if}

<style>
  .img-inline {
    width: 45%;
    max-width: 45%;
    margin-top: 0.25em;
  }

  .img-inline--left {
    float: left;
    margin-right: 1.25rem;
    margin-bottom: 0.75rem;
  }

  .img-inline--right {
    float: right;
    margin-left: 1.25rem;
    margin-bottom: 0rem;
  }

  .img-inline img {
    width: 100%;
    height: auto;
    display: block;
  }

  /* Clear floats when the inline image is inside a block that doesn't stretch */
  .img-inline + :global(p)  {
    overflow: visible; /* let the paragraph flow around the float naturally */
  }

  .img-margin {
    width: 60%;
    position: relative;
    z-index: 0;
  }

  .img-margin--left {
    float: left;
    margin-left: -300px; /* pushes into left margin */
    margin-right: 1rem;
  }

  .img-margin--right {
    float: right;
    margin-right: -300px; /* pushes into right margin */
    margin-left: -2rem;
    margin-top: -4.5rem;
  }

  .img-margin img {
    width: 100%;
    height: auto;
    display: block;
  }

  @media (max-width: 992px) {
    .img-margin {
      float: none;
      margin: 1rem auto;
      width: 100%;
      max-width: 500px;
    }
  }

</style>