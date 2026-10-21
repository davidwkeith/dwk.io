import { describe, expect, it, vi } from "vitest";
import { USER_AGENT, withUserAgent } from "../worker/user-agent";

function stub() {
  const seen: Headers[] = [];
  const base = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input, init).headers);
    return new Response("ok");
  });
  return { base: base as unknown as typeof fetch, seen };
}

describe("withUserAgent", () => {
  it("adds the User-Agent to a bare URL fetch", async () => {
    const { base, seen } = stub();
    await withUserAgent(base)("https://peer.example/actor", { headers: { accept: "application/activity+json" } });
    expect(seen[0]?.get("user-agent")).toBe(USER_AGENT);
    expect(seen[0]?.get("accept")).toBe("application/activity+json");
  });

  it("keeps a Request's own headers and adds the agent when it has none", async () => {
    const { base, seen } = stub();
    await withUserAgent(base)(new Request("https://peer.example/inbox", { method: "POST", headers: { digest: "SHA-256=x" } }));
    expect(seen[0]?.get("user-agent")).toBe(USER_AGENT);
    expect(seen[0]?.get("digest")).toBe("SHA-256=x");
  });

  it("leaves a request that already identifies itself alone", async () => {
    const { base, seen } = stub();
    await withUserAgent(base)("https://peer.example/", { headers: { "user-agent": "custom/1.0" } });
    expect(seen[0]?.get("user-agent")).toBe("custom/1.0");
  });

  it("is installed on the global fetch when the module loads", async () => {
    const real = globalThis.fetch;
    const { base, seen } = stub();
    globalThis.fetch = base;
    try {
      vi.resetModules();
      await import("../worker/user-agent");
      await globalThis.fetch("https://peer.example/");
      expect(seen[0]?.get("user-agent")).toBe(USER_AGENT);
    } finally {
      globalThis.fetch = real;
    }
  });
});
