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
      weights: ["100 900"],
      fallbacks: ["system-ui", "sans-serif"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "Overpass Mono",
      cssVariable: "--font-overpass-mono",
      weights: ["300 700"],
      fallbacks: ["ui-monospace", "monospace"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "Doto",
      cssVariable: "--font-doto",
      weights: ["100 900"],
      fallbacks: ["ui-monospace", "monospace"],
    },
    // static fonts for social cards
    {
      provider: fontProviders.fontsource(),
      name: "Overpass",
      cssVariable: "--font-card-overpass",
      weights: [500, 800],
      styles: ["normal"],
      subsets: ["latin"],
      formats: ["woff"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "Doto",
      cssVariable: "--font-card-doto",
      weights: [900],
      styles: ["normal"],
      subsets: ["latin"],
      formats: ["woff"],
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
