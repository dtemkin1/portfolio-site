import { defineConfig } from 'astro/config';

import prefetch from "@astrojs/prefetch";
import compress from "astro-compress";
import sitemap from "@astrojs/sitemap";
import image from "@astrojs/image";

// https://astro.build/config
export default defineConfig({
  site: 'https://diegotemkin.com',
  integrations: [prefetch(), sitemap(), image({
    serviceEntryPoint: '@astrojs/image/sharp'
  }), compress()]
});