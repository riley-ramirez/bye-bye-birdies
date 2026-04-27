import adapter from '@sveltejs/adapter-static';

const dev = process.env.NODE_ENV !== 'production';
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