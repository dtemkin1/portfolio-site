import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

export const collections = {
  work: defineCollection({
    loader: glob({ base: "./src/content/work", pattern: "**/*.md" }),
    schema: ({ image }) =>
      z.object({
        title: z.string(),
        description: z.string(),
        publishDate: z.coerce.date(),
        tags: z.array(z.string()),
        img: image(),
        // img: z.string(),
        img_alt: z.string().optional(),
      }),
  }),
};
