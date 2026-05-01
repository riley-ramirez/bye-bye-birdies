<script>
	import favicon from '$lib/assets/favicon.svg';
	import '../app.scss';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';

	let { children } = $props();

	onMount(async () => {
		const jqueryModule = await import('jquery');
		window.jQuery = jqueryModule.default;
		window.$ = window.jQuery;

		await import('bootstrap/dist/js/bootstrap.bundle.min.js');
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ProgressBar />

<!-- Fixed clone of the background — only shown during ScrollySplit sections -->
<div
	id="app-background-fixed"
	aria-hidden="true"
	style="background-image: linear-gradient(rgba(255,255,255,0.3), rgba(255,255,255,0.3)), url('{base}/images/grid-extended.png')"
></div>

<div
	id="app-background"
	style="background-image: linear-gradient(rgba(255,255,255,0.3), rgba(255,255,255,0.3)), url('{base}/images/grid-extended.png')"
>
	{@render children()}
</div>

<style>
	#app-background-fixed {
		position: fixed;
		inset: 0;
		z-index: -1;
		background-size: 1500px auto;
		background-position: top left;
		background-repeat: repeat;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0s;
	}

	#app-background {
		min-height: 100vh;
		min-width: 100vw;
		background-size: 1500px auto;
		background-position: top left;
		background-repeat: repeat;
	}

	/* When a ScrollySplit section is visible, show the fixed layer
	   and hide the scrolling background on #app-background */
	:global(body.scrolly-split-active) #app-background-fixed {
		opacity: 1;
	}

	:global(body.scrolly-split-active) #app-background {
		background-image: none !important;
	}
</style>