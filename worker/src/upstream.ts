// A stuck upstream shouldn't hold up the whole feed.
export const upstreamTimeout = () => AbortSignal.timeout(8_000);

// Cloudflare's cache for this data center; tests run without one.
export const edgeCache = () =>
  typeof caches === "undefined"
    ? null
    : (caches as unknown as { default: Cache }).default;
