import { glob } from "astro/loaders";
import { defineCollection, reference } from "astro:content";
import { z } from "astro/zod";

import { publicationSchema } from "./lib/publications";
import { PROFILES } from "./lib/site";
import { orcidLoader } from "./loaders/orcid";

// make sure to sync with CMS public/admin/config.yml...
const workCollection = defineCollection({
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
        earlier: z.boolean().optional(),
        when: z.string().optional(),
        status: z.literal("in-development").optional(),
        publications: z.array(reference("publications")).optional(),
      })
      .refine((data) => !data.img || Boolean(data.img_alt?.trim()), {
        message: "An image needs alt text (img_alt).",
        path: ["img_alt"],
      }),
});

// pulls from orcid, see loaders/orcid.ts
const publicationsCollection = defineCollection({
  loader: orcidLoader(PROFILES.orcid),
  schema: publicationSchema,
});

export const collections = {
  work: workCollection,
  publications: publicationsCollection,
};
