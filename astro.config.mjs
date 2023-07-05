import { defineConfig } from 'astro/config';
import compress from "astro-compress";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: 'https://diegotemkin.com',
  integrations: [sitemap({
    customPages: [
      'https://diegotemkin.com/work/mostec-2021/',
      'https://diegotemkin.com/work/mit-athena-site/',
      'https://diegotemkin.com/work/edd/',
      'https://diegotemkin.com/work/mini-urop-2023/',
      'https://diegotemkin.com/work/psfc/'
    ],
    filter: (page) => page !== 'https://diegotemkin.com/rss.xml/',
  }), compress()],
  output: "server",
  adapter: cloudflare()
});