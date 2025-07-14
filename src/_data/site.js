import childProcess from 'node:child_process';

const latestGitCommitHash =
    childProcess
    .execSync('git rev-parse --short HEAD')
    .toString()
    .trim();

export default {
  /***
   * @required
   * @property {string} title - The title of the site, used in the `<title>` tag and as the main heading.
   *                            Also used in the JSON Feed.
   */
  title: "DWK's Cyber Home",

  /***
   * @required
   * @property {string} description - A short description of the site, used in the `<meta name="description">` tag.
   *                                  if the description is not set in front matter.
   *                                  This is also used in the JSON Feed.
   */
  description: "David W. Keith's personal website.",

  /**
   * The URL is used in the `<link rel="canonical">` tag, JSON feed, and many other
   * locations throughout the build. If you need to vary based on enviornment it would
   * be best to store the value in an ENV variable so it can change by build.
   * 
   * @required
   * @property {URL} the URL of the site.
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

  /***
   * A URI for security contacts used in `/.well-known/security.txt`.
   * 
   * @see https://www.rfc-editor.org/rfc/rfc9116#section-2.5.3
   * @optional
   * @property {string} securityContact - The contact URI for security issues
   */
  securityContact: "mailto:security@dwk.io",

/***
 * This uses [eleventy-plugin-gen-favicons](https://github.com/NJAldwin/eleventy-plugin-gen-favicons)
 * 
 */
  favicon: {
    src: "img/memoji.png",
    appleIconBgColor: "#000000",
    appleIconPadding: 20,
  },

  manifest: { 
    appName: "DWK's Cyber Home",
    appDescription: "David W. Keith's personal website.", 
    lang: "en",
  },

  /***
   * If present this will be used to generate the `<meta name="copyright">` tag.
   * 
   * @optional
   * @property {string} copyright - The copywrite string for the site
   */
  copyright: `CC-BY-4.0 David W. Keith ${(new Date()).getFullYear()}`,

  /**
   * The content rating of the site, used in the `<meta name="rating">` tag.
   * If omitted the rating tag won't be output and is equivelent to "general"
   * 
   * @see https://developers.google.com/search/docs/specialty/explicit/guidelines?udm=14#mark-specific-pages
   * @optional
   * @property {string} rating - either "general" or "adult"
   */
  rating: "general",
  
  /***
   * The language for the content of the site, used in the `<html lang="">` attribute.
   * 
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang
   * @property {string} language - a valid BCP 47 language string
   * @default "en"
   */
  language: "en",
  
  /**
   * Support for switching between dark and light mode in CSS.
   * 
   * TODO: support `media` attribute.
   * 
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/color-scheme
   * @property {string} colorScheme - a string that defines the site's prefered color scheme
   */
  colorScheme: "dark light",

  /**
   * A quick and easy way to add addtional `<link>` tags to the site's `<head>`.
   * 
   * TODO: support all attributes
   * 
   * @optional
   * @property {object} headLinks - a key-value object where the key is the relationship type and the value is the URI.
   */
  headLinks: {
    "code-repository": "https://gitlab.com/dwk-io/dwk.io.git",
    "content-repository": "https://gitlab.com/dwk-io/dwk.io.git",
    "issues": "https://gitlab.com/dwk-io/dwk.io/-/issues",
    "code-license": "https://opensource.org/license/isc-license-txt",
    "content-license": "https://spdx.org/licenses/CC-BY-4.0.html",
    // "webmention": "https://webmention.io/dwk.io/webmention",
    // http://www.hixie.ch/specs/pingback/pingback
    // "pingback": "https://webmention.io/dwk.io/xmlrpc",
    "donation": "https://www.buymeacoffee.com/davidwkeith",
    "root": "https://dwk.io",
  },

  /**
   * used in the build report for `humans.txt`
   * 
   * @computed
   * @property {string} The git hash of the current HEAD
   */
  hash: childProcess
        .execSync('git rev-parse --short HEAD')
        .toString()
        .trim(),

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
}