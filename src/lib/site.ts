export const SITE = {
  name: "Diego Temkin",
  tagline:
    "MS in Transportation student at MIT, researching how students ride transit.",
};

export const PROFILES = {
  github: "https://github.com/dtemkin1",
  linkedin: "https://www.linkedin.com/in/diego-temkin/",
  bluesky: "https://bsky.app/profile/dtemkin1.bsky.social",
};

// Copies of the global.css tokens for places CSS can't reach; site.test.ts keeps them in step.
export const COLORS = {
  wall: "#003da5",
  board: "#17130b",
  yellow: "#ffc72c",
  readout: "#d6dbe5",
  white: "#ffffff",
};

export const pageTitle = (title?: string) =>
  title ? `${title} | ${SITE.name}` : SITE.name;
