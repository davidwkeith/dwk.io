// The dwk.io Worker: every @dwk/workers endpoint package composed in front of
// the static site (Workers Static Assets in `dist/`). The mount table lives in
// `worker/mounts.ts`, each package's config in `worker/config.ts`, and the
// binding union in `worker/env.ts`; `wrangler.jsonc` declares the bindings.
import { createMicrosubPoller, createMicrosubQueueConsumer } from "@dwk/microsub";
import { createSolidPodGc, type SolidPodGcHandler } from "@dwk/solid-pod";
import { createWebmentionQueueConsumer } from "@dwk/webmention";
import { createWebSubQueueConsumer } from "@dwk/websub";
import * as config from "./worker/config";
import type { Ctx, Env } from "./worker/env";
import { dispatch, findMount } from "./worker/mounts";
import { publishChangedTopics } from "./worker/publish";

// The Durable Objects this Worker serves (`wrangler.jsonc` binds them to
// these exports).
export { ActivityPubObject } from "@dwk/activitypub";
export { AtprotoRepoObject } from "@dwk/atproto-pds";
export { RemoteStorageObject } from "@dwk/remotestorage";
export { SolidPodObject } from "@dwk/solid-pod";
export { WebAuthnObject } from "@dwk/webauthn";

// Worker-generated responses skip `public/_headers`, so they get the relevant
// security headers here. A handler's own CSP (the login page's form-action)
// wins, and a WebSocket upgrade is passed through untouched.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

function secure(original: Response) {
  if (original.status === 101 || (original as { webSocket?: unknown }).webSocket) return original;
  const res = new Response(original.body, original);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!res.headers.has(name)) res.headers.set(name, value);
  }
  return res;
}

// Queue names from wrangler.jsonc; each consumer is a package's.
const QUEUES = {
  webmention: "dwk-webmention-verify",
  websub: "dwk-websub",
  microsub: "dwk-microsub",
} as const;

type ScheduledController = Parameters<SolidPodGcHandler>[0];
interface QueueBatch {
  readonly queue: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    // www.dwk.io/* → dwk.io/*: a cross-host redirect, which the Static Assets
    // `_redirects` file does not support.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    const mount = findMount(url);
    if (!mount) return env.ASSETS.fetch(request);

    if (url.pathname === "/webmention") {
      // Each accepted request makes the queue consumer fetch an arbitrary
      // source URL, so cap abuse of this public endpoint per sender IP.
      const key = request.headers.get("cf-connecting-ip") ?? "unknown";
      const { success } = await env.WEBMENTION_RATE_LIMITER.limit({ key });
      if (!success) return secure(new Response("Too Many Requests", { status: 429 }));
    }

    try {
      const response = secure(await dispatch(mount, request, env, ctx));
      // A refused write can leave the request body unread; cancel it so the
      // stream is marked used before `wrangler dev`'s middleware looks at it.
      if (request.body !== null && !request.bodyUsed) ctx.waitUntil(request.body.cancel().catch(() => undefined));
      return response;
    } catch (error) {
      config.logger.error("mount.unhandled_error", { mount: mount.name, error: error instanceof Error ? error.name : "unknown" });
      console.error(`dwk: unhandled error in ${mount.name}`, error);
      return secure(new Response("Internal Server Error", { status: 500 }));
    }
  },

  async queue(batch: QueueBatch, env: Env, ctx: Ctx): Promise<void> {
    switch (batch.queue) {
      case QUEUES.webmention:
        return createWebmentionQueueConsumer(config.webmention)(batch as never, env, ctx);
      case QUEUES.websub:
        return createWebSubQueueConsumer(config.websub)(batch as never, env, ctx);
      case QUEUES.microsub:
        return createMicrosubQueueConsumer(config.microsub)(batch as never, env, ctx);
      default:
        throw new Error(`dwk: unknown queue "${batch.queue}"`);
    }
  },

  async scheduled(event: ScheduledController, env: Env, ctx: Ctx): Promise<void> {
    const jobs = {
      // solid-pod and remotestorage share the @dwk/store GC schema and the
      // same BLOBS/GC_DB bindings, so one collector pass covers both.
      "pod blob GC": () => createSolidPodGc(config.solidPod(env))(event, env, ctx),
      // Enqueue a poll job per followed Microsub feed.
      "microsub poll": () => createMicrosubPoller(config.microsub)(event as never, env, ctx as never),
      // Ping the WebSub hub for each feed a deploy changed.
      "websub publish": () => publishChangedTopics(env),
    };
    // Each job runs to completion whatever the other does; a failure is
    // logged, then rethrown so the invocation still reports it.
    const results = await Promise.allSettled(Object.values(jobs).map((run) => run()));
    const failed = results.flatMap((result, i) =>
      result.status === "rejected" ? [{ job: Object.keys(jobs)[i], reason: result.reason as unknown }] : [],
    );
    for (const { job, reason } of failed) {
      config.logger.error("scheduled.failed", { job, error: reason instanceof Error ? reason.name : "unknown" });
      console.error(`dwk: scheduled job "${job}" failed`, reason);
    }
    if (failed.length) throw new Error(`dwk: ${failed.length} scheduled job(s) failed: ${failed.map((f) => f.job).join(", ")}`);
  },
};
