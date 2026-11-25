import resumeSchema from "@jsonresume/schema/schema.json";
import type { APIRoute } from "astro";
import { getCollection, getEntry } from "astro:content";

import { lastCommit, resumePublication } from "../lib/content/cv";
import { newestFirst } from "../lib/content/publications";
import { workHref } from "../lib/content/work";

// The whole CV as JSON Resume, with the publications from ORCID added.
export const GET: APIRoute = async ({ site }) => {
  const cv = await getEntry("cv", "resume");
  if (!cv) throw new Error("src/content/cv/resume.json is missing.");
  const publications = newestFirst(
    (await getCollection("publications")).map(({ data }) => data),
  );
  // a role's project is stored by its page's file name; outside this site it needs the full address
  const withProject = <T extends { project?: { id: string } | undefined }>(
    entry: T,
  ) => ({
    ...entry,
    project: entry.project && new URL(workHref(entry.project.id), site).href,
  });
  return Response.json({
    ...cv.data,
    $schema: resumeSchema.$id,
    work: cv.data.work.map(withProject),
    volunteer: cv.data.volunteer.map(withProject),
    publications: publications.map(resumePublication),
    meta: {
      canonical: new URL("cv.json", site).href,
      lastModified: lastCommit("src/content/cv/resume.json").toISOString(),
      language: "en",
    },
  });
};
