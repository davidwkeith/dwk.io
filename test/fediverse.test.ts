// The owner's fediverse identity: `@dwk@dwk.io` is the self-hosted actor, set
// up as the target of a Mastodon `Move` from the old instance account.
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { buildActorDocument, deriveIris } from "@dwk/activitypub";
import { activitypub } from "../worker/config";
import type { Env } from "../worker/env";

const actor = "https://dwk.io/users/dwk";

describe("webfinger", () => {
  it.each(["acct:dwk@dwk.io", actor, "https://dwk.io", "https://dwk.io/"])("resolves %s to the self-hosted actor", async (resource) => {
    const res = await SELF.fetch(`https://dwk.io/.well-known/webfinger?resource=${encodeURIComponent(resource)}`);
    expect(res.status).toBe(200);
    const jrd = (await res.json()) as { subject: string; links: { rel: string; href?: string }[] };
    expect(jrd.subject).toBe("acct:dwk@dwk.io");
    expect(jrd.links.find((l) => l.rel === "self")?.href).toBe(actor);
  });
});

describe("actor", () => {
  it("names the Mastodon account it migrates from in alsoKnownAs", () => {
    const config = activitypub({ ACTIVITYPUB_PUBLIC_KEY_PEM: "test-pem" } as Env);
    expect(config.actor.username).toBe("dwk");
    expect(config.actor.alsoKnownAs).toEqual(["https://xn--4t8h.dwk.io/users/dwk"]);
  });

  it("lists the site as a rel=me Website field, which the site links back to", async () => {
    const config = activitypub({ ACTIVITYPUB_PUBLIC_KEY_PEM: "test-pem" } as Env);
    const doc = buildActorDocument(deriveIris(config.baseUrl, "dwk"), config.actor, "test-pem");
    expect(doc.attachment).toEqual([
      { type: "PropertyValue", name: "Website", value: '<a href="https://dwk.io/" rel="me nofollow noopener" target="_blank">dwk.io</a>' },
    ]);
    // Mastodon marks the field verified when the page links back to the actor's url with rel="me".
    const home = await (await SELF.fetch("https://dwk.io/")).text();
    expect(home).toMatch(/<a rel="[^"]*\bme\b[^"]*"[^>]*href="https:\/\/dwk\.io"/);
  });
});
