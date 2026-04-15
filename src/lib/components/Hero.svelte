<script lang="ts">
  import { base } from '$app/paths';

  function p(src: string): string {
    if (!src) return '';
    if (/^data:|^https?:\/\//.test(src)) return src;
    return base + (src.startsWith('/') ? src : '/' + src);
  }
</script>

<section class="collage" aria-label="Bird illustration collage">

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

</section>

<style>
  .collage {
    position: relative;
    width: 100%;
    padding-bottom: 56.6%;
    height: 0;
    overflow: visible;
  }

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
    --frame-top: 3.7%; --frame-left: 0%; --frame-width: 100%; --frame-height: 100%; }

  .c2 { left: 27.5%; top: 48.0%; width: 25%;
    --frame-top: -4.8%; --frame-left: 2%; --frame-width: 107%; --frame-height: 108%; }

  .c3 { left: 38.0%; top: 14.0%; width: 17.8%;
    --frame-top: -3%; --frame-left: 0%; --frame-width: 100%; --frame-height: 98%; }

  .c4 { left: 58.5%; top:  5.5%; width: 13%;
    --frame-top: -3%; --frame-left:-4%; --frame-width: 106%; --frame-height: 107%; }

  .c5 { left: 76.0%; top: -1.0%; width: 20%;
    --frame-top: 3%; --frame-left: 4%; --frame-width: 100%; --frame-height: 100%; }

  .c6 { left: 58.2%; top: 30.0%; width: 17%;
    --frame-top: 5%; --frame-left: 2%; --frame-width: 97%; --frame-height: 92%; }

  .c7 { left: 77.5%; top: 35.7%; width: 17%;
    --frame-top: 13%; --frame-left: 11%; --frame-width: 90%; --frame-height: 90%; }

  .c8 { left: 59%;   top: 60.5%; width: 18.1%;
    --frame-top: 0%; --frame-left: 0%; --frame-width: 100%; --frame-height: 100%; }

  .c9 { left: 82.0%; top: 68.8%; width: 13%;
    --frame-top: 3%; --frame-left: 0%; --frame-width: 100%; --frame-height: 100%; }

  @media (max-width: 768px) {
    .collage {
        display: none;
    }
  }
</style>