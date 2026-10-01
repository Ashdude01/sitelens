-- Chrome UX Report popularity buckets. Run in Google BigQuery (free tier: 1 TB of queries / month).
-- 1) Open https://console.cloud.google.com/bigquery and create a (free) project.
-- 2) Run a query below, then "Save results" -> "CSV (Google Drive)" (a local download is capped at ~10 MB).
-- 3) npm run import:ranks -- crux --file crux.csv
--
-- The rank lives in the nested field experimental.popularity.rank (there is no top-level "rank" column).
-- It is a bucket: 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000.
-- LICENCE: confirm the CrUX dataset's licence terms for commercial use before launch.

-- 0) Latest month available (use it in place of 202608 below):
SELECT MAX(yyyymm) AS latest FROM `chrome-ux-report.experimental.global`;

-- A) Global popularity bucket per origin  ->  crux.csv  (columns: origin,rank)
--    rank <= 1000000 keeps it to ~1M rows (fits Neon's free tier). Raise it if you have the storage.
SELECT DISTINCT origin, experimental.popularity.rank AS rank
FROM `chrome-ux-report.experimental.global`
WHERE yyyymm = 202608
  AND experimental.popularity.rank <= 1000000;

-- B) Per-country popularity buckets  ->  crux_country.csv  (columns: country_code,origin,rank)
--    npm run import:ranks -- crux-country --file crux_country.csv
--    This table has one list per country, so it grows fast: check the row count BigQuery shows before
--    exporting (~1M rows is roughly 150 MB in Postgres). Raise 10000 to 100000 if you have the storage.
SELECT DISTINCT country_code, origin, experimental.popularity.rank AS rank
FROM `chrome-ux-report.experimental.country`
WHERE yyyymm = 202608
  AND experimental.popularity.rank <= 10000;
