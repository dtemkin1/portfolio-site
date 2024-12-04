// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://www.diegotemkin.com",
  integrations: [sitemap()],
  prefetch: true,
  experimental: {
    clientPrerender: true,
  },
});
