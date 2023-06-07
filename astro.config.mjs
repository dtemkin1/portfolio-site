import { defineConfig, sharpImageService } from 'astro/config';

import prefetch from "@astrojs/prefetch";
import compress from "astro-compress";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: 'https://diegotemkin.com',
  experimental: {
    assets: true
  },
  image: {
    service: sharpImageService(),
  },
  integrations: [prefetch({
    throttle: 5
  }), sitemap(), compress()]
});