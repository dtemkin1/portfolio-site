# Diego Temkin's portfolio site

The source for [diegotemkin.com](https://www.diegotemkin.com), an Astro site designed as a station platform. A countdown board lists my work, and a small command prompt lets you get around by typing if you'd like to.

## Run it

```sh
pnpm install
pnpm dev      # local site at http://localhost:4321
pnpm test     # logic tests for the board and prompt
pnpm build    # production build in dist/
pnpm fix      # format and lint
```

## Add a project

Add a Markdown file to `src/content/work/`, or use the CMS at `/admin/`. The board sorts by `publishDate`, and `draft: true` hides an entry everywhere.

Pushing to `main` deploys to GitHub Pages.
