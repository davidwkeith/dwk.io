import type { SiteData } from '../types.ts';

/**
 * These are all the site-level variables. Often used as fallback for page-level data.
 */
export default {

  /**
   * The title of the site, used in the `<title>` tag and as the main heading.
   * Also used in the JSON (RSS) Feed. See the `base.webc` template for individual
   * page title computation.
   * 
   * @required
   * @property {string} title - Site title
   */
  title: "DWK's Cyber Home",

  /**
   * Description is used in the `<meta name="description">` tag.
   * if the description is not set in front matter for the individual page.
   * This is also used in the JSON Feed.
   * 
   * @property {string} description - A short description of the site.
   */
  description: "David W. Keith's personal website.",

  /**
   * The URL is used in the `<link rel="canonical">` tag, JSON feed, and sitemap.
   * It should be the full URL to the site, including the protocol.
   * 
   * @required
   * @type {URL}
   * @property {URL} url - The URL of the site.
   */
  url: new URL("https://dwk.io"),

  /**
   * If present this will be used to generate the `<meta property="fediverse:creator">` tag.
   * 
   * @see https://blog.joinmastodon.org/2024/07/highlighting-journalism-on-mastodon/
   * @optional
   * @property {string} fediverseCreator: the handle of the creator on the Fediverse.
   */
  fediverseCreator: "@dwk@xn--4t8h.dwk.io",

  /**
   * If present this will be used to generate the `<meta name="copyright">` tag.
   * 
   * @optional
   * @property {string} copyright - The copywrite string for the site
   */
  copyright: `CC-BY-4.0 David W. Keith ${(new Date()).getFullYear()}`,

  /**
   * This is used to generate the favicons for the site.
   * 
   * @see https://github.com/NJAldwin/eleventy-plugin-gen-favicons
   * @property {object} favicon - Favicon options.
   * @property {string} favicon.src - Path to the source image.
   * @property {string} favicon.appleIconBgColor - Background color for the Apple touch icon.
   * @property {number} favicon.appleIconPadding - Padding for the Apple touch icon.
   */
  favicon: {
    src: "img/memoji.png",
    appleIconBgColor: "#000000",
    appleIconPadding: 20,
  },

  /**
   * The content rating of the site, used in the `<meta name="rating">` tag.
   * If omitted the rating tag won't be output and is equivelent to "general"
   * 
   * @see https://developers.google.com/search/docs/specialty/explicit/guidelines?udm=14#mark-specific-pages
   * @optional
   * @property {string} rating - either "general" or "adult"
   */
  rating: "general",

  /**
   * The language for the content of the site, used in the `<html lang="">` attribute
   * and any other place where language information is needed. (assumes the entire site
   * is in the same language)
   * 
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang
   * @property {string} language - a valid BCP 47 language string
   * @default "en"
   */
  language: "en",

  /**
   * Controls whether the main navigation is rendered on the site.
   * Set to `false` for single-page sites or if navigation is handled differently.
   * 
   * @property {boolean} hasNavigation - Whether to render the main navigation.
   * @default true
   */
  hasNavigation: true,

  /**
   * Support for switching between dark and light mode in CSS.
   * 
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/color-scheme
   * @property {object} colorScheme - an object that defines the site's prefered color scheme
   * @property {string} colorScheme.content - the value of the content attribute
   * @property {string} [colorScheme.media] - the value of the media attribute
   */
  colorScheme: {
    content: "dark light",
    // media: "(prefers-color-scheme: dark)",
  },

  /**
   * A quick and easy way to add addtional `<link>` tags to the site's `<head>`.
   * 
   * @optional
   * @property {object[]} headLinks - an array of objects, each representing a `<link>` tag.
   * @property {string} headLinks[].rel - the relationship of the link
   * @property {string} headLinks[].href - the URL of the link
   */
  headLinks: [
    { rel: "authorization_endpoint", href: "https://indieauth.com/auth" },
    { rel: "token_endpoint", href: "https://tokens.indieauth.com/token" },
    { rel: "webmention", href: "https://webmention.io/dwk.io/webmention" },
    { rel: "code-repository", href: "https://gitlab.com/dwk-io/dwk.io.git" },
    { rel: "content-repository", href: "https://gitlab.com/dwk-io/dwk.io.git" },
    { rel: "issues", href: "https://gitlab.com/dwk-io/dwk.io/-/issues" },
    { rel: "code-license", href: "https://opensource.org/license/isc-license-txt" },
    { rel: "content-license", href: "https://spdx.org/licenses/CC-BY-4.0.html" },
    { rel: "donation", href: "https://www.buymeacoffee.com/davidwkeith" },
    { rel: "root", href: "https://dwk.io" },
  ],

  /**
   * The default Open Graph image for social sharing.
   * This will be used if no specific Open Graph image is defined for a page.
   * 
   * @computed
   * @property {string} defaultOgImage - Path to the default Open Graph image.
   */
  get defaultOgImage() {
    return this.favicon.src;
  },

  /**
   * This gets mixed into the web-manifest for the site.
   * 
   * @see https://github.com/NJAldwin/eleventy-plugin-gen-favicons
   * @computed
   * @property {object} manifest - Web manifest options.
   * @property {string} manifest.appName - The name of the application.
   * @property {string} manifest.appDescription - A description of the application.
   * @property {string} manifest.lang - The language of the application.
   */
  get manifest() {
    return {
      appName: this.title,
      appDescription: this.description,
      lang: this.language,
    };
  },

  /// Header Web Component

  /***
  *  @property {string} logo.src - The source URL of the logo image.
  *  @property {string} logo.alt - The alternative text for the logo image.
  */
  logo: {
    src: "img/memoji.png",
    alt: "Memoji of DWK's head",
  },

  /// Footer Web Component

  /***
   * @property {object} social - a key-value object of social media links, where the key is the platform and the value is the URL.
   */
  social: {
    blog: "https://pulletsforever.com",
    bluesky: "https://bsky.app/profile/dwk.io",
    facebook: "https://www.facebook.com/davidwkeith",
    github: "https://github.com/davidwkeith",
    gitlab: "https://gitlab.com/davidwkeith",
    keybase: "https://keybase.io/dwkeith",
    linkedin: "https://www.linkedin.com/in/davidwkeith",
    mastodon: "https://xn--4t8h.dwk.io/@Dwk",
    reddit: "https://www.reddit.com/user/dwkeith",
    email: "mailto:me@dwk.io",
    // wikipedia: "https://meta.wikimedia.org/wiki/User:Davidwkeith"
  },
} satisfies SiteData