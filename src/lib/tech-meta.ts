export const PRICING_LABELS: Record<string, string> = {
  low: "Low cost",
  mid: "Mid-priced",
  high: "High cost",
  freemium: "Freemium",
  onetime: "One-time payment",
  recurring: "Subscription",
  poa: "Price on request",
  payg: "Pay as you go",
};

/** Human labels for the kinds of fingerprints a technology has. */
export const DETECTION_LABELS: Record<string, { label: string; hint: string }> = {
  headers: { label: "HTTP headers", hint: "Server response headers" },
  cookies: { label: "Cookies", hint: "Cookie names the site sets" },
  meta: { label: "Meta tags", hint: "<meta> tags such as generator" },
  scriptSrc: { label: "Script URLs", hint: "Where JavaScript files load from" },
  scripts: { label: "Inline scripts", hint: "Code patterns inside the page" },
  html: { label: "HTML patterns", hint: "Markup in the page source" },
  dom: { label: "Page elements", hint: "CSS selectors in the DOM" },
  js: { label: "JavaScript globals", hint: "Variables set at runtime (browser mode)" },
  dns: { label: "DNS records", hint: "MX, NS, TXT and SOA records" },
  certIssuer: { label: "SSL certificate", hint: "Certificate issuer" },
  url: { label: "URL patterns", hint: "The page address itself" },
};
