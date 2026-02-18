/**
 * Global Privacy Control (GPC) declaration.
 * Indicates this site respects the GPC opt-out signal.
 *
 * @see https://www.w3.org/TR/gpc/
 */
export default class GPC {

  data() {
    return {
      permalink: "/.well-known/gpc.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render() {
    return JSON.stringify({
      gpc: true,
      lastUpdate: new Date().toISOString().slice(0, 10),
    }, null, 2);
  }
}
