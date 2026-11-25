import { glob } from "astro/loaders";
import { defineCollection, reference } from "astro:content";
import { z } from "astro/zod";

import { RESUME_DATE } from "./lib/content/cv";
import { publicationSchema } from "./lib/content/publications";
import { PROFILES } from "./lib/site";
import { orcidLoader } from "./lib/content/orcid-loader";

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

// the CV, as JSON Resume (cv/resume.json); checks what /cv/ shows, and lets the rest of the standard through
const date = z.string().regex(RESUME_DATE, "Use YYYY, YYYY-MM, or YYYY-MM-DD");
const role = {
  position: z.string().min(1),
  url: z.httpUrl().optional(),
  // a work page on this site, by its file name (not JSON Resume, which allows extra fields)
  project: reference("work").optional(),
  location: z.string().optional(),
  startDate: date,
  endDate: date.optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string().min(1)).default([]),
};
const cvCollection = defineCollection({
  loader: glob({ base: "./src/content/cv", pattern: "resume.json" }),
  schema: z.looseObject({
    basics: z.looseObject({
      name: z.string().min(1),
      label: z.string().optional(),
      email: z.email(),
      url: z.httpUrl(),
      location: z.looseObject({ city: z.string(), region: z.string() }),
      profiles: z
        .array(z.looseObject({ username: z.string(), url: z.httpUrl() }))
        .default([]),
    }),
    education: z.array(
      z.looseObject({
        institution: z.string().min(1),
        studyType: z.string().min(1),
        area: z.string().min(1),
        location: z.string().optional(),
        startDate: date,
        endDate: date.optional(),
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
          date: date.optional(),
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
});

export const collections = {
  work: workCollection,
  publications: publicationsCollection,
  notes: notesCollection,
  cv: cvCollection,
};
