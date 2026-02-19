import {
  type Redirect,
  type HeaderRule,
  COMMON_SECURITY_HEADERS,
  createWorkerHandler,
} from "@dwk/eleventy-shared/worker";

export const REDIRECTS: Redirect[] = [
  { source: "/security.txt", destination: "/.well-known/security.txt", code: 301 },
  { source: "/.well-known/avatar", destination: "/icon-512.png", code: 302 },
];

export const HEADER_RULES: HeaderRule[] = [
  {
    source: "/*",
    headers: {
      ...COMMON_SECURITY_HEADERS,
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https://app.greenweb.org; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
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

export default {
  fetch: createWorkerHandler({
    hostname: "dwk.io",
    redirects: REDIRECTS,
    headerRules: HEADER_RULES,
  }),
} satisfies ExportedHandler<Env>;
