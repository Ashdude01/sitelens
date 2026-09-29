-- Chrome UX Report popularity buckets. Run in Google BigQuery (free tier: 1 TB of queries / month).
-- 1) Open https://console.cloud.google.com/bigquery and create a (free) project.
-- 2) Run a query below, then "Save results" -> CSV (or export to Cloud Storage if large).
-- 3) npm run import:ranks -- crux --file crux.csv
--
-- Replace 202608 with the latest month available (check the table's preview).
-- LICENCE: confirm the CrUX dataset's licence terms for commercial use before launch.

-- A) Global popularity bucket per origin  ->  crux.csv  (columns: origin,rank)
SELECT origin, rank
FROM `chrome-ux-report.experimental.global`
WHERE yyyymm = 202608;

-- B) Per-country popularity buckets  ->  crux_country.csv  (columns: country_code,origin,rank)
--    Keep it to top-1M per country to stay small:
--    npm run import:ranks -- crux-country --file crux_country.csv
SELECT country_code, origin, rank
FROM `chrome-ux-report.experimental.country`
WHERE yyyymm = 202608 AND rank <= 1000000;
