<script lang="ts" context="module">
	export type Block =
		| { type: 'html'; html: string }
		| {
				type: 'shortcode';
				name: string;
				attrs: Record<string, any>;
		  };
</script>

<script lang="ts">
	import { browser } from '$app/environment';

	export let blocks: Block[] = [];

	// Eager load all components — same as before, SSR works for everything
	const modules = import.meta.glob('$lib/components/**/*.svelte', { eager: true });

	const registry: Record<string, any> = {};

	for (const [path, mod] of Object.entries(modules)) {
		const file = path.split('/').pop() ?? '';
		if (file === 'DocRenderer.svelte') continue;
		const base = file.replace(/\.svelte$/, '');
		// @ts-expect-error — Svelte component default export
		registry[base] = mod.default;
	}

	// Components that should only render on the client (no SSR)
	const CLIENT_ONLY = new Set(['Animations']);

	function getComponent(name: string) {
		return registry[name];
	}

	function toCamel(s: string) {
		return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
	}

	function normalizeAttrs(attrs: Record<string, any>) {
		const out: Record<string, any> = {};

		for (const [k, v] of Object.entries(attrs ?? {})) {
			const key = toCamel(k);

			if (v !== null && typeof v === 'object') {
				out[key] = v;
				continue;
			}

			if (v === 'true') { out[key] = true; continue; }
			if (v === 'false') { out[key] = false; continue; }

			if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) {
				out[key] = Number(v);
				continue;
			}

			out[key] = v;
		}

		return out;
	}
</script>

{#each blocks as block, i (i)}
	{#if block.type === 'html'}
		{@html block.html}
	{:else if block.type === 'shortcode'}
		{#if CLIENT_ONLY.has(block.name)}
			<!-- Client-only: skip SSR to avoid hydration mismatches -->
			{#if browser && getComponent(block.name)}
				<svelte:component
					this={getComponent(block.name)}
					{...normalizeAttrs(block.attrs)}
				/>
			{/if}
		{:else if getComponent(block.name)}
			<!-- All other shortcodes: render normally with SSR -->
			<svelte:component
				this={getComponent(block.name)}
				{...normalizeAttrs(block.attrs)}
			/>
		{/if}
	{/if}
{/each}