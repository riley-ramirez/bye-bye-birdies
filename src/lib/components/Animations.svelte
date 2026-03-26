<script lang="ts">
	import { onMount } from 'svelte';
	// DocRenderer passes these from the shortcode attrs
	export let src: string = '';
	export let bodyText: string = '';
	// Parse src from bodyText if src wasn't passed directly
	$: if (!src && bodyText) {
		try {
			const parsed = JSON.parse(bodyText);
			src = '/' + (parsed.img ?? '');
		} catch (e) {
			console.error('Animations: could not parse bodyText', e);
		}
	}
	const PX_PER_SECOND = 500;
	let container: HTMLDivElement;
	let video: HTMLVideoElement;
	let duration = 0;
	let scrollHeight = 5000;
	function scrub() {
		if (!video || !duration) return;
		const { top, height } = container.getBoundingClientRect();
		const progress = Math.min(Math.max(-top / (height - window.innerHeight), 0), 1);
		video.currentTime = progress * duration;
	}
	onMount(() => {
		video.addEventListener(
			'loadedmetadata',
			() => {
				duration = video.duration;
				scrollHeight = duration * PX_PER_SECOND + window.innerHeight;
				scrub();
			},
			{ once: true }
		);
		window.addEventListener('scroll', scrub, { passive: true });
		window.addEventListener('resize', scrub, { passive: true });
		return () => {
			window.removeEventListener('scroll', scrub);
			window.removeEventListener('resize', scrub);
		};
	});
</script>

<div class="scrolly" bind:this={container} style="height: {scrollHeight}px;">
	<div class="sticky">
		<video bind:this={video} preload="auto" muted playsinline disablepictureinpicture>
			<source {src} type="video/mp4" />
		</video>
	</div>
</div>

<style>
	.scrolly {
		width: 100vw;
		margin-left: calc(50% - 50vw);
		position: relative;
	}
	.sticky {
		position: sticky;
		top: 0;
		height: 100vh;
		width: 100vw;
		overflow: hidden;
	}
	.sticky video {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}
</style>