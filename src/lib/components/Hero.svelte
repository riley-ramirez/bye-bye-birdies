<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  let collage: HTMLElement;
  let wrapper: HTMLElement;
  let loaded = false;

  function p(src: string): string {
    if (!src) return '';
    if (/^data:|^https?:\/\//.test(src)) return src;
    return base + (src.startsWith('/') ? src : '/' + src);
  }

  onMount(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) {
              const cells = Array.from(collage.querySelectorAll('.cell'))
                .sort(() => Math.random() - 0.5);
              cells.forEach((cell, i) => {
                (cell as HTMLElement).style.setProperty('--delay', `${i * 150}ms`);
                cell.classList.add('hiding');
              });
            } else {
              // Remove hiding instantly (no transition) when scrolling back up
              collage.querySelectorAll('.cell').forEach(cell => {
                (cell as HTMLElement).style.setProperty('--delay', '0ms');
                cell.classList.remove('hiding');
              });
            }
          });
        },
        { threshold: 0, rootMargin: '-75% 0px 0px 0px' }
      );

      // Double rAF ensures observer attaches after first paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          observer.observe(wrapper);
        });
      });

      return () => observer.disconnect();
    });
</script>

<header class="hero-wrapper container-fluid" bind:this={wrapper} style="margin-top: 5rem;">

  <div class="collage-area" class:loaded bind:this={collage} aria-label="Bird illustration collage">
    <div class="cell c1">
      <img src={p('/illustrations/thick-billed.png')} alt="Thick-billed Longspur" />
      <img src={p('/illustrations/black-box.png')} alt="" class="frame" />
    </div>
    <div class="cell c2">
      <img src={p('/illustrations/chestnut.png')} alt="Chestnut-collared Longspur" />
      <img src={p('/illustrations/black-box.png')} alt="" class="frame" />
    </div>
    <div class="cell c3">
      <img src={p('/illustrations/horned_lark.png')} alt="Horned Lark" />
      <img src={p('/illustrations/black-box.png')} alt="" class="frame" />
    </div>
    <div class="cell c4">
      <img src={p('/illustrations/grasshopper.png')} alt="Grasshopper Sparrow" />
      <img src={p('/illustrations/black-box.png')} alt="" class="frame" />
    </div>
    <div class="cell c5">
      <img src={p('/illustrations/bairds_sparrow.png')} alt="Baird's Sparrow" />
      <img src={p('/illustrations/black-box.png')} alt="" class="frame" />
    </div>
    <div class="cell c6">
      <img src={p('/illustrations/savannah.png')} alt="Savannah Sparrow" />
      <img src={p('/illustrations/black-box.png')} alt="" class="frame" />
    </div>
    <div class="cell c7">
      <img src={p('/illustrations/lark_bunting.png')} alt="Lark Bunting" />
      <img src={p('/illustrations/black-box.png')} alt="" class="frame" />
    </div>
    <div class="cell c8">
      <img src={p('/illustrations/mountain_plover.png')} alt="Mountain Plover" />
      <img src={p('/illustrations/black-box.png')} alt="" class="frame" />
    </div>
    <div class="cell c9">
      <img src={p('/illustrations/spragues.png')} alt="Sprague's Pipit" />
      <img src={p('/illustrations/black-box.png')} alt="" class="frame" />
    </div>
  </div>

  <div class="hero-content">
    <h1 class="hero-title">
      <span class="line1">Bye Bye</span>
      <span class="line2">Birdies</span>
    </h1>
    <p>
      Six years after scientists reported that billions of birds vanished from
      the North American landscape since 1970, conservationists are still racing
      to reverse catastrophic losses that show no sign of slowing down.
    </p>
  </div>

</header>

<!-- Mobile bird row — hidden on desktop -->
<div class="mobile-birds">
  <div class="mobile-cell">
    <img src={p('/illustrations/horned_lark.png')} alt="Horned Lark" />
    <img src={p('/illustrations/black-box.png')} alt="" class="mobile-frame" />
  </div>
  <div class="mobile-cell">
    <img src={p('/illustrations/chestnut.png')} alt="Chestnut-collared Longspur" />
    <img src={p('/illustrations/black-box.png')} alt="" class="mobile-frame" />
  </div>
  <div class="mobile-cell">
    <img src={p('/illustrations/bairds_sparrow.png')} alt="Baird's Sparrow" />
    <img src={p('/illustrations/black-box.png')} alt="" class="mobile-frame" />
  </div>
</div>

