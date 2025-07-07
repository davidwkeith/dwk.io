export default {
  layout: "project.webc",
  tags: ["project"],
  schema: {
    "@type": "CeeativeWork",
    url: "https://dwk.io",
    license: "https://spdx.org/licenses/CC-BY-4.0.html",
    author: {
      "@type": "Person",
      name: "David W. Keith",
      email: "mailto:me@dwk.io",
      url: "https://dwk.io"
    }
  },
  eleventyComputed: {
    // permalink: (data) => `/${data.fileSlug}/`,
  },
  page: {
    eleventyComputed: {
      url: (data) => `/${data.fileSlug}/`,
    }
  }
}