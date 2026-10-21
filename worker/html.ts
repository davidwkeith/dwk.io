// HTML helpers for the pages the Worker renders or rewrites (received
// webmentions, Micropub posts).

// Minimal shape of the Workers HTMLRewriter; the Workers runtime globals
// aren't loaded into this (Astro, DOM-lib) TypeScript project.
export interface RewriterElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): RewriterElement;
  removeAttribute(name: string): RewriterElement;
  setInnerContent(content: string, options?: { html: boolean }): RewriterElement;
  remove(): RewriterElement;
}
interface Rewriter {
  on(selector: string, handlers: { element(element: RewriterElement): void | Promise<void> }): Rewriter;
  transform(response: Response): Response;
}
declare const HTMLRewriter: { new (): Rewriter };

export function rewriter(): Rewriter {
  return new HTMLRewriter();
}

export function isHtml(response: Response) {
  return (response.headers.get("content-type") ?? "").startsWith("text/html");
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** `value` when it is an absolute http(s) URL, else undefined: never emit a `javascript:` href. */
export function httpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Matches the date format of the static pages (`ProjectLayout.astro`). */
export function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function timeTag(date: Date, className = "dt-published") {
  return `<time class="${className}" datetime="${date.toISOString()}">${formatDate(date)}</time>`;
}
