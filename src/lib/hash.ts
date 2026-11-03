export function slugFromHash(hash: string, known: string[]): string | null {
  let slug: string;
  try {
    slug = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return null;
  }
  return known.includes(slug) ? slug : null;
}
