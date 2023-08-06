import { defineConfig, sharpImageService } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify/functions';
import swup from '@swup/astro';

// code for sitemap
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const directoryPath = path.join(__dirname, 'src', 'content', 'work');
const files = fs.readdirSync(directoryPath);
const siteUrl = 'https://www.diegotemkin.com';
const blogUrls = files.map((file) => {
  const fileName = file.split('.')[0];
  return `${siteUrl}/work/${fileName}`;
});

// https://astro.build/config
export default defineConfig({
  site: 'https://www.diegotemkin.com',
  build: {
    inlineStylesheets: 'auto'
  },
  experimental: {
    assets: true
  },
  image: {
    service: sharpImageService()
  },
  integrations: [
    swup({
      theme: 'slide',
      containers: ['#swup'],
      accessibility: false,
      globalInstance: true
    }),
    sitemap({
      customPages: blogUrls,
      filter: (page) => !(page in ['https://www.diegotemkin.com/rss.xml/'])
    })
  ],
  output: 'server',
  adapter: netlify(),
  compressHTML: true
});
