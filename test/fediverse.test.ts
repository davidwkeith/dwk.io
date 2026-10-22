// The owner's fediverse identity: `@dwk@dwk.io` is the self-hosted actor, set
// up as the target of a Mastodon `Move` from the old instance account.
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
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
});
