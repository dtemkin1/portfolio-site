import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

export const collections = {
  work: defineCollection({
    loader: glob({ base: "./src/content/work", pattern: "**/*.md" }),
    schema: ({ image }) =>
      z.object({
        title: z.string(),
        description: z.string(),
        publishDate: z.coerce.date(),
        tags: z.array(z.string()),
        img: image().optional(),
        img_alt: z.string().optional(),
        draft: z.boolean().optional(),
        when: z.string().optional(),
        status: z.literal("in-development").optional(),
      }),
  }),
};
