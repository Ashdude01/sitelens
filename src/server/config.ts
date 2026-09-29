import path from "node:path";
import { z } from "zod";

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : ["1", "true", "yes"].includes(v.toLowerCase())));
const int = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : Number.parseInt(v, 10)))
    .pipe(z.number().int().nonnegative());

const EnvSchema = z.object({
  SITE_NAME: z.string().default("SiteLens"),
  PUBLIC_URL: z
    .string()
    .default("http://localhost:3000")
    .transform((u) => u.replace(/\/$/, "")),
  /** Folder with fingerprints/, calibration.json and ground_truth.csv. */
  DATA_DIR: z.string().optional(),
  /** Neon/Postgres connection string: postgresql://… */
  DATABASE_URL: z
    .string()
    .optional()
    .transform((v) => {
      const url = v?.trim() ?? "";
      return url.length ? url : undefined;
    }),

  USER_AGENT: z.string().default("Mozilla/5.0 (compatible; SiteLensBot/0.1; +https://example.com/bot)"),
  BOT_TOKEN: z.string().default("SiteLensBot"),
  RESPECT_ROBOTS: bool(true),
  FETCH_TIMEOUT_MS: int(12_000),
  MAX_BODY_BYTES: int(3 * 1024 * 1024),
  MAX_REDIRECTS: int(5),

  USE_BROWSER: bool(false),
  CHROMIUM_PATH: z.string().optional(),
  ALLOW_PRIVATE_NETWORK: bool(false),

  REPORT_TTL_HOURS: int(24 * 7),
  FRESH_SCANS_PER_HOUR: int(30),
  TRUST_PROXY: bool(false),

  CRUX_API_KEY: z.string().optional(),
  DATAFORSEO_LOGIN: z.string().optional(),
  DATAFORSEO_PASSWORD: z.string().optional(),
  DATAFORSEO_LOCATION_CODE: int(2840),
  DATAFORSEO_LANGUAGE_CODE: z.string().default("en"),
  RDAP_ENABLED: bool(true),

  TECH_ICON_UPSTREAM: z.string().default("https://raw.githubusercontent.com/enthec/webappanalyzer/main/src/images/icons/"),
  PAGESPEED_API_KEY: z.string().optional(),
  PAGESPEED_API_BASE: z.string().default("https://www.googleapis.com/pagespeedonline/v5/runPagespeed"),
  PAGESPEED_TTL_HOURS: int(24),
  PAGESPEED_RUNS_PER_HOUR: int(240),

  GLOBALPING_TOKEN: z.string().optional(),
  GLOBALPING_TTL_HOURS: int(12),
  /** Fresh worldwide checks per visitor per hour. Each check is one Globalping test per country. */
  GLOBALPING_RUNS_PER_HOUR: int(12),
  PREVIEW_TTL_HOURS: int(24 * 7),
});

function load() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  const dataDir = path.resolve(e.DATA_DIR ?? path.join(process.cwd(), "data"));
  return {
    siteName: e.SITE_NAME,
    publicUrl: e.PUBLIC_URL,
    /** Empty until DATABASE_URL is set. getDb() refuses to connect without a Postgres URL. */
    databaseUrl: e.DATABASE_URL ?? "",
    dataDir,

    userAgent: e.USER_AGENT,
    botToken: e.BOT_TOKEN,
    respectRobots: e.RESPECT_ROBOTS,
    fetchTimeoutMs: e.FETCH_TIMEOUT_MS,
    maxBodyBytes: e.MAX_BODY_BYTES,
    maxRedirects: e.MAX_REDIRECTS,

    useBrowser: e.USE_BROWSER,
    chromiumPath: e.CHROMIUM_PATH,
    /** Only for local tests: allows scanning localhost / private IPs / any port. Never enable in production. */
    allowPrivateNetwork: e.ALLOW_PRIVATE_NETWORK,

    reportTtlHours: e.REPORT_TTL_HOURS,
    freshScansPerHour: e.FRESH_SCANS_PER_HOUR,
    trustProxy: e.TRUST_PROXY,

    cruxApiKey: e.CRUX_API_KEY,
    dataforseo: e.DATAFORSEO_LOGIN
      ? {
          login: e.DATAFORSEO_LOGIN,
          password: e.DATAFORSEO_PASSWORD ?? "",
          locationCode: e.DATAFORSEO_LOCATION_CODE,
          languageCode: e.DATAFORSEO_LANGUAGE_CODE,
        }
      : null,
    rdapEnabled: e.RDAP_ENABLED,

    techIconUpstream: e.TECH_ICON_UPSTREAM,
    pagespeedApiKey: e.PAGESPEED_API_KEY,
    pagespeedApiBase: e.PAGESPEED_API_BASE,
    pagespeedTtlHours: e.PAGESPEED_TTL_HOURS,
    pagespeedRunsPerHour: e.PAGESPEED_RUNS_PER_HOUR,

    globalpingToken: e.GLOBALPING_TOKEN?.trim() ?? "",
    globalpingTtlHours: e.GLOBALPING_TTL_HOURS,
    globalpingRunsPerHour: e.GLOBALPING_RUNS_PER_HOUR,
    previewTtlHours: e.PREVIEW_TTL_HOURS,
  };
}

export type AppConfig = ReturnType<typeof load>;

/** Parsed once at startup. Mutable only so tests can flip flags. */
export const config: AppConfig = load();
