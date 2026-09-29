# SiteLens architecture

The goal is a website intelligence platform where you enter a domain and see its tech stack and traffic. It should cost about €10/month at launch and scale to millions of domains without a rewrite.

## 1. Principles

1. **Honest data.** Every technology shows its evidence, and every traffic number is a range with a confidence level. When we don't know, we say so.
2. **Cheap by default.**
   - One server and one SQLite file.
   - Cloudflare's free CDN in front.
   - No paid SaaS is required to run.
3. **Framework-agnostic core.** The scanner and traffic model (`src/server/scanner`, `src/server/traffic`) are plain TypeScript with no Next.js imports. The web app, the CLI scripts and a future background worker all use the same code.
4. **Swap parts, don't rewrite.**
   - Storage sits behind repositories: SQLite → Turso or Postgres.
   - The rate limiter sits behind an interface: in-memory → Redis.
   - Scans go through one service function: inline → queue worker.

## 2. System overview

```
                         ┌──────────────────────────────────────────────┐
  Browser / API client ──► Cloudflare (free): static cache, TLS, DDoS,  │
                         │ WAF (report HTML cached later, see §4)       │
                         └───────────────┬──────────────────────────────┘
                                         │
                    ┌────────────────────▼─────────────────────┐
                    │        Next.js 16 app (Node runtime)      │
                    │  app/            pages, route handlers,   │
                    │                  server actions           │
                    │  server/services report-service (cache → │
                    │                  scan → persist), limits  │
                    │  server/scanner  fetch · DNS · TLS ·      │
                    │                  fingerprints · browser*  │
                    │  server/traffic  rank signals → range     │
                    │  server/repos    typed data access        │
                    └───────┬───────────────────────┬──────────┘
                            │                       │ outbound (SSRF-guarded)
                ┌───────────▼──────────┐   ┌────────▼───────────────────────┐
                │ SQLite (libSQL file) │   │ target websites, DNS, RDAP,     │
                │ via Drizzle ORM      │   │ CrUX API*, DataForSEO*          │
                └───────────▲──────────┘   └─────────────────────────────────┘
                            │ batch jobs (cron)
                ┌───────────┴───────────────────────────────────────────────┐
                │ scripts/: import-ranks (Umbrella, Majestic, CrUX),         │
                │ import-ip2asn, calibrate, update-fingerprints, scan CLI    │
                └───────────────────────────────────────────────────────────┘
                                                          * optional
```

## 3. Code layout

```
src/
  app/                        Next.js routes only. Thin: parse input → call a service → render.
    page.tsx                  Home + search
    site/[domain]/page.tsx    Report page (server-rendered, streamed with Suspense)
    methodology/  docs/api/   Static-ish content pages
    api/v1/lookup/route.ts    Public JSON API
    api/health/route.ts       Health check for uptime monitors
    actions.ts                Server Actions: search submit, re-scan
    sitemap.ts  robots.ts     SEO (only data-rich reports are indexable)
  components/
    ui/                       shadcn/ui primitives (button, card, badge, …)
    report/                   Report sections (traffic, tech stack, infra, website, changes)
  lib/                        Shared, isomorphic: types, formatting, cn()
  server/                     Server-only code
    config.ts                 Env parsing + validation (zod)
    db/                       Drizzle schema, client, migrations runner
    repositories/             One file per table group. The only code that writes SQL.
    scanner/                  net (SSRF-safe fetch, robots, DNS, TLS, RDAP), fingerprints, browser, scan
    traffic/                  estimator (pure math), signals, optional providers
    services/                 Use-cases: getReport, getOrScanReport, rescan; rate limiter
scripts/                      CLI jobs (run with tsx), share server/ code
data/                         fingerprints (GPL-3.0), calibration.json, ground_truth.csv
drizzle/                      Generated SQL migrations
tests/                        Vitest: unit + end-to-end against local fixture websites
```

**Dependency rule:**

```
app → services → (scanner, traffic, repositories) → db
```

Lower layers never import upper ones. `lib/` can be imported from anywhere.

## 4. Request flows

**Report page `/site/example.com`**

1. `normalizeTarget()` validates the input and produces the canonical key (`example.com`). A non-canonical URL gets a 308 redirect to the canonical one.
2. `getReport(key)` reads the cached report from SQLite. If it is fresh, the page renders immediately.
3. On a cache miss, the page shows a skeleton inside `<Suspense>`. The server runs the scan and streams in the result. The client does no polling. Cold scans are rate-limited per IP.
4. The scan runs these steps:
   - robots.txt, DNS (A/AAAA/MX/NS/TXT/SOA/DMARC), the TLS certificate and RDAP, all in parallel
   - fetching the homepage (manual redirects; each hop is checked against private IPs)
   - optionally, a headless browser pass
   - fingerprint matching
   - the traffic estimate
   - saving the report and updating the tech history
