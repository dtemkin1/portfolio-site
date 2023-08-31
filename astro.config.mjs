import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify/functions';

// https://astro.build/config
export default defineConfig({
	site: 'https://www.diegotemkin.com',
	integrations: [],
	output: 'server',
	adapter: netlify(),
});
