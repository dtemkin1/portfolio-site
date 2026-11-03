// @ts-check
import { defineConfig, envField, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://www.diegotemkin.com",
  integrations: [sitemap({ filter: (page) => !page.includes("/admin/") })],
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Overpass",
      cssVariable: "--font-overpass",
      weights: [500, 800],
      formats: ["woff2", "woff"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "Overpass Mono",
      cssVariable: "--font-overpass-mono",
      weights: [400],
    },
    {
      provider: fontProviders.fontsource(),
      name: "Doto",
      cssVariable: "--font-doto",
      weights: [700, 900],
      formats: ["woff2", "woff"],
    },
  ],
  env: {
    schema: {
      // link to worker api for live data
      PUBLIC_LIVE_API: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
    },
  },
});
