import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const dev = process.env.NODE_ENV !== 'production';

// 👉 CHANGE THIS to your repo name
const repoName = 'bye-bye-birdies';

export default {
	kit: {
		adapter: adapter({
			fallback: '404.html'
		}),

		paths: {
			base: dev ? '' : `/${repoName}`
		},

		prerender: {
			handleHttpError: 'warn'
		}
	}
};