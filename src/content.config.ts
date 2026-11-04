import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

// make sure to sync with CMS public/admin/config.yml...
export const collections = {
  work: defineCollection({
    loader: glob({ base: "./src/content/work", pattern: "**/*.md" }),
    schema: ({ image }) =>
      z
        .object({
          title: z.string().min(1).max(60),
          description: z.string().min(1).max(160),
          publishDate: z.coerce.date(),
          tags: z.array(z.string().min(1)).default([]),
          img: image().optional(),
          img_alt: z.string().optional(),
          draft: z.boolean().optional(),
          when: z.string().optional(),
          status: z.literal("in-development").optional(),
        })
        .refine((data) => !data.img || Boolean(data.img_alt?.trim()), {
          message: "An image needs alt text (img_alt).",
          path: ["img_alt"],
        }),
  }),
};
