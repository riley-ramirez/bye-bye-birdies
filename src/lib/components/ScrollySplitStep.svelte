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
		padding-bottom: 0vh;
	}


	.step-card {
		padding: 1.5rem;
        margin-left: 2rem;
        margin-right: auto;
        max-width: 800px;
	}

	.step-body {
		font-size: 1rem;
		line-height: 1.65;
		color: black;
        font-family: Azeret Mono, monospace;
	}

	.step-body :global(p:last-child) {
		margin-bottom: 0;
	}
</style>