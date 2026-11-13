# Diego Temkin's portfolio site

The source for [diegotemkin.com](https://www.diegotemkin.com), an Astro site designed as a station platform. A countdown board lists my work, and a small command prompt lets you get around by typing if you'd like to. Below the board, a live display shows Red Line arrivals at Kendall/MIT, what I'm playing on Spotify, and my WMBR show when it's on air.

## Run it

```sh
pnpm install
pnpm dev      # local site at http://localhost:4321
pnpm test     # tests for the board, prompt, live display, and Worker
pnpm build    # production build in dist/
pnpm fix      # format and lint
```

## Add a project

Add a Markdown file to `src/content/work/`, or use the CMS at `/admin/`. The board sorts by `publishDate`, and `draft: true` hides an entry everywhere.

Pushing to `main` deploys to GitHub Pages.

## CMS

`/admin/` runs [Sveltia CMS](https://sveltiacms.app/), set up in `public/admin/config.yml`, with previews in `src/pages/admin/index.astro`. Sign in with **Sign In with Token**, using a fine-grained GitHub token for this repository with Contents and Pull requests set to read and write. Each change opens a pull request, and publishing merges it.

Sveltia is in beta, so the script is limited to patch updates. Read its release notes before raising the version.

## Publications

Publications and presentations on the About page load from the public ORCID record (`PROFILES.orcid` in `src/lib/site.ts`) at build time. Edit them on ORCID, then rebuild. If ORCID can't be reached, the build fails.

To show a publication on a work page, list its BibTeX key from ORCID under `publications` in the work's front matter, or in the CMS:

```yaml
publications:
  - cong2024nbs
```

A work with no BibTeX on ORCID goes by its ORCID put code. A key that doesn't match a work on ORCID fails the build.

## Notes

The Elsewhere card on the About page lists pages elsewhere that feature me, newest first. Add one in the CMS under Notes, or as a file in `src/content/notes/`:

```yaml
title: "Student spotlight: Diego Temkin"
source: MIT News
date: 2025-12-17
url: https://news.mit.edu/2025/student-spotlight-diego-temkin-1217
note: One optional line shown under it.
project: jtl-k12 # optional, a work page's file name
current: true # optional, also shows it at the top of the home board
```

A note with a `project` also shows on that work page. A `project` that doesn't match a work page fails the build. The card is hidden when there are no notes. Turn `current` off once a note is old news.

## Live display

The site never talks to the MBTA, Spotify, WMBR, Open-Meteo, or GitHub directly. A Cloudflare Worker in `worker/` holds the API keys, caches each source, and serves everything from `https://api.diegotemkin.com/live`. It only answers requests from this site and from localhost.

The station, line, colors, and music toggle are in `LIVE_CONFIG` in `src/lib/live.ts`. The WMBR host name to match is `DJ` in `worker/src/index.ts`.

### Run the Worker locally

1. Copy the secrets into `worker/.dev.vars`, which is gitignored:

   ```sh
   MBTA_KEY=...
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   GITHUB_TOKEN=...
   ```

2. Get a Spotify refresh token once. Your Spotify app needs the redirect URI `http://127.0.0.1:8888/callback`. The script saves `SPOTIFY_REFRESH_TOKEN` to `worker/.dev.vars`.

   ```sh
   pnpm worker:spotify
   ```

3. Start the Worker, and point the site at it with `PUBLIC_LIVE_API=http://localhost:8787/live` in `.env`:

   ```sh
   pnpm worker:dev
   ```

The MBTA key and GitHub token are optional; without them, the MBTA and GitHub allow fewer requests. The GitHub token needs no permissions, since it only reads public activity. Without the Spotify settings, the music row stays off.

### Deploy the Worker

```sh
pnpm exec wrangler login
pnpm exec wrangler secret put MBTA_KEY --config worker/wrangler.toml
# repeat for SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN, and GITHUB_TOKEN
pnpm worker:deploy
```

`pnpm worker:check` type-checks the Worker and its tests.
