// Shared report types. Safe to import from client and server code.

export type Confidence = "High" | "Medium" | "Low";

export interface Technology {
  name: string;
  /** URL slug of the internal technology page (older cached reports may lack it). */
  slug?: string;
  version: string | null;
  confidence: number;
  implied: boolean;
  categories: string[];
  priority: number;
  website?: string;
  description?: string;
  icon?: string;
  saas: boolean;
  oss: boolean;
  pricing: string[];
  evidence: string[];
}

export interface RankSignal {
  source: string;
  label: string;
  rank: number;
  matched: string;
  extra: { refSubNets?: number | null } | null;
}

export interface TrafficEstimate {
  monthlyVisits: { low: number; mid: number; high: number };
  sigmaLog10: number;
  confidence: Confidence;
  calibrated: boolean;
  signalsUsed: { source: string; rank: number; pointEstimate: number; sigmaLog10?: number }[];
}

export interface CruxRecord {
  inCrux: boolean;
  collectionPeriod?: unknown;
  coreWebVitals?: {
    lcpMs: number | null;
    inpMs: number | null;
    cls: number | string | null;
    fcpMs: number | null;
    ttfbMs: number | null;
  };
  deviceSplit?: Record<string, number> | null;
  navigationTypes?: Record<string, number> | null;
}

export interface OrganicEstimate {
  keywords: number;
  monthlyOrganicVisits: number;
  top3Keywords?: number;
  locationCode?: number;
}

export type TrafficVerdict = "verified" | "estimated" | "too-small" | "unknown";

export interface TrafficInfo {
  verdict: TrafficVerdict;
  verified: { monthlyVisits: number; period: string | null } | null;
  estimate: TrafficEstimate | null;
  ranks: RankSignal[];
  countries: { country: string; rank: number }[];
  crux: CruxRecord | null;
  organic: OrganicEstimate | null;
}

export interface CertInfo {
  issuerOrg: string | null;
  issuerCN: string | null;
  subjectCN: string | null;
  validFrom: string | null;
  validTo: string | null;
  sanCount: number;
  protocol: string | null;
  trusted: boolean;
  error: string | null;
}

export interface SiteInfo {
  title: string | null;
  description: string | null;
  language: string | null;
  canonical: string | null;
  ogImage: string | null;
  siteName: string | null;
  generator: string | null;
  robotsMeta: string | null;
  favicon: string | null;
  links: { internal: number; external: number };
  social: Record<string, string>;
  structuredData: string[];
  headings: { h1: number; h2: number };
  images: { total: number; missingAlt: number };
}

export interface Report {
  version: 1;
  domain: string;
  registrableDomain: string;
  scannedAt: string;
  scanMs: number;
  mode: "http" | "browser";
  fetch:
    | {
        ok: boolean;
        status: number;
        finalUrl: string;
        redirects: number;
        hops: { url: string; status: number }[];
        responseMs: number;
        bytes: number;
        truncated: boolean;
        contentType: string | null;
        error?: undefined;
      }
    | { ok: false; error: string; status?: undefined };
  robots: { found: boolean; allowed: boolean; sitemaps?: string[] };
  technologies: Technology[];
  site: SiteInfo | null;
  hosting: {
    ip: string | null;
    ipv6: boolean;
    asn: { asn: number; org: string | null; country: string | null } | null;
    nameservers: string[];
    mx: string[];
    spf: string | null;
    dmarc: string | null;
    verificationTxt: string[];
  };
  security: {
    https: boolean;
    hsts: boolean;
    csp: boolean;
    xFrameOptions: boolean;
    referrerPolicy: boolean;
    compression: string | null;
  } | null;
  cert: CertInfo | null;
  registration: { registered: string | null; expires: string | null; updated: string | null; registrar: string | null } | null;
  traffic: TrafficInfo;
  notes: string[];
}

export interface CachedReport extends Report {
  cache: { scannedAt: string; ageHours: number };
}

export interface TechChange {
  tech: string;
  firstSeen: number;
  lastSeen: number;
}
