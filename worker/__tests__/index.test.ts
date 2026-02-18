import { describe, it, expect } from "vitest";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import worker, { matchesPattern } from "../index";

// ─── matchesPattern ─────────────────────────────────────────

describe("matchesPattern", () => {
  it("matches exact paths", () => {
    expect(matchesPattern("/foo", "/foo")).toBe(true);
  });

  it("rejects non-matching exact paths", () => {
    expect(matchesPattern("/foo", "/bar")).toBe(false);
  });

  it("matches catch-all /*", () => {
    expect(matchesPattern("/anything", "/*")).toBe(true);
    expect(matchesPattern("/", "/*")).toBe(true);
    expect(matchesPattern("/deeply/nested/path", "/*")).toBe(true);
  });

  it("matches prefix wildcards", () => {
    expect(matchesPattern("/.well-known/foo", "/.well-known/*")).toBe(true);
    expect(matchesPattern("/.well-known/", "/.well-known/*")).toBe(true);
  });

  it("rejects non-matching prefix wildcards", () => {
    expect(matchesPattern("/other/path", "/.well-known/*")).toBe(false);
  });

  it("does not partial-match without wildcard", () => {
    expect(matchesPattern("/foo/bar", "/foo")).toBe(false);
  });
});

// ─── Helper ─────────────────────────────────────────────────

function mockEnv(
  status = 200,
  body = "ok",
  headers: Record<string, string> = {},
): Env {
  return {
    ASSETS: {
      fetch: async () => new Response(body, { status, headers }),
    } as unknown as Fetcher,
  };
}

async function fetchWorker(url: string, env?: Env): Promise<Response> {
  const request = new Request(url) as unknown as Request<unknown, IncomingRequestCfProperties>;
  const ctx = createExecutionContext();
  const response = await worker.fetch!(request, env ?? mockEnv(), ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

// ─── Hostname redirect ──────────────────────────────────────

describe("hostname redirect", () => {
  it("redirects www.dwk.io to dwk.io with 301", async () => {
    const response = await fetchWorker("https://www.dwk.io/some/path");
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("https://dwk.io/some/path");
  });

  it("preserves query string on www redirect", async () => {
    const response = await fetchWorker("https://www.dwk.io/page?q=test");
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("https://dwk.io/page?q=test");
  });

  it("does not redirect bare dwk.io", async () => {
    const response = await fetchWorker("https://dwk.io/");
    expect(response.status).toBe(200);
  });
});

// ─── Path redirects ─────────────────────────────────────────

describe("path redirects", () => {
  it("redirects /security.txt with 301", async () => {
    const response = await fetchWorker("https://dwk.io/security.txt");
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(
      "https://dwk.io/.well-known/security.txt",
    );
  });

  it("redirects /.well-known/avatar with 302", async () => {
    const response = await fetchWorker("https://dwk.io/.well-known/avatar");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://dwk.io/icon-512.png",
    );
  });
});

// ─── Header rules ───────────────────────────────────────────

describe("header rules", () => {
  it("applies global security headers to all paths", async () => {
    const response = await fetchWorker("https://dwk.io/any/path");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe(
      "no-referrer-when-downgrade",
    );
  });

  it("sets Content-Type and CORS for webfinger", async () => {
    const response = await fetchWorker("https://dwk.io/.well-known/webfinger");
    expect(response.headers.get("Content-Type")).toBe("application/jrd+json");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("sets Content-Type for host-meta", async () => {
    const response = await fetchWorker("https://dwk.io/.well-known/host-meta");
    expect(response.headers.get("Content-Type")).toBe("application/xrd+xml");
  });

  it("sets CORS for nostr.json", async () => {
    const response = await fetchWorker(
      "https://dwk.io/.well-known/nostr.json",
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("sets Content-Type for atproto-did", async () => {
    const response = await fetchWorker(
      "https://dwk.io/.well-known/atproto-did",
    );
    expect(response.headers.get("Content-Type")).toBe("text/plain");
  });

  it("sets Content-Type for did.json", async () => {
    const response = await fetchWorker("https://dwk.io/.well-known/did.json");
    expect(response.headers.get("Content-Type")).toBe(
      "application/did+ld+json",
    );
  });

  it("sets Content-Type for Atom feed", async () => {
    const response = await fetchWorker("https://dwk.io/feed.xml");
    expect(response.headers.get("Content-Type")).toBe("application/atom+xml");
  });

  it("stacks global + specific rules", async () => {
    const response = await fetchWorker("https://dwk.io/.well-known/host-meta");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Content-Type")).toBe("application/xrd+xml");
  });

  it("does not apply specific headers to unmatched paths", async () => {
    const response = await fetchWorker("https://dwk.io/projects/");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });
});

// ─── Asset passthrough ──────────────────────────────────────

describe("asset passthrough", () => {
  it("preserves upstream status code", async () => {
    const response = await fetchWorker(
      "https://dwk.io/not-found",
      mockEnv(404, "Not Found"),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("preserves upstream response body", async () => {
    const response = await fetchWorker(
      "https://dwk.io/",
      mockEnv(200, "<html>home</html>"),
    );
    expect(await response.text()).toBe("<html>home</html>");
  });
});
