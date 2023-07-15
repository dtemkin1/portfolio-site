import { defineConfig, sharpImageService } from 'astro/config';
import sitemap from "@astrojs/sitemap";
import netlify from "@astrojs/netlify/functions";

// https://astro.build/config
export default defineConfig({
  site: 'https://www.diegotemkin.com',
  build: {
    inlineStylesheets: "auto",
  },
  experimental: {
    assets: true,
  },
  image: {
    service: sharpImageService(),
  },
  integrations: [sitemap({
    customPages: [
      'https://diegotemkin.com/work/mostec-2021/',
      'https://diegotemkin.com/work/mit-athena-site/',
      'https://diegotemkin.com/work/edd/',
      'https://diegotemkin.com/work/mini-urop-2023/',
      'https://diegotemkin.com/work/psfc/'
    ],
    filter: page => page !== 'https://diegotemkin.com/rss.xml/'
  })],
  output: "server",
  adapter: netlify(),
  compressHTML: true
});