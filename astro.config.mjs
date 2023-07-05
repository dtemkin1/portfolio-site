import { defineConfig, squooshImageService } from 'astro/config';
import compress from "astro-compress";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: 'https://diegotemkin.com',
  integrations: [sitemap(), compress()],
  output: "server",
  adapter: cloudflare()
});