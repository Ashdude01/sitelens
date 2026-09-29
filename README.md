# SiteLens

Enter any domain and see:

- **Its tech stack, with evidence.** Each technology shows *why* it was detected: a header, a script, a DNS record…
- **Its hosting, DNS, email and SSL setup.**
- **An honest traffic range** with a confidence level.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Drizzle ORM + Postgres (Neon) · Vitest.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the design, data model, security and scaling plan.

---

## Quick start (Windows / macOS / Linux)

Requires **Node.js 22.13 or newer** (check with `node -v`).

```bash
npm install
npm run dev            # http://localhost:3000
```

Set `DATABASE_URL` in `.env` to your Neon Postgres connection string, then try a real site, e.g. `http://localhost:3000/site/wordpress.org`. Tables are created on first run.

Tech detection works immediately. **Traffic numbers need popularity data:**

```bash
npm run import:ranks -- umbrella     # Cisco Umbrella top 1M (DNS popularity), free
npm run import:ranks -- majestic     # Majestic Million (link popularity), free, CC BY 3.0
npm run import:ip2asn                # hosting provider / ASN names, free
```

**Best signal: Chrome UX Report (CrUX)**, based on real Chrome users:

1. Run the queries in `scripts/crux-bigquery.sql` in Google BigQuery. The free tier is enough.
2. Export the results to CSV.
3. Import them:

```bash
npm run import:ranks -- crux --file crux.csv
npm run import:ranks -- crux-country --file crux_country.csv
```

> ⚠️ **Licensing:** don't import Cloudflare Radar or the default Tranco list into a commercial product. Both are **non-commercial** (CC BY-NC). Confirm the CrUX dataset terms before launch.

## Features at a glance

| Where | What |
|---|---|
| `/site/example.com` | Report: overview, traffic, earnings, technology, infrastructure, health, **PageSpeed sidebar** |
| `/technology/wordpress` | Technology page: official logo, description, detection methods, related tech, sites using it |
| `/technologies`, `/technologies/cms` | Browse all 7,600+ technologies by category |
| Export & embed button | PNG / JPG / PDF download, live SVG badge, live image card, HTML card. All link back to the report. |
| `/badge/example.com.svg?metric=traffic\|stack\|grade` | Live badge site owners can embed |
| `/api/v1/card/example.com` | 1200×630 PNG card (also the social preview image) |
| `/api/v1/pagespeed?domain=&strategy=mobile\|desktop` | Cached Google PageSpeed Insights result |

## Calibrate the traffic model

Until you calibrate, every estimate says **"Uncalibrated model"**.

1. Add sites whose real monthly visits you know to `data/ground_truth.csv`. Aim for 30+ sites that appear in the imported lists. Good sources:
   - your own and friends' sites (Google Analytics)
   - analytics.usa.gov
   - Wikimedia stats
   - sites that publish their numbers
2. Run `npm run calibrate`. It fits the model and prints **how often the real number falls inside the shown range**. Publish that number on your methodology page.
3. Rows with `source=verified` are shown as exact "Verified by owner" numbers.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` then `npm start` | Production build + standalone server |
| `npm test` | Unit + end-to-end tests against local fake websites (WordPress, Shopify, SPA, robots-blocked) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run scan -- example.com [--json] [--force]` | Scan from the terminal |
| `npm run import:ranks -- <umbrella\|majestic\|crux\|crux-country\|custom>` | Load popularity lists |
| `npm run import:ip2asn` | Load IP → hosting provider data |
| `npm run calibrate` | Fit the traffic model on `data/ground_truth.csv` |
| `npm run update:fingerprints` | Pull the latest technology fingerprints |
| `npm run db:generate` | Create a migration after editing `src/server/db/schema.ts` |
| `npm run db:studio` | Browse the database in Drizzle Studio |

## Configuration

Copy `.env.example` to `.env`. `DATABASE_URL` (Neon Postgres) is required. Everything else is optional:

- `CRUX_API_KEY`: adds real-user Core Web Vitals and the mobile/desktop split.
- `DATAFORSEO_*`: adds Google organic traffic estimates.
- `USE_BROWSER=1`: adds a headless Chrome pass that finds JavaScript-only tools.
- `PAGESPEED_API_KEY`: a free Google key for the PageSpeed sidebar. It works without one at a low shared quota.
- `TRUST_PROXY=1`: set this when running behind Cloudflare or nginx.

## Deploy (about €5–10 per month)

**Setup:** one small Linux VPS (Hetzner / Oracle free tier) with Docker, and Cloudflare (free) in front.

```bash
cp .env.example .env        # set DATABASE_URL, PUBLIC_URL, TRUST_PROXY=1
docker compose up -d --build
docker compose run --rm tools npm run import:ranks -- umbrella
docker compose run --rm tools npm run import:ranks -- majestic
```

Schedule the weekly imports and `update:fingerprints` with cron.

On Vercel, set `DATABASE_URL` to the Neon **pooled** connection string (the host contains `-pooler`).

## Project layout

```
src/app/            routes: pages, API (/api/v1/lookup), server actions, sitemap, robots
src/components/     ui/ (shadcn), report/ (report sections)
src/server/         config · db (Drizzle) · repositories · scanner · traffic · services
scripts/            CLI jobs (imports, calibrate, scan)
data/               fingerprints (GPL-3.0), calibration.json, ground_truth.csv
tests/              Vitest unit + e2e with fixture websites
```

## Adding shadcn components

`components.json` is set up, so on your machine just run, for example:

```bash
npx shadcn@latest add dialog tabs
```

## Licences

- The code is yours.
- `data/fingerprints/` comes from [enthec/webappanalyzer](https://github.com/enthec/webappanalyzer) and is GPL-3.0 (see `data/LICENSE-fingerprints`). Running it on your own server is generally fine; get legal advice before redistributing it inside software you ship to customers.
