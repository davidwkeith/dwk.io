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

  /***
   * @required
   * @property {string} the URL of the site, used in the `<link rel="canonical">` tag and JSON Feed.
   */
  url: "https://dwk.io",

  /***
   * If present this will be used to generate the `<meta property="fediverse:creator">` tag.
   * 
   * @optional
   * @property {string} fediverse_creator: the handle of the creator on the Fediverse.
   */
  fediverseCreator: "@Dwk@xn--4t8h.dwk.io",

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
   * If present this will be used to generate the `<meta name="description">` tag.
   * 
   * @property {string} copyright - The copywrite string for the site, used in the 
   *                                `<meta name="copyright">` tag.
   */
  copyright: `CC-BY-4.0 David W. Keith ${(new Date()).getFullYear()}`,

  /***
   * @property {string} rating - The content rating of the site, used in the `<meta name="rating">` tag.
   *                             This should be a valid content rating, either "general" or "adult"
   */
  rating: "general",
  
  /***
   * @property {string} language - The primary language of the site, used in the `<html lang="">` attribute.
   *                                This should be a valid BCP 47 language tag.
   * @default "en"
   */
  language: "en",
  
  colorScheme: "dark light",
  /***
   * @property {object} headLinks - a key-value object of links to be included in the `<head>` section of
   *                                the HTML, where the key is the relationship type and the value is the URL.
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