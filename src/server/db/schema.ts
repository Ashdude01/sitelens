import { bigint, boolean, index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

/** Millisecond timestamps and large counters. Postgres `integer` is only 32-bit. */
const ms = (name: string) => bigint(name, { mode: "number" });

/** Latest scan report per domain (JSON blob). */
export const reports = pgTable(
  "reports",
  {
    domain: text("domain").primaryKey(),
    json: text("json").notNull(),
    scannedAt: ms("scanned_at").notNull(),
    // Denormalised flags so sitemap/listing queries don't parse JSON.
    fetchOk: boolean("fetch_ok").notNull().default(false),
    hasTraffic: boolean("has_traffic").notNull().default(false),
    techCount: integer("tech_count").notNull().default(0),
    /** Best monthly-visits figure (verified or estimated mid) for "popular sites" lists. */
    trafficMid: ms("traffic_mid"),
  },
  (t) => [index("reports_scanned_at_idx").on(t.scannedAt), index("reports_traffic_mid_idx").on(t.trafficMid)],
);

/** Technology first/last seen per domain. Powers "added / removed" changes and alerts. */
export const techHistory = pgTable(
  "tech_history",
  {
    domain: text("domain").notNull(),
    tech: text("tech").notNull(),
    firstSeen: ms("first_seen").notNull(),
    lastSeen: ms("last_seen").notNull(),
  },
  (t) => [primaryKey({ columns: [t.domain, t.tech] })],
);

/** Popularity lists (umbrella, majestic, crux, custom). Lower rank = more popular. */
export const ranks = pgTable(
  "ranks",
  {
    source: text("source").notNull(),
    domain: text("domain").notNull(),
    rank: integer("rank").notNull(),
    extra: text("extra"),
  },
  (t) => [primaryKey({ columns: [t.source, t.domain] }), index("ranks_domain_idx").on(t.domain)],
);

/** Chrome UX Report per-country popularity buckets. */
export const cruxCountry = pgTable(
  "crux_country",
  {
    domain: text("domain").notNull(),
    country: text("country").notNull(),
    rank: integer("rank").notNull(),
  },
  (t) => [primaryKey({ columns: [t.domain, t.country] })],
);

/** Known real traffic. source='verified' is shown as exact; all rows feed calibration. */
export const groundTruth = pgTable("ground_truth", {
  domain: text("domain").primaryKey(),
  monthlyVisits: ms("monthly_visits").notNull(),
  source: text("source").notNull(),
  period: text("period"),
  updatedAt: ms("updated_at").notNull(),
});

/** IP range -> ASN / hosting network (iptoasn.com, public domain). Stored as unsigned IPv4 ints. */
export const ip2asn = pgTable("ip2asn", {
  start: ms("start").primaryKey(),
  end: ms("end").notNull(),
  asn: integer("asn").notNull(),
  country: text("country"),
  org: text("org"),
});

export const meta = pgTable("meta", {
  key: text("key").primaryKey(),
  value: text("value"),
});

/** Cached Google PageSpeed Insights results (slow to fetch, so cached for days). */
export const pagespeed = pgTable(
  "pagespeed",
  {
    domain: text("domain").notNull(),
    strategy: text("strategy").notNull(),
    json: text("json").notNull(),
    fetchedAt: ms("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.domain, t.strategy] })],
);
