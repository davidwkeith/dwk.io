import { describe, expect, it } from "vitest";
import { escapeHtml, httpUrl, timeTag } from "../worker/html";

describe("escapeHtml", () => {
  it("escapes markup and both quote styles", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
});

describe("httpUrl", () => {
  it("keeps absolute http(s) URLs", () => {
    expect(httpUrl("https://example.com/a b")).toBe("https://example.com/a%20b");
    expect(httpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("drops other schemes, relative URLs, and non-strings", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,x", "/relative", "not a url", undefined, 42]) {
      expect(httpUrl(value)).toBeUndefined();
    }
  });
});

describe("timeTag", () => {
  it("renders an mf2 time with an ISO datetime", () => {
    expect(timeTag(new Date("2026-10-20T10:00:00Z"))).toBe('<time class="dt-published" datetime="2026-10-20T10:00:00.000Z">October 20, 2026</time>');
  });
});
