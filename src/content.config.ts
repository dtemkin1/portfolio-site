import { glob } from "astro/loaders";
import { defineCollection, reference } from "astro:content";
import { z } from "astro/zod";

import { publicationSchema } from "./lib/publications";
import { PROFILES } from "./lib/site";
import { orcidLoader } from "./loaders/orcid";

const day = z.union([
  z.date(),
  z.iso.date().transform((text) => new Date(text)),
]);

// make sure to sync with CMS public/admin/config.yml...
const workCollection = defineCollection({
  loader: glob({ base: "./src/content/work", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z
      .strictObject({
        title: z.string().min(1).max(60),
        description: z.string().min(1).max(160),
        publishDate: day,
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

// pages elsewhere that feature me, also edit CMS if needed
const notesCollection = defineCollection({
  loader: glob({ base: "./src/content/notes", pattern: "**/*.yml" }),
  schema: z.strictObject({
    title: z.string().min(1),
    source: z.string().min(1),
    date: day,
    url: z.httpUrl(),
    note: z.string().optional(),
    project: reference("work").optional(),
    current: z.boolean().optional(),
  }),
});

export const collections = {
  work: workCollection,
  publications: publicationsCollection,
  notes: notesCollection,
};
