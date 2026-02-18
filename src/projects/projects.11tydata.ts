export default {
  layout: "project.webc",
  tags: ["project"],
  schema: {
    "@type": "CreativeWork",
    license: "https://spdx.org/licenses/CC-BY-4.0.html",
    author: {
      "@type": "Person",
      name: "David W. Keith",
      email: "mailto:me@dwk.io",
      url: "https://dwk.io"
    }
  },
  page: {
    eleventyComputed: {
      url: (data: { fileSlug: string }) => `/${data.fileSlug}/`,
    }
  }
}
