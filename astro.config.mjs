import { defineConfig } from 'astro/config';
import prefetch from "@astrojs/prefetch";

import compress from "astro-compress";

// https://astro.build/config
import robotsTxt from "astro-robots-txt";

// https://astro.build/config
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: 'https://diegotemkin.com',
  integrations: [prefetch({
    throttle: 3
  }), compress(), robotsTxt(), sitemap()]
});