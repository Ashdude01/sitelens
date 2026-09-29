import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

/** Latest scan report per domain (JSON blob). */
export const reports = sqliteTable(
  "reports",
  {
    domain: text("domain").primaryKey(),
    json: text("json").notNull(),
    scannedAt: integer("scanned_at").notNull(),
    // Denormalised flags so sitemap/listing queries don't parse JSON.
    fetchOk: integer("fetch_ok", { mode: "boolean" }).notNull().default(false),
    hasTraffic: integer("has_traffic", { mode: "boolean" }).notNull().default(false),
    techCount: integer("tech_count").notNull().default(0),
    /** Best monthly-visits figure (verified or estimated mid) for "popular sites" lists. */
    trafficMid: integer("traffic_mid"),
  },
  (t) => [index("reports_scanned_at_idx").on(t.scannedAt), index("reports_traffic_mid_idx").on(t.trafficMid)],
);

/** Technology first/last seen per domain. Powers "added / removed" changes and alerts. */
export const techHistory = sqliteTable(
  "tech_history",
  {
    domain: text("domain").notNull(),
    tech: text("tech").notNull(),
    firstSeen: integer("first_seen").notNull(),
    lastSeen: integer("last_seen").notNull(),
  },
  (t) => [primaryKey({ columns: [t.domain, t.tech] })],
);

/** Popularity lists (umbrella, majestic, crux, custom). Lower rank = more popular. */
export const ranks = sqliteTable(
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
export const cruxCountry = sqliteTable(
  "crux_country",
  {
    domain: text("domain").notNull(),
    country: text("country").notNull(),
    rank: integer("rank").notNull(),
  },
  (t) => [primaryKey({ columns: [t.domain, t.country] })],
);

/** Known real traffic. source='verified' is shown as exact; all rows feed calibration. */
export const groundTruth = sqliteTable("ground_truth", {
  domain: text("domain").primaryKey(),
  monthlyVisits: integer("monthly_visits").notNull(),
  source: text("source").notNull(),
  period: text("period"),
  updatedAt: integer("updated_at").notNull(),
});

/** IP range -> ASN / hosting network (iptoasn.com, public domain). */
export const ip2asn = sqliteTable("ip2asn", {
  start: integer("start").primaryKey(),
  end: integer("end").notNull(),
  asn: integer("asn").notNull(),
  country: text("country"),
  org: text("org"),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value"),
});

/** Cached Google PageSpeed Insights results (slow to fetch, so cached for days). */
export const pagespeed = sqliteTable(
  "pagespeed",
  {
    domain: text("domain").notNull(),
    strategy: text("strategy").notNull(), // "mobile" | "desktop"
    json: text("json").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.domain, t.strategy] })],
);
