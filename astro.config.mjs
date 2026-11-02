// @ts-check
import { defineConfig, envField } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://www.diegotemkin.com",
  integrations: [sitemap({ filter: (page) => !page.includes("/admin/") })],
  env: {
    schema: {
      // be aware that until this is server side, these are public...
      PUBLIC_LAST_FM_KEY: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      PUBLIC_LAST_FM_USERNAME: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      PUBLIC_MBTA_KEY: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
    },
  },
});
