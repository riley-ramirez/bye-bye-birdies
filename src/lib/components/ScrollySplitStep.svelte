<script lang="ts">
	import type { Step } from './scrolly/utils.ts';

	export let step: Step;
	export let stepHeightVh: number;
	export let active: boolean = false;

	/** Bound by parent so it can track scroll position of each text box. */
	export let textBoxEl: HTMLElement | null = null;
</script>

<!--
  The outer div sets the scroll height that determines how long this step "holds".
  For the last step we add extra bottom padding equal to the full sticky video
  height so the card scrolls up to the video's top edge before the section releases.
-->
<div
	class="step-spacer"
	style="min-height:{stepHeightVh}vh;"
>
	<div
		class="step-card"
		class:active
		bind:this={textBoxEl}
	>
		{#if step.text}
			<div class="step-body">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html step.text}
			</div>
		{/if}
	</div>
</div>

<style>
	.step-spacer {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
	}

	/* First step: card sits at the top so it's visible on arrival */
	.step-spacer:first-child {
		justify-content: flex-start;
		margin-top: 6rem;
	}


	.step-card {
		padding: 1.5rem;
		margin-left: auto;
		margin-right: 0;
		margin-top: 4rem; /* pushes card below video top edge */
	}

	.step-body {
		font-size: 0.90rem;
		line-height: 1.25;
		color: black;
		font-family: Azeret Mono, monospace;
	}

	/* Force all headings inside step content to use the same font */
	.step-body :global(h1),
	.step-body :global(h2),
	.step-body :global(h3),
	.step-body :global(h4),
	.step-body :global(h5),
	.step-body :global(h6) {
		font-family: Azeret Mono, monospace;
		font-weight: 600;
		margin-bottom: 1.5rem;
	}

	.step-body :global(p:last-child) {
		margin-bottom: 0;
	}
</style>