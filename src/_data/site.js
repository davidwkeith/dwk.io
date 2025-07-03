export default {
  /***
   *  @property {string} title - The title of the site, used in the `<title>` tag and as the main heading.
   */
  title: "DWK's Cyber Home",

  /***
  *  @property {string} logo.src - The source URL of the logo image.
  *  @property {string} logo.alt - The alternative text for the logo image.
  */
  logo: {
    src: "img/memoji.png",
    alt: "Memoji of DWK's head",
  },
  url: "https://dwk.io",
  favicon: "img/memoji.png",
  license: "https://spdx.org/licenses/CC-BY-4.0.html",
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
    "webmention": "https://webmention.io/dwk.io/webmention",
    // http://www.hixie.ch/specs/pingback/pingback
    "pingback": "https://webmention.io/dwk.io/xmlrpc",
    "donation": "https://www.buymeacoffee.com/davidwkeith",
    "root": "https://dwk.io",
  },
  /***
   *  @property {string} ogType - The Open Graph type of the site, typically "website" or "article".
   **/
  ogType: "website",
}