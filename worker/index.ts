export interface Redirect {
  source: string;
  destination: string;
  code: 301 | 302;
}

export const REDIRECTS: Redirect[] = [
  { source: "/security.txt", destination: "/.well-known/security.txt", code: 301 },
  { source: "/.well-known/avatar", destination: "/icon-512.png", code: 302 },
];

export interface HeaderRule {
  source: string;
  headers: Record<string, string>;
}

export const HEADER_RULES: HeaderRule[] = [
  {
    source: "/*",
    headers: {
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer-when-downgrade",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https://app.greenweb.org; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  },
  {
    source: "/.well-known/webfinger",
    headers: {
      "Content-Type": "application/jrd+json",
      "Access-Control-Allow-Origin": "*",
    },
  },
  {
    source: "/.well-known/host-meta",
    headers: {
      "Content-Type": "application/xrd+xml",
    },
  },
  {
    source: "/.well-known/nostr.json",
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  {
    source: "/.well-known/atproto-did",
    headers: {
      "Content-Type": "text/plain",
    },
  },
  {
    source: "/.well-known/did.json",
    headers: {
      "Content-Type": "application/did+ld+json",
    },
  },
  {
    source: "/feed.xml",
    headers: {
      "Content-Type": "application/atom+xml",
    },
  },
];

export function matchesPattern(pathname: string, pattern: string): boolean {
  if (pattern === "/*") return true;
  if (pattern.endsWith("/*")) {
    return pathname.startsWith(pattern.slice(0, -1));
  }
  return pathname === pattern;
}

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const url = new URL(request.url);

    // Canonical hostname redirect
    if (url.hostname === "www.dwk.io") {
      url.hostname = "dwk.io";
      return Response.redirect(url.href, 301);
    }

    // Handle redirects
    for (const redirect of REDIRECTS) {
      if (url.pathname === redirect.source) {
        return Response.redirect(
          new URL(redirect.destination, url.origin).href,
          redirect.code,
        );
      }
    }

    // Fetch static asset
    const response = await env.ASSETS.fetch(request);

    // Apply matching header rules
    const headers = new Headers(response.headers);
    for (const rule of HEADER_RULES) {
      if (matchesPattern(url.pathname, rule.source)) {
        for (const [key, value] of Object.entries(rule.headers)) {
          headers.set(key, value);
        }
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
