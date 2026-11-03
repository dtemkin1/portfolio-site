// A stuck upstream shouldn't hold up the whole feed.
export const upstreamTimeout = () => AbortSignal.timeout(8_000);
