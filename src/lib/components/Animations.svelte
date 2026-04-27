<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  type Caption = {
    start: number;
    end: number;
    text: string;
    class?: string;
    persist?: boolean;
  };

  type OverlayItem = {
    start: number;
    end: number;
    text?: string;
    class?: string;
    textClass?: string;
    imgSrc?: string;
    imgClass?: string;
    subCaption?: string;
    alt?: string;
  };

  export let src: string = '';
  export let bodyText: string = '';
  export let scrubStart: number = 4;
  export let mobileSrc: string = '';
  export let mobileBreakpoint: number = 768;
  export let captions: Caption[] = [];
  export let overlayContent: OverlayItem[] = [];
  export let pausePoints: number[] = [];
  export let videoLabel: string = 'Scrollable animation';

  // Parse bodyText eagerly so mobileSrc and pausePoints are available
  // before we decide which component to mount
  if (bodyText && !src) {
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed.mobileSrc) mobileSrc = parsed.mobileSrc;
      if (parsed.pausePoints) pausePoints = parsed.pausePoints;
    } catch (e) {
      console.error('Animations wrapper: could not parse bodyText', e);
    }
  }

  // Only resolved in the browser — stays null during SSR so neither
  // child component is rendered on the server, avoiding hydration mismatches
  let isMobile: boolean | null = null;

  onMount(() => {
    isMobile = window.innerWidth < mobileBreakpoint;
  });
</script>

<!--
  Nothing is rendered during SSR (isMobile is null server-side).
  On the client, onMount resolves isMobile and the correct component mounts fresh,
  with no hydration mismatch because the server also rendered nothing here.
-->
{#if browser && isMobile !== null}
  {#if isMobile}
    {#await import('./AnimationsMobile.svelte') then { default: AnimationsMobile }}
      <AnimationsMobile
        src={src as string}
        bodyText={bodyText as string}
        mobileSrc={mobileSrc as string}
        mobileBreakpoint={mobileBreakpoint as number}
        captions={captions as Caption[]}
        pausePoints={pausePoints as number[]}
        videoLabel={videoLabel as string}
      />
    {/await}
  {:else}
    {#await import('./AnimationsDesktop.svelte') then { default: AnimationsDesktop }}
      <AnimationsDesktop
        src={src as string}
        bodyText={bodyText as string}
        scrubStart={scrubStart as number}
        mobileSrc={mobileSrc as string}
        mobileBreakpoint={mobileBreakpoint as number}
        captions={captions as Caption[]}
        overlayContent={overlayContent as OverlayItem[]}
        videoLabel={videoLabel as string}
      />
    {/await}
  {/if}
{/if}