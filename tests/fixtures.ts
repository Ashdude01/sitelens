// Fake websites on loopback IPs used by the end-to-end tests.
import http from "node:http";

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

function end(res: http.ServerResponse, status: number, body: string, type: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": type, ...headers });
  res.end(body);
}

export const SITES: Record<string, Handler> = {
  // WordPress + WooCommerce behind nginx; "/" redirects and sets a cookie.
  "127.0.0.2": (req, res) => {
    if (req.url === "/robots.txt")
      return end(res, 200, "User-agent: *\nDisallow: /wp-admin/\nSitemap: http://127.0.0.2:8080/sitemap.xml\n", "text/plain");
    if (req.url === "/") {
      res.writeHead(301, { location: "/home/", "set-cookie": "wordpress_test_cookie=WP+Cookie+check; path=/" });
      return res.end();
    }
    return end(
      res,
      200,
      `<!doctype html><html lang="en-US"><head>
<title>Chai &amp; Code — a WordPress blog</title>
<meta name="description" content="Notes on tea and programming.">
<meta name="generator" content="WordPress 6.6.1">
<link rel="stylesheet" href="/wp-content/themes/astra/style.css?ver=4.6.1">
<script src="/wp-includes/js/jquery/jquery.min.js?ver=3.7.1"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"></script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('config','G-TEST123');</script>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},{"@type":"Organization"}]}</script>
</head><body class="home woocommerce-no-js"><h1>Hello</h1><div class="wp-block-group"><div class="wp-block-columns">x</div></div>
<a href="/about/">About</a><a href="https://twitter.com/chaicode">Twitter</a><a href="https://github.com/chaicode">GitHub</a>
<img src="/a.png"><img src="/b.png" alt="b"></body></html>`,
      "text/html; charset=UTF-8",
      {
        server: "nginx/1.24.0",
        "x-powered-by": "PHP/8.2.12",
        link: '<http://127.0.0.2:8080/wp-json/>; rel="https://api.w.org/"',
        "strict-transport-security": "max-age=31536000",
      },
    );
  },
  // Shopify store
  "127.0.0.3": (req, res) => {
    if (req.url === "/robots.txt") return end(res, 404, "nope", "text/plain");
    return end(
      res,
      200,
      `<html><head><title>Kurta House</title><meta name="shopify-digital-wallet" content="/1/digital_wallets/dialog">
<script src="https://cdn.shopify.com/s/files/1/theme.js"></script><script src="https://connect.facebook.net/en_US/fbevents.js"></script></head>
<body><h1>Shop</h1></body></html>`,
      "text/html",
      { "x-shopify-stage": "production", "set-cookie": "_shopify_y=abc; path=/", "x-shopid": "123" },
    );
  },
  // Next.js SPA: some tech only appears after JavaScript runs.
  "127.0.0.4": (req, res) => {
    if (req.url === "/robots.txt") return end(res, 200, "User-agent: *\nAllow: /\n", "text/plain");
    if (req.url?.startsWith("/_next/")) return end(res, 200, "window.__app=1;", "application/javascript");
    return end(
      res,
      200,
      `<html><head><title>Rocket SaaS</title><script src="/_next/static/chunks/main-abc.js" defer></script></head>
<body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
<script>window.jQuery={fn:{jquery:'3.6.4'}};var s=document.createElement('script');s.src='https://js.hs-scripts.com/12345.js';document.head.appendChild(s);</script>
</body></html>`,
      "text/html",
      { "x-powered-by": "Next.js" },
    );
  },
  // Disallows all bots.
  "127.0.0.5": (req, res) => {
    if (req.url === "/robots.txt") return end(res, 200, "User-agent: *\nDisallow: /\n", "text/plain");
    return end(res, 200, "<html><head><title>Private</title></head></html>", "text/html");
  },
};

// Fake Google PageSpeed Insights API.
export let psiCalls = 0;
SITES["127.0.0.6"] = async (req, res) => {
  const { psiFixture } = await import("./psi-fixture");
  const u = new URL(req.url ?? "/", "http://x");
  psiCalls++;
  if (u.searchParams.get("url")?.includes("fail")) return end(res, 500, JSON.stringify({ error: { message: "Lighthouse returned error: FAILED_DOCUMENT_REQUEST" } }), "application/json");
  return end(res, 200, JSON.stringify(psiFixture(u.searchParams.get("strategy") === "desktop" ? "desktop" : "mobile")), "application/json");
};

export async function startFixtures(port = 8080) {
  const servers: http.Server[] = [];
  for (const [ip, handler] of Object.entries(SITES)) {
    const s = http.createServer(handler);
    await new Promise<void>((r) => s.listen(port, ip, r));
    servers.push(s);
  }
  return () => Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
}

// `npx tsx tests/fixtures.ts` runs the fixture sites standalone for manual testing.
if (process.argv[1]?.endsWith("fixtures.ts")) {
  await startFixtures(8080);
  console.log("Fixture sites on 127.0.0.2-5:8080");
}