<style>
  .hero-wrapper {
    container-type: inline-size;
    position: relative;
    width: 100%;
    overflow: visible;
    padding: 0;
    margin-top: 4rem;
  }

  .collage-area {
    position: relative;
    width: 100%;
    padding-bottom: 56.6%;
    height: 0;
    overflow: visible;
  }

  .hero-content {
    font-family: 'Legitima', serif;
    position: absolute;
    top: 1.2cqw;
    left: 4cqw;
    z-index: 10;
    max-width: 31cqw;
  }

  .hero-content h1,
  .hero-content p {
    color: rgb(0, 0, 0);
  }

  .hero-title {
    font-family: 'Legitima', serif;
    font-style: italic;
    font-weight: 400;
    letter-spacing: -0.1cqw;
    line-height: 0.85;
  }

  .hero-title .line1 {
    font-size: 5.5cqw;
    letter-spacing: 0.25cqw;
    margin-left: -1cqw;
    display: block;
  }

  .hero-title .line2 {
    font-size: 10.5cqw;
    letter-spacing: 0.15cqw;
    display: block;
    margin-left: 2cqw;
    margin-bottom: 1.4cqw;
  }

  .hero-content p {
    font-size: 1.3cqw;
    line-height: 1.5;
  }

  /* ── Cell base styles ── */
  .cell {
    position: absolute;
    overflow: visible;
    aspect-ratio: 1 / 1;
  }

  .cell > img:first-child {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    display: block;
    transition: opacity 0.6s ease var(--delay, 0ms);
  }

  .collage-area.loaded .cell > img:first-child {
    transition: opacity 0.6s ease var(--delay, 0ms);
  }

  :global(.cell.hiding > img:first-child) {
    opacity: 0;
  }

  .frame {
    position: absolute;
    top: var(--frame-top, 0%);
    left: var(--frame-left, 0%);
    width: var(--frame-width, 100%);
    height: var(--frame-height, 100%);
    object-fit: fill;
    pointer-events: none;
    z-index: 1;
  }

  .c1 { left: 4.1%;  top: 56.0%; width: 20%;
    --frame-top: 3.7%; --frame-left: 0%;  --frame-width: 100%; --frame-height: 100%; }
  .c2 { left: 27.5%; top: 48.0%; width: 25%;
    --frame-top: -4.8%; --frame-left: 2%; --frame-width: 107%; --frame-height: 108%; }
  .c3 { left: 38.0%; top: 14.0%; width: 17.8%;
    --frame-top: -3%;  --frame-left: 0%;  --frame-width: 100%; --frame-height: 98%; }
  .c4 { left: 58.5%; top:  5.5%; width: 13%;
    --frame-top: -3%;  --frame-left: -4%; --frame-width: 106%; --frame-height: 107%; }
  .c5 { left: 76.0%; top: -1.0%; width: 20%;
    --frame-top: 3%;   --frame-left: 4%;  --frame-width: 100%; --frame-height: 100%; }
  .c6 { left: 58.2%; top: 30.0%; width: 17%;
    --frame-top: 5%;   --frame-left: 2%;  --frame-width: 97%;  --frame-height: 92%; }
  .c7 { left: 77.5%; top: 35.7%; width: 17%;
    --frame-top: 13%;  --frame-left: 11%; --frame-width: 90%;  --frame-height: 90%; }
  .c8 { left: 59%;   top: 60.5%; width: 18.1%;
    --frame-top: 0%;   --frame-left: 0%;  --frame-width: 100%; --frame-height: 100%; }
  .c9 { left: 82.0%; top: 68.8%; width: 13%;
    --frame-top: 3%;   --frame-left: 0%;  --frame-width: 100%; --frame-height: 100%; }

  @media (max-width: 768px) {
    .collage-area {
      display: none;
    }

    .hero-content {
      position: static;
      max-width: 100%;
      padding: 1.5rem;
    }

    .hero-title .line1 {
      font-size: 5rem;
    }

    .hero-title .line2 {
      font-size: 8rem;
      margin-left: 2.5rem;
    }

    .hero-content p {
      font-size: 1.2rem;
    }
  }

  /* ── Mobile bird row ── */
.mobile-birds {
  display: none; /* hidden on desktop */
}

@media (max-width: 768px) {
  .mobile-birds {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    padding: 0 1rem 1.5rem;
    width: 100%;
  }

  .mobile-cell {
    position: relative;
    flex: 1;
    aspect-ratio: 1 / 1;
  }

  .mobile-cell > img:first-child {
    width: 94%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    display: block;
  }

  .mobile-frame {
    position: absolute;
    top: 0%;
    left: 0%;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
    z-index: 1;
  }
}
</style>