import type { APIRoute } from "astro";
import { getCollection, getEntry } from "astro:content";

import { lastCommit, resumePublication } from "../lib/content/cv";
import { newestFirst } from "../lib/content/publications";

// The whole CV as JSON Resume, with the publications from ORCID added.
export const GET: APIRoute = async ({ site }) => {
  const cv = await getEntry("cv", "resume");
  if (!cv) throw new Error("src/content/cv/resume.json is missing.");
  const publications = newestFirst(
    (await getCollection("publications")).map(({ data }) => data),
  );
  return Response.json({
    ...cv.data,
    publications: publications.map(resumePublication),
    meta: {
      canonical: new URL("cv.json", site).href,
      lastModified: lastCommit("src/content/cv/resume.json").toISOString(),
    },
  });
};
