<script lang="ts">
  import { onMount } from 'svelte';

  let progress = 0;
  let visible = false;

  onMount(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      progress = docHeight > 0 ? scrollTop / docHeight : 0;
      visible = scrollTop > 80;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });
</script>

<div class="progress-track" class:visible>
  <div class="progress-bar" style="transform: scaleX({progress});"></div>
</div>

<style>
  .progress-track {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: none;
  }

  .progress-track.visible {
    opacity: 1;
  }

  .progress-bar {
    height: 100%;
    width: 100%;
    background: #1a1a1a;
    transform-origin: left center;
    transform: scaleX(0);
    /* No transition — updates every scroll event for crisp tracking */
  }
</style>