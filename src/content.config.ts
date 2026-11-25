import { glob } from "astro/loaders";
import { defineCollection, reference } from "astro:content";
import { z } from "astro/zod";

import { publicationSchema } from "./lib/content/publications";
import { PROFILES } from "./lib/site";
import { orcidLoader } from "./lib/content/orcid-loader";

import resumeSchema from "@jsonresume/schema/schema.json";

const day = z.union([
  z.date(),
  z.iso.date().transform((text) => new Date(text)),
]);

// make sure to sync with CMS public/admin/config.yml...
const workCollection = defineCollection({
  loader: glob({ base: "./src/content/work", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z.strictObject({
      title: z.string().min(1).max(60),
      description: z.string().min(1).max(160),
      publishDate: day,
      tags: z.array(z.string().min(1)).default([]),
      img: z
        .object({
          src: image(),
          alt: z.string().min(1).max(150),
        })
        .optional(),
      draft: z.boolean().optional(),
      earlier: z.boolean().optional(),
      now: z.boolean().optional(),
      inDevelopment: z.boolean().optional(),
      publications: z.array(reference("publications")).optional(),
      links: z
        .array(z.strictObject({ label: z.string().min(1), url: z.httpUrl() }))
        .optional(),
    }),
});

// pulls from orcid, see lib/content/orcid-loader.ts
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

const place = z.union([
  z.string(),
  z.looseObject({
    city: z.string().optional(),
    region: z.string().optional(),
    countryCode: z.string().optional(),
  }),
]);

const role = {
  position: z.string().min(1),
  url: z.httpUrl().optional(),
  // a work page on this site, by its file name
  project: reference("work").optional(),
  location: place.optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string().min(1)).default([]),
};

const standard = {
  ...resumeSchema,
  properties: Object.fromEntries(
    Object.entries(resumeSchema.properties).filter(
      ([key]) => key !== "$schema",
    ),
  ),
} as z.core.JSONSchema.JSONSchema;

const cvCollection = defineCollection({
  loader: glob({ base: "./src/content/cv", pattern: "resume.json" }),
  schema: z.fromJSONSchema(standard).pipe(
    z.looseObject({
      basics: z.looseObject({
        name: z.string().min(1),
        label: z.string().optional(),
        email: z.string(),
        url: z.httpUrl(),
        location: place.optional(),
        profiles: z
          .array(
            z.looseObject({
              network: z.string(),
              url: z.httpUrl(),
            }),
          )
          .default([]),
      }),
      education: z.array(
        z.looseObject({
          institution: z.string().min(1),
          studyType: z.string().min(1),
          area: z.string().min(1),
          location: place.optional(),
          startDate: z.string(),
          endDate: z.string().optional(),
          score: z.string().optional(),
          courses: z.array(z.string().min(1)).default([]),
          summary: z.string().optional(),
        }),
      ),
      work: z.array(z.looseObject({ name: z.string().min(1), ...role })),
      volunteer: z
        .array(z.looseObject({ organization: z.string().min(1), ...role }))
        .default([]),
      awards: z
        .array(
          z.looseObject({
            title: z.string().min(1),
            awarder: z.string().optional(),
            date: z.string().optional(),
          }),
        )
        .default([]),
      skills: z
        .array(
          z.looseObject({
            name: z.string().min(1),
            keywords: z.array(z.string()),
          }),
        )
        .default([]),
      languages: z
        .array(z.looseObject({ language: z.string(), fluency: z.string() }))
        .default([]),
      interests: z.array(z.looseObject({ name: z.string() })).default([]),
    }),
  ),
});

export const collections = {
  work: workCollection,
  publications: publicationsCollection,
  notes: notesCollection,
  cv: cvCollection,
};
