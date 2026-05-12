<!-- src/lib/components/VideoEmbed.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';

  export let src: string | undefined;

  export let title: string = '';
  export let size: 'full' | 'large' | 'fit' = 'large';
  export let caption: string | undefined;

  // These arrive as strings from shortcodes; allow booleans too.
  export let autoplay: boolean | string | undefined = false;
  export let controls: boolean | string | undefined = true;
  export let playsinline: boolean | string | undefined = true;
  export let mute: boolean | string | undefined = false;
  export let loop: boolean | string | undefined = false;

  // Optional: for local files, allow captions track served from /static
  // Example shortcode: captions="/captions/my-video.vtt" srclang="en" label="English"
  export let captions: string | undefined;
  export let credit: string | undefined;
  export let srclang: string = 'en';
  export let label: string = 'English';

  // if they use credit, degrade gracefully to caption
  $: effectiveCaption = caption ?? (credit ? `credit: ${credit}` : undefined);

  // degrade gracefully if they use non-standard sizes
  const allowedSizes = new Set(['full', 'large', 'fit']);
  $: normalizedSize = allowedSizes.has(String(size)) ? (size as any) : 'large';

  function toBool(v: boolean | string | undefined, fallback: boolean) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
      if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
    }
    return fallback;
  }

  function safeUrl(raw: string): URL | null {
    try {
      return new URL(raw);
    } catch {
      return null;
    }
  }

  function isYouTubeHost(host: string) {
    return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
  }

  function isVimeoHost(host: string) {
    return host === 'vimeo.com' || host.endsWith('.vimeo.com') || host === 'player.vimeo.com';
  }

  function extractYouTubeId(u: URL): string | null {
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }

    if (u.pathname === '/watch') {
      return u.searchParams.get('v');
    }

    const embedMatch = u.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch) return embedMatch[1];

    const shortsMatch = u.pathname.match(/^\/shorts\/([^/]+)/);
    if (shortsMatch) return shortsMatch[1];

    const liveMatch = u.pathname.match(/^\/live\/([^/]+)/);
    if (liveMatch) return liveMatch[1];

    return null;
  }

  function extractVimeoId(u: URL): string | null {
    const playerMatch = u.pathname.match(/^\/video\/(\d+)/);
    if (playerMatch) return playerMatch[1];

    const simpleMatch = u.pathname.match(/^\/(\d+)/);
    if (simpleMatch) return simpleMatch[1];

    const anyIdMatch = u.pathname.match(/\/(\d+)(?:$|\/)/);
    return anyIdMatch ? anyIdMatch[1] : null;
  }

  function isDirectVideoFile(raw: string) {
    return /\.(mp4|webm)(\?.*)?$/i.test(raw.trim());
  }

  function normalizeStaticPath(raw: string) {
    const s = raw.trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return `${base}${s}`;
    return `${base}/${s}`;
  }

  type Resolved =
    | { kind: 'youtube'; embedUrl: string }
    | { kind: 'vimeo'; embedUrl: string }
    | { kind: 'file'; fileUrl: string; mime: 'video/mp4' | 'video/webm' };

  function resolveVideo(rawSrc: string): Resolved | null {
    const s = rawSrc.trim();
    if (!s) return null;

    // Direct file
    if (isDirectVideoFile(s)) {
      const fileUrl = normalizeStaticPath(s);
      const mime = /\.webm(\?.*)?$/i.test(s) ? 'video/webm' : 'video/mp4';
      return { kind: 'file', fileUrl, mime };
    }

    // YouTube / Vimeo (absolute URLs)
    const u = safeUrl(s);
    if (!u) return null;

    const autoplayBool = toBool(autoplay, false);
    const controlsBool = toBool(controls, true);
    const playsinlineBool = toBool(playsinline, true);
    const muteBool = toBool(mute, false);

    if (isYouTubeHost(u.hostname)) {
      const id = extractYouTubeId(u);

      if (!id) return null;

      const params = new URLSearchParams();
      if (autoplayBool) params.set('autoplay', '1');
      params.set('controls', controlsBool ? '1' : '0');
      if (playsinlineBool) params.set('playsinline', '1');
      params.set('rel', '0');
      params.set('loop', '1');

      // YouTube: autoplay often requires muted
      if (muteBool) params.set('mute', '1');

      if (toBool(loop, false)) params.set('loop', '1');

      const qs = params.toString();
      const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}${
        qs ? `?${qs}` : ''
      }`;

      return { kind: 'youtube', embedUrl };
    }

    if (isVimeoHost(u.hostname)) {
      const id = extractVimeoId(u);
      if (!id) return null;

      const params = new URLSearchParams();
      if (autoplayBool) params.set('autoplay', '1');
      if (!controlsBool) params.set('controls', '0');
      if (playsinlineBool) params.set('playsinline', '1');

      // Vimeo: autoplay often requires muted
      if (muteBool) params.set('muted', '1');
      if (toBool(loop, false)) params.set('loop', '1');

      const qs = params.toString();
      const embedUrl = `https://player.vimeo.com/video/${encodeURIComponent(id)}${
        qs ? `?${qs}` : ''
      }`;

      return { kind: 'vimeo', embedUrl };
    }

    return null;
  }

  $: resolved = src ? resolveVideo(src) : null;

  // Normalize captions path if present (assume /static)
  $: captionsSrc = captions ? normalizeStaticPath(captions) : undefined;

  $: autoplayBool = toBool(autoplay, false);
  $: controlsBool = toBool(controls, true);
  $: playsinlineBool = toBool(playsinline, true);
  $: muteBool = toBool(mute, false);
  $: loopBool = toBool(loop, false);

  // ---- Lazy-load for iframes ----
  // `nearViewport` gates whether the iframe src is set.
  // For file-based <video> tags we use the native `preload="none"` + the
  // browser's own lazy-load; the observer still preloads the wrapper early.
  let figureEl: HTMLElement | null = null;
  let nearViewport = false;
  let observer: IntersectionObserver | null = null;

  // Derived: the actual src we hand to the iframe (null until near viewport)
  $: iframeSrc =
    nearViewport && resolved && resolved.kind !== 'file' ? resolved.embedUrl : null;

  onMount(() => {
    if (!browser || !figureEl) return;

    // If the embed is already in or near the viewport on mount, skip the observer.
    const rect = figureEl.getBoundingClientRect();
    if (rect.top < window.innerHeight + 1500) {
      nearViewport = true;
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        nearViewport = true;
        observer?.disconnect();
        observer = null;
      },
      // 1500 px ahead — iframe players need a big head start for network negotiation
      { rootMargin: '1500px 0px' }
    );

    observer.observe(figureEl);
  });

  onDestroy(() => {
    observer?.disconnect();
  });
</script>

{#if resolved}
  {#if normalizedSize === 'full'}
    <figure class="my-3 full-bleed" bind:this={figureEl}>
      <div class="ratio ratio-16x9">
        {#if resolved.kind === 'file'}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            src={resolved.fileUrl}
            title={title}
            class="w-100 h-100"
            autoplay={autoplayBool}
            controls={controlsBool}
            muted={muteBool}
            loop={loopBool}
            playsinline={playsinlineBool}
            preload="none"
          >
            {#if captionsSrc}
              <track kind="captions" src={captionsSrc} srclang={srclang} label={label} default />
            {/if}
          </video>
        {:else if iframeSrc}
          <iframe
            src={iframeSrc}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        {:else}
          <!-- Placeholder holds the aspect-ratio box while the iframe hasn't loaded yet -->
          <div class="iframe-placeholder"></div>
        {/if}
      </div>
      {#if caption}
        <figcaption class="mt-2 text-muted text-left" style="font-family: Azeret Mono, monospace; font-size: small;">{caption}</figcaption>
      {/if}
    </figure>

  {:else if normalizedSize === 'large'}
    <figure class="my-3 full-bleed" bind:this={figureEl}>
      <div class="container-fluid">
        <div class="row justify-content-center">
          <div class="col-12 col-lg-10 col-xxl-8">
            <div class="ratio ratio-16x9">
              {#if resolved.kind === 'file'}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                  src={resolved.fileUrl}
                  title={title}
                  class="w-100 h-100"
                  autoplay={autoplayBool}
                  controls={controlsBool}
                  muted={muteBool}
                  playsinline={playsinlineBool}
                  preload="none"
                >
                  {#if captionsSrc}
                    <track kind="captions" src={captionsSrc} srclang={srclang} label={label} default />
                  {/if}
                </video>
              {:else if iframeSrc}
                <iframe
                  src={iframeSrc}
                  title={title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                ></iframe>
              {:else}
                <div class="iframe-placeholder"></div>
              {/if}
            </div>
          </div>
        </div>
      </div>
      {#if caption}
        <figcaption class="mt-2 text-muted text-center" style="font-size: small;">{caption}</figcaption>
      {/if}
    </figure>

  {:else if normalizedSize === 'fit'}
    <figure class="my-3" bind:this={figureEl}>
      <div class="polaroid">
        <div class="ratio ratio-16x9">
          {#if resolved.kind === 'file'}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              src={resolved.fileUrl}
              title={title}
              class="w-100 h-100"
              autoplay={autoplayBool}
              controls={controlsBool}
              muted={muteBool}
              playsinline={playsinlineBool}
              preload="none"
            >
              {#if captionsSrc}
                <track kind="captions" src={captionsSrc} srclang={srclang} label={label} default />
              {/if}
            </video>
          {:else if iframeSrc}
            <iframe
              src={iframeSrc}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          {:else}
            <div class="iframe-placeholder"></div>
          {/if}
        </div>
        {#if caption}
          <!-- svelte-ignore a11y_figcaption_parent -->
          <figcaption class="mt-2 text-muted text-left" style='font-family: "lumios-typewriter-new", elegant typewriter light, monospace; font-size: small; margin-left: 0.5rem;'>{caption}</figcaption>
        {/if}
      </div>
    </figure>
  {/if}
{/if}

<style>
  .polaroid {
    background: rgb(255, 255, 255);
    padding: 10px 10px 10px 10px;
    box-shadow: 2px 4px 12px rgba(0, 0, 0, 0.15);
    display: inline-block;
    width: 100%;
    margin-bottom: 1.5rem;
  }

  /* Holds the 16:9 box while the iframe hasn't been injected yet.
     Intentionally no visible style — the ratio wrapper already reserves space. */
  .iframe-placeholder {
    position: absolute;
    inset: 0;
    background: transparent;
  }
</style>