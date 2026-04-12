<script>
	import favicon from '$lib/assets/favicon.svg';
	import '../app.scss';
	import { base } from '$app/paths';

	import { onMount } from 'svelte';

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

<div style="background-image: linear-gradient(rgba(255,255,255,0.4), rgba(255,255,255,0.4)), url('{base}/images/grid-extended.png')" id="app-background">
	{@render children()}
</div>

<style>
	#app-background {
		min-height: 100vh;
		background-size: contain;
		background-position: center;
		background-repeat: repeat;
	}
</style>