5. Report pages are dynamic: Next.js sends `private, no-cache`, so Cloudflare caches static assets (`/_next/static`) but not report HTML. A cached report is one SQLite primary-key read (~1 ms), so this is cheap. When traffic grows, the next step is CDN caching of report pages:
   - move report rendering to ISR / `use cache`, with `cacheLife` of about 1 day and `revalidateTag` on re-scan
   - move the per-IP limit for cold scans into `proxy.ts`

   After that, Cloudflare can serve repeat views without touching the server.

**API `/api/v1/lookup?domain=`** follows the same service path, returns JSON and has the same limits.

## 5. Data model (SQLite)

| Table | Purpose | Size at 10M domains |
|---|---|---|
| `reports` | Latest report JSON per domain + `scanned_at` | ~10–30 GB (compressible; move blobs to R2 at scale) |
| `tech_history` | (domain, tech) first/last seen, powers "added/removed" alerts | ~200M rows at scale; this is where Postgres/ClickHouse starts to pay off |
| `ranks` | Popularity lists: `source, domain, rank, extra` (indexed on `domain`) | ~3M rows per monthly import |
| `crux_country` | Per-country CrUX buckets | ~20M rows |
| `ground_truth` | Known real traffic (verified / public) used for calibration | small |
| `ip2asn` | IP range → ASN/hosting provider | ~500K rows |

## 6. Traffic model

- **Model:** `log10(visits) = a + b · log10(rank)` for each list, fitted on `ground_truth` by `npm run calibrate`.
- **Signal uncertainty:** each signal's σ is the model error plus the width of its CrUX bucket.
- **Combining:** signals are combined with inverse-variance weighting. When they disagree, the range widens.
- **Output:** a low–high range of about ±1σ (~68%), with a High, Medium or Low confidence level.
- **Before calibration:** every estimate is labelled "Uncalibrated".
- **Allowed sources:** Umbrella, Majestic, CrUX (licence to be confirmed) and verified owner data. Cloudflare Radar and the default Tranco list are non-commercial, so they are excluded.

## 7. Security

- **SSRF guard:**
  - DNS results are filtered against private, loopback, link-local and metadata ranges.
  - IP-literal URLs are checked separately, because they skip DNS.
  - Every redirect hop is re-checked.
  - Only ports 80 and 443 are allowed.
  - In headless-browser mode, every sub-request is checked.
- **Resource limits:** 3 MB body cap, timeouts, and at most 5 redirects.
- **Politeness:** robots.txt is respected and the crawler sends its own `SiteLensBot` user agent.
- **Rate limits:** cold scans are limited per IP. Cached reads are free.
- **Environment:** config is validated at boot. `ALLOW_PRIVATE_NETWORK` exists only for local tests.

## 8. Deployment and cost

| Stage | Setup | Monthly |
|---|---|---|
| MVP (now) | 1 VPS (Hetzner CX-class or Oracle free tier), Docker `output: standalone`, Cloudflare free | ~€5–10 |
| Growth (100K+ reports) | Same VPS, bigger. Scanner moves to a worker process fed by a queue table. Nightly re-scans of popular domains. | ~€20–40 |
| Scale (millions) | Report blobs → Cloudflare R2. `tech_history`/analytics → ClickHouse or Postgres. 2–3 crawler boxes. Web tier stays small behind the CDN. | ~€150–400 + data |

**Why not Vercel serverless:**
- Scans need raw DNS/TLS sockets and can take up to 15 s.
- The database is a local file.
- Crawling from serverless IPs is expensive and gets blocked.

The Next.js app can still move to Vercel later, as long as the scanner runs as a separate worker.

## 9. Feature modules added after the MVP

- **PageSpeed:** `server/pagespeed/psi.ts` normalizes the Google PSI v5 response. `services/pagespeed-service.ts` caches it in the `pagespeed` table (7 days) and deduplicates runs. The client panel loads it lazily, so a slow Lighthouse run (10–30 s) never blocks the report.
- **Technology pages:** slugs come from the fingerprint database (`bySlug`). "Sites using X" = `tech_history` rows whose `last_seen` equals the report's `scanned_at`.
  - Pages with fewer than 3 sites are `noindex` and stay out of the sitemap.
  - Logos come from `/tech-icons/[file]`: an allow-listed proxy with a disk cache, served with a sandbox CSP so third-party SVGs stay inert.
- **Directory:** `reports.traffic_mid` (migration `0001`, with a backfill) powers "Popular sites".
- **Exports:**
  - `server/export/card-data.ts` is the single source for everything exported.
  - `card-image.tsx`: PNG via `next/og`, with fonts from `data/fonts`.
  - `pdf.ts`: pdf-lib, with a clickable backlink.
  - `badge.ts`: SVG.
  - `lib/embed-snippets.ts`: the copy-paste code, every snippet wrapped in a link to the report.

## 10. Roadmap hooks already in place

- `services/report-service.ts` is the single entry point, so a queue worker can be added without touching routes.
- `tech_history` already records first and last seen, so change alerts are just a query plus an email.
- `ground_truth.source = 'verified'` is displayed as exact. "Connect Google Analytics" only needs to write rows into that table.
- `/api/v1` is versioned, so API keys and plans can be added in `proxy.ts` and the route handlers.
